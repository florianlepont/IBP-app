import { getFocusedLeafRouteName, shouldHideTabBar } from "./tab-bar"

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

describe("getFocusedLeafRouteName", () => {
  test("walks the focused route down to the leaf", () => {
    expect(
      getFocusedLeafRouteName({
        index: 1,
        routes: [
          { name: "home" },
          {
            name: "surveys",
            state: { index: 1, routes: [{ name: "surveysHome" }, { name: "surveyParcels" }] },
          },
        ],
      }),
    ).toBe("surveyParcels")
  })

  test("stops at a route whose navigator has no state yet", () => {
    expect(getFocusedLeafRouteName({ index: 0, routes: [{ name: "publicMap" }] })).toBe("publicMap")
  })

  test("uses the last route of a partial state without an index", () => {
    expect(getFocusedLeafRouteName({ routes: [{ name: "home" }, { name: "account" }] })).toBe(
      "account",
    )
  })

  test("returns undefined without a state", () => {
    expect(getFocusedLeafRouteName(undefined)).toBeUndefined()
    expect(getFocusedLeafRouteName({ index: 0, routes: [] })).toBeUndefined()
  })
})
