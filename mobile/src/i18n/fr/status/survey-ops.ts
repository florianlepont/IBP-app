import { statusText } from "../../status"

// Status messages of hooks/survey-sync/useSurveySyncSurveyOperations.ts (plan 01.9-11).
// Parameters carry survey names and counts only, never ids or raw error text.

const OWNER_PENDING = "synchronisation en attente de la vérification du compte propriétaire"

const items = (count: number) => `${count} élément${count > 1 ? "s" : ""}`
const operations = (count: number) => `${count} opération${count > 1 ? "s" : ""} en échec`

export const surveyOpsStatusFr = {
  // Words shown in place of the "private" / "public" visibility values.
  visibility: {
    private: "privé",
    public: "public",
  },

  // Attachments
  photoQueued: ({ name }: { name: string }) =>
    statusText(`Photo ajoutée à « ${name} », en attente d'envoi`),
  cameraPhotoQueued: ({ name }: { name: string }) =>
    statusText(`Photo prise ajoutée à « ${name} », en attente d'envoi`),
  readOnly: ({ name }: { name: string }) =>
    statusText(`« ${name} » est soumis et ne peut plus être modifié`),
  mediaLibraryPermissionRequired: () =>
    statusText("Autorisez l'accès à vos photos pour ajouter une image"),
  noImageSelected: () => statusText("Aucune image sélectionnée"),
  cameraPermissionRequired: () => statusText("Autorisez l'accès à l'appareil photo"),
  noPhotoCaptured: () => statusText("Aucune photo prise"),
  attachmentQueueFailed: () => statusText("Impossible d'ajouter la photo, réessayez"),
  attachmentNotFound: () => statusText("Photo introuvable sur cet appareil"),
  attachmentRemoved: () => statusText("Photo supprimée de cet appareil"),
  attachmentRemovedSynced: ({ failed }: { failed: number }) =>
    statusText(
      failed > 0
        ? `Photo supprimée, synchronisation terminée avec ${operations(failed)}`
        : "Photo supprimée et synchronisée",
    ),
  attachmentRemovedOwnerPending: () =>
    statusText(`Photo supprimée de cet appareil ; ${OWNER_PENDING}`),
  attachmentRemovedLoginRequired: () =>
    statusText(
      "Photo supprimée de cet appareil. Connectez-vous et synchronisez pour la supprimer du serveur.",
    ),
  attachmentRemovedSyncPending: () =>
    statusText("Photo supprimée de cet appareil ; synchronisation en attente"),
  attachmentDeleteFailed: () => statusText("Impossible de supprimer la photo, réessayez"),

  // Submit
  notFound: () => statusText("Relevé introuvable sur cet appareil"),
  conflictUnresolved: ({ name }: { name: string }) =>
    statusText(
      `Conflit de synchronisation non résolu sur « ${name} ». Réessayez ou annulez la modification locale d'abord.`,
    ),
  alreadySubmitted: ({ name }: { name: string }) => statusText(`« ${name} » est déjà soumis`),
  notSynced: ({ name }: { name: string }) =>
    statusText(`« ${name} » doit être synchronisé avant d'être soumis`),
  surveyConflict: ({ name }: { name: string }) =>
    statusText(
      `« ${name} » a un conflit de synchronisation. Réessayez ou annulez la modification locale d'abord.`,
    ),
  expired: ({ name }: { name: string }) =>
    statusText(`« ${name} » a expiré et ne peut plus être soumis`),
  notReady: ({ name, details }: { name: string; details: string }) =>
    statusText(`« ${name} » n'est pas prêt à être soumis : ${details}`),
  notReadyGeneric: ({ name }: { name: string }) =>
    statusText(`« ${name} » n'est pas prêt à être soumis`),
  // Pieces joined into notReady's details.
  readiness: {
    missingFactors: ({ factors }: { factors: string }) =>
      `facteurs manquants ou invalides : ${factors}`,
    missingRegion: "région non renseignée",
    missingVegetationStage: "étage de végétation non renseigné",
    missingParcels: "aucune parcelle sélectionnée",
  },
  submitCheckFailed: ({ name }: { name: string }) =>
    statusText(`Impossible de vérifier « ${name} » avant la soumission, réessayez`),
  submitPostponed: ({ name }: { name: string }) =>
    statusText(`Soumission de « ${name} » reportée : ${OWNER_PENDING}`),
  submitted: ({ name }: { name: string }) => statusText(`« ${name} » a été soumis`),
  submitRejected: ({ name }: { name: string }) =>
    statusText(`Soumission de « ${name} » refusée — ouvrez le relevé pour corriger`),
  submitLoginRequired: () => statusText("Connectez-vous pour soumettre le relevé"),
  submitFailed: ({ name }: { name: string }) =>
    statusText(`Soumission de « ${name} » impossible, réessayez plus tard`),

  // Retry and discard
  retryQueued: ({ count }: { count: number }) =>
    statusText(`Nouvelle tentative programmée (${items(count)} en attente)`),
  retryFailed: () => statusText("Impossible de relancer la synchronisation, réessayez"),
  discarded: ({ count }: { count: number }) =>
    statusText(`Modifications locales annulées (${items(count)} retiré${count > 1 ? "s" : ""})`),
  discardFailed: () => statusText("Impossible d'annuler les modifications locales, réessayez"),

  // Visibility
  visibilityUnchanged: ({ visibility }: { visibility: string }) =>
    statusText(`Le relevé est déjà ${visibility}`),
  visibilityQueuedLoginRequired: ({ visibility }: { visibility: string }) =>
    statusText(
      `Visibilité « ${visibility} » enregistrée sur cet appareil. Connectez-vous et synchronisez pour l'envoyer.`,
    ),
  visibilityQueuedOwnerPending: ({ visibility }: { visibility: string }) =>
    statusText(`Visibilité « ${visibility} » enregistrée sur cet appareil ; ${OWNER_PENDING}`),
  visibilityQueuedSyncPending: ({ visibility }: { visibility: string }) =>
    statusText(
      `Visibilité « ${visibility} » enregistrée sur cet appareil ; synchronisation en attente`,
    ),
  visibilitySyncWarning: ({ failed }: { failed: number }) =>
    statusText(
      `Visibilité enregistrée sur cet appareil, mais la synchronisation signale ${operations(failed)}`,
    ),
  visibilitySynced: ({ visibility }: { visibility: string }) =>
    statusText(`Visibilité « ${visibility} » enregistrée et synchronisée`),
  visibilityLoginRequired: () => statusText("Connectez-vous pour changer la visibilité"),
  visibilityFailed: () => statusText("Impossible de changer la visibilité, réessayez"),

  // Survey deletion
  deletionQueued: () => statusText("Relevé supprimé, suppression en attente d'envoi"),
  deleteNotFound: () => statusText("Relevé introuvable sur cet appareil"),
  deleteFailed: () => statusText("Impossible de supprimer le relevé, réessayez"),

  alerts: {
    deleteSurvey: {
      title: "Supprimer le relevé",
      message:
        "Le relevé sera supprimé de cet appareil, puis du serveur à la prochaine synchronisation.",
    },
  },
} as const
