import { Text, View } from "react-native"
import { shouldShowDevTools } from "../../app/dev-tools"
import { formatDateTime } from "../../app/formatters"
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
  createdAt: string
  submittedAt: string | null
  publishableOnPublicMap: boolean
  loadedEventCount: number
  onSimulateMissingAttachmentFile?: (localAttachmentId: string) => Promise<void> | void
}

export function DebugTab({
  survey,
  attachments,
  createdAt,
  submittedAt,
  publishableOnPublicMap,
  loadedEventCount,
  onSimulateMissingAttachmentFile,
}: DebugTabProps) {
  const rowMeta = sharedStyles.rowMeta

  return (
    <View style={sharedStyles.detailSection}>
      <AppCard variant="panelElevated" padding={18} style={styles.debugCard}>
        <AppSectionHeader
          title="Debug snapshot"
          subtitle="Local and synced state for this survey."
        />
        <Text style={rowMeta}>id: {survey.id}</Text>
        <Text style={rowMeta}>updated: {survey.updated_at}</Text>
        <Text style={rowMeta}>created: {formatDateTime(createdAt)}</Text>
        <Text style={rowMeta}>submitted at: {formatDateTime(submittedAt)}</Text>
        <Text style={rowMeta}>
          publishable on public map: {publishableOnPublicMap ? "yes" : "no"}
        </Text>
        <Text style={rowMeta}>completion: {survey.completion_rate}%</Text>
        <Text style={rowMeta}>history entries loaded: {loadedEventCount}</Text>
        <Text style={rowMeta}>local photos: {attachments.length}</Text>
        {survey.last_sync_error ? (
          <Text style={rowMeta}>last error: {survey.last_sync_error}</Text>
        ) : (
          <Text style={rowMeta}>No sync error reported.</Text>
        )}
        {survey.last_sync_error_code ? (
          <Text style={rowMeta}>error code: {survey.last_sync_error_code}</Text>
        ) : null}
        {survey.last_sync_error_at ? (
          <Text style={rowMeta}>error at: {survey.last_sync_error_at}</Text>
        ) : null}
      </AppCard>

      <View style={styles.debugAttachmentBlock}>
        <AppSectionHeader
          title="Image debug"
          subtitle="Local attachment payloads and sync metadata."
        />
        {attachments.length === 0 ? (
          <Text style={rowMeta}>No local attachment found.</Text>
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
              {shouldShowDevTools() && onSimulateMissingAttachmentFile ? (
                <AppButton
                  label="Simuler un fichier manquant"
                  leadingIcon="bug-outline"
                  variant="secondary"
                  onPress={() => void onSimulateMissingAttachmentFile(attachment.id)}
                />
              ) : null}
              <Text style={rowMeta}>#{index + 1}</Text>
              <Text style={rowMeta}>id: {attachment.id}</Text>
              <Text style={rowMeta}>survey_id: {attachment.survey_id}</Text>
              <Text style={rowMeta}>local_uri: {attachment.local_uri}</Text>
              <Text style={rowMeta}>file_state: {attachment.file_state}</Text>
              <Text style={rowMeta}>mime_type: {attachment.mime_type}</Text>
              <Text style={rowMeta}>
                size: {attachment.size_bytes} bytes ({Math.round(attachment.size_bytes / 1024)} KB)
              </Text>
              <Text style={rowMeta}>sync_state: {attachment.sync_state}</Text>
              <Text style={rowMeta}>
                remote_attachment_id: {attachment.remote_attachment_id ?? "null"}
              </Text>
              <Text style={rowMeta}>storage_key: {attachment.storage_key ?? "null"}</Text>
              <Text style={rowMeta}>upload_url: {attachment.upload_url ?? "null"}</Text>
              <Text style={rowMeta}>confirm_url: {attachment.confirm_url ?? "null"}</Text>
              <Text style={rowMeta}>updated_at: {attachment.updated_at}</Text>
              <Text style={rowMeta}>
                last_sync_error_code: {attachment.last_sync_error_code ?? "null"}
              </Text>
              <Text style={rowMeta}>last_sync_error: {attachment.last_sync_error ?? "null"}</Text>
              <Text style={rowMeta}>
                last_sync_error_at: {attachment.last_sync_error_at ?? "null"}
              </Text>
            </AppCard>
          ))
        )}
      </View>
    </View>
  )
}
