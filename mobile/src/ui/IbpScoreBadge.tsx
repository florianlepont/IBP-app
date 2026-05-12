import { StyleSheet, Text, View } from "react-native"
import { brandTypography, ibpScoreTokens } from "../app/brand-tokens"

type IbpScoreBadgeProps = {
  score: number | null | undefined
  size?: "sm" | "md"
}

function getScoreColors(score: number | null | undefined) {
  if (score == null) return ibpScoreTokens.colors.empty
  if (score >= ibpScoreTokens.thresholds.high) return ibpScoreTokens.colors.high
  if (score >= ibpScoreTokens.thresholds.mid) return ibpScoreTokens.colors.mid
  return ibpScoreTokens.colors.low
}

export function IbpScoreBadge({ score, size = "md" }: IbpScoreBadgeProps) {
  const colors = getScoreColors(score)
  const isSm = size === "sm"

  return (
    <View
      style={[
        styles.badge,
        isSm ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.score, isSm ? styles.scoreSm : styles.scoreMd, { color: colors.text }]}>
        {score != null ? String(score) : "—"}
      </Text>
      <Text style={[styles.denom, { color: colors.text }]}>/10</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMd: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  badgeSm: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  score: {
    fontWeight: "900",
    lineHeight: undefined,
  },
  scoreMd: {
    fontSize: 20,
  },
  scoreSm: {
    fontSize: 14,
  },
  denom: {
    ...brandTypography.meta,
    lineHeight: 12,
  },
})
