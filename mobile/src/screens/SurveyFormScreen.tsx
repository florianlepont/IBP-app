import { Button, Text, TextInput, View } from 'react-native';
import { HELP_BY_FACTOR, REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from '../app/constants';
import { styles } from '../app/styles';
import { AppScreen, FactorField, FactorKey, RegionVersion, VegetationStage } from '../app/types';
import { FactorSection } from '../components/FactorSection';
import { FilterChip } from '../components/FilterChip';

type SurveyFormScreenProps = {
  screen: AppScreen;
  editingSurveyId: string | null;
  siteName: string;
  setSiteName: (value: string) => void;
  regionVersion: RegionVersion;
  vegetationStage: VegetationStage;
  setVegetationStage: (value: VegetationStage) => void;
  onRegionChange: (nextRegion: RegionVersion) => void;
  factorSections: Record<FactorKey, FactorField[]>;
  onSaveSurveyEdits: () => Promise<void>;
  onCreateDraft: () => Promise<void>;
  onBackToSurveyList: () => void;
  status: string;
};

const FACTOR_ORDER: FactorKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export function SurveyFormScreen({
  screen,
  editingSurveyId,
  siteName,
  setSiteName,
  regionVersion,
  vegetationStage,
  setVegetationStage,
  onRegionChange,
  factorSections,
  onSaveSurveyEdits,
  onCreateDraft,
  onBackToSurveyList,
  status
}: SurveyFormScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{screen === 'edit' ? 'Edit survey (dedicated view)' : 'Create survey (dedicated view)'}</Text>
      {screen === 'edit' && editingSurveyId ? <Text style={styles.meta}>Survey id: {editingSurveyId}</Text> : null}

      <Text style={styles.label}>Site name</Text>
      <TextInput style={styles.input} value={siteName} onChangeText={setSiteName} />

      <Text style={styles.label}>Region version</Text>
      <View style={styles.filterChipsRow}>
        {REGION_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            active={regionVersion === option.value}
            onPress={() => onRegionChange(option.value)}
          />
        ))}
      </View>

      <Text style={styles.label}>Vegetation stage</Text>
      <View style={styles.filterChipsRow}>
        {VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            active={vegetationStage === option.value}
            onPress={() => setVegetationStage(option.value)}
          />
        ))}
      </View>

      {FACTOR_ORDER.map((factor) => (
        <FactorSection key={factor} factorKey={factor} helpText={HELP_BY_FACTOR[factor]} fields={factorSections[factor]} />
      ))}

      {screen === 'edit' ? (
        <Button title="Save survey edits" onPress={() => void onSaveSurveyEdits()} />
      ) : (
        <Button title="Create offline draft" onPress={() => void onCreateDraft()} />
      )}
      <View style={styles.spacer} />
      <Button title="Back to survey list" onPress={onBackToSurveyList} />
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
