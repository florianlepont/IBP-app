/**
 * Production configuration rules (D-02, D-03, D-18). They run on the RAW
 * environment, before any default is applied, so a variable the operator forgot
 * is reported instead of silently falling back to a development value.
 *
 * Every reason is plain French and never contains the rejected value: these
 * lines end up in `docker logs` and in the deploy journal.
 */
export type ConfigProblem = { variable: string; reason: string }

type Env = Record<string, string | undefined>

/** Development defaults shipped in the code and the compose files (D-02). */
const KNOWN_DEFAULT_SECRETS = new Set(["ibp", "minio", "minio123"])

/**
 * D-18 / pattern map C-2: the committed examples use CHANGE_ME_64_CHAR_HEX,
 * change-me-access-secret and similar placeholders, so match the prefix
 * case-insensitively, not only the exact "change-me".
 */
const PLACEHOLDER_PREFIX = /^change[-_]?me/i

/** D-03: a CORS entry that still carries the example placeholder. */
const CORS_PLACEHOLDER = /change[-_]me/i

/** D-03: a browser origin is scheme + host (+ port), with no path. */
const CORS_ORIGIN_ENTRY = /^https?:\/\/[^/\s]+$/

const REASON_REQUIRED = "doit être renseignée en production."
const REASON_DEFAULT_SECRET =
  "vide, valeur par défaut de développement ou exemple CHANGE_ME : définissez un secret propre à la production."

export function isKnownDefaultSecret(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim()
  if (!trimmed) {
    return true
  }
  return KNOWN_DEFAULT_SECRETS.has(trimmed.toLowerCase()) || PLACEHOLDER_PREFIX.test(trimmed)
}

function isBlank(value: string | undefined): boolean {
  return !(value ?? "").trim()
}

function corsProblem(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim()
  if (!trimmed) {
    return "doit être renseignée en production : « none » pour désactiver CORS, ou une liste d'origines https://hôte séparées par des virgules."
  }
  if (trimmed.toLowerCase() === "none") {
    return null
  }
  const entries = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  if (entries.length === 0) {
    return "ne contient aucune origine : utilisez « none » ou une liste d'origines https://hôte."
  }
  if (entries.some((entry) => CORS_PLACEHOLDER.test(entry))) {
    return "contient encore l'exemple CHANGE_ME : remplacez-le par l'origine réelle, ou par « none »."
  }
  if (entries.some((entry) => !CORS_ORIGIN_ENTRY.test(entry))) {
    return "chaque origine doit être de la forme https://hôte (sans chemin ni barre finale), ou la valeur entière « none »."
  }
  return null
}

export function findProductionProblems(env: Env): ConfigProblem[] {
  const problems: ConfigProblem[] = []

  for (const variable of ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_DB"]) {
    if (isBlank(env[variable])) {
      problems.push({ variable, reason: REASON_REQUIRED })
    }
  }
  if (isKnownDefaultSecret(env.POSTGRES_PASSWORD)) {
    problems.push({ variable: "POSTGRES_PASSWORD", reason: REASON_DEFAULT_SECRET })
  }

  const storageMode = env.OBJECT_STORAGE_MODE
  if (storageMode !== "local" && storageMode !== "minio") {
    problems.push({
      variable: "OBJECT_STORAGE_MODE",
      reason: "doit valoir « local » ou « minio » en production.",
    })
  }
  if (storageMode === "minio") {
    if (isBlank(env.OBJECT_STORAGE_ENDPOINT)) {
      problems.push({ variable: "OBJECT_STORAGE_ENDPOINT", reason: REASON_REQUIRED })
    }
    // The access key (the MinIO root user name) is deliberately not checked:
    // the VPS compose defaults it to "minio" (pattern map C-2).
    if (isKnownDefaultSecret(env.OBJECT_STORAGE_SECRET_KEY)) {
      problems.push({ variable: "OBJECT_STORAGE_SECRET_KEY", reason: REASON_DEFAULT_SECRET })
    }
  }

  for (const variable of ["AUTH0_DOMAIN", "AUTH0_AUDIENCE"]) {
    if (isBlank(env[variable])) {
      problems.push({ variable, reason: REASON_REQUIRED })
    }
  }

  const cors = corsProblem(env.CORS_ORIGIN)
  if (cors) {
    problems.push({ variable: "CORS_ORIGIN", reason: cors })
  }

  return problems
}

/** D-02: missing Auth0 management credentials degrade account deletion, they do not stop the API. */
export function findProductionWarnings(env: Env): ConfigProblem[] {
  const warnings: ConfigProblem[] = []
  for (const variable of ["AUTH0_MGMT_CLIENT_ID", "AUTH0_MGMT_CLIENT_SECRET"]) {
    const value = (env[variable] ?? "").trim()
    if (!value || PLACEHOLDER_PREFIX.test(value)) {
      warnings.push({
        variable,
        reason:
          "vide ou exemple CHANGE_ME : la suppression de compte côté Auth0 ne fonctionnera pas.",
      })
    }
  }
  return warnings
}

export function assertProductionSafety(env: Env): void {
  const problems = findProductionProblems(env)
  if (problems.length > 0) {
    const variables = [...new Set(problems.map((problem) => problem.variable))]
    throw new Error(`Configuration de production refusée : ${variables.join(", ")}`)
  }
}
