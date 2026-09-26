import { formatPoints } from "../../app/formatters"
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

export const resolveHeroMetric = (
  scores: DisplayedScores | null,
  useLocalDraftView: boolean,
  completedFactorCount: number | null,
): HeroMetric => {
  if (scores) {
    return {
      caption: useLocalDraftView ? "Local draft score" : "IBP total",
      value: formatPoints(scores.ibp_total),
      meta: `P/G ${formatPoints(scores.ibp_peuplement_gestion)} · C ${formatPoints(scores.ibp_contexte)}`,
    }
  }
  return {
    caption: "Factors ready",
    value: completedFactorCount !== null ? `${completedFactorCount}/10` : "--",
    meta: completedFactorCount !== null ? "Required factors completed" : "Submit readiness pending",
  }
}

export type HeroSubmitCopy = { heading: string; body: string; pill: string }

export const resolveHeroSubmitCopy = (state: HeroSubmitState): HeroSubmitCopy => {
  if (state === "ready") {
    return {
      heading: "Ready to submit",
      body: "All required factors and required fields are complete.",
      pill: "Ready",
    }
  }
  if (state === "pending_sync") {
    return {
      heading: "Sync before submit",
      body: "The survey is complete locally. Sync it before submission unlocks.",
      pill: "Sync first",
    }
  }
  if (state === "blocked") {
    return {
      heading: "Submission blocked",
      body: "Resolve the sync issue before the submit action becomes available.",
      pill: "Blocked",
    }
  }
  return {
    heading: "Submission locked",
    body: "All 10 factors must be completed before submission is allowed.",
    pill: "Locked",
  }
}
