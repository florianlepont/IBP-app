import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandRadius, brandTypography } from "../../app/brand-tokens"
import { AppCard } from "../../ui/AppCard"
import { FilterPanel } from "./FilterPanel"
import type { SurveyListFilters } from "./FilterPanel"

type FilterBarProps = SurveyListFilters & {
  useNativeSearchUI: boolean
  stickyFilterOffset: number
  summaryLabel: string
  advancedFilterCount: number
  showInlineSearch: boolean
  surveyQuery: string
  setSurveyQuery: (value: string) => void
}

// The sticky filters bar (list header, sticky index 0): summary, advanced
// toggle, inline search and the filter panel.
export function FilterBar({
  useNativeSearchUI,
  stickyFilterOffset,
  summaryLabel,
  advancedFilterCount,
  showInlineSearch,
  surveyQuery,
  setSurveyQuery,
  ...filters
}: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const hasQuery = surveyQuery.trim().length > 0

  return (
    <View
      style={[
        styles.filtersStickyHost,
        useNativeSearchUI
          ? styles.filtersStickyHostNativeSearch
          : { paddingTop: stickyFilterOffset },
      ]}
    >
      <AppCard variant="panelElevated" padding={14} style={styles.filtersCard}>
        <View style={styles.filtersHeaderRow}>
          <View style={styles.filtersHeadingBlock}>
            <View style={styles.filtersCompactTitleRow}>
              <Ionicons name="funnel-outline" size={14} color={brandColors.forest} />
              <Text style={styles.filtersCompactTitle}>Filtres</Text>
            </View>
            <Text numberOfLines={1} style={styles.filtersCompactMeta}>
              {summaryLabel}
            </Text>
          </View>

          <Pressable
            accessibilityLabel={
              advancedOpen ? "Masquer les filtres avancés" : "Afficher les filtres avancés"
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            style={styles.advancedToggle}
            onPress={() => setAdvancedOpen((current) => !current)}
          >
            <Ionicons
              name={advancedOpen ? "close" : "funnel-outline"}
              size={16}
              color={brandColors.forest}
            />
            <Text style={styles.advancedToggleText}>
              {advancedOpen
                ? "Fermer"
                : advancedFilterCount > 0
                  ? `${advancedFilterCount} actif${advancedFilterCount > 1 ? "s" : ""}`
                  : "Plus"}
            </Text>
          </Pressable>
        </View>

        {/* Inline search */}
        {showInlineSearch ? (
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Ionicons name="search-outline" size={18} color={brandColors.textSecondary} />
              <TextInput
                value={surveyQuery}
                onChangeText={setSurveyQuery}
                placeholder="Rechercher par nom de site"
                placeholderTextColor={brandColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                style={styles.searchInput}
              />
              {hasQuery ? (
                <Pressable
                  accessibilityLabel="Effacer la recherche"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setSurveyQuery("")}
                  style={styles.searchClearButton}
                >
                  <Ionicons name="close-circle" size={18} color={brandColors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <FilterPanel advancedOpen={advancedOpen} {...filters} />
      </AppCard>
    </View>
  )
}

const styles = StyleSheet.create({
  filtersStickyHost: {
    backgroundColor: brandColors.canvas,
    zIndex: 1,
    paddingBottom: 10,
  },
  filtersStickyHostNativeSearch: {
    paddingTop: 4,
  },
  filtersCard: {
    gap: 10,
  },
  filtersHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  filtersHeadingBlock: {
    flex: 1,
    gap: 4,
  },
  filtersCompactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filtersCompactTitle: {
    ...brandTypography.meta,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: brandColors.forest,
    textTransform: "uppercase",
  },
  filtersCompactMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  advancedToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  advancedToggleText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  searchRow: {
    paddingBottom: 2,
  },
  searchField: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.inputFill,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
    color: brandColors.textPrimary,
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 18,
  },
  searchClearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
})
