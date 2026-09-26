// Filled by plan 01.9-22 then 01.9-27; no other plan edits this section.
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
} as const
