/**
 * The one tab-bar visibility rule shared by the native and the JS tab trees
 * (phase 01.9-25, D-08 and D-13). The JS tree applies it per screen through
 * `tabBarStyle`; the native tree, which only has a navigator-level
 * `tabBarHidden`, applies it to the focused leaf route tracked by
 * AppNavigation.
 */
const ROUTES_WITHOUT_TAB_BAR: ReadonlySet<string> = new Set(["surveyParcels"])

export function shouldHideTabBar(focusedRouteName: string | undefined): boolean {
  return focusedRouteName !== undefined && ROUTES_WITHOUT_TAB_BAR.has(focusedRouteName)
}
