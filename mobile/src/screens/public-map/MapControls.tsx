import { memo } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import { fr } from "../../i18n"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppField } from "../../ui/AppField"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { controlStyles as styles } from "./styles"

const t = fr.publicMap

export type MapTopControlsProps = {
  top: number
  count: number
  loading: boolean
  showFilters: boolean
  showParcelLayer: boolean
  layerStatusLabel: string
  fromDate: string
  toDate: string
  region: string
  onToggleFilters: () => void
  onToggleParcelLayer: () => void
  onRefresh: () => void
  onApplyFilters: () => void
  onChangeFromDate: (value: string) => void
  onChangeToDate: (value: string) => void
  onChangeRegion: (value: string) => void
}

/** Explorer badge, survey count, filters toggle, refresh and the filters panel. */
export const MapTopControls = memo(function MapTopControls({
  top,
  count,
  loading,
  showFilters,
  showParcelLayer,
  layerStatusLabel,
  fromDate,
  toDate,
  region,
  onToggleFilters,
  onToggleParcelLayer,
  onRefresh,
  onApplyFilters,
  onChangeFromDate,
  onChangeToDate,
  onChangeRegion,
}: MapTopControlsProps) {
  return (
    <View pointerEvents="box-none" style={[styles.overlayShell, { top }]}>
      <View style={styles.topDock}>
        <View style={styles.topDockLeft}>
          <View style={styles.exploreBadge}>
            <Ionicons name="globe-outline" size={15} color={brandColors.forest} />
            <Text style={styles.exploreBadgeText}>{t.badge}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{t.count(count)}</Text>
          </View>
        </View>

        <View style={styles.topDockActions}>
          <Pressable
            style={styles.iconButton}
            onPress={onToggleFilters}
            accessibilityRole="button"
            accessibilityLabel={showFilters ? t.a11y.hideFilters : t.a11y.showFilters}
            accessibilityState={{ expanded: showFilters }}
          >
            <Ionicons
              name={showFilters ? "close-outline" : "options-outline"}
              size={18}
              color={brandColors.forest}
            />
          </Pressable>
          <Pressable
            style={loading ? styles.iconButtonDisabled : styles.iconButtonPrimary}
            onPress={onRefresh}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t.a11y.refresh}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={brandColors.white} />
            ) : (
              <Ionicons name="refresh" size={18} color={brandColors.white} />
            )}
          </Pressable>
        </View>
      </View>

      {showFilters ? (
        <AppCard variant="panelElevated" padding={14} style={styles.filtersPanel}>
          <AppSectionHeader
            title={t.filters.title}
            subtitle={t.filters.subtitle}
            titleStyle={styles.filtersTitle}
            subtitleStyle={styles.filtersMeta}
            trailing={
              <Pressable
                style={[
                  styles.layerTogglePill,
                  showParcelLayer ? styles.layerTogglePillOn : styles.layerTogglePillOff,
                ]}
                onPress={onToggleParcelLayer}
                accessibilityRole="button"
                accessibilityLabel={showParcelLayer ? t.a11y.hideParcels : t.a11y.showParcels}
                accessibilityState={{ selected: showParcelLayer }}
              >
                <Ionicons
                  name={showParcelLayer ? "layers" : "layers-outline"}
                  size={14}
                  color={showParcelLayer ? brandColors.white : brandColors.forest}
                />
                <Text
                  style={[
                    styles.layerTogglePillText,
                    showParcelLayer ? styles.layerTogglePillTextOn : null,
                  ]}
                >
                  {layerStatusLabel}
                </Text>
              </Pressable>
            }
          />

          <View style={styles.filtersGrid}>
            <AppField
              label={t.filters.from}
              value={fromDate}
              onChangeText={onChangeFromDate}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t.filters.fromPlaceholder}
              containerStyle={styles.filterFieldHalf}
              labelStyle={styles.inputLabel}
              inputStyle={styles.input}
            />
            <AppField
              label={t.filters.to}
              value={toDate}
              onChangeText={onChangeToDate}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t.filters.toPlaceholder}
              containerStyle={styles.filterFieldHalf}
              labelStyle={styles.inputLabel}
              inputStyle={styles.input}
            />
            <AppField
              label={t.filters.region}
              value={region}
              onChangeText={onChangeRegion}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={t.filters.regionPlaceholder}
              containerStyle={styles.filterFieldFull}
              labelStyle={styles.inputLabel}
              inputStyle={styles.input}
            />
            <AppButton
              label={loading ? t.filters.applying : t.filters.apply}
              leadingIcon="sparkles-outline"
              onPress={onApplyFilters}
              disabled={loading}
              style={[styles.refreshButton, loading ? styles.refreshButtonDisabled : null]}
            />
          </View>
        </AppCard>
      ) : null}
    </View>
  )
})

export type MapBottomDockProps = {
  bottom: number
  showEmpty: boolean
  locating: boolean
  onLocate: () => void
}

/** The "no survey here" bubble and the locate button. */
export const MapBottomDock = memo(function MapBottomDock({
  bottom,
  showEmpty,
  locating,
  onLocate,
}: MapBottomDockProps) {
  return (
    <View style={[styles.bottomDock, { bottom }]}>
      {showEmpty ? (
        <AppCard variant="panelElevated" padding={14} style={styles.emptyDockBubble}>
          <Text style={styles.emptyDockText}>{t.empty}</Text>
        </AppCard>
      ) : (
        <View />
      )}

      <Pressable
        style={styles.locateButton}
        onPress={onLocate}
        disabled={locating}
        accessibilityRole="button"
        accessibilityLabel={t.a11y.locate}
        accessibilityState={{ disabled: locating, busy: locating }}
      >
        {locating ? (
          <ActivityIndicator size="small" color={brandColors.white} />
        ) : (
          <Ionicons name="locate" size={20} color={brandColors.white} />
        )}
      </Pressable>
    </View>
  )
})
