import {
  asFiniteNumber,
  isFactorKey,
  resolveDisplayCoordinates,
  toAddressLabel,
} from "./survey-screen-helpers"

describe("survey screen helpers", () => {
  it("formats address labels by concatenating available parts", () => {
    expect(
      toAddressLabel({
        streetNumber: "12",
        street: "Rue des Chenes",
        postalCode: "75001",
        city: "Paris",
        region: "Ile-de-France",
        country: "France",
      }),
    ).toBe("12 Rue des Chenes - 75001 Paris - Ile-de-France, France")

    expect(
      toAddressLabel({
        city: "Toulouse",
        country: "France",
      }),
    ).toBe("Toulouse - France")
  })

  it("parses finite numbers and resolves display coordinates safely", () => {
    expect(asFiniteNumber(12.5)).toBe(12.5)
    expect(asFiniteNumber("42")).toBe(42)
    expect(asFiniteNumber("not-a-number")).toBeNull()

    expect(resolveDisplayCoordinates({ lat: "48.8566", lng: 2.3522 })).toEqual({
      lat: 48.8566,
      lng: 2.3522,
    })
    expect(resolveDisplayCoordinates({ lat: "x", lng: 2.3522 })).toBeNull()
    expect(resolveDisplayCoordinates(null)).toBeNull()
  })

  it("recognizes valid factor keys only", () => {
    expect(isFactorKey("A")).toBe(true)
    expect(isFactorKey("J")).toBe(true)
    expect(isFactorKey("Z")).toBe(false)
  })
})
