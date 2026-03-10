export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  email_change_required?: boolean;
  email_change_pending_to?: string | null;
  email_change_token_dev?: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
};

export type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

export type FactorKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
export type FactorClass = 'S0' | 'S1' | 'S2' | 'S5';

export type FactorCanonical = {
  factor_id: string;
  observed_value_raw: unknown;
  selected_class: FactorClass;
  score_points: number;
  warnings: string[];
};

export type SurveyDetailResponse = {
  id: string;
  site_name?: string;
  status?: string;
  visibility?: 'private' | 'public';
  region_version?: string | null;
  vegetation_stage?: string | null;
  location?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string | null;
  expires_at?: string | null;
  sync_version?: number;
  factor_results: Record<string, FactorCanonical>;
  scores: {
    ibp_peuplement_gestion: number;
    ibp_contexte: number;
    ibp_total: number;
  };
};

export type SurveyDetailTab = 'summary' | 'events' | 'debug';

export type SurveyEventItem = {
  id: string;
  survey_id?: string;
  actor_id?: string | null;
  event_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

export type SurveyEventsResponse = {
  items?: SurveyEventItem[];
};

export type PublicMapItem = {
  survey_id: string;
  display_location: { lat: number; lng: number };
  survey_date: string;
  region_code: string;
  ibp_total: number;
};

export type SurveyStatusFilter = 'all' | 'draft' | 'submitted' | 'expired' | 'synced' | 'error';
export type SurveyVisibilityFilter = 'all' | 'private' | 'public';
export type SurveySyncFilter = 'all' | 'pending' | 'synced' | 'failed';
export type SurveyBlockedFilter = 'all' | 'blocked' | 'unblocked';
export type SurveyAttachmentFilter = 'all' | 'with' | 'without';
export type SurveySort = 'updated_desc' | 'updated_asc' | 'site_asc';
export type AppScreen = 'list' | 'create' | 'edit' | 'public_map' | 'profile';
export type RegionVersion = 'ACA' | 'M';
export type VegetationStage =
  | 'planitiaire'
  | 'collineen'
  | 'montagnard'
  | 'subalpin'
  | 'thermo_mediterraneen'
  | 'meso_mediterraneen'
  | 'supra_mediterraneen';

export type SurveyLocationSource = 'gps' | 'manual';

export type SurveyGpsLocation = {
  source: 'gps';
  lat: number;
  lng: number;
  accuracy_m?: number;
  collected_at: string;
};

export type SurveyManualLocation = {
  source: 'manual';
  address_line: string;
  postal_code: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
  geocoded_at?: string;
  geocode_query?: string;
  geocode_provider?: string;
};

export type SurveyLocationPayload = SurveyGpsLocation | SurveyManualLocation | Record<string, unknown>;

export type FactorField = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string | null;
};

export type FactorRetainedScore = {
  score: 0 | 1 | 2 | 5;
  selected_class: FactorClass;
};

export type SurveyListFilters = {
  surveyQuery: string;
  surveyFromDate: string;
  surveyToDate: string;
  statusFilter: SurveyStatusFilter;
  visibilityFilter: SurveyVisibilityFilter;
  syncFilter: SurveySyncFilter;
  blockedFilter: SurveyBlockedFilter;
  attachmentFilter: SurveyAttachmentFilter;
  sortMode: SurveySort;
};

export type SurveyStats = {
  total: number;
  draft: number;
  submitted: number;
  pending: number;
  synced: number;
  failed: number;
  blocked: number;
};

export type SubmitBlockReason =
  | 'not_found'
  | 'global_blocked'
  | 'already_submitted'
  | 'not_synced'
  | 'survey_blocked'
  | null;
