import { Text, View } from "react-native"
import { shouldShowDevTools } from "../../app/dev-tools"
import { formatDateTime, formatEventPayload } from "../../app/formatters"
import { SurveyEventItem } from "../../app/types"
import { fr } from "../../i18n"
import { LocalAttachment, LocalSurvey } from "../../storage"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { AttachmentPhotoPreview } from "./AttachmentPhotoPreview"
import { styles as sharedStyles } from "./styles"
import { styles } from "./tabs.styles"

type DebugTabProps = {
  survey: LocalSurvey
  attachments: LocalAttachment[]
  events: SurveyEventItem[]
  createdAt: string
  submittedAt: string | null
  publishableOnPublicMap: boolean
  onSimulateMissingAttachmentFile?: (localAttachmentId: string) => Promise<void> | void
}

const t = fr.surveyDetail.debug

// Technical field name and value pairs; names stay as in the data model.
type Field = [name: string, value: string | number | null]

function FieldRows({ fields }: { fields: Field[] }) {
  return (
    <>
      {fields.map(([name, value]) => (
        <Text key={name} style={sharedStyles.rowMeta}>
          {t.field({ name, value: value === null ? t.none : String(value) })}
        </Text>
      ))}
    </>
  )
}

// Developer-only snapshot: ids, error codes, storage keys and raw event
// payloads. Renders nothing outside dev builds (D-06, T-01.9-24).
export function DebugTab({
  survey,
  attachments,
  events,
  createdAt,
  submittedAt,
  publishableOnPublicMap,
  onSimulateMissingAttachmentFile,
}: DebugTabProps) {
  if (!shouldShowDevTools()) return null

  const surveyFields: Field[] = [
    ["id", survey.id],
    ["updated_at", survey.updated_at],
    ["created_at", formatDateTime(createdAt)],
    ["submitted_at", formatDateTime(submittedAt)],
    ["public_map", publishableOnPublicMap ? t.yes : t.no],
    ["completion_rate", survey.completion_rate],
    ["events_loaded", events.length],
    ["local_photos", attachments.length],
    ["last_sync_error", survey.last_sync_error],
    ["last_sync_error_code", survey.last_sync_error_code],
    ["last_sync_error_at", survey.last_sync_error_at],
  ]

  return (
    <View style={sharedStyles.detailSection}>
      <AppCard variant="panelElevated" padding={18} style={styles.debugCard}>
        <AppSectionHeader title={t.snapshotTitle} subtitle={t.snapshotSubtitle} />
        <FieldRows fields={surveyFields} />
        {survey.last_sync_error ? null : <Text style={sharedStyles.rowMeta}>{t.noSyncError}</Text>}
      </AppCard>

      <AppCard variant="panelElevated" padding={18} style={styles.debugCard}>
        <AppSectionHeader title={t.eventsTitle} subtitle={t.eventsSubtitle} />
        {events.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <Text style={styles.eventTitle}>{event.event_type}</Text>
            <Text style={sharedStyles.rowMeta}>{formatDateTime(event.created_at)}</Text>
            {formatEventPayload(event.payload) ? (
              <Text style={styles.eventPayload}>{formatEventPayload(event.payload)}</Text>
            ) : null}
          </View>
        ))}
      </AppCard>

      <View style={styles.debugAttachmentBlock}>
        <AppSectionHeader title={t.imagesTitle} subtitle={t.imagesSubtitle} />
        {attachments.length === 0 ? (
          <Text style={sharedStyles.rowMeta}>{t.noAttachment}</Text>
        ) : (
          attachments.map((attachment, index) => (
            <AppCard
              key={`debug-attachment-${attachment.id}`}
              variant="panelElevated"
              padding={14}
              style={styles.debugAttachmentCard}
            >
              <AttachmentPhotoPreview
                attachment={attachment}
                imageStyle={styles.debugAttachmentPreview}
                placeholderStyle={styles.debugAttachmentPreviewPlaceholder}
              />
              {onSimulateMissingAttachmentFile ? (
                <AppButton
                  label={t.simulateMissingFile}
                  leadingIcon="bug-outline"
                  variant="secondary"
                  onPress={() => void onSimulateMissingAttachmentFile(attachment.id)}
                />
              ) : null}
              <Text style={sharedStyles.rowMeta}>{t.attachmentIndex(index + 1)}</Text>
              <FieldRows
                fields={[
                  ["id", attachment.id],
                  ["survey_id", attachment.survey_id],
                  ["local_uri", attachment.local_uri],
                  ["file_state", attachment.file_state],
                  ["mime_type", attachment.mime_type],
                  ["sync_state", attachment.sync_state],
                  ["remote_attachment_id", attachment.remote_attachment_id ?? null],
                  ["storage_key", attachment.storage_key ?? null],
                  ["upload_url", attachment.upload_url ?? null],
                  ["confirm_url", attachment.confirm_url ?? null],
                  ["updated_at", attachment.updated_at],
                  ["last_sync_error_code", attachment.last_sync_error_code ?? null],
                  ["last_sync_error", attachment.last_sync_error ?? null],
                  ["last_sync_error_at", attachment.last_sync_error_at ?? null],
                ]}
              />
              <Text style={sharedStyles.rowMeta}>
                {t.size({
                  bytes: String(attachment.size_bytes),
                  kilobytes: String(Math.round(attachment.size_bytes / 1024)),
                })}
              </Text>
            </AppCard>
          ))
        )}
      </View>
    </View>
  )
}
