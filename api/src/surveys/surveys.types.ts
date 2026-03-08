export type SurveyUpsertBody = {
  id?: string;
  sync_version?: number;
  site_name?: string;
  status?: string;
  visibility?: 'private' | 'public';
  region_version?: 'ACA' | 'M';
  vegetation_stage?: string;
  factors?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  location?: Record<string, unknown>;
  expires_at?: string;
};

type JsonObject = Record<string, unknown>;

export type SurveyRow = {
  id: string;
  user_id: string;
  site_name: string;
  status: string;
  visibility: 'private' | 'public';
  region_version: string | null;
  vegetation_stage: string | null;
  factors: JsonObject;
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
