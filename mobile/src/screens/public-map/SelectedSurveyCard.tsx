import { memo, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { PublicMapItem } from "../../app/types"
import { fr } from "../../i18n"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppField } from "../../ui/AppField"
import { AppNotice } from "../../ui/AppNotice"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { panelStyles as styles } from "./styles"

const t = fr.publicMap

export type SelectedSurveyCardProps = {
  item: PublicMapItem
  isOwnSurvey: boolean
  bottom: number
  onClose: () => void
  onReportSurvey: (surveyId: string, reason: string) => Promise<{ ok: boolean; message: string }>
}

/**
 * The selected public survey and its report form. The form state lives here,
 * so typing a reason does not re-render the map; mount it with
 * key={item.survey_id} to reset the form when the selection changes.
 */
export const SelectedSurveyCard = memo(function SelectedSurveyCard({
  item,
  isOwnSurvey,
  bottom,
  onClose,
  onReportSurvey,
}: SelectedSurveyCardProps) {
  const [reportPanelOpen, setReportPanelOpen] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportSending, setReportSending] = useState(false)
  const [reportMessage, setReportMessage] = useState<string | null>(null)

  const cancelReport = () => {
    setReportPanelOpen(false)
    setReportReason("")
    setReportMessage(null)
  }

  const sendReport = () => {
    if (reportSending) return
    setReportSending(true)
    void onReportSurvey(item.survey_id, reportReason)
      .then((result) => {
        setReportMessage(result.message)
        if (result.ok) {
          setReportPanelOpen(false)
          setReportReason("")
        }
      })
      .finally(() => setReportSending(false))
  }

  return (
    <AppCard variant="panelElevated" padding={14} style={[styles.card, { bottom }]}>
      <AppSectionHeader
        title={t.selected.title(item.ibp_total)}
        trailing={
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.a11y.closeSelection}
          >
            <Ionicons name="close" size={18} color="#40654f" />
          </Pressable>
        }
        titleStyle={styles.title}
      />
      <Text style={styles.meta}>
        {t.selected.meta({ region: item.region_code, date: item.survey_date })}
      </Text>

      {isOwnSurvey ? (
        <AppNotice tone="info" icon="information-circle-outline" message={t.selected.ownSurvey} />
      ) : !reportPanelOpen ? (
        <AppButton
          label={t.selected.report}
          leadingIcon="flag-outline"
          variant="danger"
          size="sm"
          onPress={() => setReportPanelOpen(true)}
          style={styles.reportOpenButton}
          labelStyle={styles.reportOpenButtonText}
        />
      ) : (
        <View style={styles.reportForm}>
          <AppField
            label={t.selected.reasonLabel}
            value={reportReason}
            onChangeText={setReportReason}
            autoCapitalize="sentences"
            autoCorrect
            multiline
            numberOfLines={3}
            placeholder={t.selected.reasonPlaceholder}
            containerStyle={styles.reportField}
            labelStyle={styles.reportInputLabel}
            inputStyle={styles.reportInput}
          />
          <View style={styles.reportActionsRow}>
            <AppButton
              label={fr.common.actions.cancel}
              variant="secondary"
              size="sm"
              onPress={cancelReport}
              disabled={reportSending}
              labelStyle={styles.reportCancelButtonText}
            />
            <AppButton
              label={reportSending ? t.selected.sending : t.selected.send}
              variant="danger"
              size="sm"
              style={reportSending ? styles.reportSubmitButtonDisabled : null}
              disabled={reportSending}
              onPress={sendReport}
              labelStyle={styles.reportSubmitButtonText}
            />
          </View>
        </View>
      )}
      {/* Outside the form: a successful report closes the form but keeps its result visible. */}
      {reportMessage ? <Text style={styles.meta}>{reportMessage}</Text> : null}
    </AppCard>
  )
})
