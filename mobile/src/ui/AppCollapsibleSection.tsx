import { ReactNode, useState } from "react"
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandRadius, brandSpacing, brandTypography } from "../app/brand-tokens"
import { AppStatusChip } from "./AppStatusChip"

type AppCollapsibleSectionProps = {
  title: string
  badge?: string
  defaultExpanded?: boolean
  children: ReactNode
}

export function AppCollapsibleSection({
  title,
  badge,
  defaultExpanded = false,
  children,
}: AppCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((prev) => !prev)
  }

  return (
    <View style={styles.root}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} — ${expanded ? "réduire" : "développer"}`}
      >
        <Text style={styles.title}>{title}</Text>
        {badge ? <AppStatusChip label={badge} tone="neutral" /> : null}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={brandColors.textSecondary}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: brandSpacing.xs,
    paddingHorizontal: brandSpacing.md,
    paddingVertical: brandSpacing.sm + 2,
  },
  headerPressed: {
    opacity: 0.6,
  },
  title: {
    flex: 1,
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  body: {
    padding: brandSpacing.md,
    gap: brandSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
  },
})
