// Per-survey sync error shown to users (app/formatters.ts formatSyncErrorForUser).
export const syncErrorsFr = {
  // Fallback for rows written before error codes existed: matched on the stored
  // error text by app/formatters.ts, never shown verbatim.
  patterns: {
    siteNameMissing: "Le nom du site est manquant",
    regionMissing: "La région est manquante",
    vegetationMissing: "Le stade de végétation est manquant",
    invalidData: "Données invalides — ouvrez le relevé pour corriger",
    network: "Erreur réseau — réessayez plus tard",
    session: "Session expirée — reconnectez-vous",
  },
  generic: "Erreur de synchronisation — ouvrez le relevé pour corriger",
} as const
