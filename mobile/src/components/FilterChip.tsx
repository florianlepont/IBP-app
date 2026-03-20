import { Pressable, Text } from "react-native"
import { styles } from "../app/styles"

type FilterChipProps = {
  label: string
  active: boolean
  onPress: () => void
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active ? styles.filterChipActive : null]}
    >
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  )
}
