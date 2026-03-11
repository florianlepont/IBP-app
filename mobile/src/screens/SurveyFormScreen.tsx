import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { brandColors, brandRadius, brandShadow, brandSpacing, brandTypography } from '../app/brand-tokens';
import { computeRegionZoom } from '../app/map-viewport';
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from '../app/constants';
import { computeIbpTotalsFromRetainedScores } from '../app/ibp-scoring';
import { AppScreen, FactorField, FactorKey, FactorRetainedScore, RegionVersion, VegetationStage } from '../app/types';
import { IgnCadastreTileOverlay } from '../components/IgnCadastreTileOverlay';
import { ParcelOverlayPolygons } from '../components/ParcelOverlayPolygons';
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
const FACTOR_TITLES: Record<FactorKey, string> = {
  A: 'Essences autochtones',
  B: 'Structure verticale',
  C: 'Bois morts sur pied',
  D: 'Bois morts au sol',
  E: 'Tres gros bois vivants',
  F: 'Dendromicrohabitats',
  G: 'Milieux ouverts floriferes',
  H: 'Continuite boisee',
  I: 'Milieux aquatiques',
  J: 'Milieux rocheux'
};

type WizardStep = 'setup' | 'factors';

function WizardChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[screenStyles.choiceChip, active ? screenStyles.choiceChipActive : null]}>
      <Text style={[screenStyles.choiceChipText, active ? screenStyles.choiceChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function WizardStepButton({
  step,
  label,
  meta,
  active,
  onPress
}: {
  step: string;
  label: string;
  meta: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[screenStyles.stepButton, active ? screenStyles.stepButtonActive : null]}>
      <Text style={[screenStyles.stepButtonEyebrow, active ? screenStyles.stepButtonEyebrowActive : null]}>{step}</Text>
      <Text style={[screenStyles.stepButtonTitle, active ? screenStyles.stepButtonTitleActive : null]}>{label}</Text>
      <Text style={[screenStyles.stepButtonMeta, active ? screenStyles.stepButtonMetaActive : null]}>{meta}</Text>
    </Pressable>
  );
}

function FactorTile({
  factor,
  title,
  progress,
  retainedScore,
  onPress
}: {
  factor: FactorKey;
  title: string;
  progress: { complete: boolean; filled: number; total: number; invalid: number };
  retainedScore: FactorRetainedScore | null;
  onPress: () => void;
}) {
  const toneStyle = progress.complete
    ? screenStyles.factorTileComplete
    : progress.invalid > 0
      ? screenStyles.factorTileWarning
      : screenStyles.factorTilePending;
  const iconName = progress.complete ? 'checkmark-circle' : progress.invalid > 0 ? 'alert-circle' : 'ellipse-outline';
  const iconColor = progress.complete ? brandColors.forest : progress.invalid > 0 ? brandColors.terracotta : brandColors.textSecondary;

  return (
    <Pressable onPress={onPress} style={[screenStyles.factorTile, toneStyle]}>
      <View style={screenStyles.factorTileTopRow}>
        <View style={screenStyles.factorBadge}>
          <Text style={screenStyles.factorBadgeText}>{factor}</Text>
        </View>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <Text style={screenStyles.factorTileTitle}>{title}</Text>
      <Text style={screenStyles.factorTileMeta}>
        {progress.filled}/{progress.total} fields
        {progress.invalid > 0 ? ` · ${progress.invalid} invalid` : ''}
      </Text>
      <Text style={screenStyles.factorTileState}>
        {retainedScore ? `${retainedScore.selected_class} · ${retainedScore.score} pts` : progress.complete ? 'Ready to score' : 'Open factor'}
      </Text>
      <View style={screenStyles.factorTileFooter}>
        <Text style={screenStyles.factorTileFooterText}>Open factor</Text>
        <Ionicons name="chevron-forward" size={16} color={brandColors.forest} />
      </View>
    </Pressable>
  );
}

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
  const [activeStep, setActiveStep] = useState<WizardStep>('setup');
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
  const regionLabel = useMemo(
    () => REGION_OPTIONS.find((option) => option.value === regionVersion)?.label ?? regionVersion,
    [regionVersion]
  );
  const vegetationLabel = useMemo(
    () =>
      VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].find((option) => option.value === vegetationStage)?.label ?? vegetationStage,
    [regionVersion, vegetationStage]
  );
  const setupReady = siteName.trim().length > 0 && selectedParcelIds.length > 0;
  const heroTitle = activeStep === 'setup' ? (screen === 'edit' ? 'Edit survey' : 'Build a new survey') : 'Score the IBP factors';
  const heroBody =
    activeStep === 'setup'
      ? 'Name the survey, anchor it on the cadastre, and lock the region and vegetation before you score.'
      : 'Open each factor, enter the field observations, and track the retained score live.';
  const persistLabel = screen === 'edit' ? 'Save changes' : 'Save draft';

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

  useEffect(() => {
    setActiveStep('setup');
  }, [screen, editingSurveyId]);

  const handlePersistSurvey = (): void => {
    if (editingSurveyId) {
      void onSaveSurveyEdits();
      return;
    }
    void onCreateDraft();
  };

  return (
    <View style={screenStyles.screen}>
      <View style={screenStyles.heroCard}>
        <View style={screenStyles.heroAccentOrb} />
        <Text style={screenStyles.heroEyebrow}>Survey wizard · {activeStep === 'setup' ? 'Step 1 of 2' : 'Step 2 of 2'}</Text>
        <Text style={screenStyles.heroTitle}>{heroTitle}</Text>
        <Text style={screenStyles.heroBody}>{heroBody}</Text>
        <View style={screenStyles.heroMetaRow}>
          <View style={screenStyles.heroMetaPill}>
            <Text style={screenStyles.heroMetaPillText}>{selectedParcelIds.length} parcel{selectedParcelIds.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={screenStyles.heroMetaPill}>
            <Text style={screenStyles.heroMetaPillText}>{scoreTotals.completed_factors}/10 factors scored</Text>
          </View>
        </View>
        {editingSurveyId ? <Text style={screenStyles.heroDraftMeta}>Draft {editingSurveyId}</Text> : null}
      </View>

      <View style={screenStyles.stepRow}>
        <WizardStepButton
          step="01"
          label="Setup"
          meta="Name, parcels, region, vegetation"
          active={activeStep === 'setup'}
          onPress={() => setActiveStep('setup')}
        />
        <WizardStepButton
          step="02"
          label="Factors"
          meta={`${completedFactorCount}/${FACTOR_ORDER.length} completed`}
          active={activeStep === 'factors'}
          onPress={() => setActiveStep('factors')}
        />
      </View>

      {activeStep === 'setup' ? (
        <>
          <View style={screenStyles.panel}>
            <View style={screenStyles.panelHeader}>
              <Text style={screenStyles.panelTitle}>Survey identity</Text>
              <Text style={screenStyles.panelBody}>Define the site and its ecological context before you score the field observations.</Text>
            </View>

            <Text style={screenStyles.label}>Site name *</Text>
            <TextInput
              style={screenStyles.input}
              value={siteName}
              onChangeText={setSiteName}
              placeholder="Ex: Foret de Rambouillet"
              placeholderTextColor={brandColors.textSecondary}
            />
            {formErrors.siteName ? <Text style={screenStyles.errorText}>{formErrors.siteName}</Text> : null}

            <Text style={screenStyles.label}>Region version *</Text>
            <View style={screenStyles.choiceRow}>
              {REGION_OPTIONS.map((option) => (
                <WizardChip
                  key={option.value}
                  label={option.label}
                  active={regionVersion === option.value}
                  onPress={() => onRegionChange(option.value)}
                />
              ))}
            </View>

            <Text style={screenStyles.label}>Vegetation stage *</Text>
            <View style={screenStyles.choiceRow}>
              {VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].map((option) => (
                <WizardChip
                  key={option.value}
                  label={option.label}
                  active={vegetationStage === option.value}
                  onPress={() => setVegetationStage(option.value)}
                />
              ))}
            </View>
          </View>

          <View style={screenStyles.panel}>
            <View style={screenStyles.parcelHeaderRow}>
              <View style={screenStyles.panelHeaderCompact}>
                <Text style={screenStyles.panelTitle}>Parcel selection</Text>
                <Text style={screenStyles.panelBody}>
                  Use the GPS point to frame the map, zoom in on the cadastre, then tap polygons to add or remove parcels.
                </Text>
              </View>
              <Pressable style={screenStyles.secondaryPillButton} onPress={handleRequestCurrentLocation}>
                <Ionicons name="locate" size={14} color={brandColors.forest} />
                <Text style={screenStyles.secondaryPillButtonText}>Use GPS</Text>
              </Pressable>
            </View>

            <View style={screenStyles.mapFrame}>
              <MapView ref={mapRef} style={screenStyles.map} initialRegion={computedMapRegion} onRegionChangeComplete={setMapRegion}>
                <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
                <ParcelOverlayPolygons
                  items={parcelStatuses}
                  selectedParcelIds={selectedParcelIds}
                  onParcelPress={onToggleParcelSelection}
                />
                {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} /> : null}
              </MapView>
              <View style={screenStyles.mapFloatingPill}>
                <Ionicons name="albums-outline" size={14} color={brandColors.white} />
                <Text style={screenStyles.mapFloatingPillText}>{selectedParcelIds.length} selected</Text>
              </View>
            </View>

            <Text style={screenStyles.mapHelperText}>
              {mapZoom >= 15
                ? parcelsLoading
                  ? 'Loading parcel overlay...'
                  : `${parcelStatuses.length} visible parcel(s) · tap polygons to select or deselect`
                : 'Zoom in to level 15+ to unlock parcel selection'}
            </Text>

            {selectedParcelIds.length > 0 ? (
              <View style={screenStyles.selectionSummaryRow}>
                {selectedParcelIds.slice(0, 4).map((parcelId) => (
                  <View key={parcelId} style={screenStyles.selectionPill}>
                    <Text style={screenStyles.selectionPillText}>{parcelId}</Text>
                  </View>
                ))}
                {selectedParcelIds.length > 4 ? (
                  <View style={screenStyles.selectionPill}>
                    <Text style={screenStyles.selectionPillText}>+{selectedParcelIds.length - 4} more</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {isResolvingGpsAddress ? (
              <View style={screenStyles.infoCard}>
                <View style={screenStyles.infoCardHeader}>
                  <Ionicons name="navigate-outline" size={15} color={brandColors.forest} />
                  <Text style={screenStyles.infoCardTitle}>Local address</Text>
                </View>
                <Text style={screenStyles.infoCardBody}>Looking up...</Text>
              </View>
            ) : null}

            {resolvedGpsAddress ? (
              <View style={screenStyles.infoCard}>
                <View style={screenStyles.infoCardHeader}>
                  <Ionicons name="location-outline" size={15} color={brandColors.forest} />
                  <Text style={screenStyles.infoCardTitle}>Local address</Text>
                </View>
                <Text style={screenStyles.infoCardBody}>{resolvedGpsAddress}</Text>
              </View>
            ) : null}
          </View>

          <View style={[screenStyles.readinessCard, setupReady ? screenStyles.readinessCardReady : null]}>
            <Ionicons
              name={setupReady ? 'checkmark-circle' : 'information-circle'}
              size={18}
              color={setupReady ? brandColors.forest : brandColors.ochre}
            />
            <Text style={screenStyles.readinessText}>
              {setupReady
                ? 'Setup complete. You can move on to factor scoring.'
                : 'Keep going: add at least one parcel to fully anchor this survey.'}
            </Text>
          </View>

          <Pressable style={screenStyles.primaryButton} onPress={() => setActiveStep('factors')}>
            <Text style={screenStyles.primaryButtonText}>Continue to factors</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={screenStyles.panel}>
            <View style={screenStyles.panelHeader}>
              <Text style={screenStyles.panelTitle}>Survey snapshot</Text>
              <Text style={screenStyles.panelBody}>Use this summary to keep the scoring context visible while you fill each factor.</Text>
            </View>
            <View style={screenStyles.snapshotGrid}>
              <View style={screenStyles.snapshotTile}>
                <Text style={screenStyles.snapshotLabel}>Site</Text>
                <Text style={screenStyles.snapshotValue}>{siteName.trim() || 'Unnamed site'}</Text>
              </View>
              <View style={screenStyles.snapshotTile}>
                <Text style={screenStyles.snapshotLabel}>Region</Text>
                <Text style={screenStyles.snapshotValue}>{regionLabel}</Text>
              </View>
              <View style={screenStyles.snapshotTile}>
                <Text style={screenStyles.snapshotLabel}>Vegetation</Text>
                <Text style={screenStyles.snapshotValue}>{vegetationLabel}</Text>
              </View>
              <View style={screenStyles.snapshotTile}>
                <Text style={screenStyles.snapshotLabel}>Parcels</Text>
                <Text style={screenStyles.snapshotValue}>{selectedParcelIds.length}</Text>
              </View>
            </View>
          </View>

          <View style={screenStyles.scoreHeroCard}>
            <Text style={screenStyles.scoreHeroLabel}>IBP total in progress</Text>
            <Text style={screenStyles.scoreHeroValue}>{scoreTotals.ibp_total}</Text>
            <Text style={screenStyles.scoreHeroMeta}>
              Peuplement / gestion {scoreTotals.ibp_peuplement_gestion} · Contexte {scoreTotals.ibp_contexte}
            </Text>
            <Text style={screenStyles.scoreHeroMeta}>{scoreTotals.completed_factors}/10 factors currently scoreable</Text>
          </View>

          <View style={screenStyles.panel}>
            <View style={screenStyles.factorsHeaderRow}>
              <View style={screenStyles.panelHeaderCompact}>
                <Text style={screenStyles.panelTitle}>Factor scoring</Text>
                <Text style={screenStyles.panelBody}>Each factor opens on its dedicated screen. Inputs remain live in the draft while you edit.</Text>
              </View>
              <Pressable style={screenStyles.secondaryPillButton} onPress={() => setActiveStep('setup')}>
                <Ionicons name="arrow-back" size={14} color={brandColors.forest} />
                <Text style={screenStyles.secondaryPillButtonText}>Back to setup</Text>
              </Pressable>
            </View>

            <View style={screenStyles.factorGrid}>
              {FACTOR_ORDER.map((factor) => (
                <FactorTile
                  key={factor}
                  factor={factor}
                  title={FACTOR_TITLES[factor]}
                  progress={factorProgress[factor]}
                  retainedScore={factorRetainedScores[factor]}
                  onPress={() => onOpenFactor(factor)}
                />
              ))}
            </View>
          </View>

          <View style={screenStyles.actionRow}>
            <Pressable style={screenStyles.secondaryButton} onPress={() => setActiveStep('setup')}>
              <Text style={screenStyles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable style={screenStyles.primaryButtonWide} onPress={handlePersistSurvey}>
              <Text style={screenStyles.primaryButtonText}>{persistLabel}</Text>
            </Pressable>
          </View>
        </>
      )}

      {status.trim() ? (
        <View style={screenStyles.statusCard}>
          <Text style={screenStyles.statusCardText}>{status}</Text>
        </View>
      ) : null}
    </View>
  );
}

const screenStyles = StyleSheet.create({
  screen: {
    gap: brandSpacing.md
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: 34,
    backgroundColor: brandColors.forest,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 10,
    ...brandShadow.card
  },
  heroAccentOrb: {
    position: 'absolute',
    top: -28,
    right: -18,
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: 'rgba(176, 199, 142, 0.22)'
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: '#D7E3C0'
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white
  },
  heroBody: {
    ...brandTypography.heroBody,
    color: '#E4ECD8',
    maxWidth: 310
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  heroMetaPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  heroMetaPillText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  heroDraftMeta: {
    ...brandTypography.meta,
    color: '#D7E3C0'
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10
  },
  stepButton: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2
  },
  stepButtonActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.white
  },
  stepButtonEyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary
  },
  stepButtonEyebrowActive: {
    color: brandColors.forest
  },
  stepButtonTitle: {
    ...brandTypography.label,
    color: brandColors.textPrimary
  },
  stepButtonTitleActive: {
    color: brandColors.forest
  },
  stepButtonMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  stepButtonMetaActive: {
    color: brandColors.forest
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card
  },
  panelHeader: {
    gap: 4
  },
  panelHeaderCompact: {
    flex: 1,
    gap: 4
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 25,
    color: brandColors.forest
  },
  panelBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary
  },
  label: {
    ...brandTypography.label,
    color: brandColors.textPrimary
  },
  input: {
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    borderRadius: brandRadius.field,
    backgroundColor: brandColors.inputFill,
    color: brandColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.input
  },
  errorText: {
    ...brandTypography.meta,
    color: brandColors.terracotta
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  choiceChip: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  choiceChipActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest
  },
  choiceChipText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  choiceChipTextActive: {
    color: brandColors.white
  },
  parcelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  secondaryPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  secondaryPillButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  mapFrame: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.canvas
  },
  map: {
    width: '100%',
    height: 288
  },
  mapFloatingPill: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapFloatingPillText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  mapHelperText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  selectionSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  selectionPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  selectionPillText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 14,
    gap: 6
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  infoCardTitle: {
    ...brandTypography.label,
    color: brandColors.forest
  },
  infoCardBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary
  },
  readinessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    backgroundColor: '#F4E4D7',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  readinessCardReady: {
    backgroundColor: brandColors.successSoft
  },
  readinessText: {
    flex: 1,
    ...brandTypography.meta,
    color: brandColors.textPrimary
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  snapshotTile: {
    width: '47%',
    minWidth: 132,
    flexGrow: 1,
    borderRadius: 22,
    backgroundColor: brandColors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4
  },
  snapshotLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary
  },
  snapshotValue: {
    ...brandTypography.input,
    color: brandColors.textPrimary
  },
  scoreHeroCard: {
    borderRadius: 28,
    backgroundColor: brandColors.white,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 4,
    ...brandShadow.card
  },
  scoreHeroLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary
  },
  scoreHeroValue: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: '900',
    color: brandColors.forest
  },
  scoreHeroMeta: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary
  },
  factorsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  factorTile: {
    width: '47%',
    minWidth: 148,
    flexGrow: 1,
    borderRadius: 24,
    padding: 14,
    gap: 8,
    borderWidth: 1
  },
  factorTilePending: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white
  },
  factorTileComplete: {
    borderColor: brandColors.moss,
    backgroundColor: brandColors.successSoft
  },
  factorTileWarning: {
    borderColor: brandColors.terracotta,
    backgroundColor: '#F9E5DF'
  },
  factorTileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  factorBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.forest
  },
  factorBadgeText: {
    ...brandTypography.label,
    color: brandColors.white
  },
  factorTileTitle: {
    ...brandTypography.label,
    color: brandColors.textPrimary
  },
  factorTileMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  factorTileState: {
    ...brandTypography.input,
    color: brandColors.forest
  },
  factorTileFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  factorTileFooterText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  secondaryButton: {
    minWidth: 104,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  secondaryButtonText: {
    ...brandTypography.button,
    color: brandColors.forest
  },
  primaryButton: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    ...brandShadow.card
  },
  primaryButtonWide: {
    flex: 1,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    ...brandShadow.card
  },
  primaryButtonText: {
    ...brandTypography.button,
    color: brandColors.white
  },
  statusCard: {
    borderRadius: 20,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  statusCardText: {
    ...brandTypography.meta,
    color: brandColors.textPrimary
  }
});
