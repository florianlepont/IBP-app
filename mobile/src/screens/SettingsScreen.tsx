import { StyleSheet, Text, View } from "react-native"
import { brandColors, brandSpacing, brandTypography } from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"

type SettingsScreenProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onOpenUiPrimitives: () => void
  onSync: () => Promise<void>
  onPullChanges: () => Promise<void>
  onRefreshLocalList: () => Promise<void>
  onRefreshLocalAttachments: () => Promise<void>
  onDebugResetIbpData: () => Promise<void>
  onDebugResetUserData: () => Promise<void>
  status: string
}

export function SettingsScreen({
  apiUrl,
  onApiUrlChange,
  onOpenUiPrimitives,
  onSync,
  onPullChanges,
  onRefreshLocalList,
  onRefreshLocalAttachments,
  onDebugResetIbpData,
  onDebugResetUserData,
  status,
}: SettingsScreenProps) {
  return (
    <View style={screenStyles.screen}>
      <AppCard variant="panelElevated" style={screenStyles.section}>
        <AppSectionHeader
          title="Environment"
          subtitle="Basculer d'API et ouvrir le showcase des primitives."
        />
        <AppField
          label="API URL"
          value={apiUrl}
          onChangeText={onApiUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <AppButton
          label="Open UI primitives showcase"
          variant="secondary"
          onPress={onOpenUiPrimitives}
        />
      </AppCard>

      <AppCard variant="panelElevated" style={screenStyles.section}>
        <AppSectionHeader
          title="Sync"
          subtitle="Actions utiles pour rafraichir l'etat local et serveur."
        />
        <View style={screenStyles.buttonStack}>
          <AppButton label="Sync now (push + pull)" onPress={() => void onSync()} />
          <AppButton
            label="Pull server changes (advanced)"
            variant="secondary"
            onPress={() => void onPullChanges()}
          />
          <AppButton
            label="Refresh local list"
            variant="secondary"
            onPress={() => void onRefreshLocalList()}
          />
          <AppButton
            label="Refresh local attachments"
            variant="secondary"
            onPress={() => void onRefreshLocalAttachments()}
          />
        </View>
      </AppCard>

      <AppCard variant="soft" style={screenStyles.section}>
        <AppSectionHeader
          title="Debug"
          subtitle="Actions destructives reservees au debug local."
        />
        <View style={screenStyles.buttonStack}>
          <AppButton
            label="Debug: Clear IBP DB"
            variant="danger"
            onPress={() => void onDebugResetIbpData()}
          />
          <AppButton
            label="Debug: Clear User DB"
            variant="danger"
            onPress={() => void onDebugResetUserData()}
          />
        </View>
      </AppCard>

      {status.trim() ? (
        <AppCard variant="surface" style={screenStyles.statusCard}>
          <Text style={screenStyles.statusLabel}>Status</Text>
          <Text style={screenStyles.statusText}>{status}</Text>
        </AppCard>
      ) : null}
    </View>
  )
}

const screenStyles = StyleSheet.create({
  screen: {
    gap: brandSpacing.md,
  },
  section: {
    gap: brandSpacing.md,
  },
  buttonStack: {
    gap: brandSpacing.sm,
  },
  statusCard: {
    gap: brandSpacing.xs,
  },
  statusLabel: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  statusText: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
})
