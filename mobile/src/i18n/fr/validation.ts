// Form validation messages of hooks/useSurveyForm.ts (plan 01.9-21, D-06).
// Keyed on today's form field keys and rule names (D-12 item 3): 01.9-32
// re-checks them once 01.8 moves the rules to the shared domain package, so
// keep these names stable.

const formatNumber = (value: number): string => String(value).replace(".", ",")

export const validationFr = {
  // Label per form field key; also shown as the field label in the factor detail.
  fields: {
    siteName: "Nom du site",
    native_genus_count: "Nombre de genres autochtones",
    strata_count: "Nombre de strates",
    covered_autochthonous_percent: "Couvert autochtone (%)",
    bmg_count: "Nombre de BMg",
    bmm_count: "Nombre de BMm",
    surface_ha: "Surface (ha)",
    tgb_count: "Nombre de TGB",
    gb_count: "Nombre de GB",
    trees_per_ha: "Arbres par ha",
    open_flowering_percent: "Milieux ouverts fleuris (%)",
    class_score: "Classe (0, 2 ou 5)",
    type_count: "Nombre de types",
  },
  rules: {
    required: (label: string) => `${label} : champ obligatoire`,
    number: (label: string) => `${label} : saisissez un nombre`,
    integer: (label: string) => `${label} : saisissez un nombre entier`,
    min: (label: string, min: number) =>
      `${label} : la valeur doit être au moins ${formatNumber(min)}`,
    max: (label: string, max: number) =>
      `${label} : la valeur doit être au plus ${formatNumber(max)}`,
    oneOf: (label: string, allowed: string) => `${label} : valeurs possibles ${allowed}`,
  },
} as const
