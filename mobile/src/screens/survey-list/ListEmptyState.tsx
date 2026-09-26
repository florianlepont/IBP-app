import { Image, StyleSheet, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandTypography } from "../../app/brand-tokens"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { styles as sharedStyles } from "./styles"

type ListEmptyStateProps = {
  /** No local survey at all (true) or none left after the filters (false). */
  noSurveys: boolean
  resetFilters: () => void
}

export function ListEmptyState({ noSurveys, resetFilters }: ListEmptyStateProps) {
  if (noSurveys) {
    // P2-PERSON-04: marten illustration + warm copy
    return (
      <AppCard variant="panelElevated" padding={24} style={styles.emptyState}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require("../../../assets/auth/marten.png")}
          style={styles.emptyStateMarten}
          resizeMode="contain"
        />
        <Text style={styles.emptyStateTitle}>La nature vous attend</Text>
        <Text style={styles.emptyStateBody}>
          Commencez votre premier relevé IBP et contribuez à la connaissance de la biodiversité.
        </Text>
      </AppCard>
    )
  }

  return (
    <AppCard variant="panelElevated" padding={22} style={styles.emptyState}>
      <Ionicons name="funnel-outline" size={28} color={brandColors.forest} />
      <Text style={styles.emptyStateTitle}>Aucun résultat</Text>
      <Text style={styles.emptyStateBody}>
        Élargissez les critères ou réinitialisez les filtres pour voir plus de relevés.
      </Text>
      <AppButton
        label="Réinitialiser les filtres"
        variant="secondary"
        size="sm"
        onPress={resetFilters}
        style={sharedStyles.resetButton}
      />
    </AppCard>
  )
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    gap: 10,
  },
  // P2-PERSON-04: marten illustration
  emptyStateMarten: {
    width: 110,
    height: 110,
    marginBottom: 4,
  },
  emptyStateTitle: {
    ...brandTypography.input,
    color: brandColors.forest,
  },
  emptyStateBody: {
    ...brandTypography.sectionBody,
    textAlign: "center",
    color: brandColors.textSecondary,
  },
})
