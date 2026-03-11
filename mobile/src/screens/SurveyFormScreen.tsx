import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { brandColors, brandRadius, brandShadow, brandSpacing, brandTypography } from '../app/brand-tokens';
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from '../app/constants';
import { computeIbpTotalsFromRetainedScores } from '../app/ibp-scoring';
import { computeRegionZoom } from '../app/map-viewport';
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
  onCaptureGpsLocation: () => Promise<boolean>;
  factorSections: Record<FactorKey, FactorField[]>;
  factorRetainedScores: Record<FactorKey, FactorRetainedScore | null>;
  formErrors: { siteName: string | null };
  onOpenFactor: (factor: FactorKey) => void;
  onSaveSurveyEdits: () => Promise<void>;
  onCreateDraft: () => Promise<void>;
  status: string;
};

type WizardStep = 'identity' | 'parcels' | 'factors';

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

function StepButton({
  index,
  label,
  meta,
  active,
  complete,
  onPress
}: {
  index: string;
  label: string;
  meta: string;
  active: boolean;
  complete: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        screenStyles.stepButton,
        active ? screenStyles.stepButtonActive : null,
        complete && !active ? screenStyles.stepButtonComplete : null
      ]}
    >
      <View style={screenStyles.stepButtonTopRow}>
        <View style={[screenStyles.stepIndexPill, active ? screenStyles.stepIndexPillActive : null]}>
          <Text style={[screenStyles.stepIndexText, active ? screenStyles.stepIndexTextActive : null]}>{index}</Text>
        </View>
        <Ionicons
          name={active ? 'radio-button-on' : complete ? 'checkmark-circle' : 'chevron-forward-circle'}
          size={18}
          color={active ? brandColors.white : complete ? brandColors.forest : brandColors.textSecondary}
        />
      </View>
      <Text numberOfLines={1} style={[screenStyles.stepButtonTitle, active ? screenStyles.stepButtonTitleActive : null]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[screenStyles.stepButtonMeta, active ? screenStyles.stepButtonMetaActive : null]}>
        {meta}
      </Text>
      <Text numberOfLines={1} style={[screenStyles.stepButtonHint, active ? screenStyles.stepButtonHintActive : null]}>
        {active ? 'Current step' : 'Tap to open'}
      </Text>
    </Pressable>
  );
}

function WizardChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[screenStyles.choiceChip, active ? screenStyles.choiceChipActive : null]}>
      <Text style={[screenStyles.choiceChipText, active ? screenStyles.choiceChipTextActive : null]}>{label}</Text>
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
  const inlineMapRef = useRef<MapView | null>(null);
  const fullscreenMapRef = useRef<MapView | null>(null);
  const scrollRef = useRef<any>(null);
  const onCaptureGpsLocationRef = useRef(onCaptureGpsLocation);
  const parcelLocateRequestIdRef = useRef(0);
  const identitySectionLayoutRef = useRef({ y: 0, height: 0 });
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: viewportHeight } = useWindowDimensions();
  const [activeStep, setActiveStep] = useState<WizardStep>('identity');
  const [autoLocateRequested, setAutoLocateRequested] = useState(false);
  const [isAutoLocatingParcels, setIsAutoLocatingParcels] = useState(false);
  const [parcelAutoLocateError, setParcelAutoLocateError] = useState('');
  const [isParcelMapFullscreenVisible, setIsParcelMapFullscreenVisible] = useState(false);
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState('');
  const [isResolvingGpsAddress, setIsResolvingGpsAddress] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isIdentityInputFocused, setIsIdentityInputFocused] = useState(false);
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
    onCaptureGpsLocationRef.current = onCaptureGpsLocation;
  }, [onCaptureGpsLocation]);

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
    inlineMapRef.current?.animateToRegion(nextRegion, 420);
    fullscreenMapRef.current?.animateToRegion(nextRegion, 420);
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

  const identityReady = siteName.trim().length > 0;
  const parcelsReady = selectedParcelIds.length > 0;
  const factorsReady = completedFactorCount === FACTOR_ORDER.length;
  const persistLabel = screen === 'edit' ? 'Save changes' : 'Save draft';

  const stepMeta = useMemo(
    () => ({
      identity: siteName.trim() ? 'Name locked' : 'Name your site',
      parcels: selectedParcelIds.length > 0 ? `${selectedParcelIds.length} selected` : 'Map + context',
      factors: completedFactorCount > 0 ? `${completedFactorCount}/10 scored` : 'Start scoring'
    }),
    [siteName, selectedParcelIds.length, completedFactorCount]
  );

  const heroCopy = useMemo(() => {
    if (activeStep === 'identity') {
      return {
        title: screen === 'edit' ? 'Refine survey identity' : 'Start a new survey',
        body: 'Give the survey a clear name before you anchor it on the cadastre and score the field observations.',
        pills: [siteName.trim() || 'Unnamed site', selectedParcelIds.length ? `${selectedParcelIds.length} parcel(s)` : 'No parcel yet']
      };
    }

    if (activeStep === 'parcels') {
      return {
        title: 'Anchor the survey on the map',
        body: 'Select the parcel footprint, then lock the region version and vegetation stage for the scoring rules.',
        pills: [regionLabel, vegetationLabel, `${selectedParcelIds.length} parcel(s)`]
      };
    }

    return {
      title: 'Score the IBP factors',
      body: 'Open each factor, enter the observed values, and watch the retained scores build the total live.',
      pills: [`IBP ${scoreTotals.ibp_total}`, `${completedFactorCount}/10 factors`, `${selectedParcelIds.length} parcel(s)`]
    };
  }, [activeStep, completedFactorCount, regionLabel, screen, scoreTotals.ibp_total, selectedParcelIds.length, siteName, vegetationLabel]);

  const compactSummary = heroCopy.pills.join(' • ');
  const expandedHeroHeight = Math.max(248, Math.min(292, Math.round(viewportHeight * 0.27)));
  const collapsedHeroHeight = 84;
  const collapseDistance = expandedHeroHeight - collapsedHeroHeight;
  const topSpacerHeight = expandedHeroHeight + brandSpacing.sm;

  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeroHeight, collapsedHeroHeight],
    extrapolate: 'clamp'
  });
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.36, collapseDistance * 0.62],
    outputRange: [1, 0.22, 0],
    extrapolate: 'clamp'
  });
  const expandedTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.62],
    outputRange: [0, -10],
    extrapolate: 'clamp'
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.42, collapseDistance * 0.72, collapseDistance],
    outputRange: [0, 0.65, 1],
    extrapolate: 'clamp'
  });
  const compactTranslateY = scrollY.interpolate({
    inputRange: [collapseDistance * 0.42, collapseDistance],
    outputRange: [8, 0],
    extrapolate: 'clamp'
  });
  const stepRailOpacity = scrollY.interpolate({
    inputRange: [0, 36, 88],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp'
  });
  const stepRailScale = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [1, 0.92],
    extrapolate: 'clamp'
  });
  const stepRailTranslateY = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [0, -18],
    extrapolate: 'clamp'
  });
  const compactProgressOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.38, collapseDistance * 0.68, collapseDistance],
    outputRange: [0, 0.55, 1],
    extrapolate: 'clamp'
  });

  const activeStepIndex = activeStep === 'identity' ? 0 : activeStep === 'parcels' ? 1 : 2;
  useEffect(() => {
    if (activeStep !== 'parcels') {
      parcelLocateRequestIdRef.current += 1;
      setAutoLocateRequested(false);
      setIsAutoLocatingParcels(false);
      setParcelAutoLocateError('');
      return;
    }

    if (hasGpsCoordinates) {
      setIsAutoLocatingParcels(false);
      setParcelAutoLocateError('');
      return;
    }

    if (autoLocateRequested) {
      return;
    }

    const requestId = parcelLocateRequestIdRef.current + 1;
    parcelLocateRequestIdRef.current = requestId;
    setAutoLocateRequested(true);
    setIsAutoLocatingParcels(true);
    setParcelAutoLocateError('');

    void onCaptureGpsLocationRef.current()
      .then((captured) => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return;
        }
        setIsAutoLocatingParcels(false);
        if (!captured) {
          setParcelAutoLocateError('Current position unavailable. Open the full-screen map to retry or browse manually.');
        }
      })
      .catch(() => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return;
        }
        setIsAutoLocatingParcels(false);
        setParcelAutoLocateError('Current position unavailable. Open the full-screen map to retry or browse manually.');
      });
  }, [activeStep, autoLocateRequested, hasGpsCoordinates]);

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
        if (cancelled) {
          return;
        }
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
    setActiveStep('identity');
    setAutoLocateRequested(false);
  }, [screen, editingSurveyId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const nextKeyboardHeight = event.endCoordinates.height;
      setKeyboardHeight(nextKeyboardHeight);

      if (activeStep === 'identity' && isIdentityInputFocused) {
        setTimeout(() => {
          scrollIdentitySectionAboveKeyboard(nextKeyboardHeight);
        }, 40);
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [activeStep, isIdentityInputFocused, viewportHeight]);

  const handlePersistSurvey = (): void => {
    if (screen === 'edit') {
      void onSaveSurveyEdits();
      return;
    }
    void onCreateDraft();
  };

  const handleLocateParcelsMap = (): void => {
    if (isAutoLocatingParcels) {
      return;
    }

    const requestId = parcelLocateRequestIdRef.current + 1;
    parcelLocateRequestIdRef.current = requestId;
    setIsAutoLocatingParcels(true);
    setParcelAutoLocateError('');

    void onCaptureGpsLocationRef.current()
      .then((captured) => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return;
        }
        setIsAutoLocatingParcels(false);
        if (!captured) {
          setParcelAutoLocateError('Current position unavailable. Browse the map manually or try again.');
        }
      })
      .catch(() => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return;
        }
        setIsAutoLocatingParcels(false);
        setParcelAutoLocateError('Current position unavailable. Browse the map manually or try again.');
      });
  };

  const scrollIdentitySectionAboveKeyboard = (keyboardFrameHeight = keyboardHeight): void => {
    const visibleTop = collapsedHeroHeight + brandSpacing.md;
    const visibleBottom = viewportHeight - keyboardFrameHeight - brandSpacing.lg;
    const { y, height } = identitySectionLayoutRef.current;
    const targetY = Math.max(y - visibleTop, y + height - visibleBottom, 0);
    const scrollable = scrollRef.current as
      | {
          scrollTo?: (options: { y: number; animated?: boolean }) => void;
          getNode?: () => { scrollTo?: (options: { y: number; animated?: boolean }) => void };
        }
      | null;

    if (!scrollable) {
      return;
    }
    scrollable.scrollTo?.({ y: targetY, animated: true });
    scrollable.getNode?.().scrollTo?.({ y: targetY, animated: true });
  };

  const parcelMapHelperText = useMemo(() => {
    if (isAutoLocatingParcels) {
      return 'Centering on your current position...';
    }
    if (parcelAutoLocateError) {
      return parcelAutoLocateError;
    }
    if (mapZoom >= 15) {
      return parcelsLoading
        ? 'Loading parcel overlay...'
        : `${parcelStatuses.length} visible parcel(s) · tap polygons to select or deselect`;
    }
    return 'Zoom in to level 15+ to unlock parcel selection';
  }, [isAutoLocatingParcels, mapZoom, parcelAutoLocateError, parcelStatuses.length, parcelsLoading]);

  return (
    <View style={screenStyles.container}>
      <Animated.View
        pointerEvents="none"
        style={[
          screenStyles.heroShell,
          {
            height: heroHeight
          }
        ]}
      >
        <View style={screenStyles.heroCard}>
          <View style={screenStyles.heroAccentOrb} />
          <Animated.View
            style={[
              screenStyles.heroExpandedLayer,
              {
                opacity: expandedOpacity,
                transform: [{ translateY: expandedTranslateY }]
              }
            ]}
          >
            <View style={screenStyles.heroExpandedHeader}>
              <Text style={screenStyles.heroEyebrow}>
                Survey wizard · Step {activeStep === 'identity' ? '1' : activeStep === 'parcels' ? '2' : '3'} of 3
              </Text>
              <Text style={screenStyles.heroTitleExpanded}>{heroCopy.title}</Text>
              <Text style={screenStyles.heroBody}>{heroCopy.body}</Text>
            </View>

            <View style={screenStyles.heroMetaRow}>
              {heroCopy.pills.map((pill) => (
                <View key={`${activeStep}-${pill}`} style={screenStyles.heroMetaPill}>
                  <Text style={screenStyles.heroMetaPillText}>{pill}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              screenStyles.heroCompactLayer,
              {
                opacity: compactOpacity,
                transform: [{ translateY: compactTranslateY }]
              }
            ]}
          >
            <Text numberOfLines={1} style={screenStyles.heroCompactSummary}>
              {compactSummary}
            </Text>
            <Animated.View style={[screenStyles.compactProgressWrap, { opacity: compactProgressOpacity }]}>
              <Text style={screenStyles.compactProgressCount}>Step {activeStepIndex + 1}/3</Text>
              <View style={screenStyles.compactProgressTrack}>
                {(['identity', 'parcels', 'factors'] as WizardStep[]).map((step, index) => (
                  <View
                    key={`compact-progress-${step}`}
                    style={[
                      screenStyles.compactProgressSegment,
                      index < activeStepIndex
                        ? screenStyles.compactProgressSegmentComplete
                        : index === activeStepIndex
                          ? screenStyles.compactProgressSegmentActive
                          : null
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={screenStyles.pageScroll}
        contentContainerStyle={[screenStyles.pageContent, keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 108 } : null]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false
        })}
      >
        <View style={{ height: topSpacerHeight }} />

        <Animated.View
          style={[
            screenStyles.stepRailWrap,
            {
              marginTop: -brandSpacing.sm,
              opacity: stepRailOpacity,
              transform: [{ translateY: stepRailTranslateY }, { scale: stepRailScale }]
            }
          ]}
        >
          <View style={screenStyles.stepRailCard}>
            <View style={screenStyles.stepRow}>
              <StepButton
                index="01"
                label="Identity"
                meta={stepMeta.identity}
                active={activeStep === 'identity'}
                complete={identityReady}
                onPress={() => setActiveStep('identity')}
              />
              <StepButton
                index="02"
                label="Parcels"
                meta={stepMeta.parcels}
                active={activeStep === 'parcels'}
                complete={parcelsReady}
                onPress={() => setActiveStep('parcels')}
              />
              <StepButton
                index="03"
                label="Factors"
                meta={stepMeta.factors}
                active={activeStep === 'factors'}
                complete={factorsReady}
                onPress={() => setActiveStep('factors')}
              />
            </View>
          </View>
        </Animated.View>

        {activeStep === 'identity' ? (
          <View
            style={screenStyles.identityStepContent}
            onLayout={(event) => {
              identitySectionLayoutRef.current = event.nativeEvent.layout;
            }}
          >
            <View style={screenStyles.panel}>
              <View style={screenStyles.panelHeader}>
                <Text style={screenStyles.panelTitle}>Survey identity</Text>
                <Text style={screenStyles.panelBody}>
                  Give the draft a name that will stay readable in lists, sync logs, and parcel detail screens.
                </Text>
              </View>

              <Text style={screenStyles.label}>Site name *</Text>
              <TextInput
                style={screenStyles.input}
                value={siteName}
                onChangeText={setSiteName}
                onFocus={() => {
                  setIsIdentityInputFocused(true);
                  setTimeout(() => {
                    scrollIdentitySectionAboveKeyboard();
                  }, 140);
                }}
                onBlur={() => {
                  setIsIdentityInputFocused(false);
                }}
                placeholder="Ex: Foret de Rambouillet"
                placeholderTextColor={brandColors.textSecondary}
              />
              {formErrors.siteName ? <Text style={screenStyles.errorText}>{formErrors.siteName}</Text> : null}
            </View>

            <Pressable style={screenStyles.primaryButton} onPress={() => setActiveStep('parcels')}>
              <Text style={screenStyles.primaryButtonText}>Continue to parcels</Text>
            </Pressable>
          </View>
        ) : null}

        {activeStep === 'parcels' ? (
          <>
            <View style={screenStyles.panel}>
              <View style={screenStyles.parcelHeaderRow}>
                <View style={screenStyles.panelHeaderCompact}>
                  <Text style={screenStyles.panelTitle}>Parcel selection</Text>
                  <Text style={screenStyles.panelBody}>
                    The map starts from your current position when available. Zoom in on the cadastre, then tap polygons to attach them to the survey.
                  </Text>
                </View>
                <View style={screenStyles.selectionCountPill}>
                  <Text style={screenStyles.selectionCountPillText}>
                    {selectedParcelIds.length} selected
                  </Text>
                </View>
              </View>

              <View style={screenStyles.mapFrame}>
                <MapView ref={inlineMapRef} style={screenStyles.map} initialRegion={computedMapRegion} onRegionChangeComplete={setMapRegion}>
                  <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
                  <ParcelOverlayPolygons
                    items={parcelStatuses}
                    selectedParcelIds={selectedParcelIds}
                    onParcelPress={onToggleParcelSelection}
                  />
                  {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} /> : null}
                </MapView>
                <View pointerEvents="box-none" style={screenStyles.mapOverlayActions}>
                  <Pressable style={screenStyles.mapOverlayButton} onPress={() => setIsParcelMapFullscreenVisible(true)}>
                    <Ionicons name="expand-outline" size={15} color={brandColors.white} />
                    <Text style={screenStyles.mapOverlayButtonText}>Full screen</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={screenStyles.mapHelperText}>{parcelMapHelperText}</Text>

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

            <View style={screenStyles.panel}>
              <View style={screenStyles.panelHeader}>
                <Text style={screenStyles.panelTitle}>Scoring context</Text>
                <Text style={screenStyles.panelBody}>
                  Region version and vegetation stage directly affect the IBP scoring thresholds, so set them before opening factors.
                </Text>
              </View>

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

            <View style={screenStyles.actionRow}>
              <Pressable style={screenStyles.secondaryButton} onPress={() => setActiveStep('identity')}>
                <Text style={screenStyles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable style={screenStyles.primaryButtonWide} onPress={() => setActiveStep('factors')}>
                <Text style={screenStyles.primaryButtonText}>Continue to factors</Text>
              </Pressable>
            </View>

            <Modal
              visible={isParcelMapFullscreenVisible}
              animationType="slide"
              presentationStyle="fullScreen"
              onRequestClose={() => setIsParcelMapFullscreenVisible(false)}
            >
              <View style={screenStyles.fullscreenMapScreen}>
                <MapView
                  ref={fullscreenMapRef}
                  style={screenStyles.fullscreenMap}
                  initialRegion={mapRegion}
                  onRegionChangeComplete={setMapRegion}
                >
                  <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
                  <ParcelOverlayPolygons
                    items={parcelStatuses}
                    selectedParcelIds={selectedParcelIds}
                    onParcelPress={onToggleParcelSelection}
                  />
                  {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} /> : null}
                </MapView>

                <View pointerEvents="box-none" style={screenStyles.fullscreenMapOverlay}>
                  <View style={screenStyles.fullscreenMapTopBar}>
                    <Pressable style={screenStyles.fullscreenMapCloseButton} onPress={() => setIsParcelMapFullscreenVisible(false)}>
                      <Ionicons name="arrow-back" size={18} color={brandColors.white} />
                      <Text style={screenStyles.fullscreenMapCloseText}>Done</Text>
                    </Pressable>
                    <View style={screenStyles.fullscreenMapCountPill}>
                      <Text style={screenStyles.fullscreenMapCountText}>{selectedParcelIds.length} selected</Text>
                    </View>
                  </View>

                  <View style={screenStyles.fullscreenMapFloatingActions}>
                    <Pressable style={screenStyles.fullscreenMapActionButton} onPress={handleLocateParcelsMap}>
                      <Ionicons
                        name={isAutoLocatingParcels ? 'hourglass-outline' : 'locate-outline'}
                        size={18}
                        color={brandColors.white}
                      />
                    </Pressable>
                  </View>

                  <View style={screenStyles.fullscreenMapBottomSheet}>
                    <Text style={screenStyles.fullscreenMapBottomTitle}>Parcel selection</Text>
                    <Text style={screenStyles.fullscreenMapBottomMeta}>{parcelMapHelperText}</Text>
                    <Text style={screenStyles.fullscreenMapBottomHint}>
                      Tap polygons to add or remove parcels without leaving the wizard.
                    </Text>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        ) : null}

        {activeStep === 'factors' ? (
          <>
            <View style={screenStyles.panel}>
              <View style={screenStyles.panelHeader}>
                <Text style={screenStyles.panelTitle}>Survey snapshot</Text>
                <Text style={screenStyles.panelBody}>Keep the current context visible while you score the factors.</Text>
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
                  <Text style={screenStyles.panelBody}>
                    Each factor opens on its dedicated screen. Inputs remain live in the draft while you edit.
                  </Text>
                </View>
                <Pressable style={screenStyles.secondaryPillButton} onPress={() => setActiveStep('parcels')}>
                  <Ionicons name="arrow-back" size={14} color={brandColors.forest} />
                  <Text style={screenStyles.secondaryPillButtonText}>Back to parcels</Text>
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
              <Pressable style={screenStyles.secondaryButton} onPress={() => setActiveStep('parcels')}>
                <Text style={screenStyles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable style={screenStyles.primaryButtonWide} onPress={handlePersistSurvey}>
                <Text style={screenStyles.primaryButtonText}>{persistLabel}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {status.trim() ? (
          <View style={screenStyles.statusCard}>
            <Text style={screenStyles.statusCardText}>{status}</Text>
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas
  },
  heroShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingTop: 10,
    paddingHorizontal: 16
  },
  heroCard: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 34,
    backgroundColor: brandColors.forest,
    ...brandShadow.card
  },
  heroAccentOrb: {
    position: 'absolute',
    top: -24,
    right: -18,
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: 'rgba(176, 199, 142, 0.22)'
  },
  heroExpandedLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 20
  },
  heroExpandedHeader: {
    gap: 8,
    paddingRight: 46
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: '#D7E3C0'
  },
  heroTitleExpanded: {
    ...brandTypography.heroTitle,
    fontSize: 30,
    lineHeight: 34,
    color: brandColors.white
  },
  heroBody: {
    ...brandTypography.heroBody,
    fontSize: 13,
    lineHeight: 18,
    color: '#E4ECD8',
    maxWidth: 300
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
    paddingVertical: 6
  },
  heroMetaPillText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  heroCompactLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingRight: 64,
    paddingBottom: 12,
    gap: 8
  },
  heroCompactSummary: {
    ...brandTypography.meta,
    color: '#D7E3C0'
  },
  compactProgressWrap: {
    gap: 5
  },
  compactProgressCount: {
    ...brandTypography.heroEyebrow,
    fontSize: 10,
    lineHeight: 12,
    color: '#D7E3C0'
  },
  compactProgressTrack: {
    flexDirection: 'row',
    gap: 6
  },
  compactProgressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)'
  },
  compactProgressSegmentActive: {
    backgroundColor: brandColors.white
  },
  compactProgressSegmentComplete: {
    backgroundColor: '#D7E3C0'
  },
  pageScroll: {
    flex: 1
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 108,
    gap: 12
  },
  stepRailWrap: {
    zIndex: 1,
    paddingBottom: 10
  },
  stepRailCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 8,
    ...brandShadow.card
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8
  },
  stepButton: {
    flex: 1,
    minHeight: 78,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  stepButtonActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest
  },
  stepButtonComplete: {
    borderColor: brandColors.moss,
    backgroundColor: brandColors.successSoft
  },
  stepButtonTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  stepIndexPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  stepIndexPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)'
  },
  stepIndexText: {
    ...brandTypography.heroEyebrow,
    fontSize: 10,
    lineHeight: 12,
    color: brandColors.forest
  },
  stepIndexTextActive: {
    color: brandColors.white
  },
  stepButtonTitle: {
    ...brandTypography.label,
    color: brandColors.textPrimary
  },
  stepButtonTitleActive: {
    color: brandColors.white
  },
  stepButtonMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  stepButtonMetaActive: {
    color: '#D7E3C0'
  },
  stepButtonHint: {
    marginTop: 'auto',
    ...brandTypography.meta,
    color: brandColors.forest
  },
  stepButtonHintActive: {
    color: brandColors.white
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 16,
    gap: 10,
    ...brandShadow.card
  },
  identityStepContent: {
    gap: 12
  },
  panelHeader: {
    gap: 3
  },
  panelHeaderCompact: {
    flex: 1,
    gap: 3
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 23,
    color: brandColors.forest
  },
  panelBody: {
    ...brandTypography.sectionBody,
    fontSize: 13,
    lineHeight: 18,
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
  selectionCountPill: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.forest,
    backgroundColor: brandColors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  selectionCountPillText: {
    ...brandTypography.meta,
    color: brandColors.forest
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
  mapOverlayActions: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 12
  },
  mapOverlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(22, 47, 31, 0.76)',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapOverlayButtonText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  map: {
    width: '100%',
    height: 360
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
  fullscreenMapScreen: {
    flex: 1,
    backgroundColor: '#132434'
  },
  fullscreenMap: {
    flex: 1
  },
  fullscreenMapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: Platform.select({ ios: 64, default: 24 }),
    paddingHorizontal: 16,
    paddingBottom: 22
  },
  fullscreenMapTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  fullscreenMapCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(8, 13, 19, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  fullscreenMapCloseText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  fullscreenMapCountPill: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(8, 13, 19, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  fullscreenMapCountText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  fullscreenMapFloatingActions: {
    position: 'absolute',
    top: Platform.select({ ios: 126, default: 86 }),
    right: 16
  },
  fullscreenMapActionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(8, 13, 19, 0.72)'
  },
  fullscreenMapBottomSheet: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d6e5f5',
    backgroundColor: 'rgba(247, 251, 255, 0.96)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6
  },
  fullscreenMapBottomTitle: {
    ...brandTypography.label,
    color: '#163f65'
  },
  fullscreenMapBottomMeta: {
    ...brandTypography.meta,
    color: '#4c6783'
  },
  fullscreenMapBottomHint: {
    ...brandTypography.meta,
    color: '#3f5c79'
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
