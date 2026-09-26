import { memo, useCallback } from "react"
import { Pressable, ScrollView, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import type { PublicMapItem } from "../../app/types"
import { fr } from "../../i18n"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { panelStyles as styles } from "./styles"

const t = fr.publicMap

type ClusterRowProps = {
  item: PublicMapItem
  onSelect: (id: string) => void
}

const ClusterRow = memo(function ClusterRow({ item, onSelect }: ClusterRowProps) {
  const handlePress = useCallback(() => onSelect(item.survey_id), [item.survey_id, onSelect])
  return (
    <Pressable
      style={styles.clusterRow}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t.a11y.clusterListItem({
        ibp: item.ibp_total,
        date: item.survey_date,
        region: item.region_code,
      })}
    >
      <Text style={styles.clusterRowText}>
        {t.clusterList.row({ ibp: item.ibp_total, date: item.survey_date })}
      </Text>
      <Text style={styles.meta}>{item.region_code}</Text>
    </Pressable>
  )
})

export type ClusterListSheetProps = {
  items: PublicMapItem[]
  bottom: number
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * The surveys of a cluster that zooming cannot split (Pitfall 7): public
 * locations are rounded to about 1 km, so several surveys can share one point.
 */
export const ClusterListSheet = memo(function ClusterListSheet({
  items,
  bottom,
  onSelect,
  onClose,
}: ClusterListSheetProps) {
  return (
    <AppCard variant="panelElevated" padding={14} style={[styles.card, { bottom }]}>
      <AppSectionHeader
        title={t.clusterList.title(items.length)}
        subtitle={t.clusterList.subtitle}
        titleStyle={styles.title}
        subtitleStyle={styles.meta}
        trailing={
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.a11y.closeClusterList}
          >
            <Ionicons name="close" size={18} color={brandColors.forest} />
          </Pressable>
        }
      />
      <ScrollView style={styles.clusterList}>
        {items.map((item) => (
          <ClusterRow key={item.survey_id} item={item} onSelect={onSelect} />
        ))}
      </ScrollView>
    </AppCard>
  )
})
