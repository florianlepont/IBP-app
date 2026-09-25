import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { LRUCache } from "lru-cache"
import { appConfigOf } from "../config/app-config"
import {
  buildParcelKey,
  normalizeParcelPartToDigits,
  normalizeParcelSection,
} from "./surveys-normalize.utils"

type JsonRecord = Record<string, unknown>

/**
 * A cadastral parcel returned by the IGN WFS. It carries no study fields on purpose: the
 * tile cache holds these, and study status is always computed per request from the database
 * (D-08, T-01.7-38).
 */
export type WfsParcelFeature = {
  parcel_id: string
  commune_code: string
  section: string
  number: string
  geometry: JsonRecord
}

export type LngLatBbox = { minLng: number; minLat: number; maxLng: number; maxLat: number }

/** A cached feature, with the geometry bounds used to filter it to a request bbox. */
type CachedWfsFeature = WfsParcelFeature & { bounds: LngLatBbox }

type TileCoord = { x: number; y: number }

// D-08 / RESEARCH Pattern 7 and assumption A2. The mobile only asks for parcel statuses at
// zoom >= 15, so a z15 tile (about 1.2 km at 46°N) covers a typical screen in a few tiles.
export const WFS_TILE_ZOOM = 15
// A request whose bbox spans more tiles than this skips IGN and uses the database path, so an
// attacker-sized bbox cannot fan out into thousands of outbound calls (T-01.7-36).
export const WFS_MAX_TILES_PER_REQUEST = 16
// At most this many tile requests are in flight for one call (D-08).
export const WFS_TILE_CONCURRENCY = 4
// Cache bounds (D-08, A2; tune after deploy): 256 tiles, 64 MB of serialised features, 24 h
// TTL. The size bound keeps the cache well inside the 768 MB container (T-01.7-37).
export const WFS_TILE_CACHE_MAX_ENTRIES = 256
export const WFS_TILE_CACHE_MAX_BYTES = 64 * 1024 * 1024
export const WFS_TILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
// Web Mercator latitude limit: there are no tiles beyond it.
const WEB_MERCATOR_MAX_LAT = 85.0511287798066

export type CadastreResolvedParcel = {
  parcel_id: string
  commune_code: string
  section: string
  number: string
  centroid: { lat: number; lng: number }
  geometry?: JsonRecord
  source: string
}

@Injectable()
export class CadastreProviderService {
  private readonly logger = new Logger(CadastreProviderService.name)
  private readonly provider: "synthetic" | "ign"
  private readonly allowFallback: boolean
  private readonly timeoutMs: number
  private readonly ignReverseUrl: string
  private readonly ignApiCartoParcelUrl: string
  private readonly ignWfsUrl: string
  private readonly ignWfsTypeName: string
  private readonly ignWfsCount: number
  // Parsed features per z15 tile. An empty tile is a valid answer and is cached; a failed
  // tile is not. Study status is never stored here (D-08).
  private readonly wfsTileCache = new LRUCache<string, CachedWfsFeature[]>({
    max: WFS_TILE_CACHE_MAX_ENTRIES,
    maxSize: WFS_TILE_CACHE_MAX_BYTES,
    sizeCalculation: (features) => Math.max(1, JSON.stringify(features).length),
    ttl: WFS_TILE_CACHE_TTL_MS,
  })

  constructor(config: ConfigService) {
    // D-01: parsing and defaults live in app-config.ts (provider trimmed and lowercased,
    // fallback on unless "false", positive integer timeout defaulting to 2500 ms).
    const cadastre = appConfigOf(config).cadastre
    this.provider = cadastre.provider === "ign" ? "ign" : "synthetic"
    this.allowFallback = cadastre.allowFallback
    this.timeoutMs = cadastre.timeoutMs
    this.ignReverseUrl = cadastre.reverseUrl
    this.ignApiCartoParcelUrl = cadastre.apiCartoParcelUrl
    // The WFS count cap (3000) and the defaults also live in app-config.ts.
    this.ignWfsUrl = cadastre.wfsUrl
    this.ignWfsTypeName = cadastre.wfsTypename
    this.ignWfsCount = cadastre.wfsCount
  }

  /** True when public parcel statuses should come from the IGN WFS (CADASTRE_PROVIDER=ign). */
  get wfsEnabled(): boolean {
    return this.provider === "ign"
  }

  /**
   * Parcels intersecting `bbox`, from the IGN WFS through the per-tile cache (D-08).
   *
   * Returns null, so that the caller uses its database path, when the provider is not IGN,
   * when the bbox spans more than WFS_MAX_TILES_PER_REQUEST z15 tiles (no call is made), or
   * when a tile request fails (logged as a warning). Features are de-duplicated across tiles.
   */
  async fetchParcelFeaturesInBbox(bbox: LngLatBbox): Promise<WfsParcelFeature[] | null> {
    if (!this.wfsEnabled) {
      return null
    }

    const tiles = this.tilesForBbox(bbox)
    if (!tiles) {
      return null
    }

    const tileFeatures = new Map<string, CachedWfsFeature[]>()
    const missing: TileCoord[] = []
    for (const tile of tiles) {
      const key = this.tileKey(tile)
      const cached = this.wfsTileCache.get(key)
      if (cached) {
        tileFeatures.set(key, cached)
      } else {
        missing.push(tile)
      }
    }

    // A small worker pool: WFS_TILE_CONCURRENCY loops pull the next missing tile. After the
    // first failure no new tile is started; tiles that succeeded are still cached.
    const run: { nextIndex: number; failures: unknown[] } = { nextIndex: 0, failures: [] }
    const worker = async (): Promise<void> => {
      while (run.failures.length === 0 && run.nextIndex < missing.length) {
        const tile = missing[run.nextIndex]
        run.nextIndex += 1
        try {
          const features = await this.fetchWfsTile(tile)
          const key = this.tileKey(tile)
          this.wfsTileCache.set(key, features)
          tileFeatures.set(key, features)
        } catch (error) {
          run.failures.push(error)
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(WFS_TILE_CONCURRENCY, missing.length) }, () => worker()),
    )

    if (run.failures.length > 0) {
      const error = run.failures[0]
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`IGN WFS failed: ${message}`)
      return null
    }

    const output: WfsParcelFeature[] = []
    const seen = new Set<string>()
    for (const tile of tiles) {
      for (const feature of tileFeatures.get(this.tileKey(tile)) ?? []) {
        const key = buildParcelKey(feature.commune_code, feature.section, feature.number)
        if (seen.has(key) || !this.boundsIntersect(feature.bounds, bbox)) {
          continue
        }
        seen.add(key)
        output.push({
          parcel_id: feature.parcel_id,
          commune_code: feature.commune_code,
          section: feature.section,
          number: feature.number,
          geometry: feature.geometry,
        })
      }
    }
    return output
  }

  async resolveFromPoint(lat: number, lng: number): Promise<CadastreResolvedParcel | null> {
    if (this.provider === "ign") {
      try {
        const ignResult = await this.resolveFromIgn(lat, lng)
        if (ignResult) {
          return ignResult
        }
        this.logger.warn(
          "IGN cadastre resolver returned no parcel for coordinates, switching to fallback strategy",
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`IGN cadastre resolver failed: ${message}`)
      }

      if (!this.allowFallback) {
        return null
      }
    }

    return this.resolveSynthetic(lat, lng)
  }

  private resolveSynthetic(lat: number, lng: number): CadastreResolvedParcel {
    const latKey = Math.round((lat + 90) * 10000)
    const lngKey = Math.round((lng + 180) * 10000)
    const communeCode = String(Math.abs((latKey * 13 + lngKey * 7) % 100000)).padStart(5, "0")
    const section = `${String.fromCharCode(65 + (Math.abs(latKey) % 26))}${String.fromCharCode(65 + (Math.abs(lngKey) % 26))}`
    const number = String(Math.abs((latKey * 31 + lngKey * 17) % 10000)).padStart(4, "0")

    return {
      parcel_id: `${communeCode}${section}${number}`,
      commune_code: communeCode,
      section,
      number,
      centroid: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      },
      geometry: {},
      source: "synthetic_v1",
    }
  }

  private async resolveFromIgn(lat: number, lng: number): Promise<CadastreResolvedParcel | null> {
    const url = new URL(this.ignReverseUrl)
    url.searchParams.set("index", "parcel")
    url.searchParams.set("limit", "1")
    url.searchParams.set("lat", String(lat))
    url.searchParams.set("lon", String(lng))

    const payload = await this.fetchJson(url)
    const feature = this.firstFeature(payload)
    if (!feature) {
      return null
    }

    const properties = this.asRecord(feature.properties)
    const geometry = this.asRecord(feature.geometry)

    const rawParcelId = this.readFirstString(properties, [
      "id",
      "parcel_id",
      "cadastre_id",
      "numero_parcelle",
    ])
    const rawCommune = this.readFirstString(properties, ["citycode", "code_insee", "commune_code"])
    const rawDepartmentCode = this.readFirstString(properties, ["departmentcode"])
    const rawMunicipalityCode = this.readFirstString(properties, ["municipalitycode"])
    const rawSection = this.readFirstString(properties, ["section", "section_prefix"])
    const rawNumber = this.readFirstString(properties, ["number", "numero"])

    const communeCodeFromDepartmentMunicipality = this.buildCommuneCode(
      rawDepartmentCode,
      rawMunicipalityCode,
    )
    let communeCode = this.normalizeCommuneCode(rawCommune) ?? communeCodeFromDepartmentMunicipality
    let section = this.normalizeSection(rawSection)
    let number = this.normalizeNumber(rawNumber)
    let parcelId = this.normalizeParcelId(rawParcelId)

    if ((!communeCode || !section || !number) && parcelId) {
      const parsed = this.parseParcelIdentifier(parcelId)
      communeCode = communeCode ?? parsed?.commune_code ?? null
      section = section ?? parsed?.section ?? null
      number = number ?? parsed?.number ?? null
    }

    if (!parcelId && communeCode && section && number) {
      parcelId = `${communeCode}${section}${number}`
    }

    if (!parcelId || !communeCode || !section || !number) {
      return null
    }

    const apiCartoGeometry = await this.resolveGeometryFromApiCarto(communeCode, section, number)

    return {
      parcel_id: parcelId,
      commune_code: communeCode,
      section,
      number,
      centroid: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      },
      geometry: apiCartoGeometry ?? geometry,
      source: "ign_geocodage",
    }
  }

  private async resolveGeometryFromApiCarto(
    communeCode: string,
    section: string,
    number: string,
  ): Promise<JsonRecord | undefined> {
    const url = new URL(this.ignApiCartoParcelUrl)
    url.searchParams.set("code_insee", communeCode)
    url.searchParams.set("section", section)
    url.searchParams.set("numero", number)
    url.searchParams.set("source_ign", "PCI")
    url.searchParams.set("_limit", "1")

    try {
      const payload = await this.fetchJson(url)
      const feature = this.firstFeature(payload)
      if (!feature) {
        return undefined
      }

      const geometry = this.asRecord(feature.geometry)
      return Object.keys(geometry).length > 0 ? geometry : undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`IGN API Carto parcel geometry lookup failed: ${message}`)
      return undefined
    }
  }

  private async fetchWfsTile(tile: TileCoord): Promise<CachedWfsFeature[]> {
    const bounds = this.tileBounds(tile)
    const url = new URL(this.ignWfsUrl)
    url.searchParams.set("service", "WFS")
    url.searchParams.set("version", "2.0.0")
    url.searchParams.set("request", "GetFeature")
    url.searchParams.set("typeNames", this.ignWfsTypeName)
    url.searchParams.set(
      "bbox",
      `${bounds.minLng.toFixed(6)},${bounds.minLat.toFixed(6)},${bounds.maxLng.toFixed(6)},${bounds.maxLat.toFixed(6)},EPSG:4326`,
    )
    url.searchParams.set("outputFormat", "application/json")
    url.searchParams.set("count", String(this.ignWfsCount))

    const payload = this.asRecord(await this.fetchJson(url))
    const featuresRaw: unknown[] = Array.isArray(payload.features) ? payload.features : []
    return this.parseWfsFeatures(featuresRaw)
  }

  /** Polygon features with a complete commune/section/number (moved from SurveysService). */
  private parseWfsFeatures(featuresRaw: unknown[]): CachedWfsFeature[] {
    const features: CachedWfsFeature[] = []
    const seen = new Set<string>()

    for (const featureRaw of featuresRaw) {
      const feature = this.asRecord(featureRaw)
      const properties = this.asRecord(feature.properties)
      const geometry = this.asRecord(feature.geometry)
      const geometryType = typeof geometry.type === "string" ? geometry.type : ""
      if (
        (geometryType !== "Polygon" && geometryType !== "MultiPolygon") ||
        !Array.isArray(geometry.coordinates)
      ) {
        continue
      }

      const communeCode = normalizeParcelPartToDigits(properties.code_insee, 5)
      const section = normalizeParcelSection(properties.section)
      const number = normalizeParcelPartToDigits(properties.numero, 4)
      if (!communeCode || !section || !number) {
        continue
      }

      const parcelKey = buildParcelKey(communeCode, section, number)
      const bounds = this.geometryBounds(geometry.coordinates)
      if (seen.has(parcelKey) || !bounds) {
        continue
      }
      seen.add(parcelKey)

      const idu = typeof properties.idu === "string" ? properties.idu.trim().toUpperCase() : ""
      features.push({
        parcel_id: idu.length > 0 ? idu : `${communeCode}${section}${number}`,
        commune_code: communeCode,
        section,
        number,
        geometry,
        bounds,
      })
    }

    return features
  }

  /** The z15 tiles covering `bbox`, or null when there are more than the per-request cap. */
  private tilesForBbox(bbox: LngLatBbox): TileCoord[] | null {
    const minX = this.lngToTileX(bbox.minLng)
    const maxX = this.lngToTileX(bbox.maxLng)
    // Tile rows grow southwards, so the northern edge gives the smallest y.
    const minY = this.latToTileY(bbox.maxLat)
    const maxY = this.latToTileY(bbox.minLat)
    if ((maxX - minX + 1) * (maxY - minY + 1) > WFS_MAX_TILES_PER_REQUEST) {
      return null
    }

    const tiles: TileCoord[] = []
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        tiles.push({ x, y })
      }
    }
    return tiles
  }

  private tileKey(tile: TileCoord): string {
    return `${WFS_TILE_ZOOM}/${tile.x}/${tile.y}`
  }

  // Web Mercator XYZ: x = floor((lng + 180) / 360 * 2^z).
  private lngToTileX(lng: number): number {
    const n = 2 ** WFS_TILE_ZOOM
    return Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)))
  }

  // Web Mercator XYZ: y = floor((1 - ln(tan(phi) + sec(phi)) / pi) / 2 * 2^z).
  private latToTileY(lat: number): number {
    const n = 2 ** WFS_TILE_ZOOM
    const clamped = Math.min(WEB_MERCATOR_MAX_LAT, Math.max(-WEB_MERCATOR_MAX_LAT, lat))
    const phi = (clamped * Math.PI) / 180
    const y = Math.floor(((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n)
    return Math.min(n - 1, Math.max(0, y))
  }

  /** Inverse of the tile maths: the lng/lat bounds of one tile. */
  private tileBounds(tile: TileCoord): LngLatBbox {
    const n = 2 ** WFS_TILE_ZOOM
    const lngOf = (x: number): number => (x / n) * 360 - 180
    const latOf = (y: number): number =>
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
    return {
      minLng: lngOf(tile.x),
      minLat: latOf(tile.y + 1),
      maxLng: lngOf(tile.x + 1),
      maxLat: latOf(tile.y),
    }
  }

  /** Bounding box of a Polygon or MultiPolygon coordinate tree, or null without any point. */
  private geometryBounds(coordinates: unknown): LngLatBbox | null {
    const bounds = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity }
    const visit = (node: unknown): void => {
      if (!Array.isArray(node)) {
        return
      }
      const [lng, lat] = node
      if (typeof lng === "number" && typeof lat === "number") {
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          bounds.minLng = Math.min(bounds.minLng, lng)
          bounds.minLat = Math.min(bounds.minLat, lat)
          bounds.maxLng = Math.max(bounds.maxLng, lng)
          bounds.maxLat = Math.max(bounds.maxLat, lat)
        }
        return
      }
      for (const child of node) {
        visit(child)
      }
    }
    visit(coordinates)
    return Number.isFinite(bounds.minLng) ? bounds : null
  }

  private boundsIntersect(a: LngLatBbox, b: LngLatBbox): boolean {
    return (
      a.minLng <= b.maxLng && a.maxLng >= b.minLng && a.minLat <= b.maxLat && a.maxLat >= b.minLat
    )
  }

  /**
   * The single IGN HTTP call (D-08). `AbortSignal.timeout` covers the whole exchange: the
   * body is awaited before returning, so a server that sends headers and then stalls is
   * aborted too (the previous version cleared its timer as soon as the headers arrived).
   */
  private async fetchJson(url: URL): Promise<unknown> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`cadastre provider returned HTTP ${response.status}`)
    }

    return await response.json()
  }

  private firstFeature(payload: unknown): { properties: unknown; geometry: unknown } | null {
    const root = this.asRecord(payload)
    const featuresRaw = root.features
    if (!Array.isArray(featuresRaw) || featuresRaw.length === 0) {
      return null
    }

    const first = this.asRecord(featuresRaw[0])
    return {
      properties: first.properties,
      geometry: first.geometry,
    }
  }

  private asRecord(value: unknown): JsonRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {}
    }
    return value as JsonRecord
  }

  private readFirstString(source: JsonRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key]
      if (typeof value !== "string") {
        continue
      }
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
    return null
  }

  private normalizeParcelId(value: string | null): string | null {
    if (!value) {
      return null
    }
    const normalized = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase()
    return normalized.length > 0 ? normalized : null
  }

  private normalizeCommuneCode(value: string | null): string | null {
    if (!value) {
      return null
    }
    const normalized = value.replace(/[^0-9]/g, "")
    if (normalized.length === 0) {
      return null
    }
    return normalized.padStart(5, "0").slice(-5)
  }

  private buildCommuneCode(
    departmentCodeRaw: string | null,
    municipalityCodeRaw: string | null,
  ): string | null {
    if (!departmentCodeRaw || !municipalityCodeRaw) {
      return null
    }
    const departmentCode = departmentCodeRaw.replace(/[^0-9]/g, "")
    const municipalityCode = municipalityCodeRaw.replace(/[^0-9]/g, "")
    if (departmentCode.length < 2 || municipalityCode.length === 0) {
      return null
    }

    const normalizedDepartment =
      departmentCode.length >= 3 ? departmentCode.slice(-3) : departmentCode.slice(-2)
    const normalizedMunicipality = municipalityCode.padStart(3, "0").slice(-3)
    return `${normalizedDepartment}${normalizedMunicipality}`
  }

  private normalizeSection(value: string | null): string | null {
    if (!value) {
      return null
    }
    const normalized = value.replace(/[^A-Za-z]/g, "").toUpperCase()
    if (normalized.length === 0) {
      return null
    }
    return normalized.slice(0, 3)
  }

  private normalizeNumber(value: string | null): string | null {
    if (!value) {
      return null
    }
    const normalized = value.replace(/[^0-9]/g, "")
    if (normalized.length === 0) {
      return null
    }
    return normalized.padStart(4, "0").slice(-4)
  }

  private parseParcelIdentifier(
    parcelId: string,
  ): { commune_code: string; section: string; number: string } | null {
    const normalized = parcelId.trim().toUpperCase()
    const match = /^(\d{5})([A-Z]{1,3})(\d{1,4})$/.exec(normalized)
    if (!match) {
      return null
    }

    return {
      commune_code: match[1],
      section: match[2].slice(0, 3),
      number: match[3].padStart(4, "0").slice(-4),
    }
  }
}
