import { StyleSheet, Text, View } from "react-native"
import { brandColors } from "../../app/brand-tokens"
import type {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveySyncFilter,
} from "../../app/types"
import { fr } from "../../i18n"
import { AppButton } from "../../ui/AppButton"
import { AppChoiceChip } from "../../ui/AppChoiceChip"
import { AppField } from "../../ui/AppField"
import {
  ATTACHMENT_OPTIONS,
  BLOCKED_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  SYNC_OPTIONS,
} from "./filter-options"
import type { FilterOption } from "./filter-options"
import { styles as sharedStyles } from "./styles"

const t = fr.surveyList.filters

export type SurveyListFilters = {
  surveyFromDate: string
  setSurveyFromDate: (value: string) => void
  surveyToDate: string
  setSurveyToDate: (value: string) => void
  statusFilter: SurveyStatusFilter
  setStatusFilter: (value: SurveyStatusFilter) => void
  syncFilter: SurveySyncFilter
  setSyncFilter: (value: SurveySyncFilter) => void
  blockedFilter: SurveyBlockedFilter
  setBlockedFilter: (value: SurveyBlockedFilter) => void
  attachmentFilter: SurveyAttachmentFilter
  setAttachmentFilter: (value: SurveyAttachmentFilter) => void
  sortMode: SurveySort
  setSortMode: (value: SurveySort) => void
  resetFilters: () => void
}

function FilterSection<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<FilterOption<T>>
  value: T
  onChange: (next: T) => void
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionLabel}>{label}</Text>
      <View style={styles.filterChipRow}>
        {options.map((option) => (
          <AppChoiceChip
            key={option.value}
            label={option.label}
            active={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  )
}

type FilterPanelProps = SurveyListFilters & { advancedOpen: boolean }

// Status chips (shown when a status is picked or the panel is open) and the
// advanced panel: dates, sync, blocked, attachments, sort, reset.
export function FilterPanel({ advancedOpen, ...filters }: FilterPanelProps) {
  return (
    <>
      {/* P2-COMPACT-02: Status chips only when active filter or advanced panel open */}
      {filters.statusFilter !== "all" || advancedOpen ? (
        <FilterSection
          label={t.sections.status}
          options={STATUS_OPTIONS}
          value={filters.statusFilter}
          onChange={filters.setStatusFilter}
        />
      ) : null}

      {advancedOpen ? (
        <View style={styles.advancedPanel}>
          <View style={styles.dateInputsRow}>
            <AppField
              label={t.sections.from}
              value={filters.surveyFromDate}
              onChangeText={filters.setSurveyFromDate}
              placeholder={t.datePlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.dateInputBlock}
              labelStyle={styles.filterSectionLabel}
              inputStyle={styles.compactInput}
            />
            <AppField
              label={t.sections.to}
              value={filters.surveyToDate}
              onChangeText={filters.setSurveyToDate}
              placeholder={t.datePlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.dateInputBlock}
              labelStyle={styles.filterSectionLabel}
              inputStyle={styles.compactInput}
            />
          </View>

          <FilterSection
            label={t.sections.sync}
            options={SYNC_OPTIONS}
            value={filters.syncFilter}
            onChange={filters.setSyncFilter}
          />
          <FilterSection
            label={t.sections.blocked}
            options={BLOCKED_OPTIONS}
            value={filters.blockedFilter}
            onChange={filters.setBlockedFilter}
          />
          <FilterSection
            label={t.sections.attachments}
            options={ATTACHMENT_OPTIONS}
            value={filters.attachmentFilter}
            onChange={filters.setAttachmentFilter}
          />
          <FilterSection
            label={t.sections.sort}
            options={SORT_OPTIONS}
            value={filters.sortMode}
            onChange={filters.setSortMode}
          />

          <AppButton
            label={t.reset}
            variant="secondary"
            size="sm"
            onPress={filters.resetFilters}
            style={sharedStyles.resetButton}
          />
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  filterSection: {
    gap: 6,
  },
  filterSectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: brandColors.forest,
    textTransform: "uppercase",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingRight: 8,
  },
  advancedPanel: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingTop: 10,
  },
  dateInputsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateInputBlock: {
    flex: 1,
    gap: 4,
  },
  compactInput: {
    minHeight: 40,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
})
