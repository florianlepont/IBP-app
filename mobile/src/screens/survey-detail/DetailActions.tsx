import { View } from "react-native"
import { LocalSurvey } from "../../storage"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { styles } from "./summary.styles"

type DetailActionsProps = {
  survey: LocalSurvey
  onDeleteSurvey: (surveyId: string) => void
  onRetrySurvey: (surveyId: string) => Promise<void>
  onDiscardSurvey: (surveyId: string) => Promise<void>
  onToggleVisibility: (surveyId: string, visibility: "private" | "public") => Promise<void>
}

export function DetailActions({
  survey,
  onDeleteSurvey,
  onRetrySurvey,
  onDiscardSurvey,
  onToggleVisibility,
}: DetailActionsProps) {
  const isPublic = survey.visibility === "public"

  return (
    <AppCard variant="panelElevated" padding={18} style={styles.actionPanel}>
      <AppSectionHeader
        title="Actions"
        subtitle="Visibility, deletion and sync recovery controls."
      />

      <View style={styles.actionButtonsRow}>
        <AppButton
          label={isPublic ? "Set private" : "Set public"}
          leadingIcon={isPublic ? "lock-closed-outline" : "globe-outline"}
          variant="secondary"
          onPress={() => void onToggleVisibility(survey.id, isPublic ? "private" : "public")}
        />
        <AppButton
          label="Delete survey"
          leadingIcon="trash-outline"
          variant="danger"
          onPress={() => onDeleteSurvey(survey.id)}
        />
      </View>

      {survey.sync_state === "failed" ? (
        <View style={styles.actionButtonsRow}>
          <AppButton
            label="Retry now"
            leadingIcon="refresh-outline"
            onPress={() => void onRetrySurvey(survey.id)}
          />
          <AppButton
            label="Discard local change"
            leadingIcon="close-circle-outline"
            variant="danger"
            onPress={() => void onDiscardSurvey(survey.id)}
          />
        </View>
      ) : null}
    </AppCard>
  )
}
