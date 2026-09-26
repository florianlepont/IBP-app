import { statusText } from "../../status"

// Status messages of hooks/usePublicMapExplorer.ts (plan 01.9-23). Parameters
// are counts only, never ids, URLs or raw error text.

export const mapStatusFr = {
  loaded: ({ count }: { count: number }) =>
    statusText(
      count === 0
        ? "Carte publique chargée : aucun relevé"
        : `Carte publique chargée : ${count} ${count > 1 ? "relevés" : "relevé"}`,
    ),
  loadFailed: () => statusText("Impossible de charger la carte publique. Réessayez plus tard."),
  parcelsLoadFailed: () =>
    statusText("Impossible de charger les parcelles de la carte. Réessayez plus tard."),
} as const
