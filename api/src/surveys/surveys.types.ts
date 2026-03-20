export type SurveyUpsertBody = {
  id?: string
  sync_version?: number
  site_name?: string
  status?: "draft" | "submitted" | "synced" | "error" | "expired"
  visibility?: "private" | "public"
  parcel_id?: string
  parcel_ids?: string[]
  observation_year?: number
  version_number?: number
  previous_survey_id?: string
  region_version?: "ACA" | "M"
  vegetation_stage?: string
  factors?: Record<string, unknown>
  scores?: Record<string, unknown>
  expires_at?: string
}

export type SurveyPatchBody = {
  site_name?: string
  visibility?: "private" | "public"
  parcel_id?: string
  parcel_ids?: string[]
  observation_year?: number
  version_number?: number
  previous_survey_id?: string
  region_version?: "ACA" | "M"
  vegetation_stage?: string
  factors?: Record<string, unknown>
  scores?: Record<string, unknown>
}

export type SurveyVisibilityPatchBody = {
  visibility?: "private" | "public"
}

export type CreateAttachmentBody = {
  mime_type?: string
  size_bytes?: number
  captured_at?: string
  metadata?: Record<string, unknown>
}

export type SyncOperation = {
  client_ref?: string
  entity?: "survey" | "attachment"
  action?: "upsert" | "create" | "delete" | "visibility_update"
  survey_id?: string
  payload?: unknown
}

export type SyncBatchBody = {
  operations?: SyncOperation[]
}

type JsonObject = Record<string, unknown>

export type FactorCanonical = {
  factor_id: string
  observed_value_raw: unknown
  selected_class: "S0" | "S1" | "S2" | "S5"
  score_points: number
  warnings: string[]
}

export type SurveyRow = {
  id: string
  user_id: string
  site_name: string
  status: "draft" | "submitted" | "synced" | "error" | "expired"
  visibility: "private" | "public"
  parcel_id: string | null
  parcel_ids?: string[]
  observation_year: number | null
  version_number: number | null
  previous_survey_id: string | null
  region_version: string | null
  vegetation_stage: string | null
  factors: JsonObject
  factor_results: Record<string, FactorCanonical>
  scores: JsonObject
  created_at: string
  updated_at: string
  submitted_at: string | null
  expires_at: string
  sync_version: number
  last_sync_error: string | null
  deleted_at: string | null
}

export type SurveyEventRow = {
  id: string
  survey_id: string
  actor_id: string | null
  event_type: string
  payload: JsonObject | null
  created_at: string
}

export type AttachmentRow = {
  id: string
  survey_id: string
  storage_key: string
  mime_type: string
  size_bytes: number
  created_at: string
  captured_at: string | null
  metadata: JsonObject | null
  upload_token: string
  uploaded_at: string | null
  deleted_at: string | null
}

export type SyncResultError = {
  code: string
  message: string
  http_status?: number
  details?: Record<string, unknown>
}

export type SyncOperationResult = {
  client_ref: string | null
  entity: string
  action: string
  status: "synced" | "retryable_error" | "fatal_error"
  data?: Record<string, unknown>
  error?: SyncResultError
}

export type SyncChangeEvent = SurveyEventRow

export type SyncChangeSurvey = Pick<
  SurveyRow,
  | "id"
  | "site_name"
  | "status"
  | "visibility"
  | "parcel_id"
  | "parcel_ids"
  | "observation_year"
  | "version_number"
  | "previous_survey_id"
  | "region_version"
  | "vegetation_stage"
  | "factors"
  | "factor_results"
  | "scores"
  | "created_at"
  | "updated_at"
  | "submitted_at"
  | "expires_at"
  | "sync_version"
  | "deleted_at"
>

export type ParcelRow = {
  id: string
  parcel_id: string
  commune_code: string
  section: string
  number: string
  geometry: JsonObject
  centroid: { lat?: number; lng?: number; [key: string]: unknown }
  area_m2: number | null
  source: string | null
  created_at: string
  updated_at: string
}

export type SyncChangeAttachment = Pick<
  AttachmentRow,
  | "id"
  | "survey_id"
  | "storage_key"
  | "mime_type"
  | "size_bytes"
  | "captured_at"
  | "metadata"
  | "created_at"
  | "uploaded_at"
  | "deleted_at"
>
