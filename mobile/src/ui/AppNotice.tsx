import { ReactNode } from "react"
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandComponentTokens, brandTypography } from "../app/brand-tokens"

type AppNoticeTone = "info" | "success" | "warning" | "danger"

type AppNoticeProps = {
  message: ReactNode
  title?: string
  tone?: AppNoticeTone
  icon?: keyof typeof Ionicons.glyphMap
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
  messageStyle?: StyleProp<TextStyle>
}

export function AppNotice({
  message,
  title,
  tone = "info",
  icon,
  style,
  titleStyle,
  messageStyle,
}: AppNoticeProps) {
  const textTone =
    tone === "danger"
      ? styles.messageDanger
      : tone === "warning"
        ? styles.messageWarning
        : tone === "success"
          ? styles.messageSuccess
          : null

  return (
    <View style={[styles.base, styles[tone], style]}>
      {icon ? <Ionicons name={icon} size={18} style={[styles.icon, textTone]} /> : null}
      <View style={styles.copy}>
        {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
        <Text style={[styles.message, textTone, messageStyle]}>{message}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  info: {
    borderColor: brandComponentTokens.notice.infoBorder,
    backgroundColor: brandComponentTokens.notice.infoBackground,
  },
  success: {
    borderColor: brandComponentTokens.notice.successBorder,
    backgroundColor: brandComponentTokens.notice.successBackground,
  },
  warning: {
    borderColor: brandComponentTokens.notice.warningBorder,
    backgroundColor: brandComponentTokens.notice.warningBackground,
  },
  danger: {
    borderColor: brandComponentTokens.notice.dangerBorder,
    backgroundColor: brandComponentTokens.notice.dangerBackground,
  },
  icon: {
    marginTop: 1,
    color: brandComponentTokens.notice.text,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...brandTypography.label,
    color: brandComponentTokens.notice.title,
  },
  message: {
    ...brandTypography.sectionBody,
    color: brandComponentTokens.notice.text,
  },
  messageSuccess: {
    color: brandComponentTokens.notice.successText,
  },
  messageWarning: {
    color: brandComponentTokens.notice.warningText,
  },
  messageDanger: {
    color: brandComponentTokens.notice.dangerText,
  },
})
