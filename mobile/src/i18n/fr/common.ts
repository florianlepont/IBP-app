// Words shared across screens. Only plan 01.9-05 edits this file; anything
// screen-specific goes in that screen's own section.
export const commonFr = {
  actions: {
    cancel: "Annuler",
    confirm: "Confirmer",
    delete: "Supprimer",
    retry: "Réessayer",
    close: "Fermer",
    save: "Enregistrer",
    ok: "OK",
  },
  untitledSurvey: "Relevé sans titre",
  justNow: "À l'instant",
  // Labels used by app/survey-logic.ts for the survey status badges.
  surveyStatus: {
    draft: "Brouillon",
    pending: "En attente",
    submitted: "Soumis",
    expired: "Expiré",
    syncPending: "Sync en attente",
    syncError: "Erreur de sync",
    syncBlocked: "Sync bloqué",
    synced: "Sync",
    local: "Local",
  },
} as const
