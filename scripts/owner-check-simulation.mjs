// Owner-check simulation (phase 01.7 D-17; replaces the one-off 01.6 script, which stays in
// .planning/phases/01.6-*/ as the record of that phase).
//
// It replays what the owner would otherwise check by hand on phones and on the VPS, so the
// owner's only manual step is the VPS sitting. Every check prints PASS or FAIL, the run ends
// with a summary, and the exit code is 1 when any check failed.
//
// Usage: node scripts/owner-check-simulation.mjs <phase>
//
//   devices         Needs a running API with NODE_ENV=test (POST /debug/test-token) and, for the
//                   photo checks, OBJECT_STORAGE_MODE=minio. Two "devices" (two tokens, one
//                   account) sync a survey: v2 cursor, rename, empty next pull, legacy cursor
//                   still accepted, same-version rules, presigned photo upload and download, a
//                   wrong declared size refused by storage, profile picture. Then the 01.7
//                   lists: unpaginated shape, a limit=2 page walk equal to the unpaginated list,
//                   limit=0 and garbage cursors answered 400 (also on /sync/changes), and the
//                   events list walked one item per page. Writes the state file for `restart`.
//   restart         Run after stopping and starting the same API process (same database and
//                   bucket). Reads the state file: the picture, the photo and the surveys are
//                   still served.
//   config-refusal  No running API needed; needs the built API (npm --workspace api run build).
//                   The built API refuses a production start with development defaults, naming
//                   the variables and never echoing a value; check-config.js agrees; a valid
//                   production env passes check-config, and the API started with it answers
//                   /health, hides /debug/test-token (404) and sends no CORS headers to a foreign
//                   origin. The started API never touches a database (the pool connects lazily).
//   deploy-guard    No running API needed; needs the built API and bash. Fixture VPS env files
//                   get the same verdict from infra/vps/check-env.sh and from check-config.js
//                   with the compose-mapped env. Then a copy of infra/vps/update-stack.sh runs
//                   under a temporary REPO_DIR with stub git/docker/curl, where the stub
//                   `compose run` executes the real check-config.js: refused deploy, accepted
//                   deploy, retry after the env file is fixed, and the one-time self re-exec
//                   (D-21) with its loop guard.
//   production      Read-only, for after the deploy:
//                   SIM_BASE=https://cortege.algernon.ovh/v1 node scripts/owner-check-simulation.mjs production
//                   /health 200, /debug/test-token 404, /surveys without a token 401,
//                   /public/map-items 200 with items, no CORS headers for a foreign origin, and
//                   the MinIO health URL 200. It never writes anything. Behind an HTTP proxy,
//                   run it with NODE_USE_ENV_PROXY=1.
//
// Configuration (environment):
//   SIM_PORT          API port for the default base URL (default 3100)
//   SIM_BASE          API base URL including /v1 (default http://localhost:<SIM_PORT>/v1)
//   SIM_STATE         state file shared by devices and restart
//                     (default <os tmpdir>/cortege-owner-check-state.json)
//   SIM_EMAIL         account used by devices and restart (default owner-check@ibp.local)
//   SIM_REPO_DIR      repository root (default: the parent of this script's directory)
//   SIM_API_DIR       API workspace, absolute or relative to SIM_REPO_DIR (default api); the
//                     built files are read from <SIM_API_DIR>/dist
//   SIM_FILES_HEALTH  MinIO health URL for production
//                     (default https://cortege-files.algernon.ovh/minio/health/live)
import { spawn, spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SIM_PORT = process.env.SIM_PORT ?? "3100"
const BASE = (process.env.SIM_BASE ?? `http://localhost:${SIM_PORT}/v1`).replace(/\/+$/, "")
const STATE = process.env.SIM_STATE ?? path.join(os.tmpdir(), "cortege-owner-check-state.json")
const EMAIL = process.env.SIM_EMAIL ?? "owner-check@ibp.local"
const REPO_DIR = path.resolve(
  process.env.SIM_REPO_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
)
const API_DIR = path.resolve(REPO_DIR, process.env.SIM_API_DIR ?? "api")
const MAIN_JS = path.join(API_DIR, "dist", "main.js")
const CHECK_CONFIG_JS = path.join(API_DIR, "dist", "config", "check-config.js")
const UPDATE_STACK = path.join(REPO_DIR, "infra", "vps", "update-stack.sh")
const CHECK_ENV = path.join(REPO_DIR, "infra", "vps", "check-env.sh")
const FILES_HEALTH =
  process.env.SIM_FILES_HEALTH ?? "https://cortege-files.algernon.ovh/minio/health/live"
const FOREIGN_ORIGIN = "https://evil.example"

const results = []
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`)
}

async function api(token, method, route, body, headers = {}, base = BASE) {
  const res = await fetch(base + route, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // Not JSON (image bytes, empty body): the caller reads `text` or `res`.
  }
  return { status: res.status, json, text, res }
}

async function login(email) {
  const r = await api(null, "POST", "/debug/test-token", { email })
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`POST /debug/test-token answered ${r.status}: is the API running in test mode?`)
  }
  return r.json.access_token
}

// A foreign-origin preflight: with CORS_ORIGIN=none there is no Allow-Origin, and credentials
// are never allowed (D-03). Returns a short description for the check detail.
async function preflight(base, route) {
  const res = await fetch(base + route, {
    method: "OPTIONS",
    headers: {
      Origin: FOREIGN_ORIGIN,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  })
  const allowOrigin = res.headers.get("access-control-allow-origin")
  const allowCredentials = res.headers.get("access-control-allow-credentials")
  return {
    ok: allowOrigin === null && allowCredentials !== "true",
    detail: `status ${res.status}, allow-origin ${allowOrigin ?? "absent"}, allow-credentials ${allowCredentials ?? "absent"}`,
  }
}

// Follows next_cursor until it is null and returns every item, or null on an error status.
async function walk(token, route, limit, maxPages = 500) {
  const items = []
  let cursor = null
  for (let page = 0; page < maxPages; page += 1) {
    const sep = route.includes("?") ? "&" : "?"
    const query = `limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    const r = await api(token, "GET", `${route}${sep}${query}`)
    if (r.status !== 200) return null
    items.push(...r.json.items)
    if (r.json.next_cursor === null) return items
    cursor = r.json.next_cursor
  }
  return null
}

const sameIds = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((item, i) => item.id === b[i].id)

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Parses KEY=VALUE lines as text, like check-env.sh (never sourced or evaluated).
function parseEnvFile(file) {
  const env = {}
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    let line = raw.trim()
    if (!line || line.startsWith("#")) continue
    if (line.startsWith("export ")) line = line.slice(7).trim()
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1)
    env[key] = value
  }
  return env
}

// The environment the API container gets on the VPS: the env file, then the `environment:`
// block of infra/docker-compose.vps.yml, which wins.
function composeMappedEnv(fileEnv) {
  return {
    ...fileEnv,
    NODE_ENV: "production",
    PORT: "3000",
    POSTGRES_HOST: "postgres",
    POSTGRES_PORT: "5432",
    OBJECT_STORAGE_MODE: "minio",
    OBJECT_STORAGE_BUCKET: fileEnv.OBJECT_STORAGE_BUCKET || "cortege-media",
    OBJECT_STORAGE_ENDPOINT: fileEnv.OBJECT_STORAGE_ENDPOINT ?? "",
    OBJECT_STORAGE_REGION: fileEnv.OBJECT_STORAGE_REGION || "us-east-1",
    OBJECT_STORAGE_ACCESS_KEY: fileEnv.MINIO_ACCESS_KEY || "minio",
    OBJECT_STORAGE_SECRET_KEY: fileEnv.MINIO_SECRET_KEY ?? "",
  }
}

function requireBuiltApi() {
  if (!existsSync(MAIN_JS) || !existsSync(CHECK_CONFIG_JS)) {
    console.error(`The built API is missing (${MAIN_JS}): run npm --workspace api run build`)
    process.exit(2)
  }
}

// Minimal valid 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

// ---------------------------------------------------------------------------------------------
// devices
// ---------------------------------------------------------------------------------------------
async function phaseDevices() {
  const tokenA = await login(EMAIL) // device A
  const tokenB = await login(EMAIL) // device B, same account
  const stamp = Date.now()
  const surveyId = `survey-${stamp}`
  const base = {
    id: surveyId,
    status: "draft",
    visibility: "private",
    factors: {},
    scores: {},
    location: { source: "gps", lat: 48.643, lng: 1.829 },
  }
  const syncOne = (token, ref, payload) =>
    api(token, "POST", "/sync", {
      operations: [{ client_ref: ref, entity: "survey", action: "upsert", payload }],
    })

  // Device A creates the survey through /sync (what the app does)
  let r = await syncOne(tokenA, "a1", { ...base, sync_version: 1, site_name: "Forêt A" })
  check(
    "A: create survey via /sync",
    r.status === 200 && r.json.results[0].status === "synced",
    r.json?.results?.[0]?.status,
  )

  // Device B first pull: gets the survey and a v2 cursor
  r = await api(tokenB, "GET", "/sync/changes?limit=100")
  const b1 = r.json
  check(
    "B: first pull sees the survey",
    r.status === 200 && b1.surveys.some((s) => s.id === surveyId && s.site_name === "Forêt A"),
  )
  check("B: cursor is v2 format", /^v2:\d+:\d+$/.test(b1?.cursor_out ?? ""), b1?.cursor_out)

  // Device A renames the site (version bump)
  r = await syncOne(tokenA, "a2", { ...base, sync_version: 2, site_name: "Forêt A (renommée)" })
  check("A: rename syncs", r.status === 200 && r.json.results[0].status === "synced")

  // Device B pulls from its cursor: sees the new name, no error
  r = await api(
    tokenB,
    "GET",
    `/sync/changes?limit=100&cursor=${encodeURIComponent(b1.cursor_out)}`,
  )
  check(
    "B: incremental pull shows the new name",
    r.status === 200 &&
      r.json.surveys.some((s) => s.id === surveyId && s.site_name === "Forêt A (renommée)"),
  )
  const b2cursor = r.json?.cursor_out
  r = await api(tokenB, "GET", `/sync/changes?limit=100&cursor=${encodeURIComponent(b2cursor)}`)
  check(
    "B: next pull is empty (nothing re-sent)",
    r.status === 200 && r.json.events.length === 0 && r.json.surveys.length === 0,
  )

  // Installed-app compatibility: a legacy cursor is still accepted
  r = await api(
    tokenB,
    "GET",
    `/sync/changes?limit=100&cursor=${encodeURIComponent("2026-01-01 00:00:00+00|x")}`,
  )
  check(
    "B: legacy cursor accepted, answered with v2",
    r.status === 200 && /^v2:/.test(r.json?.cursor_out ?? ""),
  )

  // Same-version retry with only visibility changed is applied
  r = await syncOne(tokenA, "a3", {
    ...base,
    sync_version: 2,
    site_name: "Forêt A (renommée)",
    visibility: "public",
  })
  check(
    "A: same-version visibility-only retry is synced",
    r.json?.results?.[0]?.status === "synced",
  )
  // Same version, different content: conflict, not silent overwrite
  r = await syncOne(tokenB, "b1", {
    ...base,
    sync_version: 2,
    site_name: "Autre nom",
    visibility: "public",
  })
  check(
    "B: same-version different content → sync_version_conflict",
    r.json?.results?.[0]?.status === "fatal_error" &&
      r.json.results[0].error?.code === "sync_version_conflict",
  )

  // Device A adds a photo (presigned PUT to MinIO, then confirm)
  const photo = Buffer.alloc(2048, 7)
  r = await api(tokenA, "POST", `/surveys/${surveyId}/attachments`, {
    mime_type: "image/jpeg",
    size_bytes: photo.length,
  })
  const att = r.json
  check(
    "A: attachment created with presigned URL",
    r.status === 201 && String(att?.upload_url).startsWith("http"),
  )
  const put = await fetch(att.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: photo,
  })
  check("A: photo uploaded to MinIO", put.ok, String(put.status))
  r = await api(tokenA, "PUT", att.confirm_url)
  check("A: upload confirmed", r.status === 200 && typeof r.json?.uploaded_at === "string")
  r = await api(tokenB, "GET", `/surveys/${surveyId}/attachments/${att.attachment_id}/download-url`)
  const got = r.status === 200 ? Buffer.from(await (await fetch(r.json.url)).arrayBuffer()) : null
  check("B: photo downloadable, same bytes", !!got && got.equals(photo))

  // A lying size is refused by MinIO (signed Content-Length)
  r = await api(tokenA, "POST", `/surveys/${surveyId}/attachments`, {
    mime_type: "image/jpeg",
    size_bytes: 500000,
  })
  const bad = await fetch(r.json.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: photo,
  })
  check("wrong declared size is refused by storage", bad.status === 403, String(bad.status))

  // Profile picture upload and display
  const form = new FormData()
  form.append("file", new Blob([PNG], { type: "image/png" }), "avatar.png")
  r = await api(tokenA, "PUT", "/me/profile-picture", form)
  check("A: profile picture uploaded", r.status >= 200 && r.status < 300, String(r.status))
  r = await api(tokenA, "GET", "/me")
  check("A: /me shows a picture URL", r.status === 200 && !!r.json.profile_picture_url)
  r = await api(tokenA, "GET", "/me/profile-picture")
  check(
    "A: picture bytes served",
    r.status === 200 && r.res.headers.get("content-type")?.startsWith("image/png"),
  )

  // --- 01.7 lists (D-11, D-12) ---
  r = await api(tokenB, "GET", "/surveys")
  check(
    "B: GET /surveys without params → { items, next_cursor: null }",
    r.status === 200 &&
      Array.isArray(r.json?.items) &&
      r.json.next_cursor === null &&
      Object.keys(r.json).sort().join(",") === "items,next_cursor",
  )

  const extraIds = [1, 2, 3, 4].map((i) => `survey-${stamp}-p${i}`)
  r = await api(tokenA, "POST", "/sync", {
    operations: extraIds.map((id, i) => ({
      client_ref: `p${i}`,
      entity: "survey",
      action: "upsert",
      payload: { ...base, id, sync_version: 1, site_name: `Parcelle ${i + 1}` },
    })),
  })
  check(
    "A: 4 more surveys created in one /sync batch",
    r.status === 200 &&
      r.json.results.length === 4 &&
      r.json.results.every((x) => x.status === "synced"),
  )

  r = await api(tokenB, "GET", "/surveys")
  const unpaginated = r.status === 200 ? r.json.items : null
  const walked = await walk(tokenB, "/surveys", 2)
  const walkedIds = walked ? walked.map((s) => s.id) : []
  check(
    "B: GET /surveys?limit=2 page walk = unpaginated list (same ids, same order, each once)",
    sameIds(walked, unpaginated) && new Set(walkedIds).size === walkedIds.length,
    `${walked?.length ?? "error"} walked, ${unpaginated?.length ?? "error"} unpaginated`,
  )
  check(
    "B: the walk contains the 5 surveys of this run",
    [surveyId, ...extraIds].every((id) => walkedIds.includes(id)),
  )

  r = await api(tokenB, "GET", "/surveys?limit=0")
  check("GET /surveys?limit=0 → 400", r.status === 400, String(r.status))
  r = await api(tokenB, "GET", "/surveys?limit=2&cursor=garbage")
  check(
    "GET /surveys?cursor=garbage → 400, value not echoed",
    r.status === 400 && !r.text.includes("garbage"),
    String(r.status),
  )
  r = await api(
    tokenB,
    "GET",
    `/sync/changes?limit=100&cursor=${encodeURIComponent("2024-02-30T00:00:00Z|x")}`,
  )
  check("GET /sync/changes with a Feb-30 legacy cursor → 400", r.status === 400, String(r.status))
  r = await api(
    tokenB,
    "GET",
    `/sync/changes?limit=100&cursor=${encodeURIComponent("2024-01-01 12:00:00 junk|x")}`,
  )
  check(
    "GET /sync/changes with a trailing-junk legacy cursor → 400",
    r.status === 400,
    String(r.status),
  )

  r = await api(tokenB, "GET", `/surveys/${surveyId}/events`)
  const events = r.status === 200 ? r.json.items : null
  check(
    "B: GET /surveys/:id/events without params → items, next_cursor null",
    r.status === 200 && events.length > 0 && r.json.next_cursor === null,
    `${events?.length ?? "error"} events`,
  )
  const walkedEvents = await walk(tokenB, `/surveys/${surveyId}/events`, 1)
  check(
    "B: events walked one per page = unpaginated events",
    sameIds(walkedEvents, events),
    `${walkedEvents?.length ?? "error"} walked`,
  )

  writeFileSync(
    STATE,
    JSON.stringify({
      surveyId,
      attachmentId: att.attachment_id,
      surveyIds: [surveyId, ...extraIds],
    }),
  )
  console.log(`state written to ${STATE}`)
}

// ---------------------------------------------------------------------------------------------
// restart
// ---------------------------------------------------------------------------------------------
async function phaseRestart() {
  const { surveyId, attachmentId, surveyIds = [] } = JSON.parse(readFileSync(STATE, "utf8"))
  const token = await login(EMAIL)
  let r = await api(token, "GET", "/me")
  check(
    "after restart: /me still has the picture",
    r.status === 200 && !!r.json.profile_picture_url,
  )
  r = await api(token, "GET", "/me/profile-picture")
  check(
    "after restart: picture bytes still served",
    r.status === 200 && r.res.headers.get("content-type")?.startsWith("image/png"),
  )
  r = await api(token, "GET", `/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
  const got = r.status === 200 ? await fetch(r.json.url) : null
  check("after restart: survey photo still downloadable", !!got && got.ok)
  r = await api(token, "GET", "/surveys")
  const ids = r.status === 200 ? r.json.items.map((s) => s.id) : []
  check(
    "after restart: every survey of the devices run is still listed",
    surveyIds.length > 0 && surveyIds.every((id) => ids.includes(id)),
    `${surveyIds.length} expected`,
  )
}

// ---------------------------------------------------------------------------------------------
// config-refusal
// ---------------------------------------------------------------------------------------------
async function phaseConfigRefusal() {
  requireBuiltApi()
  // dotenv in main.ts reads .env from the working directory: run from an empty one.
  const cwd = mkdtempSync(path.join(os.tmpdir(), "cortege-sim-config-"))
  const child = { process: null }
  try {
    const defaultsEnv = {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "production",
      POSTGRES_PASSWORD: "ibp",
      OBJECT_STORAGE_MODE: "minio",
      OBJECT_STORAGE_SECRET_KEY: "minio123",
      PORT: String(await freePort()),
    }
    const refused = spawnSync(process.execPath, [MAIN_JS], {
      cwd,
      env: defaultsEnv,
      encoding: "utf8",
      timeout: 30_000,
    })
    const refusedOut = `${refused.stdout}${refused.stderr}`
    check(
      "built API with development defaults: exits non-zero",
      refused.status !== null && refused.status !== 0,
      `exit ${refused.status}`,
    )
    check(
      "refusal names POSTGRES_PASSWORD and CORS_ORIGIN",
      refusedOut.includes("POSTGRES_PASSWORD") && refusedOut.includes("CORS_ORIGIN"),
    )
    check("refusal never echoes the secret value", !refusedOut.includes("minio123"))

    const cli = spawnSync(process.execPath, [CHECK_CONFIG_JS], {
      cwd,
      env: defaultsEnv,
      encoding: "utf8",
      timeout: 30_000,
    })
    const cliOut = `${cli.stdout}${cli.stderr}`
    const errorLines = cliOut.split("\n").filter((l) => l.startsWith("ERREUR :"))
    check(
      "check-config.js with the same env: exit 1 with ERREUR lines",
      cli.status === 1 && errorLines.length > 0,
      `exit ${cli.status}, ${errorLines.length} ERREUR lines`,
    )
    check("check-config never echoes the secret value", !cliOut.includes("minio123"))

    const port = await freePort()
    const dbPassword = `sim-${randomBytes(12).toString("hex")}`
    const storageSecret = `sim-${randomBytes(12).toString("hex")}`
    const validEnv = {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "production",
      PORT: String(port),
      // Never contacted: nothing on these checks reaches the database or the bucket.
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: "5432",
      POSTGRES_USER: "ibp_sim",
      POSTGRES_DB: "ibp_sim_unused",
      POSTGRES_PASSWORD: dbPassword,
      OBJECT_STORAGE_MODE: "minio",
      OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:9",
      OBJECT_STORAGE_ACCESS_KEY: "cortege",
      OBJECT_STORAGE_SECRET_KEY: storageSecret,
      AUTH0_DOMAIN: "sim.eu.auth0.com",
      AUTH0_AUDIENCE: "https://api.sim.example",
      CORS_ORIGIN: "none",
    }
    const ok = spawnSync(process.execPath, [CHECK_CONFIG_JS], {
      cwd,
      env: validEnv,
      encoding: "utf8",
      timeout: 30_000,
    })
    const okOut = `${ok.stdout}${ok.stderr}`
    check(
      "check-config.js with a valid production env: exit 0 with the OK line",
      ok.status === 0 && okOut.includes("OK : la configuration de production est valide."),
      `exit ${ok.status}`,
    )

    let output = ""
    child.process = spawn(process.execPath, [MAIN_JS], { cwd, env: validEnv })
    child.process.stdout.on("data", (d) => (output += d))
    child.process.stderr.on("data", (d) => (output += d))
    const prodBase = `http://127.0.0.1:${port}/v1`
    let health = null
    for (let i = 0; i < 60 && child.process.exitCode === null; i += 1) {
      try {
        health = await fetch(`${prodBase}/health`)
        break
      } catch {
        await sleep(250)
      }
    }
    check(
      "valid production start: GET /v1/health 200",
      health?.status === 200,
      `status ${health?.status ?? "no answer"}`,
    )
    const token = await api(null, "POST", "/debug/test-token", { email: EMAIL }, {}, prodBase)
    check("production: POST /v1/debug/test-token 404", token.status === 404, String(token.status))
    const cors = await preflight(prodBase, "/health")
    check("production: foreign-origin preflight gets no CORS allow headers", cors.ok, cors.detail)
    check(
      "production start output never echoes a secret",
      !output.includes(dbPassword) && !output.includes(storageSecret),
    )
  } finally {
    if (child.process && child.process.exitCode === null) {
      child.process.kill("SIGTERM")
      await sleep(300)
      if (child.process.exitCode === null) child.process.kill("SIGKILL")
    }
    rmSync(cwd, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------------------------
// deploy-guard
// ---------------------------------------------------------------------------------------------
const CHECK_CALL = "run --rm --no-deps api node api/dist/config/check-config.js"

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

// The compose `run` of the configuration check executes the real check-config.js with the
// compose-mapped env of ENV_FILE (compose-check.mjs); everything else answers from files.
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
        run) exec "$SIM_NODE" "$STUB_DIR/compose-check.mjs" ;;
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

const COMPOSE_CHECK = `import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
const parse = ${parseEnvFile.toString()}
const map = ${composeMappedEnv.toString()}
const env = { PATH: process.env.PATH, ...map(parse(process.env.ENV_FILE)) }
const r = spawnSync(process.execPath, [process.env.SIM_CHECK_CONFIG], { env, stdio: "inherit" })
process.exit(r.status ?? 1)
`

function writeExecutable(file, content) {
  writeFileSync(file, content)
  chmodSync(file, 0o755)
}

function envFixture(overrides) {
  const values = {
    POSTGRES_DB: "cortege",
    POSTGRES_USER: "cortege",
    POSTGRES_PASSWORD: `pg-${randomBytes(10).toString("hex")}`,
    MINIO_ACCESS_KEY: "cortege",
    MINIO_SECRET_KEY: `minio-${randomBytes(10).toString("hex")}`,
    OBJECT_STORAGE_BUCKET: "cortege-media",
    OBJECT_STORAGE_REGION: "us-east-1",
    OBJECT_STORAGE_ENDPOINT: "https://cortege-files.example",
    DEBUG_DATA_RESET_ENABLED: "false",
    CORS_ORIGIN: "none",
    AUTH0_DOMAIN: "sim.eu.auth0.com",
    AUTH0_AUDIENCE: "https://api.sim.example",
    AUTH0_MGMT_CLIENT_ID: "sim-client",
    AUTH0_MGMT_CLIENT_SECRET: `mgmt-${randomBytes(10).toString("hex")}`,
    ...overrides,
  }
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}\n`)
    .join("")
}

function runUpdateStack(root, scenario) {
  const caseDir = mkdtempSync(path.join(root, "case-"))
  const repoDir = path.join(caseDir, "repo")
  const stubDir = path.join(caseDir, "stub")
  const binDir = path.join(caseDir, "bin")
  mkdirSync(path.join(repoDir, ".git"), { recursive: true })
  mkdirSync(path.join(repoDir, "infra", "vps"), { recursive: true })
  mkdirSync(stubDir)
  mkdirSync(binDir)
  // Always a copy: the repository file is never executed.
  copyFileSync(UPDATE_STACK, path.join(repoDir, "infra", "vps", "update-stack.sh"))
  writeFileSync(path.join(stubDir, "before"), `${scenario.before}\n`)
  writeFileSync(path.join(stubDir, "after"), `${scenario.after}\n`)
  writeFileSync(path.join(stubDir, "running"), `${scenario.running}\n`)
  writeFileSync(path.join(stubDir, "calls.log"), "")
  writeFileSync(path.join(stubDir, "compose-check.mjs"), COMPOSE_CHECK)
  if (scenario.replacement)
    writeFileSync(path.join(stubDir, "replacement.sh"), scenario.replacement)
  writeExecutable(path.join(binDir, "git"), GIT_STUB)
  writeExecutable(path.join(binDir, "docker"), DOCKER_STUB)
  writeExecutable(path.join(binDir, "curl"), CURL_STUB)

  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "CORTEGE_UPDATE_STACK_REEXEC") env[key] = value
  }
  Object.assign(env, {
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
    REPO_DIR: repoDir,
    ENV_FILE: scenario.envFile,
    HEALTH_URL: "http://127.0.0.1:1/v1/health",
    STUB_DIR: stubDir,
    SIM_NODE: process.execPath,
    SIM_CHECK_CONFIG: CHECK_CONFIG_JS,
  })
  if (scenario.reexecAlreadySet) env.CORTEGE_UPDATE_STACK_REEXEC = "1"

  const result = spawnSync("bash", ["infra/vps/update-stack.sh"], {
    cwd: repoDir,
    env,
    encoding: "utf8",
    timeout: 60_000,
  })
  const calls = readFileSync(path.join(stubDir, "calls.log"), "utf8").split("\n").filter(Boolean)
  const at = (fragment) => calls.findIndex((c) => c.includes(fragment))
  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls, at }
}

async function phaseDeployGuard() {
  requireBuiltApi()
  const root = mkdtempSync(path.join(os.tmpdir(), "cortege-sim-deploy-"))
  try {
    const valid = path.join(root, "valid.env")
    const emptyCors = path.join(root, "empty-cors.env")
    const placeholderPassword = path.join(root, "placeholder-password.env")
    writeFileSync(valid, envFixture({}))
    writeFileSync(emptyCors, envFixture({ CORS_ORIGIN: "" }))
    writeFileSync(
      placeholderPassword,
      envFixture({ POSTGRES_PASSWORD: "CHANGE_ME_STRONG_PASSWORD" }),
    )

    // 1. check-env.sh (pre-merge, on the VPS) and check-config.js (in the new image) agree.
    const fixtures = [
      { name: "valid", file: valid, expected: 0, variable: null },
      { name: "empty CORS_ORIGIN", file: emptyCors, expected: 1, variable: "CORS_ORIGIN" },
      {
        name: "POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD",
        file: placeholderPassword,
        expected: 1,
        variable: "POSTGRES_PASSWORD",
      },
    ]
    for (const fixture of fixtures) {
      const fileEnv = parseEnvFile(fixture.file)
      const shell = spawnSync("bash", [CHECK_ENV, fixture.file], {
        encoding: "utf8",
        timeout: 30_000,
      })
      const node = spawnSync(process.execPath, [CHECK_CONFIG_JS], {
        cwd: root,
        env: { PATH: process.env.PATH ?? "", ...composeMappedEnv(fileEnv) },
        encoding: "utf8",
        timeout: 30_000,
      })
      const shellOut = `${shell.stdout}${shell.stderr}`
      const nodeOut = `${node.stdout}${node.stderr}`
      const secrets = [fileEnv.MINIO_SECRET_KEY, fileEnv.AUTH0_MGMT_CLIENT_SECRET]
      if (fixture.expected === 0) secrets.push(fileEnv.POSTGRES_PASSWORD)
      check(
        `fixture ${fixture.name}: check-env.sh and check-config.js agree (expected exit ${fixture.expected})`,
        shell.status === fixture.expected && node.status === fixture.expected,
        `check-env ${shell.status}, check-config ${node.status}`,
      )
      if (fixture.variable) {
        check(
          `fixture ${fixture.name}: both name ${fixture.variable}`,
          shellOut.includes(`ERREUR : ${fixture.variable}`) &&
            nodeOut.includes(`ERREUR : ${fixture.variable}`),
        )
      }
      check(
        `fixture ${fixture.name}: no secret value in either output`,
        secrets.every((s) => !shellOut.includes(s) && !nodeOut.includes(s)),
      )
    }

    // 2. update-stack.sh with stub docker/git/curl; the check is the real check-config.js.
    const refused = runUpdateStack(root, {
      before: "img-old",
      after: "img-new",
      running: "img-old",
      envFile: emptyCors,
    })
    check(
      "deploy refused on a bad env file: exit 1, NOT restarted, no up -d",
      refused.status === 1 &&
        refused.output.includes("NOT restarted") &&
        refused.at(CHECK_CALL) >= 0 &&
        refused.at(" up -d") === -1,
      `exit ${refused.status}`,
    )
    check(
      "the refusal reason reaches the journal (script output)",
      refused.output.includes("ERREUR : CORS_ORIGIN"),
    )

    const accepted = runUpdateStack(root, {
      before: "img-old",
      after: "img-new",
      running: "img-old",
      envFile: valid,
    })
    check(
      "deploy accepted on a valid env file: up -d after the check, API healthy",
      accepted.status === 0 &&
        accepted.at(CHECK_CALL) >= 0 &&
        accepted.at(" up -d") > accepted.at(CHECK_CALL) &&
        accepted.output.includes("API healthy"),
      `exit ${accepted.status}`,
    )

    // Retry: the refused run pulled the image, the container still runs the old one.
    const retryEnv = path.join(root, "retry.env")
    writeFileSync(retryEnv, envFixture({ CORS_ORIGIN: "" }))
    const retryRefused = runUpdateStack(root, {
      before: "img-new",
      after: "img-new",
      running: "img-old",
      envFile: retryEnv,
    })
    writeFileSync(retryEnv, envFixture({}))
    const retryFixed = runUpdateStack(root, {
      before: "img-new",
      after: "img-new",
      running: "img-old",
      envFile: retryEnv,
    })
    check(
      "retry: image pulled but not running is checked again and deployed once the env is fixed",
      retryRefused.status === 1 &&
        retryRefused.at(" up -d") === -1 &&
        retryFixed.status === 0 &&
        retryFixed.output.includes("retrying the deploy") &&
        retryFixed.at(CHECK_CALL) >= 0 &&
        retryFixed.at(" up -d") > retryFixed.at(CHECK_CALL),
      `refused exit ${retryRefused.status}, fixed exit ${retryFixed.status}`,
    )

    const upToDate = runUpdateStack(root, {
      before: "img-new",
      after: "img-new",
      running: "img-new",
      envFile: valid,
    })
    check(
      "running image already the latest: nothing to do, no check, no up -d",
      upToDate.status === 0 &&
        upToDate.output.includes("nothing to do") &&
        upToDate.at(CHECK_CALL) === -1 &&
        upToDate.at(" up -d") === -1,
    )

    // Re-exec (D-21): the merge brings a new copy of the script (the real script plus a marker).
    const marker = 'echo "SIM-NEW-COPY reexec=${CORTEGE_UPDATE_STACK_REEXEC:-unset}"'
    const newCopy = readFileSync(UPDATE_STACK, "utf8").replace(
      "set -euo pipefail\n",
      `set -euo pipefail\n${marker}\n`,
    )
    const reexec = runUpdateStack(root, {
      before: "img-old",
      after: "img-new",
      running: "img-old",
      envFile: valid,
      replacement: newCopy,
    })
    const markers = reexec.output.split("\n").filter((l) => l.includes("SIM-NEW-COPY"))
    const reexecLines = reexec.output.split("\n").filter((l) => l.includes("re-executing"))
    check(
      "re-exec: a changed script runs its new copy exactly once, with CORTEGE_UPDATE_STACK_REEXEC=1",
      reexec.status === 0 &&
        reexecLines.length === 1 &&
        markers.length === 1 &&
        markers[0].includes("reexec=1"),
      `exit ${reexec.status}, ${markers.length} new-copy run(s)`,
    )
    check(
      "re-exec: the new copy carries the deploy through (check, then up -d)",
      reexec.at(CHECK_CALL) >= 0 && reexec.at(" up -d") > reexec.at(CHECK_CALL),
    )
    const guarded = runUpdateStack(root, {
      before: "img-new",
      after: "img-new",
      running: "img-new",
      envFile: valid,
      replacement: newCopy,
      reexecAlreadySet: true,
    })
    check(
      "re-exec loop guard: a run started with CORTEGE_UPDATE_STACK_REEXEC=1 does not re-exec",
      guarded.status === 0 &&
        !guarded.output.includes("SIM-NEW-COPY") &&
        !guarded.output.includes("re-executing") &&
        guarded.output.includes("nothing to do"),
      `exit ${guarded.status}`,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------------------------
// production (read-only)
// ---------------------------------------------------------------------------------------------
async function phaseProduction() {
  console.log(`read-only checks against ${BASE}`)
  let r = await api(null, "GET", "/health")
  check("GET /health 200", r.status === 200 && r.json?.status === "ok", String(r.status))
  r = await api(null, "POST", "/debug/test-token", { email: "nobody@example.invalid" })
  check("POST /debug/test-token 404", r.status === 404, String(r.status))
  r = await api(null, "GET", "/surveys")
  check("GET /surveys without a token 401", r.status === 401, String(r.status))
  r = await api(null, "GET", "/public/map-items")
  check(
    "GET /public/map-items 200 with an items array",
    r.status === 200 && Array.isArray(r.json?.items),
    `${r.status}, ${Array.isArray(r.json?.items) ? r.json.items.length + " items" : "no items"}`,
  )
  const cors = await preflight(BASE, "/health")
  check(
    "foreign-origin preflight: no Allow-Origin, no Allow-Credentials true",
    cors.ok,
    cors.detail,
  )
  let files = null
  try {
    files = await fetch(FILES_HEALTH)
  } catch (error) {
    files = { status: `error ${error instanceof Error ? error.message : String(error)}` }
  }
  check(`MinIO health ${FILES_HEALTH} 200`, files.status === 200, String(files.status))
}

const phase = process.argv[2]
const PHASE_NAMES = ["devices", "restart", "config-refusal", "deploy-guard", "production"]

try {
  switch (phase) {
    case "devices":
      await phaseDevices()
      break
    case "restart":
      await phaseRestart()
      break
    case "config-refusal":
      await phaseConfigRefusal()
      break
    case "deploy-guard":
      await phaseDeployGuard()
      break
    case "production":
      await phaseProduction()
      break
    default:
      console.error(`usage: node scripts/owner-check-simulation.mjs <${PHASE_NAMES.join(" | ")}>`)
      process.exit(2)
  }
} catch (error) {
  check(
    `phase ${phase} ran to completion`,
    false,
    error instanceof Error ? error.message : String(error),
  )
}

const failed = results.filter((x) => !x.ok).length
console.log(`\n${phase}: ${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
