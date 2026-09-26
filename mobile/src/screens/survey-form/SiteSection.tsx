import { LayoutRectangle, View } from "react-native"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppField } from "../../ui/AppField"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { formStyles } from "./styles"

// Step 1 of the wizard: the survey's site name.
export function SiteSection({
  siteName,
  setSiteName,
  siteNameError,
  identityReady,
  onLayout,
  onFocus,
  onBlur,
  onContinue,
}: {
  siteName: string
  setSiteName: (value: string) => void
  siteNameError: string | null
  identityReady: boolean
  onLayout: (layout: LayoutRectangle) => void
  onFocus: () => void
  onBlur: () => void
  onContinue: () => void
}) {
  return (
    <View
      style={formStyles.identityStepContent}
      onLayout={(event) => {
        onLayout(event.nativeEvent.layout)
      }}
    >
      <AppCard variant="panelElevated" style={formStyles.panel}>
        <AppSectionHeader
          title="Survey identity"
          subtitle="Give the draft a name that will stay readable in lists, sync logs, and parcel detail screens."
          titleStyle={formStyles.panelTitle}
          subtitleStyle={formStyles.panelBody}
        />

        <AppField
          label="Site name *"
          value={siteName}
          onChangeText={setSiteName}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Ex: Foret de Rambouillet"
          error={siteNameError}
          inputStyle={formStyles.input}
        />
      </AppCard>

      <AppButton
        label="Continue to parcels"
        disabled={!identityReady}
        style={formStyles.primaryButton}
        onPress={onContinue}
      />
    </View>
  )
}
