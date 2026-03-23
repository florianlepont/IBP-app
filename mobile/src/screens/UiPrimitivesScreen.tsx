import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import {
  brandColors,
  brandComponentTokens,
  brandFontFamilies,
  brandRadius,
  brandSemanticColors,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppStatusChip } from "../ui/AppStatusChip"

type Swatch = {
  label: string
  value: string
}

export function UiPrimitivesScreen() {
  const [siteName, setSiteName] = useState("Bois du coteau")
  const [apiUrl, setApiUrl] = useState("http://192.168.1.165:3000/v1")
  const [hasError, setHasError] = useState(false)

  const colorSwatches = useMemo<Swatch[]>(
    () => [
      { label: "Forest", value: brandColors.forest },
      { label: "Moss", value: brandColors.moss },
      { label: "Terracotta", value: brandColors.terracotta },
      { label: "Canvas", value: brandColors.canvas },
      { label: "Panel", value: brandColors.panel },
      { label: "Soft", value: brandColors.surfaceSoft },
    ],
    [],
  )

  return (
    <View style={screenStyles.layout}>
      <AppCard variant="surface" style={screenStyles.heroCard}>
        <Text style={screenStyles.eyebrow}>UI PRIMITIVES</Text>
        <Text style={screenStyles.heroTitle}>Showcase de la charte actuelle</Text>
        <Text style={screenStyles.heroBody}>
          Cet ecran sert a visualiser rapidement les primitives, les tokens principaux et leur
          rendu dans l&apos;app sans passer par plusieurs ecrans metier.
        </Text>
      </AppCard>

      <AppCard variant="panel" style={screenStyles.section}>
        <AppSectionHeader
          title="Boutons"
          subtitle="Primary, secondary, danger et disabled avec la charte actuelle."
          trailing={<AppStatusChip label="Preview" tone="neutral" />}
          titleStyle={screenStyles.sectionTitle}
          subtitleStyle={screenStyles.meta}
        />
        <View style={screenStyles.buttonStack}>
          <AppButton label="Primary action" onPress={() => undefined} />
          <AppButton label="Secondary action" variant="secondary" onPress={() => undefined} />
          <AppButton label="Danger action" variant="danger" onPress={() => undefined} />
          <AppButton label="Disabled action" disabled onPress={() => undefined} />
        </View>
        <Text style={screenStyles.meta}>
          Primary = {brandComponentTokens.button.primaryBackground} · Secondary outline =
          {" "}
          {brandComponentTokens.button.secondaryBorder}
        </Text>
      </AppCard>

      <AppCard variant="panel" style={screenStyles.section}>
        <AppSectionHeader
          title="Champs"
          subtitle="AppField avec etat standard puis etat erreur."
          trailing={<AppStatusChip label={hasError ? "Error" : "Idle"} tone={hasError ? "danger" : "success"} />}
          titleStyle={screenStyles.sectionTitle}
          subtitleStyle={screenStyles.meta}
        />
        <View style={screenStyles.fieldStack}>
          <AppField
            label="Nom du site"
            value={siteName}
            onChangeText={setSiteName}
            placeholder="Nom du releve"
          />
          <AppField
            label="API URL"
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            error={hasError ? "Exemple d'etat erreur sur le champ." : null}
          />
          <AppButton
            label={hasError ? "Masquer l'erreur" : "Afficher une erreur"}
            variant="secondary"
            onPress={() => setHasError((value) => !value)}
          />
        </View>
      </AppCard>

      <View style={screenStyles.cardGrid}>
        <AppCard variant="surface" style={screenStyles.gridCard}>
          <Text style={screenStyles.cardTitle}>Surface</Text>
          <Text style={screenStyles.cardBody}>
            Carte elevee claire, bord doux et ombre legere.
          </Text>
        </AppCard>
        <AppCard variant="soft" style={screenStyles.gridCard}>
          <Text style={screenStyles.cardTitle}>Soft</Text>
          <Text style={screenStyles.cardBody}>
            Surface attenuee utile pour les zones secondaires et debug.
          </Text>
        </AppCard>
      </View>

      <AppCard variant="panel" style={screenStyles.section}>
        <AppSectionHeader
          title="Typographie"
          subtitle="Hierarchie actuelle basee sur les tokens et les fallbacks systeme."
          trailing={<AppStatusChip label="Fonts pending" tone="warning" />}
          titleStyle={screenStyles.sectionTitle}
          subtitleStyle={screenStyles.meta}
        />
        <Text style={screenStyles.fontMeta}>
          Titre: {brandFontFamilies.title.preferred} / {brandFontFamilies.title.fallback}
        </Text>
        <Text style={screenStyles.fontMeta}>
          Meta: {brandFontFamilies.meta.preferred} / {brandFontFamilies.meta.fallback}
        </Text>
        <Text style={screenStyles.typographyHero}>Hero title sample</Text>
        <Text style={screenStyles.typographySection}>Section title sample</Text>
        <Text style={screenStyles.typographyBody}>
          Body copy sample aligned with the current fallback stack and brand hierarchy.
        </Text>
        <Text style={screenStyles.typographyMeta}>Metadata, helper text, microcopy.</Text>
      </AppCard>

      <AppCard variant="panel" style={screenStyles.section}>
        <AppSectionHeader
          title="Palette"
          subtitle="Swatches principaux exposes par les tokens."
          trailing={<AppStatusChip label="Brand" tone="success" />}
          titleStyle={screenStyles.sectionTitle}
          subtitleStyle={screenStyles.meta}
        />
        <View style={screenStyles.swatchGrid}>
          {colorSwatches.map((swatch) => (
            <View key={swatch.label} style={screenStyles.swatchItem}>
              <View style={[screenStyles.swatch, { backgroundColor: swatch.value }]} />
              <Text style={screenStyles.swatchLabel}>{swatch.label}</Text>
              <Text style={screenStyles.swatchValue}>{swatch.value}</Text>
            </View>
          ))}
        </View>
        <Text style={screenStyles.meta}>
          Semantic surfaces: canvas {brandSemanticColors.backgroundCanvas}, elevated
          {" "}
          {brandSemanticColors.surfaceElevated}, soft {brandSemanticColors.surfaceSoft}.
        </Text>
      </AppCard>
    </View>
  )
}

const screenStyles = StyleSheet.create({
  layout: {
    gap: brandSpacing.lg,
  },
  heroCard: {
    gap: brandSpacing.sm,
  },
  eyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandColors.forest,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.textPrimary,
  },
  heroBody: {
    ...brandTypography.heroBody,
    color: brandColors.textSecondary,
  },
  section: {
    gap: brandSpacing.md,
  },
  sectionTitle: {
    ...brandTypography.sectionTitle,
    color: brandColors.forest,
  },
  buttonStack: {
    gap: brandSpacing.sm,
  },
  fieldStack: {
    gap: brandSpacing.md,
  },
  meta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  cardGrid: {
    gap: brandSpacing.md,
  },
  gridCard: {
    gap: brandSpacing.sm,
  },
  cardTitle: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  cardBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  fontMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  typographyHero: {
    ...brandTypography.heroTitle,
    color: brandColors.textPrimary,
  },
  typographySection: {
    ...brandTypography.sectionTitle,
    color: brandColors.forest,
  },
  typographyBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textPrimary,
  },
  typographyMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: brandSpacing.md,
  },
  swatchItem: {
    width: "30%",
    minWidth: 96,
    gap: brandSpacing.xs,
  },
  swatch: {
    height: 68,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.divider,
    ...brandShadow.card,
  },
  swatchLabel: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  swatchValue: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
