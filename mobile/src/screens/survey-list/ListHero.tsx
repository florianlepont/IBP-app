import { useCallback, useMemo, useState } from "react"
import { Animated, Image, StyleSheet, Text, View } from "react-native"
import type { LayoutChangeEvent } from "react-native"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../../app/brand-tokens"
import type { computeSurveyStats } from "../../app/survey-logic"
import type { SurveyBlockedFilter, SurveyStatusFilter, SurveySyncFilter } from "../../app/types"
import { fr } from "../../i18n"
import { BrandBump } from "../../ui/BrandBump"
import { StatTile } from "./StatTile"
import type { StatTileProps } from "./StatTile"

const t = fr.surveyList

// P3-LAYOUT-01: reserve enough room so the round logo never collides with copy
const HERO_ORNAMENT_EXCLUSION = 92
const HERO_EXPANDED_PADDING_TOP = 16
const HERO_EXPANDED_PADDING_BOTTOM = 14
const HERO_EXPANDED_CONTENT_GAP = 14
const COLLAPSED_HERO_HEIGHT = 88

export type HeroGeometry = {
  expandedHeroHeight: number
  collapsedHeroHeight: number
  heroTopInset: number
  onHeaderLayout: (event: LayoutChangeEvent) => void
  onStatsLayout: (event: LayoutChangeEvent) => void
}

// P1-GLANCE-01: reduced hero height. The screen reads the geometry too: the
// list content starts under the expanded hero.
export function useHeroGeometry(viewportHeight: number, safeTop: number): HeroGeometry {
  const [headerHeight, setHeaderHeight] = useState(0)
  const [statsRowHeight, setStatsRowHeight] = useState(0)

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(Math.ceil(event.nativeEvent.layout.height))
  }, [])
  const onStatsLayout = useCallback((event: LayoutChangeEvent) => {
    setStatsRowHeight(Math.ceil(event.nativeEvent.layout.height))
  }, [])

  const baseExpandedHeroHeight = Math.max(190, Math.min(215, Math.round(viewportHeight * 0.22)))
  const measuredExpandedHeroHeight =
    headerHeight > 0 && statsRowHeight > 0
      ? HERO_EXPANDED_PADDING_TOP +
        headerHeight +
        HERO_EXPANDED_CONTENT_GAP +
        statsRowHeight +
        HERO_EXPANDED_PADDING_BOTTOM
      : 0

  return {
    expandedHeroHeight: Math.max(baseExpandedHeroHeight, measuredExpandedHeroHeight),
    collapsedHeroHeight: COLLAPSED_HERO_HEIGHT,
    heroTopInset: safeTop + brandSpacing.xs,
    onHeaderLayout,
    onStatsLayout,
  }
}

type ListHeroProps = {
  scrollY: Animated.Value
  geometry: HeroGeometry
  cardWidth: number
  stats: ReturnType<typeof computeSurveyStats>
  surveyCount: number
  visibleCount: number
  totalFilterCount: number
  attentionCount: number
  continueDraftName: string | null
  resetFilters: () => void
  setStatusFilter: (value: SurveyStatusFilter) => void
  setSyncFilter: (value: SurveySyncFilter) => void
  setBlockedFilter: (value: SurveyBlockedFilter) => void
}

export function ListHero({
  scrollY,
  geometry,
  cardWidth,
  stats,
  surveyCount,
  visibleCount,
  totalFilterCount,
  attentionCount,
  continueDraftName,
  resetFilters,
  setStatusFilter,
  setSyncFilter,
  setBlockedFilter,
}: ListHeroProps) {
  const { expandedHeroHeight, collapsedHeroHeight, heroTopInset } = geometry
  const collapseDistance = expandedHeroHeight - collapsedHeroHeight

  const compactSummary = useMemo(() => {
    if (totalFilterCount > 0) {
      return t.hero.compactFiltered({
        visible: visibleCount,
        total: surveyCount,
        filters: totalFilterCount,
      })
    }
    return t.hero.compactSummary({ total: stats.total, draft: stats.draft, pending: stats.pending })
  }, [totalFilterCount, visibleCount, surveyCount, stats.total, stats.draft, stats.pending])

  // P2-GLANCE-03: dynamic hero body
  const heroBodyText = useMemo(() => {
    const body = t.hero.body
    if (surveyCount === 0) return body.empty
    if (stats.blocked > 0) return body.blocked(stats.blocked)
    if (attentionCount > 0) return body.attention(attentionCount)
    if (continueDraftName) return body.draftWaiting(continueDraftName)
    if (stats.submitted > 0 && stats.draft === 0) return body.upToDate
    return body.fallback
  }, [surveyCount, stats, attentionCount, continueDraftName])

  // P3-PERSON-05: hero stat tiles with severity
  const heroStats = useMemo<StatTileProps[]>(
    () => [
      {
        label: t.stats.total,
        value: String(stats.total),
        severity: "neutral",
        onPress: resetFilters,
        accessibilityLabel: t.stats.a11y.total(stats.total),
      },
      {
        label: t.stats.draft,
        value: String(stats.draft),
        severity: "neutral",
        onPress: () => setStatusFilter("draft"),
        accessibilityLabel: t.stats.a11y.draft(stats.draft),
      },
      {
        label: t.stats.pending,
        value: String(stats.pending),
        severity: stats.pending > 0 ? "warning" : "neutral",
        onPress: () => setSyncFilter("pending"),
        accessibilityLabel: t.stats.a11y.pending(stats.pending),
      },
      stats.blocked > 0
        ? {
            label: t.stats.blocked,
            value: String(stats.blocked),
            severity: "danger",
            onPress: () => setBlockedFilter("blocked"),
            accessibilityLabel: t.stats.a11y.blocked(stats.blocked),
          }
        : {
            label: t.stats.submitted,
            value: String(stats.submitted),
            severity: "neutral",
            onPress: () => setStatusFilter("submitted"),
            accessibilityLabel: t.stats.a11y.submitted(stats.submitted),
          },
    ],
    [stats, resetFilters, setStatusFilter, setSyncFilter, setBlockedFilter],
  )

  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeroHeight, collapsedHeroHeight],
    extrapolate: "clamp",
  })
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.34, collapseDistance * 0.56],
    outputRange: [1, 0.22, 0],
    extrapolate: "clamp",
  })
  const expandedTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.56],
    outputRange: [0, -8],
    extrapolate: "clamp",
  })
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.28, collapseDistance * 0.56, collapseDistance],
    outputRange: [0, 0.72, 1],
    extrapolate: "clamp",
  })
  const compactTranslateY = scrollY.interpolate({
    inputRange: [collapseDistance * 0.28, collapseDistance],
    outputRange: [10, 0],
    extrapolate: "clamp",
  })
  const heroShellHeight = Animated.add(heroHeight, heroTopInset)

  return (
    // Hero — box-none so stat tiles are tappable, scroll passes through
    <Animated.View
      pointerEvents="box-none"
      style={[styles.heroShell, { height: heroShellHeight, paddingTop: heroTopInset }]}
    >
      <View pointerEvents="box-none" style={styles.heroCard}>
        {/* Decorative brand mark */}
        <View pointerEvents="none" style={styles.heroLogoWrap}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../../../assets/logo-app.png")}
            style={styles.heroLogoOrnament}
            resizeMode="contain"
          />
        </View>

        {/* Expanded layer */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.heroExpandedLayer,
            { opacity: expandedOpacity, transform: [{ translateY: expandedTranslateY }] },
          ]}
        >
          {/* Title area — non-interactive */}
          <View
            pointerEvents="none"
            style={styles.heroExpandedHeader}
            onLayout={geometry.onHeaderLayout}
          >
            {/* P2-PERSON-02: Contextual eyebrow */}
            <Text style={styles.heroEyebrow}>{t.hero.eyebrow}</Text>
            <Text style={styles.heroTitleExpanded}>{t.hero.title}</Text>
            {/* P2-GLANCE-03: Dynamic body */}
            <Text style={styles.heroBody}>{heroBodyText}</Text>
          </View>

          {/* P1-GLANCE-01: Single horizontal row of 4 stat tiles */}
          <View
            pointerEvents="box-none"
            style={styles.heroStatsRow}
            onLayout={geometry.onStatsLayout}
          >
            {heroStats.map((stat) => (
              <StatTile key={stat.label} {...stat} />
            ))}
          </View>
        </Animated.View>

        {/* Compact layer */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heroCompactLayer,
            { opacity: compactOpacity, transform: [{ translateY: compactTranslateY }] },
          ]}
        >
          <Text numberOfLines={1} style={styles.heroTitleCompact}>
            {t.hero.title}
          </Text>
          <Text numberOfLines={1} style={styles.heroCompactSummary}>
            {compactSummary}
          </Text>
        </Animated.View>

        {/* P1-PERSON-01: BrandBump at the bottom of the hero card */}
        <View pointerEvents="none">
          <BrandBump width={cardWidth} height={22} color={brandColors.moss} opacity={0.16} />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  heroShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 16,
  },
  heroCard: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    borderRadius: brandRadius.hero,
    backgroundColor: brandColors.forest,
    ...brandShadow.card,
  },
  // Decorative round logo, lightly faded into the hero background.
  heroLogoWrap: {
    position: "absolute",
    top: -12,
    right: -14,
  },
  heroExpandedLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-start",
    paddingTop: HERO_EXPANDED_PADDING_TOP,
    paddingBottom: HERO_EXPANDED_PADDING_BOTTOM,
    paddingHorizontal: 20,
    gap: HERO_EXPANDED_CONTENT_GAP,
  },
  heroExpandedHeader: {
    gap: 6,
    // P3-LAYOUT-01: uses named constant so fern/text exclusion stays in sync
    paddingRight: HERO_ORNAMENT_EXCLUSION,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandSemanticColors.heroMetaOnDark,
  },
  heroTitleExpanded: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.heroBody,
    color: brandSemanticColors.heroBodyOnDark,
  },
  // P1-GLANCE-01: single horizontal row (replaces 2×2 grid)
  heroStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  heroCompactLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingRight: 96,
    gap: 6,
  },
  heroLogoOrnament: {
    width: 136,
    height: 136,
    opacity: 0.16,
  },
  heroTitleCompact: {
    ...brandTypography.heroTitle,
    fontSize: 24,
    lineHeight: 28,
    color: brandColors.white,
  },
  heroCompactSummary: {
    ...brandTypography.meta,
    fontSize: 13,
    lineHeight: 18,
    color: brandSemanticColors.heroMetaOnDark,
  },
})
