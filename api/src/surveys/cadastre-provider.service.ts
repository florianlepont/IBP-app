import { Injectable, Logger } from '@nestjs/common';

type JsonRecord = Record<string, unknown>;

export type CadastreResolvedParcel = {
  parcel_id: string;
  commune_code: string;
  section: string;
  number: string;
  centroid: { lat: number; lng: number };
  geometry?: JsonRecord;
  source: string;
};

@Injectable()
export class CadastreProviderService {
  private readonly logger = new Logger(CadastreProviderService.name);
  private readonly provider: 'synthetic' | 'ign';
  private readonly allowFallback: boolean;
  private readonly timeoutMs: number;
  private readonly ignReverseUrl: string;
  private readonly ignApiCartoParcelUrl: string;

  constructor() {
    const configuredProvider = (process.env.CADASTRE_PROVIDER ?? 'synthetic').trim().toLowerCase();
    this.provider = configuredProvider === 'ign' ? 'ign' : 'synthetic';
    this.allowFallback = (process.env.CADASTRE_PROVIDER_ALLOW_FALLBACK ?? 'true').trim().toLowerCase() !== 'false';

    const timeoutRaw = Number(process.env.CADASTRE_PROVIDER_TIMEOUT_MS ?? 2500);
    this.timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.trunc(timeoutRaw) : 2500;
    this.ignReverseUrl = process.env.CADASTRE_IGN_REVERSE_URL ?? 'https://data.geopf.fr/geocodage/reverse';
    this.ignApiCartoParcelUrl = process.env.CADASTRE_IGN_APICARTO_PARCEL_URL ?? 'https://apicarto.ign.fr/api/cadastre/parcelle';
  }

  async resolveFromPoint(lat: number, lng: number): Promise<CadastreResolvedParcel | null> {
    if (this.provider === 'ign') {
      try {
        const ignResult = await this.resolveFromIgn(lat, lng);
        if (ignResult) {
          return ignResult;
        }
        this.logger.warn('IGN cadastre resolver returned no parcel for coordinates, switching to fallback strategy');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`IGN cadastre resolver failed: ${message}`);
      }

      if (!this.allowFallback) {
        return null;
      }
    }

    return this.resolveSynthetic(lat, lng);
  }

  private resolveSynthetic(lat: number, lng: number): CadastreResolvedParcel {
    const latKey = Math.round((lat + 90) * 10000);
    const lngKey = Math.round((lng + 180) * 10000);
    const communeCode = String(Math.abs((latKey * 13 + lngKey * 7) % 100000)).padStart(5, '0');
    const section = `${String.fromCharCode(65 + (Math.abs(latKey) % 26))}${String.fromCharCode(65 + (Math.abs(lngKey) % 26))}`;
    const number = String(Math.abs((latKey * 31 + lngKey * 17) % 10000)).padStart(4, '0');

    return {
      parcel_id: `${communeCode}${section}${number}`,
      commune_code: communeCode,
      section,
      number,
      centroid: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      },
      geometry: {},
      source: 'synthetic_v1'
    };
  }

  private async resolveFromIgn(lat: number, lng: number): Promise<CadastreResolvedParcel | null> {
    const url = new URL(this.ignReverseUrl);
    url.searchParams.set('index', 'parcel');
    url.searchParams.set('limit', '1');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));

    const payload = await this.fetchJson(url);
    const feature = this.firstFeature(payload);
    if (!feature) {
      return null;
    }

    const properties = this.asRecord(feature.properties);
    const geometry = this.asRecord(feature.geometry);

    const rawParcelId = this.readFirstString(properties, ['id', 'parcel_id', 'cadastre_id', 'numero_parcelle']);
    const rawCommune = this.readFirstString(properties, ['citycode', 'code_insee', 'commune_code']);
    const rawDepartmentCode = this.readFirstString(properties, ['departmentcode']);
    const rawMunicipalityCode = this.readFirstString(properties, ['municipalitycode']);
    const rawSection = this.readFirstString(properties, ['section', 'section_prefix']);
    const rawNumber = this.readFirstString(properties, ['number', 'numero']);

    const communeCodeFromDepartmentMunicipality = this.buildCommuneCode(rawDepartmentCode, rawMunicipalityCode);
    let communeCode = this.normalizeCommuneCode(rawCommune) ?? communeCodeFromDepartmentMunicipality;
    let section = this.normalizeSection(rawSection);
    let number = this.normalizeNumber(rawNumber);
    let parcelId = this.normalizeParcelId(rawParcelId);

    if ((!communeCode || !section || !number) && parcelId) {
      const parsed = this.parseParcelIdentifier(parcelId);
      communeCode = communeCode ?? parsed?.commune_code ?? null;
      section = section ?? parsed?.section ?? null;
      number = number ?? parsed?.number ?? null;
    }

    if (!parcelId && communeCode && section && number) {
      parcelId = `${communeCode}${section}${number}`;
    }

    if (!parcelId || !communeCode || !section || !number) {
      return null;
    }

    const apiCartoGeometry = await this.resolveGeometryFromApiCarto(communeCode, section, number);

    return {
      parcel_id: parcelId,
      commune_code: communeCode,
      section,
      number,
      centroid: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      },
      geometry: apiCartoGeometry ?? geometry,
      source: 'ign_geocodage'
    };
  }

  private async resolveGeometryFromApiCarto(
    communeCode: string,
    section: string,
    number: string
  ): Promise<JsonRecord | undefined> {
    const url = new URL(this.ignApiCartoParcelUrl);
    url.searchParams.set('code_insee', communeCode);
    url.searchParams.set('section', section);
    url.searchParams.set('numero', number);
    url.searchParams.set('source_ign', 'PCI');
    url.searchParams.set('_limit', '1');

    try {
      const payload = await this.fetchJson(url);
      const feature = this.firstFeature(payload);
      if (!feature) {
        return undefined;
      }

      const geometry = this.asRecord(feature.geometry);
      return Object.keys(geometry).length > 0 ? geometry : undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`IGN API Carto parcel geometry lookup failed: ${message}`);
      return undefined;
    }
  }

  private async fetchJson(url: URL): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`cadastre provider returned HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private firstFeature(payload: unknown): { properties: unknown; geometry: unknown } | null {
    const root = this.asRecord(payload);
    const featuresRaw = root.features;
    if (!Array.isArray(featuresRaw) || featuresRaw.length === 0) {
      return null;
    }

    const first = this.asRecord(featuresRaw[0]);
    return {
      properties: first.properties,
      geometry: first.geometry
    };
  }

  private asRecord(value: unknown): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as JsonRecord;
  }

  private readFirstString(source: JsonRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value !== 'string') {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return null;
  }

  private normalizeParcelId(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCommuneCode(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.replace(/[^0-9]/g, '');
    if (normalized.length === 0) {
      return null;
    }
    return normalized.padStart(5, '0').slice(-5);
  }

  private buildCommuneCode(departmentCodeRaw: string | null, municipalityCodeRaw: string | null): string | null {
    if (!departmentCodeRaw || !municipalityCodeRaw) {
      return null;
    }
    const departmentCode = departmentCodeRaw.replace(/[^0-9]/g, '');
    const municipalityCode = municipalityCodeRaw.replace(/[^0-9]/g, '');
    if (departmentCode.length < 2 || municipalityCode.length === 0) {
      return null;
    }

    const normalizedDepartment = departmentCode.length >= 3 ? departmentCode.slice(-3) : departmentCode.slice(-2);
    const normalizedMunicipality = municipalityCode.padStart(3, '0').slice(-3);
    return `${normalizedDepartment}${normalizedMunicipality}`;
  }

  private normalizeSection(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (normalized.length === 0) {
      return null;
    }
    return normalized.slice(0, 3);
  }

  private normalizeNumber(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.replace(/[^0-9]/g, '');
    if (normalized.length === 0) {
      return null;
    }
    return normalized.padStart(4, '0').slice(-4);
  }

  private parseParcelIdentifier(parcelId: string): { commune_code: string; section: string; number: string } | null {
    const normalized = parcelId.trim().toUpperCase();
    const match = /^(\d{5})([A-Z]{1,3})(\d{1,4})$/.exec(normalized);
    if (!match) {
      return null;
    }

    return {
      commune_code: match[1],
      section: match[2].slice(0, 3),
      number: match[3].padStart(4, '0').slice(-4)
    };
  }
}
