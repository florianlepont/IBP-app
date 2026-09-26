// Filled by plan 01.9-25; no other plan edits this section.
// Tab titles are keyed by root tab route name, so the tab maps stay typed by
// `keyof RootTabParamList`.
export const navigationFr = {
  tabs: {
    home: "Accueil",
    surveys: "Mes Relevés",
    publicMap: "Explorer",
    account: "Compte",
  },
  headers: {
    surveys: "Mes Relevés",
    detail: "Détail",
    newSurvey: "Nouveau relevé",
    editSurvey: "Modifier le relevé",
    factor: (factor: string) => `Facteur ${factor}`,
    parcels: "Parcelles",
    account: "Compte",
    settings: "Paramètres",
  },
  search: {
    placeholder: "Rechercher des relevés",
  },
  a11y: {
    openSettings: "Ouvrir les paramètres",
  },
} as const
