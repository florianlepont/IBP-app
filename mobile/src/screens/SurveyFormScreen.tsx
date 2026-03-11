import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { computeRegionZoom } from '../app/map-viewport';
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from '../app/constants';
import { computeIbpTotalsFromRetainedScores } from '../app/ibp-scoring';
import { styles } from '../app/styles';
import { AppScreen, FactorField, FactorKey, FactorRetainedScore, RegionVersion, VegetationStage } from '../app/types';
import { IgnCadastreTileOverlay } from '../components/IgnCadastreTileOverlay';
import { ParcelOverlayPolygons } from '../components/ParcelOverlayPolygons';
import { FilterChip } from '../components/FilterChip';
import { useParcelStatuses } from '../hooks/useParcelStatuses';

type SurveyFormScreenProps = {
  apiUrl: string;
  screen: AppScreen;
  editingSurveyId: string | null;
  siteName: string;
  setSiteName: (value: string) => void;
  regionVersion: RegionVersion;
  vegetationStage: VegetationStage;
  setVegetationStage: (value: VegetationStage) => void;
  onRegionChange: (nextRegion: RegionVersion) => void;
  gpsLocation: {
    lat: string;
    lng: string;
    collected_at: string;
  };
  selectedParcelIds: string[];
  onToggleParcelSelection: (parcelId: string) => void;
  onCaptureGpsLocation: () => Promise<void>;
  factorSections: Record<FactorKey, FactorField[]>;
  factorRetainedScores: Record<FactorKey, FactorRetainedScore | null>;
  formErrors: { siteName: string | null };
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
  apiUrl,
  screen,
  editingSurveyId,
  siteName,
  setSiteName,
  regionVersion,
  vegetationStage,
  setVegetationStage,
  onRegionChange,
  gpsLocation,
  selectedParcelIds,
  onToggleParcelSelection,
  onCaptureGpsLocation,
  factorSections,
  factorRetainedScores,
  formErrors,
  onOpenFactor,
  onSaveSurveyEdits,
  onCreateDraft,
  status
}: SurveyFormScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const [autoLocateRequested, setAutoLocateRequested] = useState(false);
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState('');
  const [isResolvingGpsAddress, setIsResolvingGpsAddress] = useState(false);
  const lastResolvedCoordinateKeyRef = useRef('');

  const parsedLat = Number(gpsLocation.lat);
  const parsedLng = Number(gpsLocation.lng);
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER;
  const computedMapRegion: Region = {
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    latitudeDelta: hasGpsCoordinates ? 0.02 : 3.8,
    longitudeDelta: hasGpsCoordinates ? 0.02 : 3.8
  };
  const [mapRegion, setMapRegion] = useState<Region>(computedMapRegion);
  const mapZoom = useMemo(() => computeRegionZoom(mapRegion), [mapRegion]);
  const { items: parcelStatuses, loading: parcelsLoading } = useParcelStatuses({
    apiUrl,
    region: mapRegion,
    enabled: true,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    if (!hasGpsCoordinates) {
      return;
    }
    const nextRegion: Region = {
      latitude: parsedLat,
      longitude: parsedLng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015
    };
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 420);
  }, [hasGpsCoordinates, parsedLat, parsedLng, gpsLocation.collected_at]);

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

  const handleRequestCurrentLocation = (): void => {
    setAutoLocateRequested(true);
    void onCaptureGpsLocation();
  };

  useEffect(() => {
    if (screen !== 'create') {
      setAutoLocateRequested(false);
      return;
    }

    if (!hasGpsCoordinates && !autoLocateRequested) {
      setAutoLocateRequested(true);
      void onCaptureGpsLocation();
    }
  }, [screen, hasGpsCoordinates, autoLocateRequested, onCaptureGpsLocation]);

  useEffect(() => {
    if (!hasGpsCoordinates) {
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
  }, [hasGpsCoordinates, parsedLat, parsedLng]);

  return (
    <View style={styles.formScreen}>
      <View style={styles.card}>
        {screen === 'edit' && editingSurveyId ? <Text style={styles.meta}>Survey id: {editingSurveyId}</Text> : null}
        <Text style={styles.rowMeta}>Fields marked with * are required for submit.</Text>

        <Text style={styles.label}>Site name *</Text>
        <TextInput style={styles.input} value={siteName} onChangeText={setSiteName} />
        {formErrors.siteName ? <Text style={styles.fieldError}>{formErrors.siteName}</Text> : null}
      </View>

      <View style={styles.formMapHeroCard}>
        <View style={styles.formMapHeroHeader}>
          <Text style={styles.label}>Parcels *</Text>
          <Text style={styles.rowMeta}>{selectedParcelIds.length} selected</Text>
        </View>
        <View style={styles.formMapFrame}>
          <MapView ref={mapRef} style={styles.formMap} initialRegion={computedMapRegion} onRegionChangeComplete={setMapRegion}>
            <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
            <ParcelOverlayPolygons
              items={parcelStatuses}
              selectedParcelIds={selectedParcelIds}
              onParcelPress={onToggleParcelSelection}
            />
            {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} /> : null}
          </MapView>
          <Pressable style={styles.locationCurrentMapButton} onPress={handleRequestCurrentLocation}>
            <Ionicons name="locate" size={14} color="#ffffff" />
            <Text style={styles.locationCurrentMapButtonText}>Current location</Text>
          </Pressable>
        </View>
        <Text style={styles.rowMeta}>
          {mapZoom >= 15
            ? parcelsLoading
              ? 'Loading parcel overlay...'
              : `${parcelStatuses.length} visible parcel(s) • tap polygons to select/deselect`
            : 'Zoom in (>=15) then tap parcel polygons to select/deselect'}
        </Text>
        {isResolvingGpsAddress ? (
          <View style={styles.locationAddressCard}>
            <View style={styles.locationAddressHeader}>
              <Ionicons name="navigate-outline" size={14} color="#1f5d8e" />
              <Text style={styles.locationAddressLabel}>Local address</Text>
            </View>
            <Text style={styles.locationAddressValue}>Looking up...</Text>
          </View>
        ) : null}
        {resolvedGpsAddress ? (
          <View style={styles.locationAddressCard}>
            <View style={styles.locationAddressHeader}>
              <Ionicons name="location-outline" size={14} color="#1f5d8e" />
              <Text style={styles.locationAddressLabel}>Local address</Text>
            </View>
            <Text style={styles.locationAddressValue}>{resolvedGpsAddress}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
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

        <View style={styles.formScoreHeroCard}>
          <Text style={styles.formScoreHeroLabel}>IBP Total (en cours)</Text>
          <Text style={styles.formScoreHeroValue}>{scoreTotals.ibp_total}</Text>
          <Text style={styles.formScoreHeroMeta}>
            P/G {scoreTotals.ibp_peuplement_gestion} · C {scoreTotals.ibp_contexte} ·
            {' '}
            {scoreTotals.completed_factors}/10 facteurs scoreables
          </Text>
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
    </View>
  );
}
