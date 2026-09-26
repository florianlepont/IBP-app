import { useEffect } from "react"
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors } from "../app/brand-tokens"
import type { AuthUser } from "../app/types"
import type { LocalSurvey } from "../storage/types"
import type { SurveyStats } from "../app/types"
import { AppButton } from "../ui/AppButton"
import { AppNotice } from "../ui/AppNotice"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { DraftCard } from "../components/cards/DraftCard"
import { ParcelNearbyCard } from "../components/cards/ParcelNearbyCard"
import type { NearbyParcelsState } from "../hooks/useNearbyParcels"
import { fr } from "../i18n"
import { SectorScoreCard } from "./home/SectorScoreCard"
import { styles } from "./home/styles"

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
            {firstName ? fr.home.greetingWithName({ name: firstName }) : fr.home.greeting}
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
              ? fr.home.alerts.blocked({ count: surveyStats.blocked })
              : fr.home.alerts.failed({ count: surveyStats.failed })
          }
          message={fr.home.alerts.message}
          style={styles.notice}
        />
      ) : null}

      {/* ── Hero CTA ──────────────────────────────── */}
      <View style={styles.heroCta}>
        <Text style={styles.heroEyebrow}>{fr.home.hero.eyebrow}</Text>
        <Text style={styles.heroTitle}>{fr.home.hero.title}</Text>
        <Text style={styles.heroBody}>{fr.home.hero.body}</Text>
        <AppButton
          label={fr.home.hero.button}
          leadingIcon="add"
          size="lg"
          variant="primary"
          onPress={onCreateSurvey}
          style={styles.heroButton}
          labelStyle={styles.heroButtonLabel}
        />
      </View>

      {/* ── Brouillons ────────────────────────────── */}
      {drafts.length > 0 ? (
        <View style={styles.section}>
          <AppSectionHeader
            title={fr.home.drafts.title}
            subtitle={fr.home.drafts.subtitle({ count: drafts.length })}
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
          title={fr.home.nearby.title}
          trailing={
            <Pressable
              onPress={onNavigateToExplorer}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={fr.home.nearby.seeMapLabel}
            >
              <Text style={styles.trailingLink}>{fr.home.nearby.seeMap}</Text>
            </Pressable>
          }
          style={styles.sectionHeader}
        />

        {nearbyParcels.locationDenied ? (
          <AppNotice tone="info" icon="location-outline" message={fr.home.nearby.locationDenied} />
        ) : nearbyParcels.error ? (
          <AppNotice tone="warning" icon="wifi-outline" message={fr.home.nearby.loadError} />
        ) : nearbyParcels.loading ? (
          <View style={styles.loadingRow}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </View>
        ) : nearbyParcels.parcels.length === 0 ? (
          <AppNotice tone="info" icon="leaf-outline" message={fr.home.nearby.empty} />
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

            {nearbyParcels.sectorAvgScore != null ? (
              <SectorScoreCard
                score={nearbyParcels.sectorAvgScore}
                analysedCount={
                  nearbyParcels.parcels.filter((p) => p.latest_ibp_total != null).length
                }
              />
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
