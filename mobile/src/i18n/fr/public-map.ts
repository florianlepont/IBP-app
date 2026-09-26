// Filled by plan 01.9-23 then 01.9-28; no other plan edits this section.
// Texts of the public map screen (screens/PublicMapScreen.tsx and screens/public-map/).
// Parameters are counts, scores, dates and region codes only, never survey ids (T-01.9-50).

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)

export const publicMapFr = {
  badge: "Explorer",
  count: (count: number) =>
    count === 0
      ? "Aucun relevé public"
      : `${count} ${plural(count, "relevé public", "relevés publics")}`,
  empty: "Aucun relevé public dans cette zone",
  currentPosition: "Votre position",
  layer: {
    hidden: "Parcelles masquées",
    loading: "Chargement du cadastre",
    active: "Cadastre actif",
    zoomIn: "Zoomez pour voir les parcelles",
  },
  filters: {
    title: "Filtres",
    subtitle: "Affinez les relevés publiés sans quitter la carte.",
    from: "Du",
    to: "Au",
    region: "Région",
    fromPlaceholder: "2026-03-01",
    toPlaceholder: "2026-03-31",
    regionPlaceholder: "ACA",
    apply: "Appliquer les filtres",
    applying: "Actualisation…",
  },
  selected: {
    title: (ibp: number) => `Relevé public · IBP ${ibp}`,
    meta: ({ region, date }: { region: string; date: string }) => `${region} · ${date}`,
    ownSurvey: "Vous ne pouvez pas signaler votre propre relevé.",
    report: "Signaler ce relevé",
    reasonLabel: "Motif (obligatoire)",
    reasonPlaceholder: "Expliquez pourquoi ce relevé semble suspect",
    send: "Envoyer le signalement",
    sending: "Envoi…",
  },
  clusterList: {
    title: (count: number) => `${count} ${plural(count, "relevé", "relevés")} à cet endroit`,
    subtitle: "Les positions publiques sont arrondies à environ 1 km.",
    row: ({ ibp, date }: { ibp: number; date: string }) => `IBP ${ibp} · ${date}`,
  },
  cluster: {
    count: (count: number) => (count > 99 ? "99+" : String(count)),
  },
  alerts: {
    locationDisabled: {
      title: "Localisation désactivée",
      message: "Autorisez l'accès à la localisation pour centrer la carte sur votre position.",
    },
    locationUnavailable: {
      title: "Localisation indisponible",
      message: "Impossible d'obtenir votre position actuelle.",
    },
  },
  a11y: {
    showFilters: "Afficher les filtres",
    hideFilters: "Masquer les filtres",
    refresh: "Actualiser la carte",
    showParcels: "Afficher les parcelles",
    hideParcels: "Masquer les parcelles",
    locate: "Centrer la carte sur ma position",
    closeSelection: "Fermer le relevé sélectionné",
    closeClusterList: "Fermer la liste des relevés",
    surveyMarker: (ibp: number) => `Relevé public, IBP ${ibp}`,
    cluster: (count: number) => `Groupe de ${count} ${plural(count, "relevé", "relevés")}`,
    clusterListItem: ({ ibp, date, region }: { ibp: number; date: string; region: string }) =>
      `Relevé public, IBP ${ibp}, ${date}, ${region}`,
  },
} as const
