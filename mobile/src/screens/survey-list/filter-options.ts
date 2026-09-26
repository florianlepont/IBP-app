import type {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveySyncFilter,
} from "../../app/types"
import { fr } from "../../i18n"

export type FilterOption<T extends string> = { label: string; value: T }

const { options } = fr.surveyList.filters

// The values and their order drive the filters; the labels come from the catalogue.
const withLabels = <T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): Array<FilterOption<T>> => values.map((value) => ({ label: labels[value], value }))

export const STATUS_OPTIONS = withLabels<SurveyStatusFilter>(
  ["all", "draft", "submitted", "expired"],
  options.status,
)

export const SYNC_OPTIONS = withLabels<SurveySyncFilter>(
  ["all", "pending", "synced", "failed"],
  options.sync,
)

export const BLOCKED_OPTIONS = withLabels<SurveyBlockedFilter>(
  ["all", "blocked", "unblocked"],
  options.blocked,
)

export const ATTACHMENT_OPTIONS = withLabels<SurveyAttachmentFilter>(
  ["all", "with", "without"],
  options.attachment,
)

export const SORT_OPTIONS = withLabels<SurveySort>(
  ["updated_desc", "updated_asc", "site_asc"],
  options.sort,
)
