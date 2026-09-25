import "reflect-metadata"
import { checkEnvSchema } from "./env.schema"
import { findProductionProblems, findProductionWarnings } from "./production-rules"

/**
 * Pre-flight configuration check (D-05, D-18), run outside Nest with the same
 * schema and production rules as the API:
 *
 *   node api/dist/config/check-config.js [--production]
 *
 * On the VPS, update-stack.sh runs it through `compose run` on the freshly
 * pulled image before restarting the stack. Output is one plain French line per
 * problem, naming the variable and never its value; exit code 1 on any problem.
 */
export function runConfigCheck(
  env: Record<string, string | undefined>,
  argv: string[],
): { exitCode: 0 | 1; lines: string[] } {
  const production = env.NODE_ENV === "production" || argv.includes("--production")
  const lines: string[] = []

  const { invalidVariables } = checkEnvSchema(env)
  for (const variable of invalidVariables) {
    lines.push(
      variable === "NODE_ENV"
        ? "ERREUR : NODE_ENV : doit valoir development, test ou production."
        : `ERREUR : ${variable} : valeur de type invalide.`,
    )
  }

  if (production) {
    for (const problem of findProductionProblems(env)) {
      lines.push(`ERREUR : ${problem.variable} : ${problem.reason}`)
    }
  }

  const failed = lines.length > 0
  if (!failed) {
    lines.unshift(
      production
        ? "OK : la configuration de production est valide."
        : "OK : la configuration est valide (règles de production non appliquées : NODE_ENV n'est pas production, ajoutez --production pour les vérifier).",
    )
  }

  if (production) {
    for (const warning of findProductionWarnings(env)) {
      lines.push(`ATTENTION : ${warning.variable} : ${warning.reason}`)
    }
  }

  return { exitCode: failed ? 1 : 0, lines }
}

if (require.main === module) {
  const result = runConfigCheck(process.env, process.argv.slice(2))
  for (const line of result.lines) {
    if (line.startsWith("ERREUR")) {
      process.stderr.write(`${line}\n`)
    } else {
      process.stdout.write(`${line}\n`)
    }
  }
  process.exitCode = result.exitCode
}
