import { spawnSync } from "child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs"
import { tmpdir } from "os"
import { join, resolve } from "path"

/**
 * Stubbed runs of infra/vps/update-stack.sh (phase 01.7 D-18, D-21).
 *
 * Each case builds a fake clone (REPO_DIR with an empty .git directory and a
 * copy of the real script) and puts stub `git`, `docker` and `curl`
 * executables first on PATH. The docker stub logs its argv and answers from
 * files, so the spec can assert which compose commands ran and in what order.
 */

const SCRIPT = resolve(__dirname, "../../infra/vps/update-stack.sh")
const CHECK_CALL = "run --rm --no-deps api node api/dist/config/check-config.js"

const bashAvailable = spawnSync("bash", ["-c", "true"]).status === 0
const describeIfBash = bashAvailable ? describe : describe.skip
if (!bashAvailable) {
  // Visible in the Jest output so a skipped run is never mistaken for a pass.
  process.stderr.write("vps-deploy-guard.spec: bash is not available, the suite is skipped\n")
}

const GIT_STUB = `#!/usr/bin/env bash
echo "git $*" >> "$STUB_DIR/calls.log"
for arg in "$@"; do
  if [ "$arg" = "merge" ] && [ -f "$STUB_DIR/replacement.sh" ]; then
    # git writes a new file (new inode) rather than editing in place.
    cp "$STUB_DIR/replacement.sh" "$STUB_DIR/replacement.tmp"
    mv "$STUB_DIR/replacement.tmp" "$REPO_DIR/infra/vps/update-stack.sh"
  fi
done
exit 0
`

const DOCKER_STUB = `#!/usr/bin/env bash
echo "docker $*" >> "$STUB_DIR/calls.log"
case "$1" in
  image)
    if [ "$2" = "inspect" ]; then
      if [ -f "$STUB_DIR/pulled" ]; then cat "$STUB_DIR/after"; else cat "$STUB_DIR/before"; fi
    fi
    exit 0
    ;;
  inspect)
    cat "$STUB_DIR/running"
    exit 0
    ;;
  compose)
    for arg in "$@"; do
      case "$arg" in
        pull) touch "$STUB_DIR/pulled"; exit 0 ;;
        run) exit "\${STUB_CHECK_EXIT:-0}" ;;
        up) exit 0 ;;
      esac
    done
    exit 0
    ;;
esac
exit 0
`

const CURL_STUB = `#!/usr/bin/env bash
printf '200'
`

const NEW_COPY = `#!/usr/bin/env bash
echo "NEW-COPY-RAN \${CORTEGE_UPDATE_STACK_REEXEC:-}"
exit 0
`

type Scenario = {
  before: string
  after: string
  running: string
  checkExit?: number
  replacement?: string
  reexecAlreadySet?: boolean
}

type Outcome = { status: number | null; output: string; calls: string[] }

let workDirs: string[] = []

function writeExecutable(path: string, content: string) {
  writeFileSync(path, content)
  chmodSync(path, 0o755)
}

function runScenario(scenario: Scenario): Outcome {
  const root = mkdtempSync(join(tmpdir(), "p17-deploy-guard-"))
  workDirs.push(root)
  const repoDir = join(root, "repo")
  const stubDir = join(root, "stub")
  const binDir = join(root, "bin")
  mkdirSync(join(repoDir, ".git"), { recursive: true })
  mkdirSync(join(repoDir, "infra", "vps"), { recursive: true })
  mkdirSync(stubDir)
  mkdirSync(binDir)
  copyFileSync(SCRIPT, join(repoDir, "infra", "vps", "update-stack.sh"))
  const envFile = join(root, "cortege.env")
  writeFileSync(envFile, "POSTGRES_PASSWORD=not-read-by-the-script\n")

  writeFileSync(join(stubDir, "before"), `${scenario.before}\n`)
  writeFileSync(join(stubDir, "after"), `${scenario.after}\n`)
  writeFileSync(join(stubDir, "running"), `${scenario.running}\n`)
  writeFileSync(join(stubDir, "calls.log"), "")
  if (scenario.replacement) {
    writeFileSync(join(stubDir, "replacement.sh"), scenario.replacement)
  }

  writeExecutable(join(binDir, "git"), GIT_STUB)
  writeExecutable(join(binDir, "docker"), DOCKER_STUB)
  writeExecutable(join(binDir, "curl"), CURL_STUB)

  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "CORTEGE_UPDATE_STACK_REEXEC") {
      env[key] = value
    }
  }
  Object.assign(env, {
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
    REPO_DIR: repoDir,
    ENV_FILE: envFile,
    HEALTH_URL: "http://127.0.0.1:1/v1/health",
    STUB_DIR: stubDir,
    STUB_CHECK_EXIT: String(scenario.checkExit ?? 0),
  })
  if (scenario.reexecAlreadySet) {
    env.CORTEGE_UPDATE_STACK_REEXEC = "1"
  }

  const result = spawnSync("bash", ["infra/vps/update-stack.sh"], {
    cwd: repoDir,
    env,
    encoding: "utf8",
    timeout: 30_000,
  })
  const callsPath = join(stubDir, "calls.log")
  const calls = existsSync(callsPath)
    ? readFileSync(callsPath, "utf8").split("\n").filter(Boolean)
    : []
  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls }
}

function indexOfCall(calls: string[], fragment: string): number {
  return calls.findIndex((call) => call.includes(fragment))
}

afterEach(() => {
  for (const dir of workDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  workDirs = []
})

describeIfBash("update-stack.sh deploy guard (D-18)", () => {
  it("(a) new image, failed check: exits 1 and does not restart the stack", () => {
    const outcome = runScenario({
      before: "img-old",
      after: "img-new",
      running: "img-old",
      checkExit: 1,
    })

    expect(outcome.status).toBe(1)
    expect(outcome.output).toContain("NOT restarted")
    expect(indexOfCall(outcome.calls, CHECK_CALL)).toBeGreaterThanOrEqual(0)
    expect(indexOfCall(outcome.calls, " up -d")).toBe(-1)
  })

  it("(b) new image, passing check: restarts the stack after the check", () => {
    const outcome = runScenario({ before: "img-old", after: "img-new", running: "img-old" })

    expect(outcome.status).toBe(0)
    const check = indexOfCall(outcome.calls, CHECK_CALL)
    const up = indexOfCall(outcome.calls, " up -d")
    expect(check).toBeGreaterThanOrEqual(0)
    expect(up).toBeGreaterThan(check)
    expect(outcome.output).toContain("API healthy")
  })

  it("(c) the running container already uses the pulled image: nothing to do", () => {
    const outcome = runScenario({ before: "img-new", after: "img-new", running: "img-new" })

    expect(outcome.status).toBe(0)
    expect(outcome.output).toContain("nothing to do")
    expect(indexOfCall(outcome.calls, CHECK_CALL)).toBe(-1)
    expect(indexOfCall(outcome.calls, " up -d")).toBe(-1)
  })

  it("(d) retry: image pulled by a refused run but not running is checked again", () => {
    const refused = runScenario({
      before: "img-new",
      after: "img-new",
      running: "img-old",
      checkExit: 1,
    })
    expect(refused.status).toBe(1)
    expect(indexOfCall(refused.calls, CHECK_CALL)).toBeGreaterThanOrEqual(0)
    expect(indexOfCall(refused.calls, " up -d")).toBe(-1)

    const fixed = runScenario({ before: "img-new", after: "img-new", running: "img-old" })
    expect(fixed.status).toBe(0)
    expect(indexOfCall(fixed.calls, CHECK_CALL)).toBeGreaterThanOrEqual(0)
    expect(indexOfCall(fixed.calls, " up -d")).toBeGreaterThan(indexOfCall(fixed.calls, CHECK_CALL))
  })
})

describeIfBash("update-stack.sh self re-exec (D-21)", () => {
  it("(e) re-executes the new copy once when the merge changed the script", () => {
    const outcome = runScenario({
      before: "img-new",
      after: "img-new",
      running: "img-new",
      replacement: NEW_COPY,
    })

    expect(outcome.status).toBe(0)
    expect(outcome.output).toContain("re-executing the new copy")
    expect(outcome.output).toContain("NEW-COPY-RAN 1")
    // The old copy stopped at the exec: it never pulled.
    expect(indexOfCall(outcome.calls, " pull ")).toBe(-1)
  })

  it("(f) loop guard: already re-executed, the running copy continues", () => {
    const outcome = runScenario({
      before: "img-new",
      after: "img-new",
      running: "img-new",
      replacement: NEW_COPY,
      reexecAlreadySet: true,
    })

    expect(outcome.status).toBe(0)
    expect(outcome.output).not.toContain("NEW-COPY-RAN")
    expect(outcome.output).not.toContain("re-executing")
    expect(outcome.output).toContain("nothing to do")
    expect(indexOfCall(outcome.calls, " pull ")).toBeGreaterThanOrEqual(0)
  })

  it("(g) script unchanged by the merge: no re-exec", () => {
    const outcome = runScenario({ before: "img-new", after: "img-new", running: "img-new" })

    expect(outcome.status).toBe(0)
    expect(outcome.output).not.toContain("re-executing")
    expect(outcome.output).toContain("nothing to do")
  })
})
