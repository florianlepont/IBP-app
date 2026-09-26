// Filled by plan 01.9-13; no other plan edits this section.
// Texts of the survey form wizard (screens/SurveyFormScreen.tsx and screens/survey-form/).
// Factor titles and region/vegetation labels stay in app/constants.ts until 01.8.
export const surveyFormFr = {
  header: {
    eyebrow: ({ step, total }: { step: number; total: number }) =>
      `Assistant de relevé · Étape ${step} sur ${total}`,
    compactProgress: ({ step, total }: { step: number; total: number }) => `Étape ${step}/${total}`,
    pillSeparator: " • ",
    identityTitleCreate: "Commencer un nouveau relevé",
    identityTitleEdit: "Préciser l'identité du relevé",
    identityBody:
      "Donnez au relevé un nom clair avant de le placer sur le cadastre et de noter les observations de terrain.",
    parcelsTitle: "Placer le relevé sur la carte",
    parcelsBody:
      "Sélectionnez l'emprise des parcelles, puis fixez la version régionale et le stade de végétation utilisés pour la notation.",
    factorsTitle: "Noter les facteurs IBP",
    factorsBody:
      "Ouvrez chaque facteur, saisissez les valeurs observées et suivez le total des scores retenus en direct.",
    nameRequired: "Nom requis",
    noParcelYet: "Aucune parcelle",
    parcelCount: ({ count }: { count: number }) =>
      count > 1 ? `${count} parcelles` : `${count} parcelle`,
    ibpTotal: ({ total }: { total: number }) => `IBP ${total}`,
    factorCount: ({ count }: { count: number }) => `${count}/10 facteurs`,
    steps: {
      identity: "Identité",
      parcels: "Parcelles",
      factors: "Facteurs",
      nameLocked: "Nom validé",
      nameYourSite: "Nommez votre site",
      nameRequiredFirst: "Nom requis d'abord",
      selectedCount: ({ count }: { count: number }) =>
        count > 1 ? `${count} sélectionnées` : `${count} sélectionnée`,
      mapAndContext: "Carte + contexte",
      scoredCount: ({ count }: { count: number }) => `${count}/10 notés`,
      startScoring: "Commencer la notation",
      hintCurrent: "Étape en cours",
      hintNameRequired: "Nom requis",
      hintTapToOpen: "Toucher pour ouvrir",
    },
  },
  site: {
    title: "Identité du relevé",
    subtitle:
      "Donnez au brouillon un nom qui restera lisible dans les listes, le suivi de synchronisation et les fiches parcelles.",
    nameLabel: "Nom du site *",
    namePlaceholder: "Ex : Forêt de Rambouillet",
    continue: "Continuer vers les parcelles",
  },
  region: {
    title: "Contexte de notation",
    subtitle:
      "La version régionale et le stade de végétation fixent les seuils de notation IBP : choisissez-les avant d'ouvrir les facteurs.",
    label: "Version régionale *",
  },
  vegetation: {
    label: "Stade de végétation *",
  },
  parcels: {
    title: "Sélection des parcelles",
    subtitle:
      "Centrée sur votre position si elle est disponible. Zoomez, puis touchez les parcelles.",
    selectedCount: ({ count }: { count: number }) =>
      count > 1 ? `${count} sélectionnées` : `${count} sélectionnée`,
    fullScreen: "Plein écran",
    moreCount: ({ count }: { count: number }) => `+${count} de plus`,
    addressTitle: "Adresse locale",
    addressLookingUp: "Recherche en cours…",
    addressUnavailable: "Adresse locale non disponible",
    helperLocating: "Centrage sur votre position…",
    helperLoading: "Chargement des parcelles…",
    helperVisible: ({ count }: { count: number }) =>
      `${count} parcelle(s) visible(s) · touchez les polygones pour sélectionner ou désélectionner`,
    helperZoomIn: "Zoomez pour pouvoir sélectionner des parcelles",
    autoLocateError:
      "Position actuelle indisponible. Ouvrez la carte plein écran pour réessayer ou parcourez-la manuellement.",
    manualLocateError:
      "Position actuelle indisponible. Parcourez la carte manuellement ou réessayez.",
    fullscreenFallbackTitle: "Sélection des parcelles",
    selectionTitle: ({ count }: { count: number }) =>
      count > 1 ? `${count} parcelles sélectionnées` : `${count} parcelle sélectionnée`,
    noSelection: "Aucune parcelle sélectionnée",
    back: "Retour",
    done: "Terminé",
    currentPosition: "Position actuelle",
    selectAtLeastOne: "Sélectionnez au moins une parcelle pour continuer.",
    fullscreenHint:
      "Touchez les polygones pour ajouter ou retirer des parcelles sans quitter l'assistant.",
  },
  factors: {
    scoreLabel: "Total IBP en cours",
    scoreBreakdown: ({ stand, context }: { stand: number; context: number }) =>
      `Peuplement / gestion ${stand} · Contexte ${context}`,
    scoreableCount: ({ count }: { count: number }) => `${count}/10 facteurs actuellement notables`,
    sectionTitle: "Notation des facteurs",
    sectionSubtitle:
      "Ouvrez chaque facteur pour saisir les observations et mettre à jour le score en direct.",
    fieldsProgress: ({ filled, total }: { filled: number; total: number }) =>
      `${filled}/${total} champs`,
    retainedScore: ({ selectedClass, score }: { selectedClass: string; score: number }) =>
      `${selectedClass} · ${score} pts`,
    ready: "Prêt",
    pending: "En attente",
  },
  actions: {
    back: "Retour",
    continueToFactors: "Continuer vers les facteurs",
    saveChanges: "Enregistrer les modifications",
    saveDraft: "Enregistrer le brouillon",
  },
  a11y: {
    stepButton: ({ index, label, meta }: { index: string; label: string; meta: string }) =>
      `Étape ${index}, ${label}, ${meta}`,
    factorTile: ({ factor, title, state }: { factor: string; title: string; state: string }) =>
      `Facteur ${factor}, ${title}, ${state}`,
    back: "Revenir à l'étape précédente",
    openFullscreenMap: "Ouvrir la carte des parcelles en plein écran",
    closeFullscreenMap: "Fermer la carte plein écran",
    doneFullscreenMap: "Valider la sélection et fermer la carte",
    locate: "Centrer la carte sur ma position actuelle",
  },
} as const
