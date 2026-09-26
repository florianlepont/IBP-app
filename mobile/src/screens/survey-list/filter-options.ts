import type {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveySyncFilter,
} from "../../app/types"

export type FilterOption<T extends string> = { label: string; value: T }

export const STATUS_OPTIONS: Array<FilterOption<SurveyStatusFilter>> = [
  { label: "Tous", value: "all" },
  { label: "Brouillon", value: "draft" },
  { label: "Soumis", value: "submitted" },
  { label: "Expiré", value: "expired" },
]

export const SYNC_OPTIONS: Array<FilterOption<SurveySyncFilter>> = [
  { label: "Tous", value: "all" },
  { label: "En attente", value: "pending" },
  { label: "Synchronisé", value: "synced" },
  { label: "Erreur", value: "failed" },
]

export const BLOCKED_OPTIONS: Array<FilterOption<SurveyBlockedFilter>> = [
  { label: "Tous", value: "all" },
  { label: "Bloqués", value: "blocked" },
  { label: "Non bloqués", value: "unblocked" },
]

export const ATTACHMENT_OPTIONS: Array<FilterOption<SurveyAttachmentFilter>> = [
  { label: "Tous", value: "all" },
  { label: "Avec photo", value: "with" },
  { label: "Sans photo", value: "without" },
]

export const SORT_OPTIONS: Array<FilterOption<SurveySort>> = [
  { label: "Récent en premier", value: "updated_desc" },
  { label: "Ancien en premier", value: "updated_asc" },
  { label: "Site A-Z", value: "site_asc" },
]
