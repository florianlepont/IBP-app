import { createContext, useContext } from "react"

/**
 * Static configuration of one surveys stack, read by SurveyListRoute. The
 * stack mounts its screens with `component=`, so these two navigator-level
 * booleans reach the list route through this context instead of props.
 */
export type SurveysStackConfig = {
  /** The surveys stack runs inside the native (iOS) tab bar. */
  useNativeNav: boolean
  /** This stack is the dedicated iOS "Recherche" tab. */
  searchEntry: boolean
}

const DEFAULT_CONFIG: SurveysStackConfig = { useNativeNav: false, searchEntry: false }

export const SurveysStackConfigContext = createContext<SurveysStackConfig>(DEFAULT_CONFIG)

export function useSurveysStackConfig(): SurveysStackConfig {
  return useContext(SurveysStackConfigContext)
}
