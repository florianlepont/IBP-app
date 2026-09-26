// Filled by plan 01.9-22 then 01.9-27; no other plan edits this section.
const plural = (count: number, word: string): string => (count > 1 ? `${word}s` : word)

const activeFilters = (count: number): string =>
  `${count} ${plural(count, "filtre")} ${plural(count, "actif")}`

export const surveyListFr = {
  row: {
    deleteAction: "Supprimer",
    updatedMeta: (date: string) => `· ${date}`,
  },
  a11y: {
    deleteSurvey: (name: string) => `Supprimer le relevé ${name}`,
    openSurvey: ({
      name,
      status,
      updatedAt,
    }: {
      name: string
      status: string
      updatedAt: string
    }) => `${name}, ${status}, mis à jour ${updatedAt}`,
  },
  hero: {
    eyebrow: "ACCUEIL",
    title: "Votre carnet de terrain",
    body: {
      empty: "Commencez votre premier relevé IBP.",
      blocked: (count: number) =>
        `${count} ${plural(count, "relevé")} nécessite${count > 1 ? "nt" : ""} votre attention.`,
      attention: (count: number) => `${count} ${plural(count, "relevé")} à examiner.`,
      draftWaiting: (name: string) => `${name} vous attend.`,
      upToDate: "Tous vos relevés sont à jour.",
      fallback: "Retrouvez vos relevés et reprenez où vous vous êtes arrêté.",
    },
    compactFiltered: ({
      visible,
      total,
      filters,
    }: {
      visible: number
      total: number
      filters: number
    }) => `${visible} sur ${total} affichés • ${activeFilters(filters)}`,
    compactSummary: ({
      total,
      draft,
      pending,
    }: {
      total: number
      draft: number
      pending: number
    }) => `${total} relevés • ${draft} brouillons • ${pending} en attente`,
  },
  stats: {
    total: "relevés",
    draft: "brouillons",
    pending: "en attente",
    blocked: "bloqués",
    submitted: "soumis",
    a11y: {
      total: (count: number) => `${count} relevés au total — appuyer pour tout afficher`,
      draft: (count: number) => `${count} brouillons — appuyer pour filtrer`,
      pending: (count: number) => `${count} en attente de sync — appuyer pour filtrer`,
      blocked: (count: number) => `${count} relevés bloqués — appuyer pour filtrer`,
      submitted: (count: number) => `${count} relevés soumis — appuyer pour filtrer`,
    },
  },
  summary: {
    noLocalSurvey: "Aucun relevé local",
    results: ({ count, query }: { count: number; query: string }) =>
      `${count} ${plural(count, "résultat")} pour « ${query} »`,
    shown: (count: number) => `${count} ${plural(count, "relevé")} ${plural(count, "affiché")}`,
    shownOf: ({ visible, total }: { visible: number; total: number }) =>
      `${visible} sur ${total} relevés affichés`,
    activeFilters,
  },
  filters: {
    title: "Filtres",
    toggle: {
      show: "Afficher les filtres avancés",
      hide: "Masquer les filtres avancés",
      close: "Fermer",
      more: "Plus",
      active: (count: number) => `${count} ${plural(count, "actif")}`,
    },
    search: {
      placeholder: "Rechercher par nom de site",
      clear: "Effacer la recherche",
    },
    sections: {
      status: "Statut",
      from: "Du",
      to: "Au",
      sync: "Synchronisation",
      blocked: "Bloqués",
      attachments: "Pièces jointes",
      sort: "Tri",
    },
    datePlaceholder: "AAAA-MM-JJ",
    reset: "Réinitialiser les filtres",
    // Option labels by filter value.
    options: {
      status: { all: "Tous", draft: "Brouillon", submitted: "Soumis", expired: "Expiré" },
      sync: { all: "Tous", pending: "En attente", synced: "Synchronisé", failed: "Erreur" },
      blocked: { all: "Tous", blocked: "Bloqués", unblocked: "Non bloqués" },
      attachment: { all: "Tous", with: "Avec photo", without: "Sans photo" },
      sort: {
        updated_desc: "Récent en premier",
        updated_asc: "Ancien en premier",
        site_asc: "Site A-Z",
      },
    },
  },
  createCard: {
    first: {
      badge: "Premier relevé",
      title: "Créez votre premier relevé",
      body: "Commencez votre carnet de terrain IBP en quelques étapes.",
      action: "Commencer",
      a11y: "Créer votre premier relevé",
    },
    next: {
      badge: "Nouveau relevé",
      title: "Créer un nouveau relevé",
      body: "Ajoutez un relevé IBP à votre carnet de terrain.",
      action: "Créer",
      a11y: "Créer un nouveau relevé",
    },
  },
  attention: {
    title: "À faire",
    problemsAndDraft: (count: number) =>
      `${count} ${plural(count, "problème")} · brouillon en cours`,
    toReview: (count: number) => `${count} ${plural(count, "relevé")} à examiner`,
    draftOnly: "Brouillon en cours",
    rowA11y: ({ name, status }: { name: string; status: string }) => `${name}, ${status}`,
    updated: (date: string) => `Mis à jour ${date}`,
    more: (count: number) =>
      `+${count} ${plural(count, "autre")} ${plural(count, "relevé")} à examiner`,
  },
  continueDraft: {
    a11y: (name: string) => `Continuer le brouillon : ${name}`,
    completion: (rate: number) => `${rate}% complété`,
  },
  section: {
    mine: "Mes relevés",
    results: "Résultats",
    others: (count: number) => `${count} ${plural(count, "autre")} ${plural(count, "relevé")}`,
  },
  empty: {
    none: {
      title: "La nature vous attend",
      body: "Commencez votre premier relevé IBP et contribuez à la connaissance de la biodiversité.",
    },
    filtered: {
      title: "Aucun résultat",
      body: "Élargissez les critères ou réinitialisez les filtres pour voir plus de relevés.",
    },
  },
} as const
