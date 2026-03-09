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
  onDiscardSurvey
}: SurveyDetailScreenProps) {
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
          {editingSurveyId === selectedSurvey.id ? <Text style={styles.editingTag}>currently edited in form above</Text> : null}
          {selectedSurvey.status === 'submitted' ? <Text style={styles.rowMeta}>submitted survey: read-only</Text> : null}
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
          <Button title="Refresh canonical details" onPress={() => void onLoadCanonicalDetails(selectedSurvey.id)} />
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
          <Button title="Refresh events" onPress={() => void onLoadSurveyEvents(selectedSurvey.id)} />
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
        {selectedSurvey.status !== 'submitted' ? (
          <>
            <Button title="Edit survey" onPress={() => void onEditSurvey(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
            <Button title="Take photo (camera)" onPress={() => void onTakePhoto(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
            <Button title="Add photo from library" onPress={() => void onPickPhoto(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
            <Button title="Delete survey" onPress={() => onDeleteSurvey(selectedSurvey.id)} />
            <View style={styles.miniSpacer} />
          </>
        ) : null}
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
