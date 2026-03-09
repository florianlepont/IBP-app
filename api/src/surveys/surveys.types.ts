export type SurveyUpsertBody = {
  id?: string;
  sync_version?: number;
  site_name?: string;
  status?: 'draft' | 'submitted' | 'synced' | 'error' | 'expired';
  visibility?: 'private' | 'public';
  region_version?: 'ACA' | 'M';
  vegetation_stage?: string;
  factors?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  location?: Record<string, unknown>;
  expires_at?: string;
};

export type SurveyPatchBody = {
  site_name?: string;
  visibility?: 'private' | 'public';
  region_version?: 'ACA' | 'M';
  vegetation_stage?: string;
  factors?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  location?: Record<string, unknown>;
};

export type CreateAttachmentBody = {
  mime_type?: string;
  size_bytes?: number;
  captured_at?: string;
  metadata?: Record<string, unknown>;
};

type JsonObject = Record<string, unknown>;

export type FactorCanonical = {
  factor_id: string;
  observed_value_raw: unknown;
  selected_class: 'S0' | 'S1' | 'S2' | 'S5';
  score_points: number;
  warnings: string[];
};

export type SurveyRow = {
  id: string;
  user_id: string;
  site_name: string;
  status: 'draft' | 'submitted' | 'synced' | 'error' | 'expired';
  visibility: 'private' | 'public';
  region_version: string | null;
  vegetation_stage: string | null;
  factors: JsonObject;
  factor_results: Record<string, FactorCanonical>;
  scores: JsonObject;
  location: JsonObject;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  expires_at: string;
  sync_version: number;
  last_sync_error: string | null;
  deleted_at: string | null;
};

export type SurveyEventRow = {
  id: string;
  survey_id: string;
  actor_id: string | null;
  event_type: string;
  payload: JsonObject | null;
  created_at: string;
};

export type AttachmentRow = {
  id: string;
  survey_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  captured_at: string | null;
  metadata: JsonObject | null;
  upload_token: string;
  uploaded_at: string | null;
  deleted_at: string | null;
};
