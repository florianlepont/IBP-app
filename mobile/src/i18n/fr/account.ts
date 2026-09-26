// Filled by plan 01.9-15; no other plan edits this section.
// Shared words (Annuler, Enregistrer) come from fr.common.
export const accountFr = {
  fallbackName: "Compte",
  initialsFallback: "A",
  noEmail: "Aucun email associé",
  defaultRole: "membre",
  profile: {
    title: "Profil",
    unsaved: "Non sauvegardé",
    saved: "Sauvegardé",
    firstName: "Prénom",
    firstNamePlaceholder: "Florian",
    lastName: "Nom",
    lastNamePlaceholder: "Lepont",
    displayName: "Nom d'affichage",
    displayNamePlaceholder: "ex. F. Lepont",
    saving: "Enregistrement...",
    save: "Enregistrer le profil",
  },
  email: {
    label: "Email",
    empty: "—",
    newLabel: "Nouvel email",
    invalid: "Email invalide",
  },
  password: {
    label: "Mot de passe",
    action: "Réinitialiser",
  },
  logout: "Se déconnecter",
  alerts: {
    photo: {
      title: "Photo de profil",
      take: "Prendre une photo",
      pick: "Choisir depuis la galerie",
      remove: "Supprimer la photo",
    },
    passwordReset: {
      title: "Réinitialiser le mot de passe",
      message: (email: string) => `Un email de réinitialisation sera envoyé à ${email}.`,
      emailFallback: "votre adresse email",
      confirm: "Envoyer",
    },
    logout: {
      title: "Se déconnecter",
      message: "Vous serez déconnecté de votre compte.",
      confirm: "Se déconnecter",
    },
  },
  a11y: {
    editPhoto: "Modifier la photo de profil",
    editPhotoHint: "Ouvre les options de photo",
    editEmail: "Modifier l'adresse email",
    resetPassword: "Réinitialiser le mot de passe",
  },
} as const
