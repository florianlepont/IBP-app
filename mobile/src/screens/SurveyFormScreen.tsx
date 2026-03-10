import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { MapPressEvent, Marker, MarkerDragStartEndEvent } from 'react-native-maps';
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from '../app/constants';
import { computeIbpTotalsFromRetainedScores } from '../app/ibp-scoring';
import { styles } from '../app/styles';
import { AppScreen, FactorField, FactorKey, FactorRetainedScore, RegionVersion, SurveyLocationSource, VegetationStage } from '../app/types';
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
  factorRetainedScores: Record<FactorKey, FactorRetainedScore | null>;
  formErrors: {
    siteName: string | null;
    gps: {
      lat: string | null;
      lng: string | null;
    };
    manual: {
      address_line: string | null;
      postal_code: string | null;
      city: string | null;
      country: string | null;
    };
  };
  onOpenFactor: (factor: FactorKey) => void;
  onSaveSurveyEdits: () => Promise<void>;
  onCreateDraft: () => Promise<void>;
  status: string;
};

const FACTOR_ORDER: FactorKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const DEFAULT_FRANCE_CENTER = { lat: 46.603354, lng: 1.888334 };
const toAddressLabel = (item: Record<string, unknown>): string => {
  const streetNumber = typeof item.streetNumber === 'string' ? item.streetNumber.trim() : '';
  const street = typeof item.street === 'string' ? item.street.trim() : '';
  const postalCode = typeof item.postalCode === 'string' ? item.postalCode.trim() : '';
  const city = typeof item.city === 'string' ? item.city.trim() : '';
  const region = typeof item.region === 'string' ? item.region.trim() : '';
  const country = typeof item.country === 'string' ? item.country.trim() : '';

  const line1 = [streetNumber, street].filter((part) => part.length > 0).join(' ');
  const line2 = [postalCode, city].filter((part) => part.length > 0).join(' ');
  const line3 = [region, country].filter((part) => part.length > 0).join(', ');
  return [line1, line2, line3].filter((part) => part.length > 0).join(' - ');
};

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
  factorRetainedScores,
  formErrors,
  onOpenFactor,
  onSaveSurveyEdits,
  onCreateDraft,
  status
}: SurveyFormScreenProps) {
  const [autoLocateRequested, setAutoLocateRequested] = useState(false);
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState('');
  const [isResolvingGpsAddress, setIsResolvingGpsAddress] = useState(false);
  const lastResolvedCoordinateKeyRef = useRef('');

  const parsedLat = Number(gpsLocation.lat);
  const parsedLng = Number(gpsLocation.lng);
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER;
  const mapRegion = {
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    latitudeDelta: hasGpsCoordinates ? 0.02 : 3.8,
    longitudeDelta: hasGpsCoordinates ? 0.02 : 3.8
  };

  const factorProgress = useMemo(
    () =>
      FACTOR_ORDER.reduce<Record<FactorKey, { complete: boolean; filled: number; total: number; invalid: number }>>((acc, factor) => {
        const fields = factorSections[factor];
        const total = fields.length;
        const filled = fields.filter((field) => field.value.trim().length > 0).length;
        const invalid = fields.filter((field) => Boolean(field.error)).length;
        acc[factor] = {
          complete: total > 0 && filled === total && invalid === 0,
          filled,
          total,
          invalid
        };
        return acc;
      }, {} as Record<FactorKey, { complete: boolean; filled: number; total: number; invalid: number }>),
    [factorSections]
  );

  const completedFactorCount = FACTOR_ORDER.filter((factor) => factorProgress[factor]?.complete).length;
  const scoreTotals = useMemo(() => computeIbpTotalsFromRetainedScores(factorRetainedScores), [factorRetainedScores]);

  const handleMapPress = (event: MapPressEvent): void => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLocationSource('gps');
    setGpsLocationField('lat', latitude.toFixed(6));
    setGpsLocationField('lng', longitude.toFixed(6));
    if (!gpsLocation.collected_at) {
      setGpsLocationField('collected_at', new Date().toISOString());
    }
  };

  const handleMarkerDragEnd = (event: MarkerDragStartEndEvent): void => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setGpsLocationField('lat', latitude.toFixed(6));
    setGpsLocationField('lng', longitude.toFixed(6));
  };

  const handleRequestCurrentLocation = (): void => {
    setLocationSource('gps');
    setAutoLocateRequested(true);
    void onCaptureGpsLocation();
  };

  useEffect(() => {
    if (screen !== 'create') {
      setAutoLocateRequested(false);
      return;
    }

    if (locationSource === 'manual') {
      setAutoLocateRequested(false);
      return;
    }

    if (locationSource === 'gps' && !hasGpsCoordinates && !autoLocateRequested) {
      setAutoLocateRequested(true);
      void onCaptureGpsLocation();
    }
  }, [screen, locationSource, hasGpsCoordinates, autoLocateRequested, onCaptureGpsLocation]);

  useEffect(() => {
    if (locationSource !== 'gps' || !hasGpsCoordinates) {
      setResolvedGpsAddress('');
      setIsResolvingGpsAddress(false);
      return;
    }

    const coordinateKey = `${parsedLat.toFixed(5)},${parsedLng.toFixed(5)}`;
    if (lastResolvedCoordinateKeyRef.current === coordinateKey) {
      return;
    }
    lastResolvedCoordinateKeyRef.current = coordinateKey;

    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        setIsResolvingGpsAddress(true);
        const Location = await import('expo-location');
        const matches = await Location.reverseGeocodeAsync({
          latitude: parsedLat,
          longitude: parsedLng
        });
        if (cancelled) return;
        const first = matches[0] as Record<string, unknown> | undefined;
        if (!first) {
          setResolvedGpsAddress('Adresse locale non disponible');
          return;
        }
        const label = toAddressLabel(first);
        setResolvedGpsAddress(label || 'Adresse locale non disponible');
      } catch (_error) {
        if (!cancelled) {
          setResolvedGpsAddress('Adresse locale non disponible');
        }
      } finally {
        if (!cancelled) {
          setIsResolvingGpsAddress(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [locationSource, hasGpsCoordinates, parsedLat, parsedLng]);

  return (
    <View style={styles.card}>
      {screen === 'edit' && editingSurveyId ? <Text style={styles.meta}>Survey id: {editingSurveyId}</Text> : null}
      <Text style={styles.rowMeta}>Fields marked with * are required for submit.</Text>
      <View style={styles.formScoreHeroCard}>
        <Text style={styles.formScoreHeroLabel}>IBP Total (en cours)</Text>
        <Text style={styles.formScoreHeroValue}>{scoreTotals.ibp_total}</Text>
        <Text style={styles.formScoreHeroMeta}>
          P/G {scoreTotals.ibp_peuplement_gestion} · C {scoreTotals.ibp_contexte} ·
          {' '}
          {scoreTotals.completed_factors}/10 facteurs scoreables
        </Text>
      </View>

      <Text style={styles.label}>Site name *</Text>
      <TextInput style={styles.input} value={siteName} onChangeText={setSiteName} />
      {formErrors.siteName ? <Text style={styles.fieldError}>{formErrors.siteName}</Text> : null}

      <Text style={styles.label}>Region version *</Text>
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

      <Text style={styles.label}>Vegetation stage *</Text>
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

      <View style={styles.formLocationSection}>
        <Text style={styles.label}>Location *</Text>

        {locationSource === 'gps' ? (
          <View style={styles.detailSection}>
            <View style={styles.formMapCard}>
              <View style={styles.formMapFrame}>
                <MapView style={styles.formMap} region={mapRegion} onPress={handleMapPress}>
                  {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} draggable onDragEnd={handleMarkerDragEnd} /> : null}
                </MapView>
                <Pressable style={styles.locationCurrentMapButton} onPress={handleRequestCurrentLocation}>
                  <Ionicons name="locate" size={14} color="#ffffff" />
                  <Text style={styles.locationCurrentMapButtonText}>Localisation actuelle</Text>
                </Pressable>
              </View>
              <Text style={styles.rowMeta}>
                {screen === 'create'
                  ? 'Position récupérée automatiquement à la création. Touchez la carte pour ajuster.'
                  : 'Touchez la carte pour ajuster la position.'}
              </Text>
              {isResolvingGpsAddress ? (
                <View style={styles.locationAddressCard}>
                  <View style={styles.locationAddressHeader}>
                    <Ionicons name="navigate-outline" size={14} color="#1f5d8e" />
                    <Text style={styles.locationAddressLabel}>Adresse locale</Text>
                  </View>
                  <Text style={styles.locationAddressValue}>Recherche en cours...</Text>
                </View>
              ) : null}
              {resolvedGpsAddress ? (
                <View style={styles.locationAddressCard}>
                  <View style={styles.locationAddressHeader}>
                    <Ionicons name="location-outline" size={14} color="#1f5d8e" />
                    <Text style={styles.locationAddressLabel}>Adresse locale</Text>
                  </View>
                  <Text style={styles.locationAddressValue}>{resolvedGpsAddress}</Text>
                </View>
              ) : null}
            </View>

            {formErrors.gps.lat || formErrors.gps.lng ? (
              <Text style={styles.fieldError}>{formErrors.gps.lat ?? formErrors.gps.lng}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.detailSection}>
            <Text style={styles.rowMeta}>Renseignez l'adresse complète si vous ne souhaitez pas utiliser la carte.</Text>
            <Text style={styles.label}>Address line *</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.address_line}
              onChangeText={(value) => setManualLocationField('address_line', value)}
              placeholder="12 Rue de la Foret"
            />
            {formErrors.manual.address_line ? <Text style={styles.fieldError}>{formErrors.manual.address_line}</Text> : null}

            <Text style={styles.label}>Postal code *</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.postal_code}
              onChangeText={(value) => setManualLocationField('postal_code', value)}
              keyboardType="number-pad"
              placeholder="75001"
            />
            {formErrors.manual.postal_code ? <Text style={styles.fieldError}>{formErrors.manual.postal_code}</Text> : null}

            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.city}
              onChangeText={(value) => setManualLocationField('city', value)}
              placeholder="Paris"
            />
            {formErrors.manual.city ? <Text style={styles.fieldError}>{formErrors.manual.city}</Text> : null}

            <Text style={styles.label}>Country *</Text>
            <TextInput
              style={styles.input}
              value={manualLocation.country}
              onChangeText={(value) => setManualLocationField('country', value)}
              placeholder="France"
            />
            {formErrors.manual.country ? <Text style={styles.fieldError}>{formErrors.manual.country}</Text> : null}
          </View>
        )}
      </View>

      <View style={styles.factorSectionCard}>
        <View style={styles.factorSectionHeaderRow}>
          <Text style={styles.label}>Factors</Text>
          <Text style={styles.rowMeta}>
            {completedFactorCount}/{FACTOR_ORDER.length} complete
          </Text>
        </View>

        <View style={styles.formFactorTilesGrid}>
          {FACTOR_ORDER.map((factor) => {
            const progress = factorProgress[factor];
            const retainedScore = factorRetainedScores[factor];
            return (
              <Pressable
                key={`form-factor-tile-${factor}`}
                style={[styles.formFactorTile, progress.complete ? styles.formFactorTileComplete : styles.formFactorTileIncomplete]}
                onPress={() => onOpenFactor(factor)}
              >
                <View style={styles.formFactorTileHeader}>
                  <Text style={styles.formFactorTileTitle}>Factor {factor}</Text>
                  <Ionicons
                    name={progress.complete ? 'checkmark-circle' : progress.invalid > 0 ? 'alert-circle' : 'ellipse-outline'}
                    size={16}
                    color={progress.complete ? '#1f7a56' : progress.invalid > 0 ? '#9a4e09' : '#6a829a'}
                  />
                </View>
                <Text style={styles.formFactorTileMeta}>
                  {progress.filled}/{progress.total} fields
                </Text>
                <Text style={styles.formFactorTileMeta}>{progress.complete ? 'Completed' : progress.invalid > 0 ? 'Validation needed' : 'To complete'}</Text>
                {retainedScore ? (
                  <Text style={styles.formFactorTileScore}>
                    Score {retainedScore.score} ({retainedScore.selected_class})
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {editingSurveyId ? <Button title="Save" onPress={() => void onSaveSurveyEdits()} /> : <Button title="Save" onPress={() => void onCreateDraft()} />}
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
