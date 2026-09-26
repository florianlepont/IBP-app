import { statusText } from "../../status"

// Status messages of hooks/survey-sync/useSurveySyncNetwork.ts (sync, pull,
// report) and of the survey detail / history loads in hooks/useSurveySync.ts
// (plan 01.9-20). Parameters are counts only, never ids or raw error text.

const LOCAL_KEPT = "Vos relevés locaux sont conservés."

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`

export const syncStatusFr = {
  // Sync
  inProgress: () => statusText("Synchronisation en cours…"),
  autoInProgress: () => statusText("De nouveau en ligne. Synchronisation en cours…"),
  alreadyRunning: () => statusText("Synchronisation déjà en cours…"),
  done: ({
    synced,
    failed,
    receivedCount = 0,
  }: {
    synced: number
    failed: number
    receivedCount?: number
  }) => {
    const parts = [plural(synced, "modification envoyée", "modifications envoyées")]
    if (failed > 0) parts.push(`${failed} en échec`)
    if (receivedCount > 0) parts.push(plural(receivedCount, "élément reçu", "éléments reçus"))
    return statusText(`Synchronisation terminée : ${parts.join(", ")}`)
  },
  loginRequired: () => statusText("Connectez-vous pour synchroniser"),
  pausedLoginRequired: () => statusText("Synchronisation en pause : connectez-vous"),
  retryLater: () =>
    statusText(
      `Synchronisation reportée : authentification momentanément indisponible. ${LOCAL_KEPT}`,
    ),
  purgeInProgress: () =>
    statusText("Synchronisation suspendue : suppression des données locales en cours."),
  failed: () => statusText(`La synchronisation a échoué. Réessayez plus tard. ${LOCAL_KEPT}`),

  // Pull of server changes
  pulling: () => statusText("Récupération des modifications du serveur…"),
  pulled: ({ surveyCount, attachmentCount }: { surveyCount: number; attachmentCount: number }) =>
    statusText(
      `Modifications du serveur reçues : ${plural(surveyCount, "relevé", "relevés")}, ${plural(attachmentCount, "photo", "photos")}`,
    ),
  pullLoginRequired: () => statusText("Connectez-vous pour récupérer les modifications du serveur"),
  pullFailed: () =>
    statusText("Impossible de récupérer les modifications du serveur. Réessayez plus tard."),

  // Survey report (moderation)
  reportSurveyMissing: () => statusText("Relevé introuvable : signalement impossible"),
  reportReasonRequired: () => statusText("Indiquez le motif du signalement"),
  reportSent: () => statusText("Signalement envoyé à la modération"),
  reportRetryLater: () =>
    statusText(
      "Signalement non envoyé : authentification momentanément indisponible. Réessayez plus tard.",
    ),
  reportLoginRequired: () => statusText("Connectez-vous pour signaler un relevé"),
  reportFailed: () => statusText("Signalement non envoyé. Réessayez plus tard."),
} as const
