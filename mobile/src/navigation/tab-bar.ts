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

/** The part of a (possibly partial) navigation state the leaf walk needs. */
export type NavigationStateLike = {
  index?: number
  routes: ReadonlyArray<{ name: string; state?: NavigationStateLike }>
}

/**
 * The name of the focused leaf route: follows `routes[index]` through the
 * nested navigator states. A partial state without an index focuses its last
 * route, as a stack does.
 */
export function getFocusedLeafRouteName(
  state: NavigationStateLike | undefined,
): string | undefined {
  let current = state
  let leaf: string | undefined
  while (current && current.routes.length > 0) {
    const route = current.routes[current.index ?? current.routes.length - 1]
    leaf = route.name
    current = route.state
  }
  return leaf
}
