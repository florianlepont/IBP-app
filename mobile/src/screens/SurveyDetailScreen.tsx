import { Button, Image, Pressable, Text, View } from 'react-native';
import { formatEventPayload, formatPoints } from '../app/formatters';
import { styles } from '../app/styles';
import { FactorCanonical, SurveyDetailResponse, SurveyDetailTab, SurveyEventItem } from '../app/types';
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
  onClose: () => void;
  onLoadCanonicalDetails: (surveyId: string) => Promise<void>;
  onLoadSurveyEvents: (surveyId: string) => Promise<void>;
  onEditSurvey: (surveyId: string) => Promise<void> | void;
  onTakePhoto: (surveyId: string) => Promise<void> | void;
  onPickPhoto: (surveyId: string) => Promise<void> | void;
  onDeleteSurvey: (surveyId: string) => void;
  onSubmitSurvey: (surveyId: string) => Promise<void>;
  onRetrySurvey: (surveyId: string) => Promise<void>;
  onDiscardSurvey: (surveyId: string) => Promise<void>;
  onToggleVisibility: (surveyId: string, visibility: 'private' | 'public') => Promise<void>;
};

const renderCanonicalFactor = (factorCode: string, factor: FactorCanonical) => (
  <View key={`canonical-${factorCode}`} style={styles.canonicalRow}>
    <Text style={styles.canonicalTitle}>Facteur {factorCode}</Text>
    <Text style={styles.canonicalMeta}>Classe retenue: {factor.selected_class}</Text>
    <Text style={styles.canonicalMeta}>Score: {formatPoints(factor.score_points)}</Text>
    <Text style={styles.canonicalMeta}>ID canonique: {factor.factor_id}</Text>
    {factor.warnings.length > 0 ? <Text style={styles.canonicalMeta}>Warnings: {factor.warnings.join(' | ')}</Text> : null}
  </View>
);

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'n/a';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
};

const resolveSubmissionDeadline = (createdAt?: string | null, expiresAt?: string | null): string | null => {
  if (expiresAt) return expiresAt;
  if (!createdAt) return null;
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return null;
  return new Date(createdAtMs + 7 * 24 * 60 * 60 * 1000).toISOString();
};

const formatRemainingTime = (deadlineIso?: string | null): string => {
  if (!deadlineIso) return 'n/a';
  const deadlineMs = Date.parse(deadlineIso);
  if (!Number.isFinite(deadlineMs)) return 'n/a';

  const deltaMs = deadlineMs - Date.now();
  if (deltaMs <= 0) return 'expired';

  const totalMinutes = Math.floor(deltaMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
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
  onClose,
  onLoadCanonicalDetails,
  onLoadSurveyEvents,
  onEditSurvey,
  onTakePhoto,
  onPickPhoto,
  onDeleteSurvey,
  onSubmitSurvey,
  onRetrySurvey,
  onDiscardSurvey,
  onToggleVisibility
}: SurveyDetailScreenProps) {
  const detail = surveyDetails[selectedSurvey.id];
  // Local survey state is the live source after user actions (submit / visibility toggle).
  const detailStatus = selectedSurvey.status;
  const detailVisibility = selectedSurvey.visibility;
  const detailSubmittedAt = detail?.submitted_at ?? null;
  const detailSyncVersion = detail?.sync_version ?? selectedSurvey.sync_version;
  const detailCreatedAt = detail?.created_at ?? selectedSurvey.created_at;
  const detailExpiresAt = detail?.expires_at ?? null;
  const submissionDeadline = resolveSubmissionDeadline(detailCreatedAt, detailExpiresAt);
  const remainingTime = formatRemainingTime(submissionDeadline);
  const loadedEventCount = surveyEvents[selectedSurvey.id]?.length ?? 0;
  const publishableOnPublicMap = detailStatus === 'submitted' && detailVisibility === 'public';

  return (
    <View style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>Survey detail: {selectedSurvey.site_name}</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.helpToggle}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.rowMeta}>id: {selectedSurvey.id}</Text>
      <Text style={styles.rowMeta}>updated: {selectedSurvey.updated_at}</Text>
      <SurveyBadges survey={selectedSurvey} attachmentCount={selectedSurveyAttachments.length} />

      <View style={styles.filterChipsRow}>
        <FilterChip label="Summary" active={surveyDetailTab === 'summary'} onPress={() => setSurveyDetailTab('summary')} />
        <FilterChip label="Factors" active={surveyDetailTab === 'factors'} onPress={() => setSurveyDetailTab('factors')} />
        <FilterChip label="Photos" active={surveyDetailTab === 'photos'} onPress={() => setSurveyDetailTab('photos')} />
        <FilterChip label="Events" active={surveyDetailTab === 'events'} onPress={() => setSurveyDetailTab('events')} />
      </View>

      {surveyDetailTab === 'summary' ? (
        <View style={styles.detailSection}>
          <View style={styles.infoCard}>
            <Text style={styles.detailTitle}>Instructions</Text>
            <Text style={styles.rowMeta}>Review survey context, then start or continue data entry from this screen.</Text>
            <Text style={styles.rowMeta}>A survey is expected to be submitted within 7 days after creation.</Text>
          </View>
          {editingSurveyId === selectedSurvey.id ? <Text style={styles.editingTag}>currently edited in form above</Text> : null}
          {selectedSurvey.status === 'submitted' ? <Text style={styles.rowMeta}>submitted survey: read-only</Text> : null}
          <Text style={styles.rowMeta}>visibility: {detailVisibility}</Text>
          <Text style={styles.rowMeta}>publishable on public map: {publishableOnPublicMap ? 'yes' : 'no'}</Text>
          <Text style={styles.rowMeta}>completion: {selectedSurvey.completion_rate}%</Text>
          <Text style={styles.rowMeta}>created: {formatDateTime(detailCreatedAt)}</Text>
          <Text style={styles.rowMeta}>submission deadline: {formatDateTime(submissionDeadline)}</Text>
          <Text style={styles.rowMeta}>time remaining: {detailStatus === 'submitted' ? 'submitted' : remainingTime}</Text>
          <Text style={styles.rowMeta}>submitted at: {formatDateTime(detailSubmittedAt)}</Text>
          <Text style={styles.rowMeta}>sync version: v{detailSyncVersion}</Text>
          <Text style={styles.rowMeta}>location: {formatLocationSummary(detail?.location)}</Text>
          <Text style={styles.rowMeta}>history entries loaded: {loadedEventCount}</Text>
          {selectedSurvey.last_sync_error ? (
            <Text style={styles.rowMeta}>last error: {selectedSurvey.last_sync_error}</Text>
          ) : (
            <Text style={styles.rowMeta}>No sync error reported.</Text>
          )}
          {selectedSurvey.last_sync_error_code ? <Text style={styles.rowMeta}>error code: {selectedSurvey.last_sync_error_code}</Text> : null}
          {selectedSurvey.last_sync_error_at ? <Text style={styles.rowMeta}>error at: {selectedSurvey.last_sync_error_at}</Text> : null}
        </View>
      ) : null}

      {surveyDetailTab === 'factors' ? (
        <View style={styles.detailSection}>
          <Button title="Reload canonical details" onPress={() => void onLoadCanonicalDetails(selectedSurvey.id)} />
          {detailsLoadingSurveyId === selectedSurvey.id ? <Text style={styles.rowMeta}>Loading canonical details...</Text> : null}
          {surveyDetails[selectedSurvey.id] ? (
            <View style={styles.canonicalCard}>
              <Text style={styles.canonicalHeader}>Scores globaux</Text>
              <Text style={styles.canonicalHeaderLine}>
                Peuplement/Gestion: {formatPoints(surveyDetails[selectedSurvey.id].scores.ibp_peuplement_gestion)}
              </Text>
              <Text style={styles.canonicalHeaderLine}>Contexte: {formatPoints(surveyDetails[selectedSurvey.id].scores.ibp_contexte)}</Text>
              <Text style={styles.canonicalHeaderLine}>Total IBP: {formatPoints(surveyDetails[selectedSurvey.id].scores.ibp_total)}</Text>
              {Object.entries(surveyDetails[selectedSurvey.id].factor_results)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([factorCode, factor]) => renderCanonicalFactor(factorCode, factor))}
            </View>
          ) : (
            <View style={styles.detailSection}>
              <Text style={styles.rowMeta}>Canonical factors not loaded yet.</Text>
            </View>
          )}
        </View>
      ) : null}

      {surveyDetailTab === 'photos' ? (
        <View style={styles.detailSection}>
          {selectedSurveyAttachments.length > 0 ? (
            <View style={styles.attachmentCard}>
              <Text style={styles.attachmentHeader}>Local Attachments</Text>
              {selectedSurveyAttachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentRow}>
                  {attachment.local_uri ? <Image source={{ uri: attachment.local_uri }} style={styles.attachmentPreview} /> : null}
                  <Text style={styles.attachmentText}>
                    {attachment.id} | {attachment.mime_type} | {Math.round(attachment.size_bytes / 1024)} KB
                  </Text>
                  <Text style={styles.attachmentText}>
                    state: {attachment.sync_state}
                    {attachment.remote_attachment_id ? ` | remote: ${attachment.remote_attachment_id}` : ''}
                  </Text>
                  {attachment.last_sync_error_code ? <Text style={styles.attachmentError}>code: {attachment.last_sync_error_code}</Text> : null}
                  {attachment.last_sync_error ? <Text style={styles.attachmentError}>error: {attachment.last_sync_error}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.rowMeta}>No photo queued for this survey.</Text>
          )}
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

      <View style={styles.detailSection}>
        <Text style={styles.rowMeta}>visibility: {selectedSurvey.visibility}</Text>
        <Button
          title={selectedSurvey.visibility === 'public' ? 'Set private' : 'Set public'}
          onPress={() => void onToggleVisibility(selectedSurvey.id, selectedSurvey.visibility === 'public' ? 'private' : 'public')}
        />
        <View style={styles.miniSpacer} />
        {selectedSurvey.status !== 'submitted' ? (
          <>
            <Button title="Start / Continue survey" onPress={() => void onEditSurvey(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
            <Button title="Take photo (camera)" onPress={() => void onTakePhoto(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
            <Button title="Add photo from library" onPress={() => void onPickPhoto(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
          </>
        ) : null}
        <Button title="Delete survey" onPress={() => onDeleteSurvey(selectedSurvey.id)} />
        <View style={styles.miniSpacer} />
        {selectedSurvey.sync_state === 'synced' && selectedSurvey.status !== 'submitted' && selectedSurvey.sync_blocked !== 1 ? (
          <>
            <Button title="Submit survey" onPress={() => void onSubmitSurvey(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
          </>
        ) : null}
        {selectedSurvey.sync_state === 'failed' ? (
          <>
            <Button title="Retry now" onPress={() => void onRetrySurvey(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
            <Button title="Discard local change" onPress={() => void onDiscardSurvey(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
          </>
        ) : null}
      </View>
    </View>
  );
}
