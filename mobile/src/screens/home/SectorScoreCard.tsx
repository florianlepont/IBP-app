import { Text, View } from "react-native"
import { brandColors, ibpScoreTokens } from "../../app/brand-tokens"
import { fr } from "../../i18n"
import { styles } from "./styles"

type SectorScoreCardProps = {
  score: number
  analysedCount: number
}

function getDotColor(score: number): string {
  if (score >= ibpScoreTokens.thresholds.high) return brandColors.moss
  if (score >= ibpScoreTokens.thresholds.mid) return brandColors.ochre
  return brandColors.terracotta
}

// Average IBP score of the surveyed parcels around the user, as 10 dots.
export function SectorScoreCard({ score, analysedCount }: SectorScoreCardProps) {
  const dotColor = getDotColor(score)
  const filledCount = Math.round(score)

  return (
    <View style={styles.sectorCard}>
      <View style={styles.sectorHeader}>
        <Text style={styles.sectorLabel}>{fr.home.sector.label}</Text>
        <Text style={styles.sectorScore}>{fr.home.sector.score({ score })}</Text>
      </View>
      <View style={styles.scoreDotsRow}>
        {Array.from({ length: 10 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.scoreDot,
              { backgroundColor: i < filledCount ? dotColor : brandColors.divider },
            ]}
          />
        ))}
      </View>
      <Text style={styles.sectorMeta}>{fr.home.sector.meta({ count: analysedCount })}</Text>
    </View>
  )
}
