import { Text, View } from "react-native"
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from "../../app/constants"
import { RegionVersion, VegetationStage } from "../../app/types"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { WizardChip } from "./components"
import { formStyles } from "./styles"
import { fr } from "../../i18n"

// Region version and vegetation stage: they set the IBP scoring thresholds.
export function RegionVegetationSection({
  regionVersion,
  vegetationStage,
  onRegionChange,
  setVegetationStage,
}: {
  regionVersion: RegionVersion
  vegetationStage: VegetationStage
  onRegionChange: (nextRegion: RegionVersion) => void
  setVegetationStage: (value: VegetationStage) => void
}) {
  return (
    <AppCard variant="panelElevated" style={formStyles.panel}>
      <AppSectionHeader
        title={fr.surveyForm.region.title}
        subtitle={fr.surveyForm.region.subtitle}
        titleStyle={formStyles.panelTitle}
        subtitleStyle={formStyles.panelBody}
      />

      <Text style={formStyles.label}>{fr.surveyForm.region.label}</Text>
      <View style={formStyles.choiceRow}>
        {REGION_OPTIONS.map((option) => (
          <WizardChip
            key={option.value}
            label={option.label}
            active={regionVersion === option.value}
            onPress={() => onRegionChange(option.value)}
          />
        ))}
      </View>

      <Text style={formStyles.label}>{fr.surveyForm.vegetation.label}</Text>
      <View style={formStyles.choiceRow}>
        {VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].map((option) => (
          <WizardChip
            key={option.value}
            label={option.label}
            active={vegetationStage === option.value}
            onPress={() => setVegetationStage(option.value)}
          />
        ))}
      </View>
    </AppCard>
  )
}
