import { statusText } from "../../status"

// Status messages of the app bootstrap and navigation in
// state/AppStateProvider.tsx (plan 01.9-21). Survey names only, never ids or
// raw error text.

export const appStatusFr = {
  initFailed: () =>
    statusText("Impossible de charger les données de l'appareil. Redémarrez l'application."),
  surveyOpened: ({ name }: { name: string }) => statusText(`« ${name} » ouvert`),
} as const
