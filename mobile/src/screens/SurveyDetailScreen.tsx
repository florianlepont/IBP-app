import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { computeIbpTotalsFromRetainedScores, computeRetainedScoresFromRawFactors, evaluateSubmitReadinessFromDraft } from '../app/ibp-scoring';
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION, defaultVegetationStageForRegion, normalizeVegetationStageForRegion } from '../app/constants';
import { formatDateTime, formatEventPayload, formatPoints, formatRemainingTime, isLessThan24HoursRemaining, resolveSubmissionDeadline } from '../app/formatters';
import { styles } from '../app/styles';
import { FactorKey, RegionVersion, SurveyDetailResponse, SurveyDetailTab, SurveyEventItem, VegetationStage } from '../app/types';
import { FilterChip } from '../components/FilterChip';
import { SurveyBadges } from '../components/SurveyBadges';
import { getLocalSurveyDraft, LocalAttachment, LocalSurvey } from '../storage';

type SurveyDetailScreenProps = {
  selectedSurvey: LocalSurvey;
  selectedSurveyAttachments: LocalAttachment[];
  surveyDetailTab: SurveyDetailTab;
  setSurveyDetailTab: (tab: SurveyDetailTab) => void;
  surveyDetails: Record<string, SurveyDetailResponse>;
  detailsLoadingSurveyId: string | null;
  surveyEvents: Record<string, SurveyEventItem[]>;
  eventsLoadingSurveyId: string | null;
  onLoadSurveyEvents: (surveyId: string) => Promise<void>;
  onTakePhoto: (surveyId: string) => Promise<void> | void;
  onPickPhoto: (surveyId: string) => Promise<void> | void;
  onDeleteAttachment: (surveyId: string, localAttachmentId: string) => Promise<void> | void;
  onDeleteSurvey: (surveyId: string) => void;
  onSubmitSurvey: (surveyId: string) => Promise<void>;
  onRetrySurvey: (surveyId: string) => Promise<void>;
  onDiscardSurvey: (surveyId: string) => Promise<void>;
  onToggleVisibility: (surveyId: string, visibility: 'private' | 'public') => Promise<void>;
  onOpenFactor: (surveyId: string, factor: FactorKey) => Promise<void> | void;
  onRenameSurvey: (surveyId: string, nextSiteName: string) => Promise<void> | void;
  onUpdateRegionVersion: (surveyId: string, region: RegionVersion) => Promise<void> | void;
  onUpdateVegetationStage: (surveyId: string, stage: VegetationStage) => Promise<void> | void;
  onOpenLocation: (surveyId: string) => Promise<void> | void;
};

const FACTOR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  A: 'leaf-outline',
  B: 'layers-outline',
  C: 'flower-outline',
  D: 'git-branch-outline',
  E: 'leaf-outline',
  F: 'aperture-outline',
  G: 'sunny-outline',
  H: 'water-outline',
  I: 'trail-sign-outline',
  J: 'paw-outline'
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const resolveGpsCoordinates = (location?: Record<string, unknown>): { lat: number; lng: number } | null => {
  if (!location || typeof location !== 'object') return null;
  const lat = asFiniteNumber(location.lat);
  const lng = asFiniteNumber(location.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

const hasLocationContent = (location?: Record<string, unknown>): boolean => {
  if (!location || typeof location !== 'object') return false;
  return Object.values(location).some((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    return value !== null && value !== undefined;
  });
};

type ActionButtonVariant = 'neutral' | 'primary' | 'danger' | 'success';
type DisplayedScores = {
  ibp_total: number;
  ibp_peuplement_gestion: number;
  ibp_contexte: number;
};
type DisplayedFactorResult = {
  selected_class: string;
  warnings: string[];
};
type LocalDraftMeta = {
  site_name: string;
  region_version: RegionVersion;
  vegetation_stage: VegetationStage;
};

const FACTOR_KEYS = new Set<FactorKey>(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
const isFactorKey = (value: string): value is FactorKey => FACTOR_KEYS.has(value as FactorKey);

type ActionButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: ActionButtonVariant;
  onPress: () => void;
};

function ActionButton({ label, icon, variant, onPress }: ActionButtonProps) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        variant === 'neutral'
          ? styles.actionButtonNeutral
          : variant === 'primary'
            ? styles.actionButtonPrimary
            : variant === 'danger'
              ? styles.actionButtonDanger
              : styles.actionButtonSuccess
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={14}
        color={
          variant === 'neutral'
            ? '#2f5478'
            : variant === 'primary'
              ? '#1d5b96'
              : variant === 'danger'
                ? '#8f3737'
                : '#2a7a56'
        }
      />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SurveyDetailScreen({
  selectedSurvey,
  selectedSurveyAttachments,
  surveyDetailTab,
  setSurveyDetailTab,
  surveyDetails,
  detailsLoadingSurveyId,
  surveyEvents,
  eventsLoadingSurveyId,
  onLoadSurveyEvents,
  onTakePhoto,
  onPickPhoto,
  onDeleteAttachment,
  onDeleteSurvey,
  onSubmitSurvey,
  onRetrySurvey,
  onDiscardSurvey,
  onToggleVisibility,
  onOpenFactor,
  onRenameSurvey,
  onUpdateRegionVersion,
  onUpdateVegetationStage,
  onOpenLocation
}: SurveyDetailScreenProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const detail = surveyDetails[selectedSurvey.id];
  // Local survey state is the live source after user actions (submit / visibility toggle).
  const detailStatus = selectedSurvey.status;
  const detailSubmittedAt = detail?.submitted_at ?? null;
  const detailCreatedAt = detail?.created_at ?? selectedSurvey.created_at;
  const detailExpiresAt = detail?.expires_at ?? null;
  const submissionDeadline = resolveSubmissionDeadline(detailCreatedAt, detailExpiresAt);
  const remainingTime = formatRemainingTime(submissionDeadline);
  const isDraftNearDeadline = detailStatus === 'draft' && isLessThan24HoursRemaining(submissionDeadline);
  const loadedEventCount = surveyEvents[selectedSurvey.id]?.length ?? 0;
  const publishableOnPublicMap = detailStatus === 'submitted' && selectedSurvey.visibility === 'public';
  const photoAttachments = selectedSurveyAttachments.filter((attachment) => Boolean(attachment.local_uri?.trim()));
  const canonicalFactorEntries = detail
    ? Object.entries(detail.factor_results).sort(([left], [right]) => left.localeCompare(right))
    : [];
  const [localDraftScores, setLocalDraftScores] = useState<DisplayedScores | null>(null);
  const [localDraftFactorEntries, setLocalDraftFactorEntries] = useState<Array<[string, DisplayedFactorResult]>>([]);
  const [localSubmitReady, setLocalSubmitReady] = useState<boolean | null>(null);
  const [localMissingFactorCount, setLocalMissingFactorCount] = useState<number | null>(null);
  const [localDraftMeta, setLocalDraftMeta] = useState<LocalDraftMeta | null>(null);
  const [isRenamingSite, setIsRenamingSite] = useState(false);
  const [siteNameInput, setSiteNameInput] = useState('');
  const mediaSlideWidth = Math.max(300, viewportWidth - 36);
  const localLocation = selectedSurvey.location;
  const effectiveLocation = hasLocationContent(localLocation) ? localLocation : detail?.location;
  const gpsCoordinates = resolveGpsCoordinates(effectiveLocation);
  const hasMapPreview = gpsCoordinates !== null;
  const mediaSlides = useMemo<Array<{ key: string; type: 'map' } | { key: string; type: 'photo'; attachment: LocalAttachment }>>(() => {
    const slides: Array<{ key: string; type: 'map' } | { key: string; type: 'photo'; attachment: LocalAttachment }> = [];
    if (hasMapPreview) {
      slides.push({ key: `map-${selectedSurvey.id}`, type: 'map' });
    }
    for (const attachment of photoAttachments) {
      slides.push({ key: `photo-${attachment.id}`, type: 'photo', attachment });
    }
    return slides;
  }, [hasMapPreview, selectedSurvey.id, photoAttachments]);
  const hasMediaSlides = mediaSlides.length > 0;
  const [mediaPageIndex, setMediaPageIndex] = useState(0);

  useEffect(() => {
    setMediaPageIndex(0);
  }, [selectedSurvey.id, mediaSlides.length]);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const draft = await getLocalSurveyDraft(selectedSurvey.id);
        if (!draft || cancelled) {
          if (!cancelled) {
            setLocalDraftScores(null);
            setLocalDraftFactorEntries([]);
            setLocalSubmitReady(null);
            setLocalMissingFactorCount(null);
            setLocalDraftMeta(null);
          }
          return;
        }

        const retained = computeRetainedScoresFromRawFactors(
          typeof draft.factors === 'object' && draft.factors && !Array.isArray(draft.factors) ? draft.factors : {},
          draft.region_version,
          typeof draft.vegetation_stage === 'string' ? draft.vegetation_stage : ''
        );

        const totals = computeIbpTotalsFromRetainedScores(retained);
        const regionVersion: RegionVersion = draft.region_version === 'M' ? 'M' : 'ACA';
        const vegetationStage = normalizeVegetationStageForRegion(
          regionVersion,
          typeof draft.vegetation_stage === 'string' ? draft.vegetation_stage : defaultVegetationStageForRegion(regionVersion)
        );
        const readiness = evaluateSubmitReadinessFromDraft({
          region_version: draft.region_version,
          vegetation_stage: draft.vegetation_stage,
          factors: draft.factors,
          location: draft.location,
          expires_at: draft.expires_at
        });
        const entries = Object.entries(retained)
          .filter(([, score]) => Boolean(score))
          .sort(([left], [right]) => left.localeCompare(right))
          .reduce<Array<[string, DisplayedFactorResult]>>((acc, [factorCode, score]) => {
            if (!score) return acc;
            acc.push([
              factorCode,
              {
                selected_class: score.selected_class,
                warnings: []
              }
            ]);
            return acc;
          }, []);

        if (cancelled) return;
        setLocalDraftScores({
          ibp_total: totals.ibp_total,
          ibp_peuplement_gestion: totals.ibp_peuplement_gestion,
          ibp_contexte: totals.ibp_contexte
        });
        setLocalDraftFactorEntries(entries);
        setLocalSubmitReady(readiness.ready);
        setLocalMissingFactorCount(readiness.missing_factors.length);
        setLocalDraftMeta({
          site_name: typeof draft.site_name === 'string' && draft.site_name.trim().length > 0 ? draft.site_name : selectedSurvey.site_name,
          region_version: regionVersion,
          vegetation_stage: vegetationStage
        });
      } catch (_error) {
        if (!cancelled) {
          setLocalDraftScores(null);
          setLocalDraftFactorEntries([]);
          setLocalSubmitReady(null);
          setLocalMissingFactorCount(null);
          setLocalDraftMeta(null);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedSurvey.id, selectedSurvey.updated_at]);

  const useLocalDraftView = selectedSurvey.status !== 'submitted' && localDraftScores !== null;
  const displayedScores: DisplayedScores | null = useMemo(() => {
    if (useLocalDraftView && localDraftScores) {
      return localDraftScores;
    }
    if (detail?.scores) {
      return detail.scores;
    }
    return localDraftScores;
  }, [useLocalDraftView, localDraftScores, detail?.scores]);
  const displayedFactorEntries = useMemo<Array<[string, DisplayedFactorResult]>>(() => {
    if (useLocalDraftView && localDraftFactorEntries.length > 0) {
      return localDraftFactorEntries;
    }
    if (canonicalFactorEntries.length > 0) {
      return canonicalFactorEntries as Array<[string, DisplayedFactorResult]>;
    }
    return localDraftFactorEntries;
  }, [useLocalDraftView, localDraftFactorEntries, canonicalFactorEntries]);
  const showSubmitReadyBanner =
    selectedSurvey.sync_state === 'synced' &&
    selectedSurvey.status !== 'submitted' &&
    selectedSurvey.sync_blocked !== 1 &&
    localSubmitReady === true;
  const completedFactorCountForSubmit = localMissingFactorCount === null ? null : 10 - localMissingFactorCount;
  const showSubmitProgressBanner =
    selectedSurvey.status !== 'submitted' &&
    localSubmitReady === false &&
    (localMissingFactorCount ?? 0) > 0 &&
    completedFactorCountForSubmit !== null;
  const factorsCompleted = completedFactorCountForSubmit ?? Math.min(10, displayedFactorEntries.length);
  const factorsRemaining = Math.max(0, 10 - factorsCompleted);
  const canEditSurvey = selectedSurvey.status !== 'submitted';
  const activeRegion: RegionVersion = useMemo(() => {
    if (localDraftMeta) return localDraftMeta.region_version;
    return detail?.region_version === 'M' ? 'M' : 'ACA';
  }, [localDraftMeta, detail?.region_version]);
  const activeVegetationStage: VegetationStage = useMemo(() => {
    if (localDraftMeta) return localDraftMeta.vegetation_stage;
    const fallback = defaultVegetationStageForRegion(activeRegion);
    return normalizeVegetationStageForRegion(activeRegion, typeof detail?.vegetation_stage === 'string' ? detail.vegetation_stage : fallback);
  }, [localDraftMeta, activeRegion, detail?.vegetation_stage]);
  const activeSiteName = (localDraftMeta?.site_name ?? detail?.site_name ?? selectedSurvey.site_name).trim() || selectedSurvey.site_name;

  useEffect(() => {
    setIsRenamingSite(false);
    setSiteNameInput(activeSiteName);
  }, [selectedSurvey.id, activeSiteName]);

  const handleAddPicture = (): void => {
    if (selectedSurvey.status === 'submitted') {
      Alert.alert('Read-only survey', 'This survey is submitted. Photo upload is disabled.');
      return;
    }

    Alert.alert('Add picture', 'Choose how to add a photo.', [
      {
        text: 'Take photo',
        onPress: () => {
          void onTakePhoto(selectedSurvey.id);
        }
      },
      {
        text: 'Choose from gallery',
        onPress: () => {
          void onPickPhoto(selectedSurvey.id);
        }
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ]);
  };

  const handleDeletePicture = (localAttachmentId: string): void => {
    if (selectedSurvey.status === 'submitted') {
      Alert.alert('Read-only survey', 'This survey is submitted. Photo deletion is disabled.');
      return;
    }

    Alert.alert('Delete picture', 'Remove this photo from the survey?', [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void onDeleteAttachment(selectedSurvey.id, localAttachmentId);
        }
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ]);
  };

  const handleSaveSiteRename = (): void => {
    const nextName = siteNameInput.trim();
    if (!canEditSurvey) {
      return;
    }
    if (!nextName) {
      Alert.alert('Invalid name', 'Survey name cannot be empty.');
      return;
    }
    void onRenameSurvey(selectedSurvey.id, nextName);
    setIsRenamingSite(false);
  };

  const handleOpenLocationEditor = (): void => {
    if (!canEditSurvey) {
      return;
    }
    void onOpenLocation(selectedSurvey.id);
  };

  const handleMediaScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (mediaSlides.length <= 1) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / mediaSlideWidth);
    const safeIndex = Math.max(0, Math.min(mediaSlides.length - 1, nextIndex));
    setMediaPageIndex(safeIndex);
  };

  return (
    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.detailScreenContent}>
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          {isRenamingSite ? (
            <View style={styles.detailRenameRow}>
              <TextInput style={styles.detailRenameInput} value={siteNameInput} onChangeText={setSiteNameInput} autoFocus />
              <Pressable style={styles.detailRenameSaveButton} onPress={handleSaveSiteRename}>
                <Text style={styles.detailRenameSaveButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={styles.detailRenameCancelButton}
                onPress={() => {
                  setIsRenamingSite(false);
                  setSiteNameInput(activeSiteName);
                }}
              >
                <Text style={styles.detailRenameCancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                if (!canEditSurvey) return;
                setIsRenamingSite(true);
              }}
            >
              <Text style={styles.detailSurveyTitle}>{activeSiteName}</Text>
              {canEditSurvey ? <Text style={styles.rowMeta}>Tap survey name to rename.</Text> : null}
            </Pressable>
          )}
        </View>
        <SurveyBadges survey={selectedSurvey} />

        {surveyDetailTab !== 'debug' ? (
          hasMediaSlides ? (
            <View style={styles.mediaHeroSection}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.mediaHeroCarousel}
                decelerationRate="fast"
                snapToInterval={mediaSlideWidth}
                disableIntervalMomentum
                onMomentumScrollEnd={handleMediaScrollEnd}
              >
                {mediaSlides.map((slide) =>
                  slide.type === 'map' ? (
                    <View key={slide.key} style={[styles.mediaHeroSlide, { width: mediaSlideWidth }]}>
                      <MapView
                        style={styles.mediaHeroMap}
                        initialRegion={{
                          latitude: gpsCoordinates?.lat ?? 0,
                          longitude: gpsCoordinates?.lng ?? 0,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01
                        }}
                        onPress={handleOpenLocationEditor}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                      >
                        {gpsCoordinates ? <Marker coordinate={{ latitude: gpsCoordinates.lat, longitude: gpsCoordinates.lng }} /> : null}
                      </MapView>
                      <View style={styles.mediaHeroCaption}>
                        <Ionicons name="map-outline" size={14} color="#254a6d" />
                        <Text style={styles.mediaHeroCaptionText}>{canEditSurvey ? 'Map (tap to edit location)' : 'Map'}</Text>
                      </View>
                    </View>
                  ) : (
                    <View key={slide.key} style={[styles.mediaHeroSlide, { width: mediaSlideWidth }]}>
                      <Image source={{ uri: slide.attachment.local_uri ?? undefined }} style={styles.mediaHeroImage} resizeMode="cover" />
                      <View style={styles.mediaHeroCaption}>
                        <Ionicons name="image-outline" size={14} color="#254a6d" />
                        <Text style={styles.mediaHeroCaptionText}>Photo</Text>
                      </View>
                      <Pressable
                        style={[styles.mediaDeletePictureButton, selectedSurvey.status === 'submitted' ? styles.mediaDeletePictureButtonDisabled : null]}
                        onPress={() => handleDeletePicture(slide.attachment.id)}
                        disabled={selectedSurvey.status === 'submitted'}
                      >
                        <Ionicons name="trash-outline" size={13} color={selectedSurvey.status === 'submitted' ? '#8a9caf' : '#8f3737'} />
                        <Text style={[styles.mediaDeletePictureButtonText, selectedSurvey.status === 'submitted' ? styles.mediaDeletePictureButtonTextDisabled : null]}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  )
                )}
              </ScrollView>
              {mediaSlides.length > 1 ? (
                <View style={styles.mediaPagerRow}>
                  <View style={styles.mediaDotsRow}>
                    {mediaSlides.map((slide, index) => (
                      <View key={`dot-${slide.key}`} style={[styles.mediaDot, index === mediaPageIndex ? styles.mediaDotActive : null]} />
                    ))}
                  </View>
                  <Text style={styles.mediaPagerLabel}>
                    {mediaPageIndex + 1}/{mediaSlides.length}
                  </Text>
                </View>
              ) : null}

              {selectedSurvey.status !== 'submitted' ? (
                <Pressable style={styles.mediaAddPictureButton} onPress={handleAddPicture}>
                  <Ionicons name="add-circle-outline" size={15} color="#255178" />
                  <Text style={styles.mediaAddPictureButtonText}>Add picture</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable style={styles.mediaPlaceholderCard} onPress={handleAddPicture}>
              <Ionicons name="image-outline" size={28} color="#7d95ad" />
              <Text style={styles.mediaPlaceholderTitle}>No map or picture yet</Text>
              <Text style={styles.mediaPlaceholderMeta}>Tap to upload a photo</Text>
            </Pressable>
          )
        ) : null}

        <View style={styles.filterChipsRow}>
          <FilterChip label="Summary" active={surveyDetailTab === 'summary'} onPress={() => setSurveyDetailTab('summary')} />
          <FilterChip label="Events" active={surveyDetailTab === 'events'} onPress={() => setSurveyDetailTab('events')} />
          <FilterChip label="Debug" active={surveyDetailTab === 'debug'} onPress={() => setSurveyDetailTab('debug')} />
        </View>

      {surveyDetailTab === 'summary' ? (
        <View style={styles.detailSection}>
          {selectedSurvey.status !== 'submitted' ? (
            <View style={styles.factorsProgressCard}>
              <View style={styles.factorsProgressHeader}>
                <Ionicons name="analytics-outline" size={16} color="#2f5d87" />
                <Text style={styles.factorsProgressTitle}>Factors progress: {factorsCompleted}/10 completed</Text>
              </View>
              <Text style={styles.factorsProgressText}>{factorsRemaining} factor(s) remaining before submit.</Text>
            </View>
          ) : null}

          {showSubmitReadyBanner ? (
            <View style={styles.submitReadyBanner}>
              <View style={styles.submitReadyBannerHeader}>
                <Ionicons name="checkmark-circle" size={16} color="#236449" />
                <Text style={styles.submitReadyBannerTitle}>Your survey is ready to be submitted</Text>
              </View>
              <Text style={styles.submitReadyBannerText}>All required factors and required fields are complete.</Text>
              <Pressable style={styles.submitReadyBannerCta} onPress={() => void onSubmitSurvey(selectedSurvey.id)}>
                <Ionicons name="paper-plane-outline" size={14} color="#ffffff" />
                <Text style={styles.submitReadyBannerCtaText}>Submit survey</Text>
              </Pressable>
            </View>
          ) : null}

          {showSubmitProgressBanner ? (
            <View style={styles.submitProgressBanner}>
              <View style={styles.submitProgressBannerHeader}>
                <Ionicons name="hourglass-outline" size={16} color="#8f6a1d" />
                <Text style={styles.submitProgressBannerTitle}>
                  Factors progress: {completedFactorCountForSubmit}/10 completed
                </Text>
              </View>
              <Text style={styles.submitProgressBannerText}>
                This survey can be submitted once all factors are completed.
              </Text>
            </View>
          ) : null}

          {selectedSurvey.status === 'submitted' ? (
            <View style={styles.submittedReadonlyBanner}>
              <View style={styles.submittedReadonlyBannerHeader}>
                <Ionicons name="checkmark-done-circle" size={16} color="#2a7a56" />
                <Text style={styles.submittedReadonlyBannerTitle}>Your survey has been submitted</Text>
              </View>
              <Text style={styles.submittedReadonlyBannerText}>No update possible.</Text>
            </View>
          ) : null}
          <View style={[styles.deadlineCard, isDraftNearDeadline ? styles.deadlineCardWarning : null]}>
            <Text style={styles.deadlineLabel}>Time remaining</Text>
            <Text style={[styles.deadlineValue, isDraftNearDeadline ? styles.deadlineValueWarning : null]}>
              {detailStatus === 'submitted' ? 'Submitted' : remainingTime}
            </Text>
            {detailStatus !== 'submitted' ? <Text style={styles.rowMeta}>Deadline: {formatDateTime(submissionDeadline)}</Text> : null}
            {isDraftNearDeadline ? <Text style={styles.warningText}>Less than 24h left before survey expiration.</Text> : null}
          </View>

          <View style={styles.locationCard}>
            <Text style={styles.detailTitle}>Region and vegetation</Text>
            {canEditSurvey ? <Text style={styles.rowMeta}>Tap to update directly from detail.</Text> : null}
            <View style={styles.filterChipsRow}>
              {REGION_OPTIONS.map((option) => (
                <FilterChip
                  key={`detail-region-${option.value}`}
                  label={option.label}
                  active={activeRegion === option.value}
                  onPress={() => {
                    if (!canEditSurvey) return;
                    void onUpdateRegionVersion(selectedSurvey.id, option.value);
                  }}
                />
              ))}
            </View>
            <View style={styles.filterChipsRow}>
              {VEGETATION_STAGE_OPTIONS_BY_REGION[activeRegion].map((option) => (
                <FilterChip
                  key={`detail-stage-${option.value}`}
                  label={option.label}
                  active={activeVegetationStage === option.value}
                  onPress={() => {
                    if (!canEditSurvey) return;
                    void onUpdateVegetationStage(selectedSurvey.id, option.value);
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.factorTilesCard}>
            <View style={styles.factorTilesHeader}>
              <Text style={styles.detailTitle}>Factors</Text>
            </View>
            {detailsLoadingSurveyId === selectedSurvey.id ? <Text style={styles.rowMeta}>Loading factors...</Text> : null}
            {displayedScores ? (
              <>
                {useLocalDraftView ? <Text style={styles.rowMeta}>Showing local draft score (latest edits).</Text> : null}
                <View style={styles.scoreHeroCard}>
                  <Text style={styles.scoreHeroLabel}>IBP Total</Text>
                  <Text style={styles.scoreHeroValue}>{formatPoints(displayedScores.ibp_total)}</Text>
                  <Text style={styles.scoreHeroMeta}>P/G {formatPoints(displayedScores.ibp_peuplement_gestion)} · C {formatPoints(displayedScores.ibp_contexte)}</Text>
                </View>
                <View style={styles.factorTotalsRow}>
                  <View style={styles.factorTotalPill}>
                    <Text style={styles.factorTotalText}>P/G {formatPoints(displayedScores.ibp_peuplement_gestion)}</Text>
                  </View>
                  <View style={styles.factorTotalPill}>
                    <Text style={styles.factorTotalText}>C {formatPoints(displayedScores.ibp_contexte)}</Text>
                  </View>
                </View>
                <View style={styles.factorTilesGrid}>
                  {displayedFactorEntries.map(([factorCode, factor]) => (
                    <Pressable
                      key={`factor-tile-${factorCode}`}
                      style={[styles.factorTile, canEditSurvey && isFactorKey(factorCode) ? styles.factorTileEditable : null]}
                      onPress={() => {
                        if (!canEditSurvey) return;
                        if (!isFactorKey(factorCode)) return;
                        void onOpenFactor(selectedSurvey.id, factorCode);
                      }}
                    >
                      <View style={styles.factorTileIconWrap}>
                        <Ionicons name={FACTOR_ICONS[factorCode] ?? 'ellipse-outline'} size={16} color="#1f4f79" />
                      </View>
                      <Text style={styles.factorTileCode}>Factor {factorCode}</Text>
                      <Text style={styles.factorTileClass}>{factor.selected_class}</Text>
                      {canEditSurvey && isFactorKey(factorCode) ? <Text style={styles.factorTileHint}>Tap to update</Text> : null}
                      {factor.warnings.length > 0 ? <Text style={styles.factorTileWarning}>warning</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.rowMeta}>Canonical factors not loaded yet.</Text>
            )}
          </View>
        </View>
      ) : null}

      {surveyDetailTab === 'events' ? (
        <View style={styles.detailSection}>
          <Button title="Reload events" onPress={() => void onLoadSurveyEvents(selectedSurvey.id)} />
          {eventsLoadingSurveyId === selectedSurvey.id ? <Text style={styles.rowMeta}>Loading events...</Text> : null}
          {(surveyEvents[selectedSurvey.id] ?? []).length === 0 && eventsLoadingSurveyId !== selectedSurvey.id ? (
            <Text style={styles.rowMeta}>No events loaded yet.</Text>
          ) : null}
          {(surveyEvents[selectedSurvey.id] ?? []).map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventTitle}>{event.event_type}</Text>
              <Text style={styles.rowMeta}>{event.created_at}</Text>
              {formatEventPayload(event.payload) ? <Text style={styles.eventPayload}>{formatEventPayload(event.payload)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

        {surveyDetailTab === 'summary' ? (
          <View style={styles.detailSection}>
            <View style={styles.actionButtonsRow}>
              <ActionButton
                label={selectedSurvey.visibility === 'public' ? 'Set private' : 'Set public'}
                icon={selectedSurvey.visibility === 'public' ? 'lock-closed-outline' : 'globe-outline'}
                variant="neutral"
                onPress={() => void onToggleVisibility(selectedSurvey.id, selectedSurvey.visibility === 'public' ? 'private' : 'public')}
              />
              <ActionButton label="Delete survey" icon="trash-outline" variant="danger" onPress={() => onDeleteSurvey(selectedSurvey.id)} />
            </View>

            {selectedSurvey.sync_state === 'failed' ? (
              <View style={styles.actionButtonsRow}>
                <ActionButton
                  label="Retry now"
                  icon="refresh-outline"
                  variant="primary"
                  onPress={() => void onRetrySurvey(selectedSurvey.id)}
                />
                <ActionButton
                  label="Discard local change"
                  icon="close-circle-outline"
                  variant="danger"
                  onPress={() => void onDiscardSurvey(selectedSurvey.id)}
                />
              </View>
            ) : null}

          </View>
        ) : null}

      {surveyDetailTab === 'debug' ? (
        <View style={styles.detailSection}>
          <View style={styles.debugCard}>
            <Text style={styles.rowMeta}>id: {selectedSurvey.id}</Text>
            <Text style={styles.rowMeta}>updated: {selectedSurvey.updated_at}</Text>
            <Text style={styles.rowMeta}>created: {formatDateTime(detailCreatedAt)}</Text>
            <Text style={styles.rowMeta}>submitted at: {formatDateTime(detailSubmittedAt)}</Text>
            <Text style={styles.rowMeta}>publishable on public map: {publishableOnPublicMap ? 'yes' : 'no'}</Text>
            <Text style={styles.rowMeta}>completion: {selectedSurvey.completion_rate}%</Text>
            <Text style={styles.rowMeta}>history entries loaded: {loadedEventCount}</Text>
            <Text style={styles.rowMeta}>local photos: {selectedSurveyAttachments.length}</Text>
            {selectedSurvey.last_sync_error ? (
              <Text style={styles.rowMeta}>last error: {selectedSurvey.last_sync_error}</Text>
            ) : (
              <Text style={styles.rowMeta}>No sync error reported.</Text>
            )}
            {selectedSurvey.last_sync_error_code ? <Text style={styles.rowMeta}>error code: {selectedSurvey.last_sync_error_code}</Text> : null}
            {selectedSurvey.last_sync_error_at ? <Text style={styles.rowMeta}>error at: {selectedSurvey.last_sync_error_at}</Text> : null}
          </View>

          <View style={styles.debugAttachmentBlock}>
            <Text style={styles.debugSectionTitle}>Image debug</Text>
            {selectedSurveyAttachments.length === 0 ? (
              <Text style={styles.rowMeta}>No local attachment found.</Text>
            ) : (
              selectedSurveyAttachments.map((attachment, index) => (
                <View key={`debug-attachment-${attachment.id}`} style={styles.debugAttachmentCard}>
                  {attachment.local_uri ? (
                    <Image source={{ uri: attachment.local_uri }} style={styles.debugAttachmentPreview} />
                  ) : (
                    <View style={styles.debugAttachmentPreviewPlaceholder}>
                      <Text style={styles.rowMeta}>No local preview</Text>
                    </View>
                  )}
                  <Text style={styles.rowMeta}>#{index + 1}</Text>
                  <Text style={styles.rowMeta}>id: {attachment.id}</Text>
                  <Text style={styles.rowMeta}>survey_id: {attachment.survey_id}</Text>
                  <Text style={styles.rowMeta}>local_uri: {attachment.local_uri}</Text>
                  <Text style={styles.rowMeta}>mime_type: {attachment.mime_type}</Text>
                  <Text style={styles.rowMeta}>
                    size: {attachment.size_bytes} bytes ({Math.round(attachment.size_bytes / 1024)} KB)
                  </Text>
                  <Text style={styles.rowMeta}>sync_state: {attachment.sync_state}</Text>
                  <Text style={styles.rowMeta}>remote_attachment_id: {attachment.remote_attachment_id ?? 'null'}</Text>
                  <Text style={styles.rowMeta}>storage_key: {attachment.storage_key ?? 'null'}</Text>
                  <Text style={styles.rowMeta}>upload_url: {attachment.upload_url ?? 'null'}</Text>
                  <Text style={styles.rowMeta}>confirm_url: {attachment.confirm_url ?? 'null'}</Text>
                  <Text style={styles.rowMeta}>updated_at: {attachment.updated_at}</Text>
                  <Text style={styles.rowMeta}>last_sync_error_code: {attachment.last_sync_error_code ?? 'null'}</Text>
                  <Text style={styles.rowMeta}>last_sync_error: {attachment.last_sync_error ?? 'null'}</Text>
                  <Text style={styles.rowMeta}>last_sync_error_at: {attachment.last_sync_error_at ?? 'null'}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      ) : null}
      </View>
    </ScrollView>
  );
}
