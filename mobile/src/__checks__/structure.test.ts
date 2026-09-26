import fs from "fs"
import os from "os"
import path from "path"

type UnusedStyleKey = { file: string; key: string }
type LongFile = { file: string; lines: number }
type Literal = { file: string; line: number; kind: string; text: string }
type StatusLeak = { file: string; line: number; text: string }

type StructureReport = {
  collectFiles: (paths: string[], baseDir: string) => string[]
  findUnusedStyleKeys: (files: string[]) => UnusedStyleKey[]
  findLongFiles: (files: string[], maxLines?: number) => LongFile[]
  findUserFacingLiterals: (files: string[]) => Literal[]
  findStatusIdLeaks: (files: string[]) => StatusLeak[]
}

const report = require("../../scripts/structure-report") as StructureReport

const MOBILE_ROOT = path.resolve(__dirname, "../..")

// Measured 01.9-04 on the pre-phase tree. Counts may only go down. Plan 01.9-29 sets every
// ratchet to 0 (D-04: the unused-key script must report 0).
const BASELINE = {
  unusedStyleKeys: 301,
  longFiles: 10,
  literals: 552,
  statusIdLeaks: 0,
}

let fixtureRoot = ""

function writeFixture(relativePath: string, content: string): string {
  const filePath = path.join(fixtureRoot, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  return filePath
}

function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `// line ${index + 1}`).join("\n") + "\n"
}

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "structure-report-"))
})

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

describe("findUnusedStyleKeys", () => {
  it("reports keys never read and keeps keys read through the binding", () => {
    const file = writeFixture(
      "src/screens/Plain.tsx",
      [
        'import { StyleSheet, View } from "react-native"',
        "export function Plain() {",
        "  return <View style={[styles.a, styles[\"c\"]]} />",
        "}",
        "const styles = StyleSheet.create({ a: {}, b: {}, c: {} })",
      ].join("\n"),
    )

    expect(report.findUnusedStyleKeys([file])).toEqual([{ file, key: "b" }])
  })

  it("treats every key of an object indexed by a variable as used", () => {
    const file = writeFixture(
      "src/ui/Chip.tsx",
      [
        'import { StyleSheet, View } from "react-native"',
        'export function Chip({ tone }: { tone: "info" | "danger" }) {',
        "  return <View style={[styles.base, styles[tone]]} />",
        "}",
        "const styles = StyleSheet.create({ base: {}, info: {}, danger: {} })",
      ].join("\n"),
    )

    expect(report.findUnusedStyleKeys([file])).toEqual([])
  })

  it("counts reads from another file that imports the exported styles", () => {
    const stylesFile = writeFixture(
      "src/screens/Detail.styles.ts",
      [
        'import { StyleSheet } from "react-native"',
        "export const styles = StyleSheet.create({ used: {}, unused: {} })",
      ].join("\n"),
    )
    const screenFile = writeFixture(
      "src/screens/Detail.tsx",
      [
        'import { View } from "react-native"',
        'import { styles as detailStyles } from "./Detail.styles"',
        "export const Detail = () => <View style={detailStyles.used} />",
      ].join("\n"),
    )

    expect(report.findUnusedStyleKeys([stylesFile, screenFile])).toEqual([
      { file: stylesFile, key: "unused" },
    ])
  })
})

describe("findLongFiles", () => {
  it("reports a 401-line screen file and ignores tests and other folders", () => {
    const screen = writeFixture("src/screens/Long.tsx", lines(401))
    const styles = writeFixture("src/screens/Long.styles.ts", lines(401))
    const short = writeFixture("src/navigation/Short.tsx", lines(400))
    const test = writeFixture("src/screens/Long.test.tsx", lines(401))
    const hook = writeFixture("src/hooks/useLong.ts", lines(401))

    expect(report.findLongFiles([screen, styles, short, test, hook])).toEqual([
      { file: screen, lines: 401 },
      { file: styles, lines: 401 },
    ])
  })

  it("honours a custom limit", () => {
    const screen = writeFixture("src/screens/Medium.tsx", lines(20))

    expect(report.findLongFiles([screen], 10)).toEqual([{ file: screen, lines: 20 }])
  })
})

describe("findUserFacingLiterals", () => {
  it("reports object labels and ignores other properties and the catalogue", () => {
    const file = writeFixture(
      "src/screens/Filters.tsx",
      [
        "const n = 3",
        'export const options = [{ label: "Brouillon", value: "draft" }]',
        "export const header = { title: `Relevé ${n}` }",
        'export const plain = { value: "draft" }',
      ].join("\n"),
    )
    const catalogue = writeFixture(
      "src/i18n/fr.ts",
      'export const fr = { filters: { label: "Brouillon", title: "Relevés" } }\n',
    )

    const found = report.findUserFacingLiterals([file, catalogue])

    expect(found.map(({ kind, text, line }) => ({ kind, text, line }))).toEqual([
      { kind: "object-label", text: "Brouillon", line: 2 },
      { kind: "object-label", text: "Relevé ${n}", line: 3 },
    ])
  })

  it("reports JSX text, text props, alerts and status messages", () => {
    const file = writeFixture(
      "src/screens/Screen.tsx",
      [
        'import { Alert, Pressable, Text } from "react-native"',
        "declare function setStatus(message: string): void",
        "export function Screen({ id }: { id: string }) {",
        '  Alert.alert("t", "m", [{ text: "Annuler" }])',
        '  setStatus("Done")',
        "  setStatus(`Loading ${id}`)",
        '  console.log("x")',
        '  if (!id) throw new Error("x")',
        "  return (",
        '    <Pressable accessibilityRole="button">',
        "      <Text>Bonjour</Text>",
        '      <Text title="x">{" - "}</Text>',
        "    </Pressable>",
        "  )",
        "}",
      ].join("\n"),
    )

    const found = report.findUserFacingLiterals([file])

    expect(found.map(({ kind, text, line }) => ({ kind, text, line }))).toEqual([
      { kind: "alert", text: "t", line: 4 },
      { kind: "alert", text: "m", line: 4 },
      { kind: "alert-button", text: "Annuler", line: 4 },
      { kind: "status", text: "Done", line: 5 },
      { kind: "status", text: "Loading ${id}", line: 6 },
      { kind: "jsx-text", text: "Bonjour", line: 11 },
      { kind: "jsx-prop", text: "x", line: 12 },
    ])
  })

  it("reads the message of the three-argument reportStatus form", () => {
    const file = writeFixture(
      "src/hooks/useThing.ts",
      [
        "declare function reportStatus(scope: string, state: string, message: string): void",
        'reportStatus("sync", "error", "Synchronisation impossible")',
      ].join("\n"),
    )

    expect(report.findUserFacingLiterals([file]).map(({ text }) => text)).toEqual([
      "Synchronisation impossible",
    ])
  })
})

describe("findStatusIdLeaks", () => {
  it("flags ids and raw error text, not counts", () => {
    const file = writeFixture(
      "src/hooks/useLeaky.ts",
      [
        "declare function setStatus(message: string): void",
        "declare const surveyId: string",
        "declare const error: unknown",
        "declare const count: number",
        "setStatus(`Survey ${surveyId} opened`)",
        "setStatus(`Init error: ${(error as Error).message}`)",
        "setStatus(`Terminé : ${count}`)",
      ].join("\n"),
    )

    expect(report.findStatusIdLeaks([file]).map(({ line }) => line)).toEqual([5, 6])
  })
})

describe("structure ratchet on mobile/src", () => {
  const files = report.collectFiles(["src"], MOBILE_ROOT)

  it("never exceeds the 01.9-04 baseline", () => {
    const counts = {
      unusedStyleKeys: report.findUnusedStyleKeys(files).length,
      longFiles: report.findLongFiles(files).length,
      literals: report.findUserFacingLiterals(files).length,
      statusIdLeaks: report.findStatusIdLeaks(files).length,
    }
    console.info(`structure counts: ${JSON.stringify(counts)}`)

    expect(counts.unusedStyleKeys).toBeLessThanOrEqual(BASELINE.unusedStyleKeys)
    expect(counts.longFiles).toBeLessThanOrEqual(BASELINE.longFiles)
    expect(counts.literals).toBeLessThanOrEqual(BASELINE.literals)
    expect(counts.statusIdLeaks).toBeLessThanOrEqual(BASELINE.statusIdLeaks)
  })
})
