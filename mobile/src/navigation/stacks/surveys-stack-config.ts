import { createContext, useContext } from "react"

/**
 * Static configuration of one surveys stack, read by SurveyListRoute. The
 * stack mounts its screens with `component=`, so this navigator-level boolean
 * reaches the list route through this context instead of props. There is one
 * survey stack since 01.9-25 (D-08): the "Recherche" tab is gone.
 */
export type SurveysStackConfig = {
  /** The surveys stack runs inside the native (iOS) tab bar. */
  useNativeNav: boolean
}

const DEFAULT_CONFIG: SurveysStackConfig = { useNativeNav: false }

export const SurveysStackConfigContext = createContext<SurveysStackConfig>(DEFAULT_CONFIG)

export function useSurveysStackConfig(): SurveysStackConfig {
  return useContext(SurveysStackConfigContext)
}
