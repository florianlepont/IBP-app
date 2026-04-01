export type LocalSurvey = {
  id: string
  site_name: string
  status: string
  visibility: "private" | "public"
  sync_version: number
  sync_state: "pending" | "synced" | "failed"
  last_sync_error: string | null
  last_sync_error_code: string | null
  last_sync_error_at: string | null
  sync_blocked: number
  created_at: string
  updated_at: string
  completion_rate: number
}

export type LocalAttachment = {
  id: string
  survey_id: string
  local_uri: string
  mime_type: string
  size_bytes: number
  sync_state: "pending" | "synced" | "failed"
  remote_attachment_id: string | null
  storage_key: string | null
  upload_url: string | null
  confirm_url: string | null
  last_sync_error: string | null
  last_sync_error_code: string | null
  last_sync_error_at: string | null
  updated_at: string
}

export type QueueRow = {
  id: number
  survey_id: string
  payload: string
  status: "pending" | "failed"
  retry_count: number
  next_retry_at: string | null
}

export type AttachmentQueuePayload = {
  kind: "attachment_upload"
  local_attachment_id: string
  survey_id: string
  local_uri: string
  mime_type: string
  size_bytes: number
  captured_at?: string
  metadata?: Record<string, unknown>
}

export type AttachmentDeleteQueuePayload = {
  kind: "attachment_delete"
  survey_id: string
  attachment_id: string
}

export type SurveyQueuePayload = {
  id?: string
  sync_version?: number
  site_name?: string
  status?: string
  visibility?: string
  parcel_ids?: string[]
  region_version?: string
  vegetation_stage?: string
  factors?: Record<string, unknown>
  scores?: Record<string, unknown>
  expires_at?: string
}

export type SurveyDeleteQueuePayload = {
  kind: "survey_delete"
  survey_id: string
}

export type SurveyVisibilityQueuePayload = {
  kind: "survey_visibility_update"
  survey_id: string
  visibility: "private" | "public"
}

export type UploadTargetResponse = {
  attachment_id: string
  storage_key: string
  upload_url: string
  confirm_url?: string
}

export type SyncBatchOperation = {
  client_ref: string
  entity: "survey" | "attachment"
  action: "upsert" | "create" | "delete" | "visibility_update"
  survey_id?: string
  payload: Record<string, unknown>
}

export type SyncBatchError = {
  code?: string
  message?: string
  http_status?: number
}

export type SyncBatchResult = {
  client_ref: string | null
  entity: string
  action: string
  status: "synced" | "retryable_error" | "fatal_error"
  data?: Record<string, unknown>
  error?: SyncBatchError
}

export type SyncBatchResponse = {
  results?: SyncBatchResult[]
}

export type RemoteSurvey = {
  id: string
  site_name: string
  status: string
  visibility?: string
  parcel_ids?: string[]
  region_version?: string | null
  vegetation_stage?: string | null
  factors?: Record<string, unknown>
  scores?: Record<string, unknown>
  created_at?: string | null
  expires_at?: string | null
  sync_version: number
  deleted_at?: string | null
}

export type RemoteAttachment = {
  id: string
  survey_id: string
  storage_key: string
  mime_type: string
  size_bytes: number
  uploaded_at?: string | null
  deleted_at?: string | null
}

export type SyncChangesResponse = {
  cursor_in: string | null
  cursor_out: string | null
  has_more: boolean
  surveys?: RemoteSurvey[]
  attachments?: RemoteAttachment[]
}

export type DraftInput = {
  site_name: string
  region_version: "ACA" | "M"
  vegetation_stage: string
  parcel_ids: string[]
  factors: Record<string, unknown>
}

export type UpdateDraftInput = {
  survey_id: string
  site_name: string
  region_version: "ACA" | "M"
  vegetation_stage: string
  parcel_ids: string[]
  factors: Record<string, unknown>
  visibility?: "private" | "public"
}

export type LocalAttachmentInput = {
  survey_id: string
  local_uri: string
  mime_type: string
  size_bytes: number
  captured_at?: string
  metadata?: Record<string, unknown>
}
