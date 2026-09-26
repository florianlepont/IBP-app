import { statusText } from "../../status"

// Status messages and alerts of the session: hooks/useAuth0Session.ts and the
// logout / delete-account flows of hooks/useSurveySync.ts (plan 01.9-20).
// No raw Auth0 or server text: the detail goes to logStatusDetail.

const LOCAL_KEPT = "Vos relevés locaux sont conservés."

export const sessionStatusFr = {
  ready: () => statusText("Prêt"),

  // Session restore at launch
  restored: () => statusText("Session restaurée"),
  restoredOfflineCached: () => statusText("Session restaurée hors ligne (dernier profil connu)"),
  restoredOffline: () =>
    statusText(
      "Session restaurée hors ligne. Votre profil se chargera dès que le serveur sera joignable.",
    ),
  restoreExpired: () => statusText(`Session expirée : reconnectez-vous. ${LOCAL_KEPT}`),
  restoreUnavailable: () =>
    statusText(`Session non restaurée (réseau indisponible). ${LOCAL_KEPT}`),

  // Profile
  profileLoaded: () => statusText("Profil chargé"),
  profileLoginRequired: () => statusText("Connectez-vous pour charger votre profil"),
  profileLoadFailed: () => statusText("Impossible de charger votre profil, réessayez plus tard"),

  // Login / logout
  loggingIn: () => statusText("Connexion…"),
  loggedIn: () => statusText("Connecté"),
  loginFailed: () => statusText("La connexion a échoué. Réessayez."),
  loggedOut: () => statusText("Déconnecté"),
  logoutFailed: () => statusText("La déconnexion a échoué. Réessayez."),

  // Account deletion
  deletingAccount: () => statusText("Suppression du compte…"),
  deleteAccountLoginRequired: () => statusText("Connectez-vous pour supprimer votre compte"),
  deleteAccountFailed: () => statusText("Le compte n'a pas été supprimé. Réessayez."),

  alerts: {
    unsyncedLogout: {
      title: "Données non synchronisées",
      message: ({ summary }: { summary: string }) =>
        `Non synchronisé : ${summary}. Si vous vous déconnectez maintenant, ces données seront définitivement supprimées de cet appareil.`,
      confirm: "Supprimer et se déconnecter",
    },
    deleteAccount: {
      title: "Supprimer le compte",
      message:
        "Cette action est immédiate et irréversible. Votre nom, votre adresse e-mail et votre photo de profil seront définitivement supprimés. Les relevés déjà soumis seront anonymisés et conservés à des fins scientifiques.",
      confirm: "Supprimer mon compte",
    },
    deleteAccountFailed: {
      title: "Suppression impossible",
      message: "Le compte n'a pas été supprimé. Vérifiez votre connexion et réessayez.",
    },
  },
} as const
