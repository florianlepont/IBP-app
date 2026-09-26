import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandTypography,
} from "../../app/brand-tokens"
import { triggerHaptic } from "./haptics"

// P3-PERSON-05: severity prop for visual differentiation
export type StatTileSeverity = "neutral" | "warning" | "danger"

export type StatTileProps = {
  label: string
  value: string
  severity?: StatTileSeverity
  onPress: () => void
  accessibilityLabel: string
}

// P3-PERSON-05: severity tint + P1-A11Y-01: funnel affordance
export function StatTile({
  label,
  value,
  severity = "neutral",
  onPress,
  accessibilityLabel,
}: StatTileProps) {
  const chipBg =
    severity === "danger"
      ? "rgba(205,88,51,0.20)"
      : severity === "warning"
        ? "rgba(204,112,31,0.20)"
        : brandSemanticColors.heroPanelBackgroundOnDark
  const chipBorder =
    severity === "danger"
      ? "rgba(205,88,51,0.40)"
      : severity === "warning"
        ? "rgba(204,112,31,0.40)"
        : brandSemanticColors.heroPanelBorderOnDark

  return (
    <Pressable
      onPress={() => {
        triggerHaptic()
        onPress()
      }}
      style={({ pressed }) => [pressed && styles.statTilePressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.statTile, { backgroundColor: chipBg, borderColor: chipBorder }]}>
        <Text style={styles.statTileText}>
          {value} {label}
        </Text>
        {/* P1-A11Y-01: subtle funnel affordance hinting the tile is interactive */}
        <Ionicons name="funnel-outline" size={9} color="rgba(255,255,255,0.50)" />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // P3-PERSON-05 + P1-A11Y-01: custom tile (not AppStatusChip) for full style control
  statTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: brandRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statTileText: {
    ...brandTypography.meta,
    fontSize: 12,
    color: brandColors.white,
  },
  statTilePressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
})
