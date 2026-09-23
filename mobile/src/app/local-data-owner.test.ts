import {
  formatUnsyncedWorkSummary,
  hasUnsyncedWork,
  resolveLocalDataOwnership,
} from "./local-data-owner"

describe("hasUnsyncedWork", () => {
  test("returns false when both counts are zero", () => {
    expect(hasUnsyncedWork({ surveys: 0, attachments: 0 })).toBe(false)
  })

  test("returns true when surveys count is positive", () => {
    expect(hasUnsyncedWork({ surveys: 1, attachments: 0 })).toBe(true)
  })

  test("returns true when attachments count is positive", () => {
    expect(hasUnsyncedWork({ surveys: 0, attachments: 1 })).toBe(true)
  })
})

describe("formatUnsyncedWorkSummary", () => {
  test("singular survey", () => {
    expect(formatUnsyncedWorkSummary({ surveys: 1, attachments: 0 })).toBe("1 relevé")
  })

  test("plural surveys", () => {
    expect(formatUnsyncedWorkSummary({ surveys: 3, attachments: 0 })).toBe("3 relevés")
  })

  test("singular photo", () => {
    expect(formatUnsyncedWorkSummary({ surveys: 0, attachments: 1 })).toBe("1 photo")
  })

  test("surveys and attachments combined", () => {
    expect(formatUnsyncedWorkSummary({ surveys: 2, attachments: 5 })).toBe("2 relevés et 5 photos")
  })

  test("nothing unsynced", () => {
    expect(formatUnsyncedWorkSummary({ surveys: 0, attachments: 0 })).toBe("aucune donnée")
  })
})

describe("resolveLocalDataOwnership", () => {
  test("no session (logged out) -> unknown-session, storedOwnerSub present", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: "auth0|a",
        sessionSub: null,
        unsynced: { surveys: 0, attachments: 0 },
      }),
    ).toBe("unknown-session")
  })

  test("no session (logged out) -> unknown-session, storedOwnerSub null", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: null,
        sessionSub: null,
        unsynced: { surveys: 1, attachments: 0 },
      }),
    ).toBe("unknown-session")
  })

  test("no stored owner, session present -> adopt", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: null,
        sessionSub: "auth0|a",
        unsynced: { surveys: 0, attachments: 0 },
      }),
    ).toBe("adopt")
  })

  test("no stored owner, session present, unsynced work -> adopt", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: null,
        sessionSub: "auth0|a",
        unsynced: { surveys: 2, attachments: 1 },
      }),
    ).toBe("adopt")
  })

  test("stored owner matches session, no unsynced work -> match", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: "auth0|a",
        sessionSub: "auth0|a",
        unsynced: { surveys: 0, attachments: 0 },
      }),
    ).toBe("match")
  })

  test("stored owner matches session, unsynced work -> match", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: "auth0|a",
        sessionSub: "auth0|a",
        unsynced: { surveys: 3, attachments: 0 },
      }),
    ).toBe("match")
  })

  test("stored owner differs, unsynced work exists -> conflict", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: "auth0|a",
        sessionSub: "auth0|b",
        unsynced: { surveys: 2, attachments: 1 },
      }),
    ).toBe("conflict")
  })

  test("stored owner differs, no unsynced work -> purge-and-adopt", () => {
    expect(
      resolveLocalDataOwnership({
        storedOwnerSub: "auth0|a",
        sessionSub: "auth0|b",
        unsynced: { surveys: 0, attachments: 0 },
      }),
    ).toBe("purge-and-adopt")
  })
})
