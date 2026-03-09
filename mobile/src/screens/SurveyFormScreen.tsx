import { Button, Text, TextInput, View } from 'react-native';
import { HELP_BY_FACTOR, REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from '../app/constants';
import { styles } from '../app/styles';
import { AppScreen, FactorField, FactorKey, RegionVersion, SurveyLocationSource, VegetationStage } from '../app/types';
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
  locationSource: SurveyLocationSource;
  setLocationSource: (value: SurveyLocationSource) => void;
  gpsLocation: {
    lat: string;
    lng: string;
    accuracy_m: string;
    collected_at: string;
  };
  manualLocation: {
    address_line: string;
    postal_code: string;
    city: string;
    country: string;
  };
  setGpsLocationField: (field: 'lat' | 'lng' | 'accuracy_m' | 'collected_at', value: string) => void;
  setManualLocationField: (field: 'address_line' | 'postal_code' | 'city' | 'country', value: string) => void;
  onCaptureGpsLocation: () => Promise<void>;
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
  locationSource,
  setLocationSource,
  gpsLocation,
  manualLocation,
  setGpsLocationField,
  setManualLocationField,
  onCaptureGpsLocation,
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

      <View style={styles.locationCard}>
        <Text style={styles.label}>Location (required to submit)</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="GPS (device)" active={locationSource === 'gps'} onPress={() => setLocationSource('gps')} />
          <FilterChip label="Manual address" active={locationSource === 'manual'} onPress={() => setLocationSource('manual')} />
        </View>

        {locationSource === 'gps' ? (
          <View style={styles.detailSection}>
            <Button title="Capture current GPS" onPress={() => void onCaptureGpsLocation()} />
            <Text style={styles.rowMeta}>or type values manually for simulator/testing.</Text>

            <Text style={styles.label}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={gpsLocation.lat}
              onChangeText={(value) => setGpsLocationField('lat', value)}
              keyboardType="decimal-pad"
              placeholder="48.643"
            />

            <Text style={styles.label}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={gpsLocation.lng}
              onChangeText={(value) => setGpsLocationField('lng', value)}
              keyboardType="decimal-pad"
              placeholder="1.829"
            />

            <Text style={styles.label}>Accuracy (m, optional)</Text>
            <TextInput
              style={styles.input}
              value={gpsLocation.accuracy_m}
              onChangeText={(value) => setGpsLocationField('accuracy_m', value)}
              keyboardType="decimal-pad"
              placeholder="12"
            />

            {gpsLocation.collected_at ? <Text style={styles.rowMeta}>Captured at: {gpsLocation.collected_at}</Text> : null}
          </View>
        ) : (
          <View style={styles.detailSection}>
            <Text style={styles.label}>Address line</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.address_line}
              onChangeText={(value) => setManualLocationField('address_line', value)}
              placeholder="12 Rue de la Foret"
            />

            <Text style={styles.label}>Postal code</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.postal_code}
              onChangeText={(value) => setManualLocationField('postal_code', value)}
              placeholder="75001"
            />

            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.city}
              onChangeText={(value) => setManualLocationField('city', value)}
              placeholder="Paris"
            />

            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.country}
              onChangeText={(value) => setManualLocationField('country', value)}
              placeholder="France"
            />
          </View>
        )}
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
