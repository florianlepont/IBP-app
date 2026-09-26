// Filled by plan 01.9-17; no other plan edits this section.
export const ownerConflictFr = {
  eyebrow: "DONNÉES LOCALES",
  title: "Relevés d'un autre compte",
  body: ({ summary, email }: { summary: string; email: string | null }) =>
    `${summary} enregistrés sur cet appareil appartiennent à un autre compte${email ? ` (${email})` : ""}. Ils ne seront jamais envoyés sous votre compte actuel. La synchronisation est suspendue tant que vous n'avez pas choisi.`,
  switchAccount: "Me reconnecter avec l'autre compte",
  discard: "Supprimer ces données",
} as const
