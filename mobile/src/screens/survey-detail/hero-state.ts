import { formatPoints } from "../../app/formatters"
import { fr } from "../../i18n"
import { LocalSurvey } from "../../storage"
import { DisplayedScores } from "./useLocalDraftSummary"

export type HeroSubmitState = "submitted" | "ready" | "pending_sync" | "blocked" | "progress"

export const resolveHeroSubmitState = (
  survey: LocalSurvey,
  canSubmitNow: boolean,
  localSubmitReady: boolean | null,
): HeroSubmitState => {
  if (survey.status === "submitted") return "submitted"
  if (canSubmitNow) return "ready"
  if (localSubmitReady === true) return survey.sync_blocked === 1 ? "blocked" : "pending_sync"
  return "progress"
}

export type HeroMetric = { caption: string; value: string; meta: string }

const m = fr.surveyDetail.metric

export const resolveHeroMetric = (
  scores: DisplayedScores | null,
  useLocalDraftView: boolean,
  completedFactorCount: number | null,
): HeroMetric => {
  if (scores) {
    return {
      caption: useLocalDraftView ? m.localDraftScore : m.ibpTotal,
      value: formatPoints(scores.ibp_total),
      meta: m.split({
        standTotal: formatPoints(scores.ibp_peuplement_gestion),
        contextTotal: formatPoints(scores.ibp_contexte),
      }),
    }
  }
  return {
    caption: m.factorsReady,
    value: completedFactorCount !== null ? m.factorsCount(completedFactorCount) : m.unknown,
    meta: completedFactorCount !== null ? m.requiredCompleted : m.readinessPending,
  }
}

export type HeroSubmitCopy = { heading: string; body: string; pill: string }

export const resolveHeroSubmitCopy = (state: HeroSubmitState): HeroSubmitCopy => {
  const copy = fr.surveyDetail.submit
  if (state === "ready") return copy.ready
  if (state === "pending_sync") return copy.pendingSync
  if (state === "blocked") return copy.blocked
  return copy.progress
}
