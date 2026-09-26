import { statusText } from "../../status"

// Local-data owner check (D-04): the sync gate messages shown by
// hooks/survey-sync/useSurveySyncNetwork.ts and the "discard the other
// account's data" alert of hooks/useSurveySync.ts (plan 01.9-20).
// hooks/useLocalDataOwner.ts itself shows no text.

export const ownerStatusFr = {
  // Local data owned by another account suspends sync (status "conflict").
  syncSuspended: () =>
    statusText("Synchronisation suspendue : des relevés locaux appartiennent à un autre compte."),
  // Any other blocking owner status ("checking", "error", "idle", WR-07).
  checkPending: () =>
    statusText("Vérification des données locales en cours… La synchronisation reprendra ensuite."),
  // The execution-time owner check refused: nothing was sent.
  recheckPending: () =>
    statusText(
      "Synchronisation reportée : vérification du compte propriétaire des données locales en cours.",
    ),

  alerts: {
    discardForeign: {
      title: "Supprimer les données de l'autre compte ?",
      message: ({ summary }: { summary: string }) =>
        `${summary} seront définitivement supprimés de cet appareil. Cette action est irréversible.`,
      confirm: "Supprimer",
    },
  },
} as const
