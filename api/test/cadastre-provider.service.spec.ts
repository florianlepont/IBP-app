import { Logger } from "@nestjs/common"
import { CadastreProviderService } from "../src/surveys/cadastre-provider.service"
import { buildTestConfigService } from "./config-helper"

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
