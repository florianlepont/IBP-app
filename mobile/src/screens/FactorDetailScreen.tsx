import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  brandColors,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { FACTOR_INPUT_HINTS_BY_FACTOR, FACTOR_TITLES, HELP_BY_FACTOR } from "../app/constants"
import { FactorField, FactorKey, FactorRetainedScore } from "../app/types"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppStatusChip } from "../ui/AppStatusChip"

type FactorDetailScreenProps = {
  factor: FactorKey
  fields: FactorField[]
  retainedScore: FactorRetainedScore | null
}

export function FactorDetailScreen({ factor, fields, retainedScore }: FactorDetailScreenProps) {
  const [captureHelpExpanded, setCaptureHelpExpanded] = useState(false)
  const hints = FACTOR_INPUT_HINTS_BY_FACTOR[factor]
  const total = fields.length
  const filled = fields.filter((field) => field.value.trim().length > 0).length

  return (
    <View style={detailStyles.screen}>
      <View style={detailStyles.heroCard}>
        <View style={detailStyles.heroAccentOrb} />
        <View style={detailStyles.heroHeaderRow}>
          <View style={detailStyles.heroFactorBadge}>
            <Text style={detailStyles.heroFactorBadgeText}>{factor}</Text>
          </View>
          <Text style={detailStyles.heroProgressText}>
            {filled}/{total} fields
          </Text>
        </View>
        <Text style={detailStyles.heroTitle}>{FACTOR_TITLES[factor]}</Text>
        <Text style={detailStyles.heroBody}>{HELP_BY_FACTOR[factor]}</Text>
        <View style={detailStyles.heroScoreRow}>
          <View style={detailStyles.heroScoreCard}>
            <Text style={detailStyles.heroScoreLabel}>Retained score</Text>
            <Text style={detailStyles.heroScoreValue}>
              {retainedScore ? `${retainedScore.score} pts` : "Pending"}
            </Text>
          </View>
          <Text style={detailStyles.heroScoreMeta}>
            {retainedScore
              ? retainedScore.selected_class
              : "Complete every required field to compute the score"}
          </Text>
        </View>
      </View>

      <AppCard variant="panelElevated" padding={18} style={detailStyles.panel}>
        <AppSectionHeader
          title="Observations"
          subtitle="Inputs update the draft immediately and recompute the retained score as you type."
          trailing={
            retainedScore ? (
              <AppStatusChip label={retainedScore.selected_class} tone="success" />
            ) : (
              <AppStatusChip label="Pending" tone="warning" />
            )
          }
          titleStyle={detailStyles.panelTitle}
          subtitleStyle={detailStyles.panelBody}
        />
        <View style={detailStyles.fieldsList}>
          {fields.map((field) => (
            <AppField
              key={`${factor}-${field.label}`}
              label={`${humanizeFieldLabel(field.label)}${field.required ? " *" : ""}`}
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="numeric"
              placeholder="Enter a numeric value"
              error={field.error}
              containerStyle={detailStyles.fieldBlock}
              labelStyle={detailStyles.fieldLabel}
              inputStyle={detailStyles.input}
            />
          ))}
        </View>
      </AppCard>

      <AppCard variant="panelElevated" padding={18} style={detailStyles.panel}>
        <Pressable
          style={detailStyles.panelToggle}
          onPress={() => setCaptureHelpExpanded((current) => !current)}
        >
          <View style={detailStyles.panelToggleCopy}>
            <Text style={detailStyles.panelTitle}>What to capture</Text>
            <Text style={detailStyles.panelToggleMeta}>
              Open only if you need a quick reminder while scoring this factor.
            </Text>
          </View>
          <Ionicons
            name={captureHelpExpanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={20}
            color={brandColors.forest}
          />
        </Pressable>
        {captureHelpExpanded ? (
          <View style={detailStyles.hintsList}>
            {hints.map((hint) => (
              <View key={`hint-${factor}-${hint}`} style={detailStyles.hintRow}>
                <View style={detailStyles.hintDot} />
                <Text style={detailStyles.hintText}>{hint}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </AppCard>
    </View>
  )
}

function humanizeFieldLabel(label: string): string {
  switch (label) {
    case "native_genus_count":
      return "Native genus count"
    case "strata_count":
      return "Strata count"
    case "covered_autochthonous_percent":
      return "Autochthonous cover (%)"
    case "bmg_count":
      return "BMg count"
    case "bmm_count":
      return "BMm count"
    case "surface_ha":
      return "Surface (ha)"
    case "tgb_count":
      return "TGB count"
    case "gb_count":
      return "GB count"
    case "trees_per_ha":
      return "Trees per ha"
    case "open_flowering_percent":
      return "Open flowering area (%)"
    case "class_score (0|2|5)":
      return "Class score (0, 2 or 5)"
    case "type_count":
      return "Type count"
    default:
      return label.replace(/_/g, " ")
  }
}

const detailStyles = StyleSheet.create({
  screen: {
    gap: brandSpacing.md,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: brandColors.forest,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 10,
    ...brandShadow.card,
  },
  heroAccentOrb: {
    position: "absolute",
    top: -22,
    right: -14,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(176, 199, 142, 0.22)",
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroFactorBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  heroFactorBadgeText: {
    ...brandTypography.button,
    color: brandColors.white,
  },
  heroProgressText: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  heroTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 26,
    lineHeight: 30,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: "#E4ECD8",
  },
  heroScoreRow: {
    marginTop: 2,
    gap: 6,
  },
  heroScoreCard: {
    alignSelf: "flex-start",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  heroScoreLabel: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  heroScoreValue: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    color: brandColors.white,
  },
  heroScoreMeta: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  panel: {
    gap: 12,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 25,
    color: brandColors.forest,
  },
  panelBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  panelToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panelToggleCopy: {
    flex: 1,
    gap: 4,
  },
  panelToggleMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  hintsList: {
    gap: 10,
  },
  hintRow: {
    flexDirection: "row",
    gap: 10,
  },
  hintDot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: brandColors.moss,
  },
  hintText: {
    flex: 1,
    ...brandTypography.sectionBody,
    color: brandColors.textPrimary,
  },
  fieldsList: {
    gap: 12,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
})
