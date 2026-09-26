import { memo } from "react"
import { ScrollView } from "react-native"
import { styles } from "../../app/styles"
import { FactorDetailScreen } from "../../screens/FactorDetailScreen"
import { useSurveyFormState } from "../../state/survey-form-context"
import type { FactorDetailRouteProps } from "../types"

/** Factor detail route (phase 01.9-18, D-01): the form context only. */
export const FactorDetailRoute = memo(function FactorDetailRoute({
  route,
}: FactorDetailRouteProps) {
  const { state } = useSurveyFormState()
  const { factor } = route.params

  return (
    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
      <FactorDetailScreen
        factor={factor}
        fields={state.factorSections[factor]}
        retainedScore={state.factorRetainedScores[factor]}
      />
    </ScrollView>
  )
})
