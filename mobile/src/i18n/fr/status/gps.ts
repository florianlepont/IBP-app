import { statusText } from "../../status"

// Status messages and alerts of hooks/useGpsCapture.ts (plan 01.9-21). The
// alerts are shown by the provider through Alert.alert. No raw error text.

const LOCATION_PURPOSE = "pour centrer la carte et trouver les parcelles à proximité."

export const gpsStatusFr = {
  servicesDisabled: () => statusText("Services de localisation désactivés"),
  requestingPermission: () => statusText("Demande d'autorisation de localisation…"),
  permissionDenied: () => statusText("Autorisation de localisation refusée"),
  approximateRefining: () => statusText("Position approximative relevée. Affinage du GPS…"),
  capturing: () => statusText("Relevé de la position GPS…"),
  captured: () => statusText("Position GPS relevée"),
  approximateCaptured: () => statusText("Position approximative relevée"),
  failed: () => statusText("Position GPS indisponible"),

  alerts: {
    servicesDisabled: {
      title: "Localisation désactivée",
      message: `Activez les services de localisation ${LOCATION_PURPOSE}`,
    },
    permissionDenied: {
      title: "Localisation désactivée",
      message: `Autorisez l'accès à votre position ${LOCATION_PURPOSE}`,
    },
    unavailable: {
      title: "GPS indisponible",
      message: "L'appareil n'a pas pu fournir de position GPS.",
    },
  },
} as const
