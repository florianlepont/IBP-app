import { useRef, useState } from "react"
import {
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors, brandSpacing, brandTypography } from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { fr } from "../i18n"

const t = fr.profileSetup

type ProfileSetupScreenProps = {
  saving: boolean
  logoSource?: ImageSourcePropType
  onSave: (firstName: string, lastName: string) => Promise<void>
  onSkip: () => void
}

export function ProfileSetupScreen({
  saving,
  logoSource,
  onSave,
  onSkip,
}: ProfileSetupScreenProps) {
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView | null>(null)
  const lastNameInputRef = useRef<TextInput | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const handleContinue = async (): Promise<void> => {
    await onSave(firstName.trim(), lastName.trim())
  }

  const scrollToActions = (): void => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? brandSpacing.sm : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, brandSpacing.xl) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroAccent} />
          <AppCard variant="surface" style={styles.heroCard}>
            {logoSource ? (
              <Image source={logoSource} style={styles.heroLogo} resizeMode="contain" />
            ) : null}
            <Text style={styles.heroEyebrow}>{t.eyebrow}</Text>
            <AppSectionHeader
              title={t.title}
              subtitle={t.subtitle}
              titleStyle={styles.heroTitle}
              subtitleStyle={styles.heroSubtitle}
            />
          </AppCard>
        </View>

        <AppCard variant="panelElevated" style={styles.formCard}>
          <AppSectionHeader
            title={t.nameTitle}
            subtitle={t.nameSubtitle}
            titleStyle={styles.sectionTitle}
            subtitleStyle={styles.sectionSubtitle}
          />

          <View style={styles.fields}>
            <AppField
              label={t.firstName}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t.firstNamePlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              blurOnSubmit={false}
              onFocus={scrollToActions}
              onSubmitEditing={() => {
                lastNameInputRef.current?.focus()
              }}
            />
            <AppField
              label={t.lastName}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t.lastNamePlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              inputRef={lastNameInputRef}
              returnKeyType="done"
              onFocus={scrollToActions}
              onSubmitEditing={() => {
                if (firstName.trim()) void handleContinue()
              }}
            />
          </View>

          <View style={styles.actions}>
            <AppButton
              label={saving ? t.saving : t.start}
              onPress={() => void handleContinue()}
              disabled={saving || !firstName.trim()}
              size="lg"
            />
            <AppButton
              label={t.skip}
              variant="secondary"
              onPress={onSkip}
              disabled={saving}
              size="lg"
            />
          </View>
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: brandSpacing.lg,
    paddingTop: brandSpacing.lg,
    gap: brandSpacing.lg,
  },
  heroWrap: {
    position: "relative",
  },
  heroAccent: {
    position: "absolute",
    top: 16,
    right: 14,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: brandColors.sage,
    opacity: 0.28,
  },
  heroCard: {
    gap: brandSpacing.sm,
    padding: brandSpacing.lg,
  },
  heroLogo: {
    width: 132,
    height: 42,
    marginLeft: -18,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandColors.moss,
    letterSpacing: 1.6,
  },
  heroTitle: {
    ...brandTypography.sectionTitle,
    color: brandColors.forest,
  },
  heroSubtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  formCard: {
    gap: brandSpacing.md,
  },
  sectionTitle: {
    ...brandTypography.sectionTitle,
    color: brandColors.textPrimary,
  },
  sectionSubtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  fields: {
    gap: 12,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
})
