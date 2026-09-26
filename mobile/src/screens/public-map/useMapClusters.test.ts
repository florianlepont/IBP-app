/**
 * Tests for useMapClusters, on renderHook (see hooks/render-hook-smoke.test.ts)
 * with the real supercluster (UMD build through the Jest moduleNameMapper).
 */

jest.mock("react-native", () => ({}))

const mockSuperclusterConstructed = jest.fn()

jest.mock("supercluster", () => {
  const actual = jest.requireActual("supercluster")
  const Real = (actual.default ?? actual) as new (options: unknown) => object
  class SpiedSupercluster extends Real {
    constructor(options: unknown) {
      super(options)
      mockSuperclusterConstructed(options)
    }
  }
  return { __esModule: true, default: SpiedSupercluster }
})

import { cleanup, renderHook } from "@testing-library/react-native/pure"
import type { Region } from "react-native-maps"
import type { PublicMapItem } from "../../app/types"
import {
  CLUSTER_MAX_ZOOM,
  computeClusterZoom,
  computeRegionBboxArray,
  useMapClusters,
} from "./useMapClusters"

const FRANCE: Region = { latitude: 46.6, longitude: 1.9, latitudeDelta: 10, longitudeDelta: 12 }
const LYON_CLOSE: Region = {
  latitude: 45.76,
  longitude: 4.84,
  latitudeDelta: 0.001,
  longitudeDelta: 0.001,
}

function item(id: string, lat: number, lng: number): PublicMapItem {
  return {
    survey_id: id,
    display_location: { lat, lng },
    survey_date: "2026-05-01",
    region_code: "ARA",
    ibp_total: 30,
  }
}

const SAME_SPOT = [item("s1", 45.76, 4.84), item("s2", 45.76, 4.84), item("s3", 45.76, 4.84)]

async function renderClusters(items: PublicMapItem[], region: Region) {
  return renderHook((props: { items: PublicMapItem[]; region: Region }) => useMapClusters(props), {
    initialProps: { items, region },
  })
}

describe("useMapClusters", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await cleanup()
  })

  test("three surveys on the same spot form one cluster of 3 over France", async () => {
    const { result } = await renderClusters(SAME_SPOT, FRANCE)

    expect(result.current.clusters).toHaveLength(1)
    expect(result.current.clusters[0]).toMatchObject({ kind: "cluster", count: 3 })
    expect(mockSuperclusterConstructed).toHaveBeenCalledWith({ radius: 60, maxZoom: 16 })
  })

  test("at max zoom the shared-spot cluster yields its leaves instead of a zoom", async () => {
    const { result } = await renderClusters(SAME_SPOT, LYON_CLOSE)

    expect(computeClusterZoom(LYON_CLOSE)).toBe(CLUSTER_MAX_ZOOM)
    const [entry] = result.current.clusters
    expect(entry?.kind).toBe("cluster")
    if (entry?.kind !== "cluster") return

    expect(result.current.expansionZoom(entry.clusterId)).toBeGreaterThan(CLUSTER_MAX_ZOOM)
    const leaves = result.current.leaves(entry.clusterId)
    expect(leaves.map((leaf) => leaf.survey_id).sort()).toEqual(["s1", "s2", "s3"])
    const target = result.current.resolveClusterPress(entry.clusterId)
    expect(target.kind).toBe("leaves")
    expect(target.kind === "leaves" && target.items).toHaveLength(3)
  })

  test("a cluster of distinct points zooms in on press", async () => {
    const items = [item("a", 45.7, 4.8), item("b", 45.8, 4.9)]
    const { result } = await renderClusters(items, FRANCE)

    const [entry] = result.current.clusters
    expect(entry).toMatchObject({ kind: "cluster", count: 2 })
    if (entry?.kind !== "cluster") return

    const target = result.current.resolveClusterPress(entry.clusterId)
    expect(target.kind).toBe("zoom")
    expect(target.kind === "zoom" && target.zoom).toBeLessThanOrEqual(CLUSTER_MAX_ZOOM)
  })

  test("single points come back as items", async () => {
    const items = [item("paris", 48.85, 2.35), item("marseille", 43.3, 5.37)]
    const { result } = await renderClusters(items, FRANCE)

    expect(result.current.clusters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "item", key: "item-paris", latitude: 48.85 }),
        expect.objectContaining({ kind: "item", key: "item-marseille", longitude: 5.37 }),
      ]),
    )
  })

  test("points outside the region are not returned", async () => {
    const items = [item("lyon", 45.76, 4.84), item("brest", 48.39, -4.49)]
    const { result } = await renderClusters(items, {
      latitude: 45.76,
      longitude: 4.84,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    })

    expect(result.current.clusters.map((entry) => entry.key)).toEqual(["item-lyon"])
  })

  test("a region change re-queries without rebuilding the index; new items rebuild it", async () => {
    const { result, rerender } = await renderClusters(SAME_SPOT, FRANCE)
    const firstClusters = result.current.clusters
    const firstLeaves = result.current.leaves
    expect(mockSuperclusterConstructed).toHaveBeenCalledTimes(1)

    await rerender({ items: SAME_SPOT, region: LYON_CLOSE })
    expect(mockSuperclusterConstructed).toHaveBeenCalledTimes(1)
    expect(result.current.clusters).not.toBe(firstClusters)
    expect(result.current.leaves).toBe(firstLeaves)

    await rerender({ items: [...SAME_SPOT], region: LYON_CLOSE })
    expect(mockSuperclusterConstructed).toHaveBeenCalledTimes(2)
    expect(result.current.leaves).not.toBe(firstLeaves)
  })

  test("the same region object keeps the same clusters array", async () => {
    const { result, rerender } = await renderClusters(SAME_SPOT, FRANCE)
    const firstClusters = result.current.clusters

    await rerender({ items: SAME_SPOT, region: FRANCE })

    expect(result.current.clusters).toBe(firstClusters)
  })
})

describe("region helpers", () => {
  test("computeRegionBboxArray clamps to the world", () => {
    expect(
      computeRegionBboxArray({
        latitude: 0,
        longitude: 0,
        latitudeDelta: 400,
        longitudeDelta: 400,
      }),
    ).toEqual([-180, -90, 180, 90])
    expect(computeRegionBboxArray(FRANCE)).toEqual([-4.1, 41.6, 7.9, 51.6])
  })

  test("computeClusterZoom stays within 0 and the max zoom", () => {
    expect(
      computeClusterZoom({ latitude: 0, longitude: 0, latitudeDelta: 170, longitudeDelta: 3600 }),
    ).toBe(0)
    expect(computeClusterZoom(FRANCE)).toBe(5)
    expect(computeClusterZoom(LYON_CLOSE)).toBe(CLUSTER_MAX_ZOOM)
  })
})
