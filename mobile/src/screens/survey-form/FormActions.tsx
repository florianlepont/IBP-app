import { Pressable, Text, View } from "react-native"
import { AppButton } from "../../ui/AppButton"
import { formStyles } from "./styles"

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
      <Pressable style={formStyles.secondaryButton} onPress={onBack}>
        <Text style={formStyles.secondaryButtonText}>Back</Text>
      </Pressable>
      <AppButton label={primaryLabel} style={formStyles.primaryButtonWide} onPress={onPrimary} />
    </View>
  )
}
