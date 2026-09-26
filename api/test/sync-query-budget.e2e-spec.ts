import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { Client } from "pg"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"

// D-09 query budget, written before any sync-path change. Every pg statement goes through
// Client.prototype.query (pool queries and the transaction adapter alike), so spying on it
// around one POST /v1/sync counts the statements of a 100-operation upsert batch, including
// the one auth lookup of the request.
// Baseline measured 2026-09-25 before phase 01.7 (RESEARCH Pattern 4).
const BASELINE = {
  creates1: 1001,
  updates1: 901,
  creates3: 1301,
  updates3: 1101,
} as const
type BudgetCase = keyof typeof BASELINE

// D-09 / ROADMAP criterion 4: a 100-operation batch issues at least three times fewer
// statements than the baseline (333 / 300 / 433 / 367).
const budgetLimit = (budgetCase: BudgetCase): number => Math.floor(BASELINE[budgetCase] / 3)

const BATCH_SIZE = 100

type SyncResult = { client_ref: string; status: string }

describe("Sync query budget (e2e)", () => {
  let app: NestExpressApplication
  let accessToken: string

  // Distinct per run, so a re-run on the same database never reuses a survey or parcel id.
  const runToken =
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

  const surveyId = (parcelsPerSurvey: number, index: number) =>
    `qb-${runToken}-p${parcelsPerSurvey}-${index}`
  // The first parcel of every survey is shared by index across the 1- and 3-parcel sets, so a
  // 3-parcel create meets one parcel that already exists and creates two. That is the mix the
  // RESEARCH baseline measured (1 301); three brand-new parcels per op would cost 1 401.
  const parcelIds = (parcelsPerSurvey: number, index: number) =>
    Array.from({ length: parcelsPerSurvey }, (_, k) => `QB${runToken}S${index}K${k}`)

  const upsertBatch = (parcelsPerSurvey: number, syncVersion: number) =>
    Array.from({ length: BATCH_SIZE }, (_, index) => ({
      client_ref: `op-${index}`,
      entity: "survey",
      action: "upsert",
      payload: {
        id: surveyId(parcelsPerSurvey, index),
        sync_version: syncVersion,
        site_name: `Query Budget Forest ${index} v${syncVersion}`,
        status: "draft",
        visibility: "private",
        parcel_ids: parcelIds(parcelsPerSurvey, index),
        factors: {},
        scores: {},
      },
    }))

  const countSyncStatements = async (
    budgetCase: BudgetCase,
    operations: ReturnType<typeof upsertBatch>,
  ): Promise<number> => {
    const spy = jest.spyOn(Client.prototype, "query")
    let count: number
    let results: SyncResult[]
    try {
      const response = await request(app.getHttpServer())
        .post("/v1/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ operations })
        .expect(200)
      count = spy.mock.calls.length
      results = response.body.results as SyncResult[]
    } finally {
      spy.mockRestore()
    }

    process.stdout.write(`query-budget ${budgetCase}: ${count}\n`)
    expect(results).toHaveLength(BATCH_SIZE)
    expect(results.filter((result) => result.status !== "synced")).toEqual([])
    return count
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()

    const response = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: `e2e-query-budget-${runToken.toLowerCase()}@ibp.local` })
      .expect(201)
    accessToken = response.body.access_token as string
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("100 creates with 1 parcel each stay within a third of the baseline", async () => {
    const count = await countSyncStatements("creates1", upsertBatch(1, 1))
    expect(count).toBeLessThanOrEqual(budgetLimit("creates1"))
  })

  it("100 updates with the same 1 parcel stay within a third of the baseline", async () => {
    const count = await countSyncStatements("updates1", upsertBatch(1, 2))
    expect(count).toBeLessThanOrEqual(budgetLimit("updates1"))
  })

  it("100 creates with 3 parcels each stay within a third of the baseline", async () => {
    const count = await countSyncStatements("creates3", upsertBatch(3, 1))
    expect(count).toBeLessThanOrEqual(budgetLimit("creates3"))
  })

  it("100 updates with the same 3 parcels stay within a third of the baseline", async () => {
    const count = await countSyncStatements("updates3", upsertBatch(3, 2))
    expect(count).toBeLessThanOrEqual(budgetLimit("updates3"))
  })

  // D-10: ensureParcelIds registers any number of parcels in one statement, so the statement
  // count of one create does not depend on how many (brand-new) parcels it links.
  it("parcel ids are written in one statement: 50 parcels cost the same as 1", async () => {
    const countSingleCreate = async (label: string, parcelCount: number): Promise<number> => {
      const id = `qb-${runToken}-wide-${parcelCount}`
      const operations = [
        {
          client_ref: `op-${label}`,
          entity: "survey",
          action: "upsert",
          payload: {
            id,
            sync_version: 1,
            site_name: `Query Budget Wide ${parcelCount}`,
            status: "draft",
            visibility: "private",
            parcel_ids: Array.from(
              { length: parcelCount },
              (_, k) => `QB${runToken}W${parcelCount}K${k}`,
            ),
            factors: {},
            scores: {},
          },
        },
      ]
      const spy = jest.spyOn(Client.prototype, "query")
      let count: number
      let results: SyncResult[]
      try {
        const response = await request(app.getHttpServer())
          .post("/v1/sync")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ operations })
          .expect(200)
        count = spy.mock.calls.length
        results = response.body.results as SyncResult[]
      } finally {
        spy.mockRestore()
      }

      process.stdout.write(`query-budget ${label}: ${count}\n`)
      expect(results).toEqual([expect.objectContaining({ status: "synced" })])
      return count
    }

    const oneParcel = await countSingleCreate("create-1-parcel", 1)
    const fiftyParcels = await countSingleCreate("create-50-parcels", 50)
    expect(fiftyParcels).toBe(oneParcel)

    const linked = await request(app.getHttpServer())
      .get(`/v1/surveys/qb-${runToken}-wide-50`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    expect(linked.body.parcel_ids).toHaveLength(50)
  })
})
