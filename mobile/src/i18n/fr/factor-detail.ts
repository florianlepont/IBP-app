// Filled by plan 01.9-17; no other plan edits this section.
export const factorDetailFr = {
  fieldsProgress: ({ filledCount, totalCount }: { filledCount: number; totalCount: number }) =>
    `${filledCount}/${totalCount} champs`,
  retainedScore: "Score retenu",
  scorePoints: ({ scoreCount }: { scoreCount: number }) => `${scoreCount} pts`,
  pending: "En attente",
  scoreHint: "Remplissez tous les champs obligatoires pour calculer le score",
  observationsTitle: "Observations",
  observationsSubtitle:
    "Chaque saisie met à jour le brouillon et recalcule le score retenu en direct.",
  requiredField: ({ label }: { label: string }) => `${label} *`,
  numericPlaceholder: "Saisissez une valeur numérique",
  captureTitle: "Que relever",
  captureSubtitle: "À ouvrir seulement pour un rappel rapide pendant la notation de ce facteur.",
  captureToggle: "Afficher ou masquer l'aide de saisie",
  // Keyed by the factor field label the form passes in (see useSurveyForm).
  fieldLabels: {
    native_genus_count: "Nombre de genres autochtones",
    strata_count: "Nombre de strates",
    covered_autochthonous_percent: "Couvert autochtone (%)",
    bmg_count: "Nombre de BMg",
    bmm_count: "Nombre de BMm",
    surface_ha: "Surface (ha)",
    tgb_count: "Nombre de TGB",
    gb_count: "Nombre de GB",
    trees_per_ha: "Arbres par ha",
    open_flowering_percent: "Milieux ouverts fleuris (%)",
    "class_score (0|2|5)": "Classe (0, 2 ou 5)",
    type_count: "Nombre de types",
  },
} as const
