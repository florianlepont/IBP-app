import { statusText } from "../../status"

// Debug reset dialogs and results of hooks/useSurveySync.ts (plan 01.9-20).
// They only appear in dev builds, but are French like every other text.

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`

export const debugStatusFr = {
  resetIbpInProgress: () => statusText("Réinitialisation des données IBP…"),
  resetIbpDone: ({
    surveyCount,
    attachmentCount,
    eventCount,
  }: {
    surveyCount: number
    attachmentCount: number
    eventCount: number
  }) =>
    statusText(
      `Données IBP réinitialisées : ${plural(surveyCount, "relevé", "relevés")}, ${plural(attachmentCount, "photo", "photos")}, ${plural(eventCount, "événement", "événements")}`,
    ),
  resetIbpFailed: () => statusText("La réinitialisation des données IBP a échoué"),

  resetUserInProgress: () => statusText("Réinitialisation des utilisateurs…"),
  resetUserDone: ({
    userCount,
    surveyCount,
    attachmentCount,
  }: {
    userCount: number
    surveyCount: number
    attachmentCount: number
  }) =>
    statusText(
      `Utilisateurs réinitialisés : ${plural(userCount, "utilisateur", "utilisateurs")}, ${plural(surveyCount, "relevé", "relevés")}, ${plural(attachmentCount, "photo", "photos")}`,
    ),
  resetUserFailed: () => statusText("La réinitialisation des utilisateurs a échoué"),

  loginRequired: () => statusText("Connectez-vous pour réinitialiser les données"),

  alerts: {
    resetIbp: {
      title: "Réinitialiser les données IBP",
      message:
        "Tous les relevés, événements et photos IBP seront supprimés du serveur, et les données IBP locales effacées.",
    },
    resetUser: {
      title: "Réinitialiser les utilisateurs",
      message:
        "Tous les utilisateurs seront supprimés du serveur, et votre session et vos données IBP locales effacées.",
    },
    confirm: "Réinitialiser",
  },
} as const
