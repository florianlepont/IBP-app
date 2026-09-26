// Filled by plan 01.9-16; no other plan edits this section.
const plural = (count: number, word: string): string => (count > 1 ? `${word}s` : word)

export const homeFr = {
  greeting: "Bonjour",
  greetingWithName: ({ name }: { name: string }) => `Bonjour, ${name}`,
  alerts: {
    blocked: ({ count }: { count: number }) =>
      `${count} ${plural(count, "relevé")} ${plural(count, "bloqué")}`,
    failed: ({ count }: { count: number }) =>
      `${count} ${plural(count, "relevé")} en erreur de sync`,
    message: "Vérifiez votre connexion pour relancer la synchronisation.",
  },
  hero: {
    eyebrow: "COMMENCER",
    title: "Nouveau relevé IBP",
    body: "Localisez une parcelle et démarrez l'inventaire.",
    button: "Démarrer un relevé",
  },
  drafts: {
    title: "Brouillons",
    subtitle: ({ count }: { count: number }) => `${count} ${plural(count, "relevé")} en cours`,
  },
  nearby: {
    title: "Autour de vous",
    seeMap: "Voir carte ›",
    seeMapLabel: "Voir la carte",
    locationDenied: "Activez la localisation pour voir les parcelles proches.",
    loadError: "Impossible de charger les parcelles. Vérifiez votre connexion.",
    empty: "Aucune parcelle relevée dans un rayon de 2,5 km.",
  },
  sector: {
    label: "SCORE IBP MOYEN DU SECTEUR",
    score: ({ score }: { score: number }) => `${score} / 10`,
    meta: ({ count }: { count: number }) =>
      `${count} ${plural(count, "relevé")} ${plural(count, "analysé")} · rayon ~2,5 km`,
  },
} as const
