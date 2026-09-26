import { statusText } from "../../status"

// Status messages and alerts of hooks/survey-sync/useSurveySyncProfile.ts (plan 01.9-11).
// No raw server or error text: the detail goes to logStatusDetail.

export const profileStatusFr = {
  displayNameRequired: () => statusText("Le nom affiché est obligatoire"),
  updated: () => statusText("Profil mis à jour"),
  updateLoginRequired: () => statusText("Connectez-vous pour modifier votre profil"),
  updateFailed: () => statusText("Impossible de mettre à jour le profil, réessayez"),

  pictureUploading: () => statusText("Envoi de la photo de profil…"),
  pictureUploaded: () => statusText("Photo de profil mise à jour"),
  pictureUploadedRefreshNeedsLogin: () =>
    statusText("Photo de profil envoyée ; connectez-vous pour mettre à jour votre profil"),
  pictureUploadLoginRequired: () => statusText("Connectez-vous pour changer votre photo de profil"),
  pictureUploadFailed: () => statusText("Impossible d'envoyer la photo de profil, réessayez"),
  mediaLibraryPermissionRequired: () =>
    statusText("Autorisez l'accès à vos photos pour choisir une image"),
  noImageSelected: () => statusText("Aucune image sélectionnée"),
  pictureLibraryFailed: () => statusText("Impossible d'ouvrir vos photos, réessayez"),
  cameraPermissionRequired: () => statusText("Autorisez l'accès à l'appareil photo"),
  noPhotoCaptured: () => statusText("Aucune photo prise"),
  pictureCameraFailed: () => statusText("Impossible d'utiliser l'appareil photo, réessayez"),
  pictureRemoveLoginRequired: () =>
    statusText("Connectez-vous pour supprimer votre photo de profil"),
  pictureRemoved: () => statusText("Photo de profil supprimée"),
  pictureRemoveFailed: () => statusText("Impossible de supprimer la photo de profil, réessayez"),

  loginRequired: () => statusText("Connectez-vous pour continuer"),
  emailUpdated: () =>
    statusText("Adresse e-mail modifiée. Consultez votre boîte de réception pour la confirmer."),
  emailChangeFailed: () => statusText("Impossible de changer l'adresse e-mail"),
  passwordResetSent: () =>
    statusText(
      "E-mail de réinitialisation du mot de passe envoyé. Consultez votre boîte de réception.",
    ),
  passwordResetFailed: () => statusText("Impossible d'envoyer l'e-mail de réinitialisation"),

  alerts: {
    errorTitle: "Erreur",
    emailChangeFailed:
      "Impossible de changer l'adresse e-mail. Vérifiez qu'elle est correcte et différente de l'actuelle, puis réessayez.",
    passwordResetTitle: "Réinitialisation du mot de passe",
    // The address is the user's own, shown back to them.
    passwordResetSent: ({ email }: { email: string }) =>
      `Un lien de réinitialisation a été envoyé à ${email}. Consultez votre boîte de réception.`,
    yourEmailAddress: "votre adresse e-mail",
    passwordResetFailed:
      "Impossible d'envoyer l'e-mail de réinitialisation du mot de passe. Réessayez plus tard.",
  },
} as const
