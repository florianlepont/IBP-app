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
