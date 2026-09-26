import { shouldHideTabBar } from "./tab-bar"

describe("shouldHideTabBar (D-13)", () => {
  test("hides the tab bar on parcel selection", () => {
    expect(shouldHideTabBar("surveyParcels")).toBe(true)
  })

  test.each(["surveysHome", "surveyDetail", "surveyForm", "surveyFactorDetail", "homeRoot"])(
    "keeps the tab bar on %s",
    (routeName) => {
      expect(shouldHideTabBar(routeName)).toBe(false)
    },
  )

  test("keeps the tab bar when no route is focused yet", () => {
    expect(shouldHideTabBar(undefined)).toBe(false)
  })
})
