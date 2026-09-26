// Phase 01.6 owner-check simulation: two "devices" on one account against the built API
// running in MinIO mode. Usage: node verify16.mjs phase1 | phase2
import { readFileSync, writeFileSync } from "node:fs"

const BASE = "http://localhost:3100/v1"
const STATE = "/tmp/claude-0/-home-user-cortege/2b3789f4-1097-5c7e-920c-66fb05f3a881/scratchpad/verify16-state.json"
const results = []
const check = (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`)
}

async function api(token, method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
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
  } catch {}
  return { status: res.status, json, text, res }
}

async function login(email) {
  const r = await api(null, "POST", "/debug/test-token", { email })
  return r.json.access_token
}

// Minimal valid 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

const phase = process.argv[2]
const email = "owner-check-16@ibp.local"

if (phase === "phase1") {
  const tokenA = await login(email) // device A
  const tokenB = await login(email) // device B, same account
  const surveyId = `survey-${Date.now()}`
  const base = {
    id: surveyId,
    status: "draft",
    visibility: "private",
    factors: {},
    scores: {},
    location: { source: "gps", lat: 48.643, lng: 1.829 },
  }

  // Device A creates the survey through /sync (what the app does)
  let r = await api(tokenA, "POST", "/sync", {
    operations: [
      { client_ref: "a1", entity: "survey", action: "upsert", payload: { ...base, sync_version: 1, site_name: "Forêt A" } },
    ],
  })
  check("A: create survey via /sync", r.status === 200 && r.json.results[0].status === "synced", r.json?.results?.[0]?.status)

  // Device B first pull: gets the survey and a v2 cursor
  r = await api(tokenB, "GET", "/sync/changes?limit=100")
  const b1 = r.json
  check("B: first pull sees the survey", r.status === 200 && b1.surveys.some((s) => s.id === surveyId && s.site_name === "Forêt A"))
  check("B: cursor is v2 format", /^v2:\d+:\d+$/.test(b1.cursor_out ?? ""), b1.cursor_out)

  // Device A edits the site name (version bump), as in step 3 of the owner check
  r = await api(tokenA, "POST", "/sync", {
    operations: [
      { client_ref: "a2", entity: "survey", action: "upsert", payload: { ...base, sync_version: 2, site_name: "Forêt A (renommée)" } },
    ],
  })
  check("A: rename syncs", r.status === 200 && r.json.results[0].status === "synced")

  // Device B pulls from its cursor: sees the new name, no error
  r = await api(tokenB, "GET", `/sync/changes?limit=100&cursor=${encodeURIComponent(b1.cursor_out)}`)
  check(
    "B: incremental pull shows the new name",
    r.status === 200 && r.json.surveys.some((s) => s.id === surveyId && s.site_name === "Forêt A (renommée)"),
  )
  const b2cursor = r.json.cursor_out
  r = await api(tokenB, "GET", `/sync/changes?limit=100&cursor=${encodeURIComponent(b2cursor)}`)
  check("B: next pull is empty (nothing re-sent)", r.status === 200 && r.json.events.length === 0 && r.json.surveys.length === 0)

  // Installed-app compatibility: a legacy cursor is still accepted
  r = await api(tokenB, "GET", `/sync/changes?limit=100&cursor=${encodeURIComponent("2026-01-01 00:00:00+00|x")}`)
  check("B: legacy cursor accepted, answered with v2", r.status === 200 && /^v2:/.test(r.json.cursor_out ?? ""))

  // Same-version retry with only visibility changed is applied (D-16 amended)
  r = await api(tokenA, "POST", "/sync", {
    operations: [
      { client_ref: "a3", entity: "survey", action: "upsert", payload: { ...base, sync_version: 2, site_name: "Forêt A (renommée)", visibility: "public" } },
    ],
  })
  check("A: same-version visibility-only retry is synced", r.json.results[0].status === "synced")
  // Same version, different content: conflict, not silent overwrite
  r = await api(tokenB, "POST", "/sync", {
    operations: [
      { client_ref: "b1", entity: "survey", action: "upsert", payload: { ...base, sync_version: 2, site_name: "Autre nom", visibility: "public" } },
    ],
  })
  check("B: same-version different content → sync_version_conflict", r.json.results[0].status === "fatal_error" && r.json.results[0].error?.code === "sync_version_conflict")

  // Step 4: device A adds a photo to the draft (presigned PUT to MinIO, then confirm)
  const photo = Buffer.alloc(2048, 7)
  r = await api(tokenA, "POST", `/surveys/${surveyId}/attachments`, { mime_type: "image/jpeg", size_bytes: photo.length })
  const att = r.json
  check("A: attachment created with presigned URL", r.status === 201 && String(att.upload_url).startsWith("http"))
  const put = await fetch(att.upload_url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo })
  check("A: photo uploaded to MinIO", put.ok, String(put.status))
  r = await api(tokenA, "PUT", att.confirm_url)
  check("A: upload confirmed", r.status === 200 && typeof r.json.uploaded_at === "string")
  // The app reads photos through download-url (presigned GET in MinIO mode)
  r = await api(tokenB, "GET", `/surveys/${surveyId}/attachments/${att.attachment_id}/download-url`)
  const got = r.status === 200 ? Buffer.from(await (await fetch(r.json.url)).arrayBuffer()) : null
  check("B: photo downloadable, same bytes", !!got && got.equals(photo))

  // A lying size is refused by MinIO (signed Content-Length)
  r = await api(tokenA, "POST", `/surveys/${surveyId}/attachments`, { mime_type: "image/jpeg", size_bytes: 500000 })
  const bad = await fetch(r.json.upload_url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo })
  check("wrong declared size is refused by storage", bad.status === 403, String(bad.status))

  // Step 5: profile picture upload and display
  const form = new FormData()
  form.append("file", new Blob([PNG], { type: "image/png" }), "avatar.png")
  r = await api(tokenA, "PUT", "/me/profile-picture", form)
  check("A: profile picture uploaded", r.status >= 200 && r.status < 300, String(r.status))
  r = await api(tokenA, "GET", "/me")
  check("A: /me shows a picture URL", r.status === 200 && !!r.json.profile_picture_url)
  r = await api(tokenA, "GET", "/me/profile-picture")
  check("A: picture bytes served", r.status === 200 && r.res.headers.get("content-type")?.startsWith("image/png"))

  writeFileSync(STATE, JSON.stringify({ surveyId, attachmentId: att.attachment_id }))
} else if (phase === "phase2") {
  // Step 6: after an API restart, everything is still there
  const { surveyId, attachmentId } = JSON.parse(readFileSync(STATE, "utf8"))
  const token = await login(email)
  let r = await api(token, "GET", "/me")
  check("after restart: /me still has the picture", r.status === 200 && !!r.json.profile_picture_url)
  r = await api(token, "GET", "/me/profile-picture")
  check("after restart: picture bytes still served", r.status === 200 && r.res.headers.get("content-type")?.startsWith("image/png"))
  r = await api(token, "GET", `/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
  const got = r.status === 200 ? await fetch(r.json.url) : null
  check("after restart: survey photo still downloadable", !!got && got.ok)
} else {
  console.error("usage: phase1 | phase2")
  process.exit(2)
}

const failed = results.filter((x) => !x.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
