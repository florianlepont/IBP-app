import { shouldShowDevTools } from "../app/dev-tools"
import { fr, logStatusDetail, statusText } from "./index"
import type { Catalog } from "./index"

jest.mock("../app/dev-tools", () => ({
  shouldShowDevTools: jest.fn(() => false),
}))

const mockedShouldShowDevTools = shouldShowDevTools as jest.MockedFunction<
  typeof shouldShowDevTools
>

const ID_PATTERNS: RegExp[] = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /survey-\d+/i,
  /\b[0-9a-f]{8,}\b/,
]

const SAMPLE_NAME = "Parcelle du Bois"
const SAMPLE_COUNT = 2
const COUNT_KEY = /count|total|synced|failed|n$/i

// Stands in for any parameter object: counts get a number, everything else a
// human name. Converting the proxy itself to text also yields the name, so an
// entry that takes a bare string parameter is exercised too.
const sampleArgument: unknown = new Proxy(
  {},
  {
    get: (_target, key) => {
      if (key === Symbol.toPrimitive || key === "toString" || key === "valueOf") {
        return () => SAMPLE_NAME
      }
      if (typeof key === "string" && COUNT_KEY.test(key)) return SAMPLE_COUNT
      return SAMPLE_NAME
    },
  },
)

type Leaf = { path: string; value: unknown }

const collectLeaves = (node: unknown, path: string, into: Leaf[]): Leaf[] => {
  if (node !== null && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      collectLeaves(child, path ? `${path}.${key}` : key, into)
    }
    return into
  }
  into.push({ path, value: node })
  return into
}

const expectUserFacing = (path: string, text: unknown) => {
  expect({ path, type: typeof text }).toEqual({ path, type: "string" })
  const value = text as string
  expect({ path, empty: value.trim().length === 0 }).toEqual({ path, empty: false })
  for (const pattern of ID_PATTERNS) {
    expect({ path, idLike: pattern.test(value) }).toEqual({ path, idLike: false })
  }
}

describe("French catalogue", () => {
  const leaves = collectLeaves(fr, "", [])

  test("exposes every section so owning plans fill their own file", () => {
    expect(Object.keys(fr).sort()).toEqual(
      [
        "account",
        "authGate",
        "common",
        "components",
        "factorDetail",
        "home",
        "labels",
        "navigation",
        "ownerConflict",
        "parcelSelection",
        "profileSetup",
        "publicMap",
        "settings",
        "status",
        "surveyDetail",
        "surveyForm",
        "surveyList",
        "syncErrors",
        "validation",
      ].sort(),
    )
    expect(Object.keys(fr.status).sort()).toEqual(
      [
        "app",
        "debug",
        "editing",
        "gps",
        "map",
        "owner",
        "profile",
        "session",
        "surveyOps",
        "sync",
      ].sort(),
    )
  })

  test("every text entry is non-empty and carries no id", () => {
    const texts = leaves.filter((leaf) => typeof leaf.value !== "function")
    expect(texts.length).toBeGreaterThan(0)
    for (const leaf of texts) expectUserFacing(leaf.path, leaf.value)
  })

  test("every function entry returns non-empty text with no id", () => {
    const functions = leaves.filter((leaf) => typeof leaf.value === "function")
    for (const leaf of functions) {
      const render = leaf.value as (argument: unknown) => unknown
      expectUserFacing(leaf.path, render(sampleArgument))
    }
  })

  test("the sample argument yields counts for count keys and names otherwise", () => {
    const probe = sampleArgument as Record<string, unknown>
    expect(probe.failed).toBe(SAMPLE_COUNT)
    expect(probe.siteName).toBe(SAMPLE_NAME)
    expect(`${String(sampleArgument)}`).toBe(SAMPLE_NAME)
  })

  test("common holds the untitled survey label", () => {
    expect(fr.common.untitledSurvey).toBe("Relevé sans titre")
  })

  test("the French catalogue satisfies the widened Catalog type", () => {
    // A second language would be typed the same way; this line fails to compile
    // if Widen stops matching the catalogue shape.
    const widened: Catalog = fr
    expect(widened.common.actions.cancel).toBe("Annuler")
  })
})

describe("status messages", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    mockedShouldShowDevTools.mockReturnValue(false)
  })

  test("statusText keeps the text unchanged at runtime", () => {
    expect(statusText("x")).toBe("x")
  })

  test("logStatusDetail stays silent outside dev tools", () => {
    const debug = jest.spyOn(console, "debug").mockImplementation(() => undefined)
    mockedShouldShowDevTools.mockReturnValue(false)
    logStatusDetail("sync", new Error("HTTP 503"))
    expect(debug).not.toHaveBeenCalled()
  })

  test("logStatusDetail logs the context and detail with dev tools", () => {
    const debug = jest.spyOn(console, "debug").mockImplementation(() => undefined)
    mockedShouldShowDevTools.mockReturnValue(true)
    const detail = new Error("HTTP 503")
    logStatusDetail("sync", detail)
    expect(debug).toHaveBeenCalledWith("[status] sync", detail)
  })
})
