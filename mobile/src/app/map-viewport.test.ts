import {
  buildFocusedMapRegion,
  computeRegionZoom,
  areRegionsNearlyEqual,
  computeRegionBbox,
  buildBboxAroundPoint,
} from "./map-viewport"

describe("buildFocusedMapRegion", () => {
  test("centers region on given lat/lng", () => {
    const region = buildFocusedMapRegion({ lat: 48.85, lng: 2.35 })
    expect(region.latitude).toBe(48.85)
    expect(region.longitude).toBe(2.35)
  })

  test("uses fixed 0.015 deltas", () => {
    const region = buildFocusedMapRegion({ lat: 0, lng: 0 })
    expect(region.latitudeDelta).toBe(0.015)
    expect(region.longitudeDelta).toBe(0.015)
  })
})

describe("computeRegionZoom", () => {
  test("returns zoom ~9 for ~0.7 longitudeDelta", () => {
    // log2(360 / 0.703125) ≈ 9
    const zoom = computeRegionZoom({
      latitude: 48,
      longitude: 2,
      latitudeDelta: 1,
      longitudeDelta: 0.703125,
    })
    expect(zoom).toBe(9)
  })

  test("returns zoom ~14 for 0.015 longitudeDelta (street level)", () => {
    const zoom = computeRegionZoom({
      latitude: 48,
      longitude: 2,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    })
    expect(zoom).toBeGreaterThanOrEqual(13)
    expect(zoom).toBeLessThanOrEqual(15)
  })

  test("handles zero longitudeDelta without crashing", () => {
    const zoom = computeRegionZoom({
      latitude: 48,
      longitude: 2,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
    expect(typeof zoom).toBe("number")
    expect(Number.isFinite(zoom)).toBe(true)
  })
})

describe("areRegionsNearlyEqual", () => {
  const base = { latitude: 48.85, longitude: 2.35, latitudeDelta: 0.01, longitudeDelta: 0.01 }

  test("returns true for identical regions", () => {
    expect(areRegionsNearlyEqual(base, { ...base })).toBe(true)
  })

  test("returns true when difference is within default epsilon", () => {
    const b = { ...base, latitude: base.latitude + 0.000005 }
    expect(areRegionsNearlyEqual(base, b)).toBe(true)
  })

  test("returns false when latitude differs beyond epsilon", () => {
    const b = { ...base, latitude: base.latitude + 0.001 }
    expect(areRegionsNearlyEqual(base, b)).toBe(false)
  })

  test("returns false when longitude differs beyond epsilon", () => {
    const b = { ...base, longitude: base.longitude + 0.001 }
    expect(areRegionsNearlyEqual(base, b)).toBe(false)
  })

  test("returns false when latitudeDelta differs beyond epsilon", () => {
    const b = { ...base, latitudeDelta: 0.02 }
    expect(areRegionsNearlyEqual(base, b)).toBe(false)
  })

  test("returns false when longitudeDelta differs beyond epsilon", () => {
    const b = { ...base, longitudeDelta: 0.02 }
    expect(areRegionsNearlyEqual(base, b)).toBe(false)
  })

  test("accepts custom epsilon", () => {
    const b = { ...base, latitude: base.latitude + 0.005 }
    expect(areRegionsNearlyEqual(base, b, 0.01)).toBe(true)
    expect(areRegionsNearlyEqual(base, b, 0.001)).toBe(false)
  })
})

describe("computeRegionBbox", () => {
  test("returns comma-separated bbox string", () => {
    const bbox = computeRegionBbox({
      latitude: 48,
      longitude: 2,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    })
    expect(bbox).toMatch(/^-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+$/)
  })

  test("correctly orders minLng,minLat,maxLng,maxLat", () => {
    const bbox = computeRegionBbox({
      latitude: 48,
      longitude: 2,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    })
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number)
    expect(minLng).toBeLessThan(maxLng)
    expect(minLat).toBeLessThan(maxLat)
  })

  test("clamps latitude to -90/90", () => {
    const bbox = computeRegionBbox({
      latitude: 89.99,
      longitude: 0,
      latitudeDelta: 10,
      longitudeDelta: 0.1,
    })
    const [, minLat, , maxLat] = bbox.split(",").map(Number)
    expect(minLat).toBeGreaterThanOrEqual(-90)
    expect(maxLat).toBeLessThanOrEqual(90)
  })

  test("clamps longitude to -180/180", () => {
    const bbox = computeRegionBbox({
      latitude: 0,
      longitude: 179.99,
      latitudeDelta: 0.1,
      longitudeDelta: 10,
    })
    const [minLng, , maxLng] = bbox.split(",").map(Number)
    expect(minLng).toBeGreaterThanOrEqual(-180)
    expect(maxLng).toBeLessThanOrEqual(180)
  })
})

describe("buildBboxAroundPoint", () => {
  test("returns minLng,minLat,maxLng,maxLat around a center point", () => {
    expect(buildBboxAroundPoint({ lat: 46, lng: 2 }, 0.025)).toBe(
      "1.975000,45.975000,2.025000,46.025000",
    )
  })

  test("clamps max values near the north-east edge of the world", () => {
    expect(buildBboxAroundPoint({ lat: 89.99, lng: 179.99 }, 0.025)).toBe(
      "179.965000,89.965000,180.000000,90.000000",
    )
  })

  test("clamps min values near the south-west edge of the world", () => {
    const bbox = buildBboxAroundPoint({ lat: -89.99, lng: -179.99 }, 0.025)
    const [minLng, minLat] = bbox.split(",").map(Number)
    expect(minLng).toBe(-180)
    expect(minLat).toBe(-90)
  })
})
