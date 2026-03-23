#!/usr/bin/env node
/**
 * Sync Notion EPICs & User Stories to docs/specs/
 *
 * Usage: NOTION_TOKEN=... node scripts/sync-notion.mjs
 */

import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = join(ROOT, "docs", "specs")

const TOKEN = process.env.NOTION_TOKEN
const DATABASE_ID = "3243fb182ac68095b4ade58d48b78478"

if (!TOKEN) {
  console.error("Missing NOTION_TOKEN environment variable")
  process.exit(1)
}

// ── Notion API helpers ───────────────────────────────────────────────────────

async function notionFetch(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Notion API error ${res.status}: ${body}`)
  }
  return res.json()
}

async function queryDatabase(databaseId) {
  const items = []
  let cursor = undefined

  do {
    const body = cursor ? { start_cursor: cursor } : {}
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ ...body, page_size: 100 }),
    })
    items.push(...data.results)
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return items
}

async function getPageBlocks(pageId) {
  const blocks = []
  let cursor = undefined

  do {
    const params = cursor ? `?start_cursor=${cursor}` : ""
    const data = await notionFetch(`/blocks/${pageId}/children${params}`)
    blocks.push(...data.results)
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return blocks
}

// ── Markdown helpers ─────────────────────────────────────────────────────────

function richTextToMd(richText) {
  return (richText ?? []).map((t) => t.plain_text).join("")
}

function blocksToMd(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return richTextToMd(block.paragraph.rich_text)
        case "heading_1":
          return `# ${richTextToMd(block.heading_1.rich_text)}`
        case "heading_2":
          return `## ${richTextToMd(block.heading_2.rich_text)}`
        case "heading_3":
          return `### ${richTextToMd(block.heading_3.rich_text)}`
        case "bulleted_list_item":
          return `- ${richTextToMd(block.bulleted_list_item.rich_text)}`
        case "numbered_list_item":
          return `1. ${richTextToMd(block.numbered_list_item.rich_text)}`
        case "quote":
          return `> ${richTextToMd(block.quote.rich_text)}`
        case "code":
          return `\`\`\`\n${richTextToMd(block.code.rich_text)}\n\`\`\``
        case "divider":
          return "---"
        default:
          return ""
      }
    })
    .filter(Boolean)
    .join("\n\n")
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[àâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function extractProperty(page, key) {
  const prop = page.properties[key]
  if (!prop) return null
  switch (prop.type) {
    case "title":
      return richTextToMd(prop.title)
    case "rich_text":
      return richTextToMd(prop.rich_text)
    case "select":
      return prop.select?.name ?? null
    case "relation":
      return prop.relation?.[0]?.id ?? null
    default:
      return null
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching EPICs & User Stories from Notion...")
  const pages = await queryDatabase(DATABASE_ID)

  // Separate EPICs (no parent) from User Stories (has parent)
  const epics = pages.filter((p) => !extractProperty(p, "Parent item"))
  const stories = pages.filter((p) => extractProperty(p, "Parent item"))

  console.log(`Found ${epics.length} EPICs and ${stories.length} User Stories`)

  mkdirSync(OUT_DIR, { recursive: true })

  // Clear existing spec files
  try {
    for (const f of readdirSync(OUT_DIR)) {
      if (f.endsWith(".md")) unlinkSync(join(OUT_DIR, f))
    }
  } catch {}

  // Generate one markdown file per EPIC
  for (const epic of epics) {
    const epicName = extractProperty(epic, "Name") ?? "Untitled"
    const epicRelease = extractProperty(epic, "Release") ?? ""

    console.log(`  Processing: ${epicName}`)

    // Fetch EPIC body
    const epicBlocks = await getPageBlocks(epic.id)
    const epicBody = blocksToMd(epicBlocks)

    // Find User Stories for this EPIC
    const epicStories = stories
      .filter((s) => extractProperty(s, "Parent item") === epic.id)
      .sort((a, b) => {
        const na = extractProperty(a, "Name") ?? ""
        const nb = extractProperty(b, "Name") ?? ""
        return na.localeCompare(nb)
      })

    let md = `# ${epicName}\n\n`
    if (epicRelease) md += `**Release:** ${epicRelease}\n\n`
    if (epicBody) md += `${epicBody}\n\n`

    if (epicStories.length > 0) {
      md += `---\n\n## User Stories\n\n`

      for (const story of epicStories) {
        const storyName = extractProperty(story, "Name") ?? "Untitled"
        const storyRelease = extractProperty(story, "Release") ?? ""
        const storyDesc = extractProperty(story, "Description") ?? ""

        md += `### ${storyName}\n\n`
        if (storyRelease) md += `**Release:** ${storyRelease}\n\n`
        if (storyDesc) md += `${storyDesc}\n\n`

        // Fetch US body blocks
        const storyBlocks = await getPageBlocks(story.id)
        const storyBody = blocksToMd(storyBlocks)
        if (storyBody) md += `${storyBody}\n\n`
      }
    }

    const filename = `${slugify(epicName)}.md`
    writeFileSync(join(OUT_DIR, filename), md.trimEnd() + "\n")
    console.log(`    → docs/specs/${filename}`)
  }

  // Write index
  const index = epics
    .map((e) => {
      const name = extractProperty(e, "Name") ?? "Untitled"
      const release = extractProperty(e, "Release") ?? ""
      const slug = slugify(name)
      const count = stories.filter(
        (s) => extractProperty(s, "Parent item") === e.id,
      ).length
      return `- [${name}](${slug}.md) — ${count} US${release ? ` *(${release})*` : ""}`
    })
    .join("\n")

  writeFileSync(
    join(OUT_DIR, "README.md"),
    `# IBP Specifications\n\nAuto-generated from Notion. Do not edit manually.\n\n${index}\n`,
  )

  console.log(`\nDone. ${epics.length} files written to docs/specs/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
