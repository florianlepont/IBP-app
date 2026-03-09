import { Alert, Button, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, formatEventPayload, formatPoints, formatRemainingTime, isLessThan24HoursRemaining, resolveSubmissionDeadline } from '../app/formatters';
import { styles } from '../app/styles';
import { SurveyDetailResponse, SurveyDetailTab, SurveyEventItem } from '../app/types';
import { FilterChip } from '../components/FilterChip';
import { SurveyBadges } from '../components/SurveyBadges';
import { LocalAttachment, LocalSurvey } from '../storage';

type SurveyDetailScreenProps = {
  selectedSurvey: LocalSurvey;
  selectedSurveyAttachments: LocalAttachment[];
  surveyDetailTab: SurveyDetailTab;
  setSurveyDetailTab: (tab: SurveyDetailTab) => void;
  editingSurveyId: string | null;
  surveyDetails: Record<string, SurveyDetailResponse>;
  detailsLoadingSurveyId: string | null;
  surveyEvents: Record<string, SurveyEventItem[]>;
  eventsLoadingSurveyId: string | null;
  onLoadCanonicalDetails: (surveyId: string) => Promise<void>;
  onLoadSurveyEvents: (surveyId: string) => Promise<void>;
  onEditSurvey: (surveyId: string) => Promise<void> | void;
  onTakePhoto: (surveyId: string) => Promise<void> | void;
  onPickPhoto: (surveyId: string) => Promise<void> | void;
  onDeleteAttachment: (surveyId: string, localAttachmentId: string) => Promise<void> | void;
  onDeleteSurvey: (surveyId: string) => void;
  onSubmitSurvey: (surveyId: string) => Promise<void>;
  onRetrySurvey: (surveyId: string) => Promise<void>;
  onDiscardSurvey: (surveyId: string) => Promise<void>;
  onToggleVisibility: (surveyId: string, visibility: 'private' | 'public') => Promise<void>;
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

const formatLocationSummary = (location?: Record<string, unknown>): string => {
  if (!location || typeof location !== 'object') return 'not available';
  const source = typeof location.source === 'string' ? location.source : '';

  if (source === 'gps') {
    const lat = asFiniteNumber(location.lat);
    const lng = asFiniteNumber(location.lng);
    if (lat === null || lng === null) return 'GPS selected (coordinates missing)';
    return `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  if (source === 'manual') {
    const parts = [
      typeof location.address_line === 'string' ? location.address_line : '',
      typeof location.postal_code === 'string' ? location.postal_code : '',
      typeof location.city === 'string' ? location.city : '',
      typeof location.country === 'string' ? location.country : ''
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parts.length === 0) return 'manual address selected (details missing)';
    return parts.join(', ');
  }

  return 'not available';
};

const resolveGpsCoordinates = (location?: Record<string, unknown>): { lat: number; lng: number } | null => {
  if (!location || typeof location !== 'object') return null;
  const lat = asFiniteNumber(location.lat);
  const lng = asFiniteNumber(location.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

const buildMapPreviewUrl = (lat: number, lng: number): string =>
  `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(`${lat},${lng}`)}&zoom=14&size=900x480&markers=${encodeURIComponent(`${lat},${lng},red-pushpin`)}`;

type ActionButtonVariant = 'neutral' | 'primary' | 'danger' | 'success';

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
  editingSurveyId,
  surveyDetails,
  detailsLoadingSurveyId,
  surveyEvents,
  eventsLoadingSurveyId,
  onLoadCanonicalDetails,
  onLoadSurveyEvents,
  onEditSurvey,
  onTakePhoto,
  onPickPhoto,
  onDeleteAttachment,
  onDeleteSurvey,
  onSubmitSurvey,
  onRetrySurvey,
  onDiscardSurvey,
  onToggleVisibility
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
  const mediaSlideWidth = Math.max(280, viewportWidth - 52);
  const gpsCoordinates = resolveGpsCoordinates(detail?.location);
  const hasMapPreview = gpsCoordinates !== null;
  const hasMediaSlides = hasMapPreview || photoAttachments.length > 0;

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

  return (
    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.detailScreenContent}>
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailSurveyTitle}>{selectedSurvey.site_name}</Text>
        </View>
        <SurveyBadges survey={selectedSurvey} />

        {surveyDetailTab !== 'debug' ? (
          hasMediaSlides ? (
            <View style={styles.mediaHeroSection}>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.mediaHeroCarousel}>
                {hasMapPreview ? (
                  <View style={[styles.mediaHeroSlide, { width: mediaSlideWidth }]}>
                    <Image
                      source={{ uri: buildMapPreviewUrl(gpsCoordinates.lat, gpsCoordinates.lng) }}
                      style={styles.mediaHeroImage}
                      resizeMode="cover"
                    />
                    <View style={styles.mediaHeroCaption}>
                      <Ionicons name="map-outline" size={14} color="#254a6d" />
                      <Text style={styles.mediaHeroCaptionText}>Map preview</Text>
                    </View>
                  </View>
                ) : null}

                {photoAttachments.map((attachment) => (
                  <View key={`hero-photo-${attachment.id}`} style={[styles.mediaHeroSlide, { width: mediaSlideWidth }]}>
                    <Image source={{ uri: attachment.local_uri ?? undefined }} style={styles.mediaHeroImage} resizeMode="cover" />
                    <View style={styles.mediaHeroCaption}>
                      <Ionicons name="image-outline" size={14} color="#254a6d" />
                      <Text style={styles.mediaHeroCaptionText}>Photo</Text>
                    </View>
                    <Pressable
                      style={[styles.mediaDeletePictureButton, selectedSurvey.status === 'submitted' ? styles.mediaDeletePictureButtonDisabled : null]}
                      onPress={() => handleDeletePicture(attachment.id)}
                      disabled={selectedSurvey.status === 'submitted'}
                    >
                      <Ionicons name="trash-outline" size={13} color={selectedSurvey.status === 'submitted' ? '#8a9caf' : '#8f3737'} />
                      <Text style={[styles.mediaDeletePictureButtonText, selectedSurvey.status === 'submitted' ? styles.mediaDeletePictureButtonTextDisabled : null]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

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
          {selectedSurvey.status === 'submitted' ? <Text style={styles.rowMeta}>submitted survey: read-only</Text> : null}
          <View style={[styles.deadlineCard, isDraftNearDeadline ? styles.deadlineCardWarning : null]}>
            <Text style={styles.deadlineLabel}>Time remaining</Text>
            <Text style={[styles.deadlineValue, isDraftNearDeadline ? styles.deadlineValueWarning : null]}>
              {detailStatus === 'submitted' ? 'Submitted' : remainingTime}
            </Text>
            {detailStatus !== 'submitted' ? <Text style={styles.rowMeta}>Deadline: {formatDateTime(submissionDeadline)}</Text> : null}
            {isDraftNearDeadline ? <Text style={styles.warningText}>Less than 24h left before survey expiration.</Text> : null}
          </View>

          <View style={styles.locationCard}>
            <Text style={styles.detailTitle}>Location</Text>
            <Text style={styles.rowMeta}>{formatLocationSummary(detail?.location)}</Text>
          </View>

          <View style={styles.factorTilesCard}>
            <View style={styles.factorTilesHeader}>
              <Text style={styles.detailTitle}>Factors</Text>
              <Pressable style={styles.factorReloadButton} onPress={() => void onLoadCanonicalDetails(selectedSurvey.id)}>
                <Ionicons name="refresh-outline" size={14} color="#255178" />
                <Text style={styles.factorReloadButtonText}>Refresh</Text>
              </Pressable>
            </View>
            {detailsLoadingSurveyId === selectedSurvey.id ? <Text style={styles.rowMeta}>Loading factors...</Text> : null}
            {detail ? (
              <>
                <View style={styles.factorTotalsRow}>
                  <View style={styles.factorTotalPill}>
                    <Text style={styles.factorTotalText}>P/G {formatPoints(detail.scores.ibp_peuplement_gestion)}</Text>
                  </View>
                  <View style={styles.factorTotalPill}>
                    <Text style={styles.factorTotalText}>C {formatPoints(detail.scores.ibp_contexte)}</Text>
                  </View>
                  <View style={[styles.factorTotalPill, styles.factorTotalPillStrong]}>
                    <Text style={styles.factorTotalText}>Total {formatPoints(detail.scores.ibp_total)}</Text>
                  </View>
                </View>
                <View style={styles.factorTilesGrid}>
                  {canonicalFactorEntries.map(([factorCode, factor]) => (
                    <View key={`factor-tile-${factorCode}`} style={styles.factorTile}>
                      <View style={styles.factorTileIconWrap}>
                        <Ionicons name={FACTOR_ICONS[factorCode] ?? 'ellipse-outline'} size={16} color="#1f4f79" />
                      </View>
                      <Text style={styles.factorTileCode}>Factor {factorCode}</Text>
                      <Text style={styles.factorTileClass}>{factor.selected_class}</Text>
                      {factor.warnings.length > 0 ? <Text style={styles.factorTileWarning}>warning</Text> : null}
                    </View>
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
              {selectedSurvey.status !== 'submitted' ? (
                <ActionButton
                  label="Update"
                  icon="create-outline"
                  variant="primary"
                  onPress={() => void onEditSurvey(selectedSurvey.id)}
                />
              ) : null}
              {selectedSurvey.sync_state === 'synced' && selectedSurvey.status !== 'submitted' && selectedSurvey.sync_blocked !== 1 ? (
                <ActionButton label="Submit survey" icon="paper-plane-outline" variant="success" onPress={() => void onSubmitSurvey(selectedSurvey.id)} />
              ) : null}
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
