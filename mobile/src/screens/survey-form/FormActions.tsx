import { Pressable, Text, View } from "react-native"
import { AppButton } from "../../ui/AppButton"
import { formStyles } from "./styles"
import { fr } from "../../i18n"

// Bottom row of the parcels and factors steps: back, then the main action.
export function FormActions({
  primaryLabel,
  onBack,
  onPrimary,
}: {
  primaryLabel: string
  onBack: () => void
  onPrimary: () => void
}) {
  return (
    <View style={formStyles.actionRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fr.surveyForm.a11y.back}
        style={formStyles.secondaryButton}
        onPress={onBack}
      >
        <Text style={formStyles.secondaryButtonText}>{fr.surveyForm.actions.back}</Text>
      </Pressable>
      <AppButton label={primaryLabel} style={formStyles.primaryButtonWide} onPress={onPrimary} />
    </View>
  )
}
