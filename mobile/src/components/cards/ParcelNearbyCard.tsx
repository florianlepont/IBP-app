import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandComponentTokens, brandRadius, brandShadow, brandTypography } from "../../app/brand-tokens"
import { IbpScoreBadge } from "../../ui/IbpScoreBadge"
import type { PublicParcelStatusItem } from "../../app/types"

type ParcelNearbyCardProps = {
  parcel: PublicParcelStatusItem
  distanceKm: number
  surveyCount: number
  onPress: () => void
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function formatParcelId(parcelId: string): string {
  const parts = parcelId.split("-")
  if (parts.length >= 3) return `Parcelle ${parts.slice(-2).join("-")}`
  return `Parcelle ${parcelId}`
}

export function ParcelNearbyCard({ parcel, distanceKm, surveyCount, onPress }: ParcelNearbyCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <IbpScoreBadge score={parcel.latest_ibp_total} size="md" />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {formatParcelId(parcel.parcel_id)}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={brandColors.textSecondary} />
          <Text style={styles.metaText}>{formatDistance(distanceKm)}</Text>
          {surveyCount > 0 ? (
            <>
              <Text style={styles.metaSeparator}>·</Text>
              <Text style={styles.metaText}>
                {surveyCount} relevé{surveyCount > 1 ? "s" : ""}
              </Text>
            </>
          ) : null}
          {parcel.latest_observation_year ? (
            <>
              <Text style={styles.metaSeparator}>·</Text>
              <Text style={styles.metaText}>{parcel.latest_observation_year}</Text>
            </>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: brandColors.panel,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandComponentTokens.card.panelBorder,
    padding: 14,
    ...brandShadow.card,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...brandTypography.input,
    color: brandColors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  metaSeparator: {
    ...brandTypography.meta,
    color: brandColors.divider,
  },
})
