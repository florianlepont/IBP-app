export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    display_name: string;
    role: string;
  };
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
  factor_results: Record<string, FactorCanonical>;
  scores: {
    ibp_peuplement_gestion: number;
    ibp_contexte: number;
    ibp_total: number;
  };
};

export type SurveyDetailTab = 'summary' | 'factors' | 'photos' | 'events';

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

export type SurveyStatusFilter = 'all' | 'draft' | 'submitted';
export type SurveySyncFilter = 'all' | 'pending' | 'synced' | 'failed';
export type SurveyBlockedFilter = 'all' | 'blocked' | 'unblocked';
export type SurveyAttachmentFilter = 'all' | 'with' | 'without';
export type SurveySort = 'updated_desc' | 'updated_asc' | 'site_asc';
export type AppScreen = 'list' | 'create' | 'edit';
export type RegionVersion = 'ACA' | 'M';
export type VegetationStage =
  | 'planitiaire'
  | 'collineen'
  | 'montagnard'
  | 'subalpin'
  | 'thermo_mediterraneen'
  | 'meso_mediterraneen'
  | 'supra_mediterraneen';

export type FactorField = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export type SurveyListFilters = {
  surveyQuery: string;
  statusFilter: SurveyStatusFilter;
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
