import { useEffect } from "react"
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandSpacing,
  brandTypography,
  ibpScoreTokens,
} from "../app/brand-tokens"
import type { AuthUser } from "../app/types"
import type { LocalSurvey } from "../storage/types"
import type { SurveyStats } from "../app/types"
import { AppButton } from "../ui/AppButton"
import { AppNotice } from "../ui/AppNotice"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { DraftCard } from "../components/cards/DraftCard"
import { ParcelNearbyCard } from "../components/cards/ParcelNearbyCard"
import type { NearbyParcelsState } from "../hooks/useNearbyParcels"

type HomeScreenProps = {
  currentUser: AuthUser | null
  surveys: LocalSurvey[]
  surveyStats: SurveyStats
  nearbyParcels: NearbyParcelsState
  onLoadNearbyParcels: () => void
  onCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
  onNavigateToExplorer: () => void
  onRefresh: () => Promise<void>
}

function getFirstName(user: AuthUser | null): string {
  if (!user) return ""
  return user.first_name?.trim() || user.display_name?.split(" ")[0] || ""
}

function formatTodayDate(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())
}

export function HomeScreen({
  currentUser,
  surveys,
  surveyStats,
  nearbyParcels,
  onLoadNearbyParcels,
  onCreateSurvey,
  onOpenSurvey,
  onNavigateToExplorer,
  onRefresh,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets()
  const firstName = getFirstName(currentUser)
  const drafts = surveys
    .filter((s) => s.status === "draft")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)

  useEffect(() => {
    onLoadNearbyParcels()
  }, [onLoadNearbyParcels])

  const hasAlerts = surveyStats.blocked > 0 || surveyStats.failed > 0

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl onRefresh={onRefresh} refreshing={false} tintColor={brandColors.moss} />
      }
    >
      {/* ── Greeting ──────────────────────────────── */}
      <View style={styles.greeting}>
        <View>
          <Text style={styles.greetingTitle}>
            {firstName ? `Bonjour, ${firstName}` : "Bonjour"}
          </Text>
          <Text style={styles.greetingDate}>{formatTodayDate()}</Text>
        </View>
        {currentUser?.profile_picture_url ? null : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={20} color={brandColors.textSecondary} />
          </View>
        )}
      </View>

      {/* ── Alertes ───────────────────────────────── */}
      {hasAlerts ? (
        <AppNotice
          tone={surveyStats.blocked > 0 ? "danger" : "warning"}
          icon={surveyStats.blocked > 0 ? "warning-outline" : "cloud-upload-outline"}
          title={
            surveyStats.blocked > 0
              ? `${surveyStats.blocked} relevé${surveyStats.blocked > 1 ? "s" : ""} bloqué${surveyStats.blocked > 1 ? "s" : ""}`
              : `${surveyStats.failed} relevé${surveyStats.failed > 1 ? "s" : ""} en erreur de sync`
          }
          message="Vérifiez votre connexion pour relancer la synchronisation."
          style={styles.notice}
        />
      ) : null}

      {/* ── Hero CTA ──────────────────────────────── */}
      <View style={styles.heroCta}>
        <Text style={styles.heroEyebrow}>COMMENCER</Text>
        <Text style={styles.heroTitle}>Nouveau relevé IBP</Text>
        <Text style={styles.heroBody}>{"Localisez une parcelle et démarrez l'inventaire."}</Text>
        <AppButton
          label="Démarrer un relevé"
          leadingIcon="add"
          size="lg"
          variant="primary"
          onPress={onCreateSurvey}
          style={styles.heroButton}
          labelStyle={{ color: brandColors.canvas }}
        />
      </View>

      {/* ── Brouillons ────────────────────────────── */}
      {drafts.length > 0 ? (
        <View style={styles.section}>
          <AppSectionHeader
            title="Brouillons"
            subtitle={`${drafts.length} relevé${drafts.length > 1 ? "s" : ""} en cours`}
            style={styles.sectionHeader}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.draftsScroll}
          >
            {drafts.map((survey) => (
              <DraftCard key={survey.id} survey={survey} onPress={() => onOpenSurvey(survey.id)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Parcelles proches ─────────────────────── */}
      <View style={styles.section}>
        <AppSectionHeader
          title="Autour de vous"
          trailing={
            <Pressable onPress={onNavigateToExplorer} hitSlop={8}>
              <Text style={styles.trailingLink}>Voir carte ›</Text>
            </Pressable>
          }
          style={styles.sectionHeader}
        />

        {nearbyParcels.locationDenied ? (
          <AppNotice
            tone="info"
            icon="location-outline"
            message="Activez la localisation pour voir les parcelles proches."
          />
        ) : nearbyParcels.error ? (
          <AppNotice
            tone="warning"
            icon="wifi-outline"
            message="Impossible de charger les parcelles. Vérifiez votre connexion."
          />
        ) : nearbyParcels.loading ? (
          <View style={styles.loadingRow}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </View>
        ) : nearbyParcels.parcels.length === 0 ? (
          <AppNotice
            tone="info"
            icon="leaf-outline"
            message="Aucune parcelle relevée dans un rayon de 2,5 km."
          />
        ) : (
          <View style={styles.parcelsList}>
            {nearbyParcels.parcels.map((parcel) => (
              <ParcelNearbyCard
                key={parcel.parcel_id}
                parcel={parcel}
                distanceKm={parcel.distanceKm}
                surveyCount={parcel.surveyCount}
                onPress={onNavigateToExplorer}
              />
            ))}

            {/* Score secteur */}
            {nearbyParcels.sectorAvgScore != null ? (
              <View style={styles.sectorCard}>
                <View style={styles.sectorHeader}>
                  <Text style={styles.sectorLabel}>SCORE IBP MOYEN DU SECTEUR</Text>
                  <Text style={styles.sectorScore}>{nearbyParcels.sectorAvgScore} / 10</Text>
                </View>
                <View style={styles.scoreDotsRow}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const filled = i < Math.round(nearbyParcels.sectorAvgScore ?? 0)
                    const score = nearbyParcels.sectorAvgScore ?? 0
                    const dotColor =
                      score >= ibpScoreTokens.thresholds.high
                        ? brandColors.moss
                        : score >= ibpScoreTokens.thresholds.mid
                          ? brandColors.ochre
                          : brandColors.terracotta
                    return (
                      <View
                        key={i}
                        style={[
                          styles.scoreDot,
                          { backgroundColor: filled ? dotColor : brandColors.divider },
                        ]}
                      />
                    )
                  })}
                </View>
                <Text style={styles.sectorMeta}>
                  {nearbyParcels.parcels.filter((p) => p.latest_ibp_total != null).length} relevés
                  analysés · rayon ~2,5 km
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const PAGE_H = 20

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  content: {
    gap: 0,
  },

  // Greeting
  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: PAGE_H,
    marginBottom: 16,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: brandColors.forest,
    lineHeight: 32,
  },
  greetingDate: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    marginTop: 2,
    textTransform: "capitalize",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    alignItems: "center",
    justifyContent: "center",
  },

  // Notice
  notice: {
    marginHorizontal: PAGE_H,
    marginBottom: 16,
  },

  // Hero CTA
  heroCta: {
    marginHorizontal: PAGE_H,
    backgroundColor: brandColors.forest,
    borderRadius: brandRadius.card,
    padding: 24,
    paddingBottom: 28,
    gap: 8,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: brandColors.moss,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: brandColors.canvas,
    lineHeight: 30,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: brandSemanticColors.heroBodyOnDark,
    marginBottom: 4,
  },
  heroButton: {
    backgroundColor: brandColors.moss,
    marginTop: 4,
  },

  // Sections
  section: {
    marginTop: brandSpacing.xl + 4,
  },
  sectionHeader: {
    paddingHorizontal: PAGE_H,
    marginBottom: 14,
  },
  trailingLink: {
    ...brandTypography.label,
    color: brandColors.moss,
  },

  // Drafts
  draftsScroll: {
    paddingHorizontal: PAGE_H,
    gap: 12,
  },

  // Parcels
  parcelsList: {
    paddingHorizontal: PAGE_H,
    gap: 10,
  },
  loadingRow: {
    paddingHorizontal: PAGE_H,
    gap: 10,
  },
  skeletonCard: {
    height: 72,
    borderRadius: brandRadius.card,
    backgroundColor: brandColors.panelMuted,
  },

  // Sector score card
  sectorCard: {
    backgroundColor: brandSemanticColors.surfaceSoft,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  sectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectorLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: brandColors.forest,
    textTransform: "uppercase",
    flex: 1,
  },
  sectorScore: {
    fontSize: 22,
    fontWeight: "900",
    color: brandColors.forest,
  },
  scoreDotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  scoreDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  sectorMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
