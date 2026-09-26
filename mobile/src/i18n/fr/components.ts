// Filled by plan 01.9-16; no other plan edits this section.
// Texts of the shared cards, the splash screen and the ui/ primitives.
export const componentsFr = {
  separator: "·",
  draftCard: {
    progressLabel: "AVANCEMENT",
    factorCount: ({ count }: { count: number }) => `${count}/10`,
    syncBlocked: "Sync bloquée",
    hoursAgo: ({ count }: { count: number }) => `il y a ${count}h`,
    yesterday: "Hier",
    daysAgo: ({ count }: { count: number }) => `il y a ${count}j`,
  },
  parcelNearbyCard: {
    title: ({ name }: { name: string }) => `Parcelle ${name}`,
    surveyCount: ({ count }: { count: number }) => `${count} relevé${count > 1 ? "s" : ""}`,
  },
  splash: {
    // Latin species names shown one after the other while the app loads.
    species: [
      "Fagus sylvatica",
      "Dryocopus martius",
      "Quercus robur",
      "Salamandra salamandra",
      "Betula pendula",
      "Sitta europaea",
      "Tilia cordata",
      "Martes martes",
      "Pinus sylvestris",
      "Parus major",
      "Carpinus betulus",
      "Rosalia alpina",
    ],
    cursor: "|",
    loadingLabel: "Chargement en cours",
    loading: "Chargement…",
  },
  appButton: {
    defaultLabel: "Action",
  },
  collapsibleSection: {
    toggleLabel: ({ title, expanded }: { title: string; expanded: boolean }) =>
      `${title} — ${expanded ? "réduire" : "développer"}`,
  },
  ibpScoreBadge: {
    noScore: "—",
    denominator: "/10",
  },
} as const
