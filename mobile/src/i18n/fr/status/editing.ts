import { statusText } from "../../status"

// Status messages of hooks/useEditingDraft.ts (create, edit, autosave) and of
// hooks/useSurveyDraftPatcher.ts (rename, region and stage changes), plan
// 01.9-21. Parameters carry survey names only, never ids or raw error text.

const RETRY = "Réessayez."

export const editingStatusFr = {
  // Create and edit (useEditingDraft)
  createOpened: () => statusText("Nouveau relevé : préparation du brouillon…"),
  draftInitialized: () => statusText("Brouillon prêt"),
  draftInitFailed: () => statusText(`Impossible de préparer le brouillon. ${RETRY}`),
  draftSaved: ({ name }: { name: string }) => statusText(`« ${name} » enregistré sur cet appareil`),
  draftCreated: () => statusText("Brouillon enregistré sur cet appareil"),
  draftSaveFailed: () => statusText(`Impossible d'enregistrer le brouillon. ${RETRY}`),
  editing: ({ name }: { name: string }) => statusText(`Modification de « ${name} »`),
  editLoadFailed: () => statusText(`Impossible d'ouvrir le relevé. ${RETRY}`),
  noSurveySelected: () => statusText("Aucun relevé sélectionné pour la modification"),
  editsSaved: ({ name }: { name: string }) =>
    statusText(`« ${name} » mis à jour, en attente de synchronisation`),
  editSaveFailed: () => statusText(`Impossible d'enregistrer les modifications. ${RETRY}`),
  autosaveFailed: () =>
    statusText("Enregistrement automatique impossible : vos dernières saisies ne sont pas sauvées"),

  // Shared by both hooks
  readOnly: ({ name }: { name: string }) =>
    statusText(`« ${name} » est soumis et ne peut plus être modifié`),
  notFound: () => statusText("Relevé introuvable sur cet appareil"),

  // Direct changes from the survey detail (useSurveyDraftPatcher)
  renamed: ({ name }: { name: string }) => statusText(`Relevé renommé en « ${name} »`),
  regionUpdated: ({ name }: { name: string }) => statusText(`Région mise à jour pour « ${name} »`),
  vegetationStageUpdated: ({ name }: { name: string }) =>
    statusText(`Stade de végétation mis à jour pour « ${name} »`),
  updateFailed: () => statusText(`Impossible d'enregistrer la modification. ${RETRY}`),
} as const
