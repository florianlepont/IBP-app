import { ReactNode } from "react"
import { Text, View } from "react-native"
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from "../../app/constants"
import { formatDateTime } from "../../app/formatters"
import { RegionVersion, VegetationStage } from "../../app/types"
import { fr } from "../../i18n"
import { LocalSurvey } from "../../storage"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppChoiceChip } from "../../ui/AppChoiceChip"
import { AppNotice } from "../../ui/AppNotice"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { AppStatusChip } from "../../ui/AppStatusChip"
import { styles as sharedStyles } from "./styles"
import { styles } from "./summary.styles"

const t = fr.surveyDetail.summary

type SummaryTabProps = {
  survey: LocalSurvey
  canEditSurvey: boolean
  remainingTime: string
  submissionDeadline: string | null
  isDraftNearDeadline: boolean
  activeRegion: RegionVersion
  activeVegetationStage: VegetationStage
  onOpenParcels: () => void
  onUpdateRegionVersion: (surveyId: string, region: RegionVersion) => Promise<void> | void
  onUpdateVegetationStage: (surveyId: string, stage: VegetationStage) => Promise<void> | void
  // The factor tiles and the actions card, rendered after the context card.
  children: ReactNode
}

export function SummaryTab({
  survey,
  canEditSurvey,
  remainingTime,
  submissionDeadline,
  isDraftNearDeadline,
  activeRegion,
  activeVegetationStage,
  onOpenParcels,
  onUpdateRegionVersion,
  onUpdateVegetationStage,
  children,
}: SummaryTabProps) {
  const activeRegionLabel =
    REGION_OPTIONS.find((option) => option.value === activeRegion)?.label ?? activeRegion
  const activeVegetationLabel =
    VEGETATION_STAGE_OPTIONS_BY_REGION[activeRegion].find(
      (option) => option.value === activeVegetationStage,
    )?.label ?? activeVegetationStage

  return (
    <View style={sharedStyles.detailSection}>
      {survey.status === "submitted" ? (
        <AppNotice
          tone="success"
          icon="checkmark-done-circle-outline"
          title={t.submittedTitle}
          message={t.submittedMessage}
          style={styles.submittedReadonlyBanner}
        />
      ) : null}

      {survey.status !== "submitted" ? (
        <AppCard
          variant="panelElevated"
          padding={18}
          style={[styles.deadlineCard, isDraftNearDeadline ? styles.deadlineCardWarning : null]}
        >
          <Text style={styles.deadlineLabel}>{t.windowLabel}</Text>
          <Text
            style={[styles.deadlineValue, isDraftNearDeadline ? styles.deadlineValueWarning : null]}
          >
            {remainingTime}
          </Text>
          <Text style={sharedStyles.rowMeta}>{t.deadline(formatDateTime(submissionDeadline))}</Text>
          {isDraftNearDeadline ? (
            <Text style={sharedStyles.warningText}>{t.nearDeadline}</Text>
          ) : null}
        </AppCard>
      ) : null}

      <AppCard variant="panelElevated" padding={18} style={styles.detailMetadataCard}>
        <AppSectionHeader
          title={t.contextTitle}
          subtitle={t.contextSubtitle}
          trailing={
            canEditSurvey ? (
              <AppButton
                label={t.editParcels}
                variant="secondary"
                size="sm"
                leadingIcon="map-outline"
                onPress={onOpenParcels}
                style={styles.detailParcelsEditButton}
              />
            ) : null
          }
        />

        {canEditSurvey ? (
          <>
            <View style={sharedStyles.filterChipsRow}>
              {REGION_OPTIONS.map((option) => (
                <AppChoiceChip
                  key={`detail-region-${option.value}`}
                  label={option.label}
                  active={activeRegion === option.value}
                  onPress={() => {
                    void onUpdateRegionVersion(survey.id, option.value)
                  }}
                />
              ))}
            </View>
            <View style={sharedStyles.filterChipsRow}>
              {VEGETATION_STAGE_OPTIONS_BY_REGION[activeRegion].map((option) => (
                <AppChoiceChip
                  key={`detail-stage-${option.value}`}
                  label={option.label}
                  active={activeVegetationStage === option.value}
                  onPress={() => {
                    void onUpdateVegetationStage(survey.id, option.value)
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.summaryRow}>
            <AppStatusChip
              label={t.region(activeRegionLabel)}
              style={styles.summaryItem}
              labelStyle={styles.summaryItemLabel}
            />
            <AppStatusChip
              label={t.vegetation(activeVegetationLabel)}
              style={styles.summaryItem}
              labelStyle={styles.summaryItemLabel}
            />
          </View>
        )}
      </AppCard>

      {children}
    </View>
  )
}
