import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandRadius, brandSpacing, brandTypography } from "../app/brand-tokens"

type AppSettingsRowProps = {
  label: string
  value?: string
  onPress: () => void
  accessibilityLabel?: string
  loading?: boolean
  disabled?: boolean
}

export function AppSettingsRow({
  label,
  value,
  onPress,
  accessibilityLabel,
  loading = false,
  disabled = false,
}: AppSettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      android_ripple={{ color: brandColors.panelMuted }}
    >
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={brandColors.textSecondary} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    backgroundColor: brandColors.inputFill,
    borderRadius: brandRadius.field - 6,
    paddingHorizontal: brandSpacing.md - 2,
    paddingVertical: brandSpacing.sm,
    gap: brandSpacing.xs + 2,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  content: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  value: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
})
