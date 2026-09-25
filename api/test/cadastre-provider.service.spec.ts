import { Logger } from "@nestjs/common"
import * as http from "http"
import { AddressInfo, Socket } from "net"
import {
  CadastreProviderService,
  LngLatBbox,
  WfsParcelFeature,
  WFS_MAX_TILES_PER_REQUEST,
  WFS_TILE_ZOOM,
} from "../src/surveys/cadastre-provider.service"
import { buildTestConfigService } from "./config-helper"

// Independent Web Mercator helpers for the tile assertions (z15, as in the service).
const TILES = 2 ** WFS_TILE_ZOOM
const tileX = (lng: number) => Math.floor(((lng + 180) / 360) * TILES)
const tileY = (lat: number) => {
  const phi = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * TILES)
}
const tileLng = (x: number) => (x / TILES) * 360 - 180
const tileLat = (y: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / TILES))) * 180) / Math.PI
const tileBounds = (x: number, y: number): LngLatBbox => ({
  minLng: tileLng(x),
  minLat: tileLat(y + 1),
  maxLng: tileLng(x + 1),
  maxLat: tileLat(y),
})
/** A bbox strictly inside the tiles [x0..x1] x [y0..y1] (10 % margin inside the outer tiles). */
const innerBbox = (x0: number, y0: number, x1 = x0, y1 = y0): LngLatBbox => {
  const nw = tileBounds(x0, y0)
  const se = tileBounds(x1, y1)
  const dLng = (nw.maxLng - nw.minLng) / 10
  const dLat = (nw.maxLat - nw.minLat) / 10
  return {
    minLng: nw.minLng + dLng,
    maxLng: se.maxLng - dLng,
    minLat: se.minLat + dLat,
    maxLat: nw.maxLat - dLat,
  }
}
const PARIS_X = tileX(2.35)
const PARIS_Y = tileY(48.85)

function squareFeature(
  props: { code_insee: string; section: string; numero: string; idu?: string },
  center: { lng: number; lat: number },
  half = 0.0005,
) {
  return {
    type: "Feature",
    properties: props,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [center.lng - half, center.lat - half],
          [center.lng + half, center.lat - half],
          [center.lng + half, center.lat + half],
          [center.lng - half, center.lat - half],
        ],
      ],
    },
  }
}

const okJson = (payload: unknown): MockResponse => ({ ok: true, json: async () => payload })

function buildService(overrides: Record<string, string | undefined>): CadastreProviderService {
  return new CadastreProviderService(buildTestConfigService(overrides))
}

type MockResponse = {
  ok: boolean
  status?: number
  json: () => Promise<unknown>
}

describe("CadastreProviderService", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it("returns a deterministic synthetic parcel when synthetic mode is active", async () => {
    const service = buildService({ CADASTRE_PROVIDER: "synthetic" })

    const parcel = await service.resolveFromPoint(48.6431234, 1.8299876)

    expect(parcel).toEqual({
      parcel_id: `${parcel?.commune_code}${parcel?.section}${parcel?.number}`,
      commune_code: parcel?.commune_code,
      section: parcel?.section,
      number: parcel?.number,
      centroid: { lat: 48.643123, lng: 1.829988 },
      geometry: {},
      source: "synthetic_v1",
    })
  })

  it("resolves an IGN parcel and enriches it with API Carto geometry", async () => {
    const overrides = { CADASTRE_PROVIDER: "ign" }
    const fetchMock = jest
      .fn<Promise<MockResponse>, [URL, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                citycode: "75104",
                section: "AE",
                number: "3",
              },
              geometry: { type: "Point", coordinates: [2.3522, 48.8566] },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [2.35, 48.85],
                    [2.36, 48.85],
                    [2.36, 48.86],
                    [2.35, 48.85],
                  ],
                ],
              },
            },
          ],
        }),
      })
    global.fetch = fetchMock as unknown as typeof global.fetch

    const service = buildService(overrides)
    const parcel = await service.resolveFromPoint(48.8566, 2.3522)

    expect(parcel).toEqual({
      parcel_id: "75104AE0003",
      commune_code: "75104",
      section: "AE",
      number: "0003",
      centroid: { lat: 48.8566, lng: 2.3522 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2.35, 48.85],
            [2.36, 48.85],
            [2.36, 48.86],
            [2.35, 48.85],
          ],
        ],
      },
      source: "ign_geocodage",
    })

    const reverseUrl = fetchMock.mock.calls[0][0]
    expect(reverseUrl.searchParams.get("index")).toBe("parcel")
    expect(reverseUrl.searchParams.get("lat")).toBe("48.8566")
    expect(reverseUrl.searchParams.get("lon")).toBe("2.3522")

    const apiCartoUrl = fetchMock.mock.calls[1][0]
    expect(apiCartoUrl.searchParams.get("code_insee")).toBe("75104")
    expect(apiCartoUrl.searchParams.get("section")).toBe("AE")
    expect(apiCartoUrl.searchParams.get("numero")).toBe("0003")
  })

  it("falls back to a synthetic parcel when IGN returns no feature and fallback is enabled", async () => {
    const overrides = { CADASTRE_PROVIDER: "ign", CADASTRE_PROVIDER_ALLOW_FALLBACK: "true" }
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    } satisfies MockResponse) as typeof global.fetch

    const service = buildService(overrides)
    const parcel = await service.resolveFromPoint(43.6, 1.44)

    expect(parcel?.source).toBe("synthetic_v1")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("switching to fallback strategy"))
  })

  it("returns null when IGN fails and fallback is disabled", async () => {
    const overrides = { CADASTRE_PROVIDER: "ign", CADASTRE_PROVIDER_ALLOW_FALLBACK: "false" }
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as typeof global.fetch

    const service = buildService(overrides)
    await expect(service.resolveFromPoint(43.6, 1.44)).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("network down"))
  })

  it("keeps reverse geometry when API Carto lookup fails", async () => {
    const overrides = { CADASTRE_PROVIDER: "ign" }
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const fetchMock = jest
      .fn<Promise<MockResponse>, [URL, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                departmentcode: "75",
                municipalitycode: "104",
                section: "AE",
                number: "3",
              },
              geometry: { type: "Polygon", coordinates: [[[1, 2]]] },
            },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error("carto unavailable"))
    global.fetch = fetchMock as unknown as typeof global.fetch

    const service = buildService(overrides)
    const parcel = await service.resolveFromPoint(48.8566, 2.3522)

    expect(parcel?.geometry).toEqual({ type: "Polygon", coordinates: [[[1, 2]]] })
    expect(parcel?.parcel_id).toBe("75104AE0003")
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("IGN API Carto parcel geometry lookup failed"),
    )
  })

  it("aborts the IGN request after CADASTRE_PROVIDER_TIMEOUT_MS", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    global.fetch = jest.fn(
      (_url: URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted by timeout")))
        }),
    ) as unknown as typeof global.fetch

    const service = buildService({
      CADASTRE_PROVIDER: "ign",
      CADASTRE_PROVIDER_ALLOW_FALLBACK: "false",
      CADASTRE_PROVIDER_TIMEOUT_MS: "20",
    })
    const startedAt = Date.now()

    await expect(service.resolveFromPoint(43.6, 1.44)).resolves.toBeNull()
    expect(Date.now() - startedAt).toBeLessThan(2000)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("aborted by timeout"))
  })
})

describe("CadastreProviderService IGN WFS client (D-08)", () => {
  const originalFetch = global.fetch
  const IGN = { CADASTRE_PROVIDER: "ign", CADASTRE_IGN_WFS_URL: "https://wfs.example.test/ows" }

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  function mockFetch(respond: (url: URL) => Promise<MockResponse> | MockResponse) {
    const fetchMock = jest.fn(async (url: URL, _init?: RequestInit) => respond(url))
    global.fetch = fetchMock as unknown as typeof global.fetch
    return fetchMock
  }

  it("returns null without calling IGN when the provider is synthetic", async () => {
    const fetchMock = mockFetch(() => okJson({ features: [] }))
    const service = buildService({ CADASTRE_PROVIDER: "synthetic" })

    expect(service.wfsEnabled).toBe(false)
    await expect(service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))).resolves.toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches one z15 tile with the tile bounds and serves later calls from the cache", async () => {
    const tile = tileBounds(PARIS_X, PARIS_Y)
    const center = { lng: (tile.minLng + tile.maxLng) / 2, lat: (tile.minLat + tile.maxLat) / 2 }
    const polygon = squareFeature({ code_insee: "75104", section: "ae", numero: "3" }, center)
    const fetchMock = mockFetch(() =>
      okJson({
        features: [
          { ...polygon, properties: { ...polygon.properties, idu: "75104000ae0003" } },
          // Not a polygon: skipped, as before the merge.
          {
            properties: { code_insee: "75104", section: "AE", numero: "4" },
            geometry: { type: "Point", coordinates: [2.35, 48.85] },
          },
        ],
      }),
    )
    const service = buildService({ ...IGN, CADASTRE_IGN_WFS_COUNT: "700" })

    const features = await service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))

    expect(features).toEqual<WfsParcelFeature[]>([
      {
        parcel_id: "75104000AE0003",
        commune_code: "75104",
        section: "AE",
        number: "0003",
        geometry: polygon.geometry,
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url.origin + url.pathname).toBe("https://wfs.example.test/ows")
    expect(url.searchParams.get("service")).toBe("WFS")
    expect(url.searchParams.get("version")).toBe("2.0.0")
    expect(url.searchParams.get("request")).toBe("GetFeature")
    expect(url.searchParams.get("typeNames")).toBe("CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle")
    expect(url.searchParams.get("outputFormat")).toBe("application/json")
    expect(url.searchParams.get("count")).toBe("700")
    expect(url.searchParams.get("bbox")).toBe(
      `${tile.minLng.toFixed(6)},${tile.minLat.toFixed(6)},${tile.maxLng.toFixed(6)},${tile.maxLat.toFixed(6)},EPSG:4326`,
    )
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)

    // The same bbox, then a smaller bbox inside the same tile: no new call.
    await service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))
    const sub = innerBbox(PARIS_X, PARIS_Y)
    const subFeatures = await service.fetchParcelFeaturesInBbox({
      ...sub,
      maxLng: (sub.minLng + sub.maxLng) / 2 + 0.0001,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(subFeatures?.map((feature) => feature.parcel_id)).toEqual(["75104000AE0003"])
  })

  it("caches an empty tile as a valid answer", async () => {
    const fetchMock = mockFetch(() => okJson({ features: [] }))
    const service = buildService(IGN)

    await expect(service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))).resolves.toEqual(
      [],
    )
    await expect(service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))).resolves.toEqual(
      [],
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it(`skips IGN when the bbox spans more than ${WFS_MAX_TILES_PER_REQUEST} tiles`, async () => {
    const fetchMock = mockFetch(() => okJson({ features: [] }))
    const service = buildService(IGN)

    // 17 tiles (17 x 1), a 5 x 4 block, and a country-sized bbox.
    await expect(
      service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y, PARIS_X + 16, PARIS_Y)),
    ).resolves.toBeNull()
    await expect(
      service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y, PARIS_X + 4, PARIS_Y + 3)),
    ).resolves.toBeNull()
    await expect(
      service.fetchParcelFeaturesInBbox({ minLng: -5, minLat: 42, maxLng: 8, maxLat: 51 }),
    ).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    // Exactly 16 tiles (4 x 4) is still served by IGN, one call per tile.
    await expect(
      service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y, PARIS_X + 3, PARIS_Y + 3)),
    ).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(16)
  })

  it("fetches 6 tiles with at most 4 requests in flight", async () => {
    let inFlight = 0
    let maxInFlight = 0
    const releases: Array<() => void> = []
    const fetchMock = mockFetch(
      () =>
        new Promise<MockResponse>((resolve) => {
          inFlight += 1
          maxInFlight = Math.max(maxInFlight, inFlight)
          releases.push(() => {
            inFlight -= 1
            resolve(okJson({ features: [] }))
          })
        }),
    )
    const service = buildService(IGN)

    const pending = service.fetchParcelFeaturesInBbox(
      innerBbox(PARIS_X, PARIS_Y, PARIS_X + 2, PARIS_Y + 1),
    )
    // Release the deferred responses one at a time until all six tiles were answered.
    let released = 0
    for (let turn = 0; turn < 100 && released < 6; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve))
      expect(inFlight).toBeLessThanOrEqual(4)
      const release = releases[released]
      if (release) {
        release()
        released += 1
      }
    }

    await expect(pending).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(maxInFlight).toBe(4)
  })

  it("de-duplicates features across tiles and keeps only those intersecting the bbox", async () => {
    const left = tileBounds(PARIS_X, PARIS_Y)
    const right = tileBounds(PARIS_X + 1, PARIS_Y)
    const midLat = (left.minLat + left.maxLat) / 2
    // Straddles the shared edge, so both tiles return it.
    const shared = squareFeature(
      { code_insee: "75104", section: "AB", numero: "1" },
      { lng: left.maxLng, lat: midLat },
    )
    // Inside the left tile, but west of the request bbox.
    const outside = squareFeature(
      { code_insee: "75104", section: "AB", numero: "2" },
      { lng: left.minLng + 0.0006, lat: midLat },
    )
    const inRight = squareFeature(
      { code_insee: "75105", section: "CD", numero: "7" },
      { lng: (right.minLng + right.maxLng) / 2, lat: midLat },
    )
    const edgeLng = tileLng(PARIS_X + 1) - 0.0001
    mockFetch((url) => {
      const minLng = Number(url.searchParams.get("bbox")?.split(",")[0])
      return okJson({ features: minLng < edgeLng ? [shared, outside] : [shared, inRight] })
    })
    const service = buildService(IGN)

    const features = await service.fetchParcelFeaturesInBbox({
      minLng: (left.minLng + left.maxLng) / 2,
      minLat: left.minLat + 0.001,
      maxLng: (right.minLng + right.maxLng) / 2,
      maxLat: left.maxLat - 0.001,
    })

    expect(features?.map((feature) => feature.parcel_id)).toEqual(["75104AB0001", "75105CD0007"])
  })

  it.each([
    [
      "an HTTP 500",
      () => Promise.resolve<MockResponse>({ ok: false, status: 500, json: async () => ({}) }),
    ],
    ["a thrown fetch", () => Promise.reject(new Error("socket hang up"))],
  ])("returns null on %s, warns once and does not cache the tile", async (_label, fail) => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const fetchMock = mockFetch(fail)
    const service = buildService(IGN)

    await expect(service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("IGN WFS failed"))

    fetchMock.mockImplementation(async () => okJson({ features: [] }))
    await expect(service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y))).resolves.toEqual(
      [],
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  describe("against a server that sends headers and never ends the body", () => {
    let server: http.Server
    let baseUrl = ""
    const sockets = new Set<Socket>()

    beforeAll(async () => {
      server = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.write('{"features": [')
      })
      server.on("connection", (socket) => {
        sockets.add(socket)
        socket.on("close", () => sockets.delete(socket))
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterAll(async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    it("aborts the WFS body read after CADASTRE_PROVIDER_TIMEOUT_MS", async () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
      const service = buildService({
        ...IGN,
        CADASTRE_IGN_WFS_URL: `${baseUrl}/ows`,
        CADASTRE_PROVIDER_TIMEOUT_MS: "200",
      })
      const startedAt = Date.now()

      await expect(
        service.fetchParcelFeaturesInBbox(innerBbox(PARIS_X, PARIS_Y)),
      ).resolves.toBeNull()

      expect(Date.now() - startedAt).toBeLessThan(1500)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("IGN WFS failed"))
    })

    it("aborts the geocodage body read and falls back as before", async () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
      const service = buildService({
        CADASTRE_PROVIDER: "ign",
        CADASTRE_IGN_REVERSE_URL: `${baseUrl}/reverse`,
        CADASTRE_PROVIDER_TIMEOUT_MS: "200",
        CADASTRE_PROVIDER_ALLOW_FALLBACK: "true",
      })
      const startedAt = Date.now()

      const parcel = await service.resolveFromPoint(48.85, 2.35)

      expect(Date.now() - startedAt).toBeLessThan(1500)
      expect(parcel?.source).toBe("synthetic_v1")
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("IGN cadastre resolver failed"))
    })
  })
})
