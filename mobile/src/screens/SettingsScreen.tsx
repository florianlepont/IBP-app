import { useState } from "react"
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors, brandSpacing, brandTypography } from "../app/brand-tokens"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppCollapsibleSection } from "../ui/AppCollapsibleSection"
import { AppField } from "../ui/AppField"
import { AppNotice } from "../ui/AppNotice"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppSettingsRow } from "../ui/AppSettingsRow"

type SettingsScreenProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onSync: () => Promise<void>
  onPullChanges: () => Promise<void>
  onRefreshLocalList: () => Promise<void>
  onRefreshLocalAttachments: () => Promise<void>
  onDeleteAccount: () => Promise<void>
  onDebugResetIbpData: () => Promise<void>
  onDebugResetUserData: () => Promise<void>
  status: string
}

export function SettingsScreen({
  apiUrl,
  onApiUrlChange,
  onSync,
  onPullChanges,
  onRefreshLocalList,
  onRefreshLocalAttachments,
  onDeleteAccount,
  onDebugResetIbpData,
  onDebugResetUserData,
  status,
}: SettingsScreenProps) {
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight(Platform.select({ ios: 84, default: 68 }) ?? 68)
  const topContentPadding = Platform.OS === "ios" ? headerHeight + brandSpacing.md : brandSpacing.md
  const bottomContentPadding = Math.max(tabBarHeight, insets.bottom) + brandSpacing.md

  const [syncLoading, setSyncLoading] = useState(false)
  const [pullLoading, setPullLoading] = useState(false)
  const [refreshListLoading, setRefreshListLoading] = useState(false)
  const [refreshAttachmentsLoading, setRefreshAttachmentsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const syncBusy = syncLoading || pullLoading || refreshListLoading || refreshAttachmentsLoading

  const handleSync = async () => {
    setSyncLoading(true)
    try {
      await onSync()
    } finally {
      setSyncLoading(false)
    }
  }

  const handlePullChanges = async () => {
    setPullLoading(true)
    try {
      await onPullChanges()
    } finally {
      setPullLoading(false)
    }
  }

  const handleRefreshLocalList = async () => {
    setRefreshListLoading(true)
    try {
      await onRefreshLocalList()
    } finally {
      setRefreshListLoading(false)
    }
  }

  const handleRefreshLocalAttachments = async () => {
    setRefreshAttachmentsLoading(true)
    try {
      await onRefreshLocalAttachments()
    } finally {
      setRefreshAttachmentsLoading(false)
    }
  }

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est irréversible. Toutes vos données seront définitivement supprimées, y compris vos relevés et pièces jointes.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleteLoading(true)
            try {
              await onDeleteAccount()
            } finally {
              setDeleteLoading(false)
            }
          },
        },
      ],
    )
  }

  const confirmDebugResetIbpData = () => {
    Alert.alert("Vider la base IBP", "Toutes les données IBP locales seront supprimées.", [
      { text: "Annuler", style: "cancel" },
      { text: "Vider", style: "destructive", onPress: () => void onDebugResetIbpData() },
    ])
  }

  const confirmDebugResetUserData = () => {
    Alert.alert(
      "Vider la base utilisateur",
      "Toutes les données utilisateur locales seront supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Vider", style: "destructive", onPress: () => void onDebugResetUserData() },
      ],
    )
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topContentPadding,
          paddingBottom: bottomContentPadding,
          paddingHorizontal: brandSpacing.md,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      scrollIndicatorInsets={{
        top: Platform.OS === "ios" ? headerHeight : 0,
        bottom: tabBarHeight,
      }}
    >
      {/* Feedback de statut — en tête pour visibilité immédiate */}
      {status.trim() ? (
        <AppNotice message={status} tone="info" icon="information-circle-outline" />
      ) : null}

      {/* Zone 1 — Compte (production) */}
      <AppCard variant="panelElevated" style={styles.section}>
        <AppSectionHeader
          title="Compte"
          subtitle="Gestion de votre compte et de vos données."
          titleStyle={styles.sectionTitle}
        />
        <AppNotice
          tone="danger"
          icon="warning-outline"
          message="Cette action est irréversible. Toutes vos données seront définitivement supprimées."
        />
        <AppButton
          label="Supprimer mon compte"
          variant="danger"
          size="lg"
          leadingIcon="trash-outline"
          loading={deleteLoading}
          disabled={deleteLoading}
          onPress={confirmDeleteAccount}
        />
      </AppCard>

      {/* Zone 2 — Synchronisation */}
      <AppCard variant="panel" style={styles.section}>
        <AppSectionHeader
          title="Synchronisation"
          subtitle="Rafraîchir l'état local et les données serveur."
          titleStyle={styles.sectionTitle}
        />
        <AppButton
          label="Synchroniser maintenant"
          leadingIcon="sync-outline"
          loading={syncLoading}
          disabled={syncBusy}
          onPress={() => void handleSync()}
        />
        <View style={styles.advancedDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>Avancé</Text>
          <View style={styles.dividerLine} />
        </View>
        <AppSettingsRow
          label="Récupérer les changements serveur"
          onPress={() => void handlePullChanges()}
          loading={pullLoading}
          disabled={syncBusy}
        />
        <AppSettingsRow
          label="Rafraîchir la liste locale"
          onPress={() => void handleRefreshLocalList()}
          loading={refreshListLoading}
          disabled={syncBusy}
        />
        <AppSettingsRow
          label="Rafraîchir les pièces jointes"
          onPress={() => void handleRefreshLocalAttachments()}
          loading={refreshAttachmentsLoading}
          disabled={syncBusy}
        />
      </AppCard>

      {/* Zone 3 — Outils développeur (repliée par défaut) */}
      <AppCollapsibleSection title="Outils développeur" badge="DEV">
        <AppField
          label="URL de l'API"
          value={apiUrl}
          onChangeText={onApiUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <AppButton
          label="Vider la base IBP"
          variant="dangerSoft"
          leadingIcon="bug-outline"
          onPress={confirmDebugResetIbpData}
        />
        <AppButton
          label="Vider la base utilisateur"
          variant="dangerSoft"
          leadingIcon="bug-outline"
          onPress={confirmDebugResetUserData}
        />
      </AppCollapsibleSection>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  content: {
    gap: brandSpacing.md,
  },
  section: {
    gap: brandSpacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 20,
  },
  advancedDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: brandSpacing.sm,
    marginVertical: brandSpacing.xs - 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: brandColors.divider,
  },
  dividerLabel: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
})
