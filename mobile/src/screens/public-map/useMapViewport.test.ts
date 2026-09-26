/**
 * Tests for useMapViewport (D-05, Pitfall 6), on renderHook with fake timers.
 * The hook needs no MapView: the camera move is an injected callback.
 */

jest.mock("react-native", () => ({}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import type { Region } from "react-native-maps"
import { computeRegionBbox } from "../../app/map-viewport"
import type { PublicMapItem } from "../../app/types"
import {
  DEFAULT_MAP_REGION,
  VIEWPORT_DEBOUNCE_MS,
  computeRegionFromItems,
  regionForZoom,
  useMapViewport,
  type UseMapViewportArgs,
} from "./useMapViewport"

function item(id: string, lat: number, lng: number): PublicMapItem {
  return {
    survey_id: id,
    display_location: { lat, lng },
    survey_date: "2026-05-01",
    region_code: "ARA",
    ibp_total: 30,
  }
}

const LYON: Region = { latitude: 45.76, longitude: 4.84, latitudeDelta: 0.5, longitudeDelta: 0.5 }
const PARIS: Region = { latitude: 48.85, longitude: 2.35, latitudeDelta: 0.5, longitudeDelta: 0.5 }
const NANTES: Region = {
  latitude: 47.21,
  longitude: -1.55,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
}
const PARCEL_ZOOM: Region = {
  latitude: 45.76,
  longitude: 4.84,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
}

type Props = Pick<UseMapViewportArgs, "items" | "showParcelLayer">

async function setup(initial: Partial<Props> = {}) {
  const loadPublicMap = jest.fn(async () => undefined)
  const loadParcels = jest.fn(async () => undefined)
  const animateToRegion = jest.fn()
  const onViewportBboxChange = jest.fn()
  const view = await renderHook(
    ({ items, showParcelLayer }: Props) =>
      useMapViewport({
        items,
        showParcelLayer,
        loadPublicMap,
        loadParcels,
        animateToRegion,
        onViewportBboxChange,
      }),
    { initialProps: { items: [], showParcelLayer: true, ...initial } },
  )
  return { ...view, loadPublicMap, loadParcels, animateToRegion, onViewportBboxChange }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function moveTo(
  result: { current: ReturnType<typeof useMapViewport> },
  region: Region,
  isGesture?: boolean,
) {
  await act(async () => {
    result.current.onRegionChangeComplete(region, { isGesture })
  })
}

describe("useMapViewport", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(async () => {
    await cleanup()
    jest.useRealTimers()
  })

  test("loads the initial viewport by bbox on mount and reports it", async () => {
    const { loadPublicMap, onViewportBboxChange } = await setup()
    const bbox = computeRegionBbox(DEFAULT_MAP_REGION)
    expect(loadPublicMap).toHaveBeenCalledTimes(1)
    expect(loadPublicMap).toHaveBeenCalledWith({ bbox })
    expect(onViewportBboxChange).toHaveBeenCalledWith(bbox)
  })

  test("three region changes within 400 ms produce one load with the last bbox", async () => {
    const { result, loadPublicMap } = await setup()
    loadPublicMap.mockClear()

    await moveTo(result, LYON, true)
    await advance(150)
    await moveTo(result, PARIS, true)
    await advance(150)
    await moveTo(result, NANTES, true)
    await advance(VIEWPORT_DEBOUNCE_MS - 1)
    expect(loadPublicMap).not.toHaveBeenCalled()

    await advance(1)
    expect(loadPublicMap).toHaveBeenCalledTimes(1)
    expect(loadPublicMap).toHaveBeenCalledWith({ bbox: computeRegionBbox(NANTES) })
    expect(result.current.region).toEqual(NANTES)
  })

  test("a programmatic move that lands on the current region does not load again", async () => {
    const { result, loadPublicMap } = await setup()
    await moveTo(result, LYON, true)
    await advance(VIEWPORT_DEBOUNCE_MS)
    loadPublicMap.mockClear()

    // The animation end reports the same region (isGesture false or undefined on Apple Maps).
    await moveTo(result, { ...LYON, latitude: LYON.latitude + 0.000001 }, false)
    await moveTo(result, LYON)
    await advance(VIEWPORT_DEBOUNCE_MS * 2)
    expect(loadPublicMap).not.toHaveBeenCalled()
  })

  test("fits once on the first items load, not on later viewport loads", async () => {
    const { result, rerender, animateToRegion, loadPublicMap } = await setup()
    const first = [item("a", 45.7, 4.8), item("b", 45.9, 5.0)]

    await rerender({ items: first, showParcelLayer: true })
    expect(animateToRegion).toHaveBeenCalledTimes(1)
    const fitted = computeRegionFromItems(first)
    expect(animateToRegion).toHaveBeenCalledWith(fitted, 520)

    // The fit moves the camera: one load for the fitted bbox, then no new fit.
    loadPublicMap.mockClear()
    await moveTo(result, fitted, false)
    await advance(VIEWPORT_DEBOUNCE_MS)
    expect(loadPublicMap).toHaveBeenCalledTimes(1)
    await rerender({ items: [item("a", 45.7, 4.8)], showParcelLayer: true })
    await moveTo(result, LYON, true)
    await advance(VIEWPORT_DEBOUNCE_MS)
    await rerender({ items: [item("c", 45.76, 4.84)], showParcelLayer: true })
    expect(animateToRegion).toHaveBeenCalledTimes(1)
    expect(result.current.fitOnce(LYON)).toBe(false)
  })

  test("an empty first load disarms the fit without moving the camera", async () => {
    const { rerender, animateToRegion } = await setup()
    await rerender({ items: [], showParcelLayer: true })
    expect(animateToRegion).not.toHaveBeenCalled()
    await rerender({ items: [item("a", 45.7, 4.8)], showParcelLayer: true })
    expect(animateToRegion).not.toHaveBeenCalled()
  })

  test("a user gesture before the first load cancels the pending fit", async () => {
    const { result, rerender, animateToRegion } = await setup()
    await moveTo(result, LYON, true)
    await rerender({ items: [item("a", 45.7, 4.8)], showParcelLayer: true })
    expect(animateToRegion).not.toHaveBeenCalled()
  })

  test("applying filters reloads every matching item and fits once more", async () => {
    const { result, rerender, animateToRegion, loadPublicMap } = await setup({
      items: [],
    })
    await rerender({ items: [item("a", 45.7, 4.8)], showParcelLayer: true })
    expect(animateToRegion).toHaveBeenCalledTimes(1)
    loadPublicMap.mockClear()

    await act(async () => {
      result.current.applyFilters()
    })
    expect(loadPublicMap).toHaveBeenCalledWith({ force: true })
    const next = [item("b", 48.8, 2.3)]
    await rerender({ items: next, showParcelLayer: true })
    expect(animateToRegion).toHaveBeenCalledTimes(2)
    expect(animateToRegion).toHaveBeenLastCalledWith(computeRegionFromItems(next), 520)
  })

  test("reload forces the current viewport, and the parcels when they are shown", async () => {
    const { result, loadPublicMap, loadParcels } = await setup()
    await act(async () => {
      result.current.reload()
    })
    expect(loadPublicMap).toHaveBeenLastCalledWith({
      bbox: computeRegionBbox(DEFAULT_MAP_REGION),
      force: true,
    })
    expect(loadParcels).not.toHaveBeenCalled()

    await moveTo(result, PARCEL_ZOOM, true)
    await advance(VIEWPORT_DEBOUNCE_MS)
    loadParcels.mockClear()
    await act(async () => {
      result.current.reload()
    })
    expect(loadParcels).toHaveBeenCalledWith({
      bbox: computeRegionBbox(PARCEL_ZOOM),
      zoom: result.current.zoom,
    })
  })

  test("parcels load after the debounce at zoom 15+, once per viewport, only when shown", async () => {
    const { result, rerender, loadParcels } = await setup()
    expect(result.current.parcelLayerRenderable).toBe(false)
    expect(loadParcels).not.toHaveBeenCalled()

    await moveTo(result, PARCEL_ZOOM, true)
    expect(result.current.parcelLayerRenderable).toBe(true)
    await advance(VIEWPORT_DEBOUNCE_MS)
    expect(loadParcels).toHaveBeenCalledTimes(1)
    expect(loadParcels).toHaveBeenCalledWith({
      bbox: computeRegionBbox(PARCEL_ZOOM),
      zoom: result.current.zoom,
    })

    // Hiding the layer resets the key, so showing it again reloads the same viewport.
    await rerender({ items: [], showParcelLayer: false })
    expect(result.current.parcelLayerRenderable).toBe(false)
    await rerender({ items: [], showParcelLayer: true })
    expect(loadParcels).toHaveBeenCalledTimes(2)
    await rerender({ items: [item("a", 45.7, 4.8)], showParcelLayer: true })
    expect(loadParcels).toHaveBeenCalledTimes(2)
  })

  test("moveTo animates the camera without touching the fit", async () => {
    const { result, animateToRegion } = await setup()
    await act(async () => {
      result.current.moveTo(LYON, 450)
    })
    expect(animateToRegion).toHaveBeenCalledWith(LYON, 450)
    expect(result.current.fitOnce(PARIS)).toBe(true)
    expect(animateToRegion).toHaveBeenLastCalledWith(PARIS, 520)
  })
})

describe("computeRegionFromItems", () => {
  test("falls back to France without usable coordinates", () => {
    expect(computeRegionFromItems([])).toBe(DEFAULT_MAP_REGION)
    expect(computeRegionFromItems([item("x", Number.NaN, 2)])).toBe(DEFAULT_MAP_REGION)
  })

  test("frames the items with a margin and a minimum span", () => {
    expect(computeRegionFromItems([item("a", 45, 4), item("b", 46, 6)])).toEqual({
      latitude: 45.5,
      longitude: 5,
      latitudeDelta: 1.4,
      longitudeDelta: 2.8,
    })
    expect(computeRegionFromItems([item("a", 45, 4)]).latitudeDelta).toBe(0.08)
  })
})

describe("regionForZoom", () => {
  test("centres on the point with the span of the zoom and the current aspect", () => {
    const region = regionForZoom({ latitude: 45, longitude: 4 }, 10, {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 2,
      longitudeDelta: 1,
    })
    expect(region.latitude).toBe(45)
    expect(region.longitude).toBe(4)
    expect(region.longitudeDelta).toBeCloseTo(360 / 1024)
    expect(region.latitudeDelta).toBeCloseTo((360 / 1024) * 2)
  })
})
