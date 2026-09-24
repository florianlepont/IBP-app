const fs = require("fs")
const path = require("path")

const METRICS = ["statements", "branches", "functions", "lines"]

// Groups every file in a Jest coverage-summary.json by its first directory
// under "<workspaceDir>/src/" and returns floor-rounded per-directory and
// "global" (remainder) coverage percentages for each metric.
//
// - Files directly under "<workspaceDir>/src/" (no subdirectory) or outside
//   "<workspaceDir>/src/" entirely are counted in "global".
// - The "total" key of the summary is ignored.
// - A metric whose summed total is 0 in a group is omitted from that group.
// - Percentages are always floored, never rounded up.
function computeThresholds(summary, workspaceDir) {
  const srcPrefix = `${workspaceDir.replace(/\/+$/, "")}/src/`
  const sums = {}

  const addTo = (groupKey, fileMetrics) => {
    if (!sums[groupKey]) {
      sums[groupKey] = {}
      for (const metric of METRICS) {
        sums[groupKey][metric] = { covered: 0, total: 0 }
      }
    }
    for (const metric of METRICS) {
      const entry = fileMetrics[metric]
      if (!entry) continue
      sums[groupKey][metric].covered += entry.covered
      sums[groupKey][metric].total += entry.total
    }
  }

  for (const [filePath, fileMetrics] of Object.entries(summary)) {
    if (filePath === "total") continue

    let groupKey = "global"
    if (filePath.startsWith(srcPrefix)) {
      const rest = filePath.slice(srcPrefix.length)
      const slashIndex = rest.indexOf("/")
      if (slashIndex !== -1) {
        const dir = rest.slice(0, slashIndex)
        groupKey = `./src/${dir}/`
      }
    }

    addTo(groupKey, fileMetrics)
  }

  const result = {}
  const groupKeys = Object.keys(sums)
    .filter((key) => key !== "global")
    .sort()
  const orderedKeys = sums.global ? ["global", ...groupKeys] : groupKeys

  for (const groupKey of orderedKeys) {
    const metrics = sums[groupKey]
    const entry = {}
    for (const metric of METRICS) {
      const { covered, total } = metrics[metric]
      if (total === 0) continue
      entry[metric] = Math.floor((covered / total) * 100)
    }
    result[groupKey] = entry
  }

  return result
}

function main() {
  const workspaceDir = process.argv[2]
  if (!workspaceDir) {
    console.error("Usage: node scripts/coverage-by-directory.js <workspace-dir>")
    process.exit(1)
  }

  const summaryPath = path.join(workspaceDir, "coverage", "unit", "coverage-summary.json")
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  const thresholds = computeThresholds(summary, path.resolve(workspaceDir))

  console.log(JSON.stringify(thresholds, null, 2))
}

module.exports = { computeThresholds }

if (require.main === module) {
  main()
}
