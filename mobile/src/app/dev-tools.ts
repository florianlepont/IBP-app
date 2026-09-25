/**
 * Gate for developer-only tools (API URL override, data-reset buttons).
 *
 * Production bundles have `__DEV__ === false`, so callers that guard their
 * rendering/behavior on `shouldShowDevTools()` never expose the API URL
 * override or data-reset tools in a production build (audit M-H5, D-11).
 */
export function shouldShowDevTools(isDev: boolean = __DEV__): boolean {
  return isDev
}

/**
 * Passes a handler through only in dev builds (plan 09's "Simuler un fichier
 * manquant" wiring, D-11); a release build gets `undefined`, so the prop is
 * never reachable in production (T-01.5-32). Kept here, tested, so screens
 * and navigation never inline the `shouldShowDevTools() ? x : undefined`
 * branch themselves.
 */
export function devOnlyHandler<T>(handler: T, isDev: boolean = __DEV__): T | undefined {
  return shouldShowDevTools(isDev) ? handler : undefined
}
