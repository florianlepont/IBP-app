// Filled by plan 01.9-17; no other plan edits this section.
export const parcelSelectionFr = {
  currentPosition: "Ma position",
  selectedCount: ({ count }: { count: number }) =>
    count > 1 ? `${count} parcelles sélectionnées` : `${count} parcelle sélectionnée`,
  noSelection: "Aucune parcelle sélectionnée",
  loadingOverlay: "Chargement des parcelles…",
  visibleCount: ({ count }: { count: number }) =>
    count > 1 ? `${count} parcelles visibles` : `${count} parcelle visible`,
  zoomToSelect: "Zoomez pour sélectionner des parcelles",
  selectionRequired: "Sélectionnez au moins une parcelle pour continuer.",
  tapHint: "Touchez les parcelles pour les ajouter ou les retirer de ce relevé.",
  saving: "Enregistrement…",
  done: "Terminé",
} as const
