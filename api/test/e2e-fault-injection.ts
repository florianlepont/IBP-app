import { Queryable } from "../src/database/database.service"

// D-15: once writes run on a transaction client, a spy on DatabaseService.query
// cannot observe them. This module installs a temporary PostgreSQL trigger on
// survey_events instead, scoped to one survey (and optionally one event type),
// so E2E specs can prove that an injected failure on the event insert leaves
// nothing else committed. Test-only: lives under api/test, never imported from
// api/src, and only ever runs against a *_test database (guarded by
// api/test/global-setup.js / assertResettableDatabase).

const TRIGGER_NAME = "e2e_fail_event_insert"
const FUNCTION_NAME = "e2e_fail_event_insert_fn"

// DDL cannot use bind parameters, so identifiers/values are inlined as quoted
// literals below. Restrict the accepted characters to prevent SQL injection
// through this test helper (T-01.4-05).
const SAFE_VALUE_PATTERN = /^[A-Za-z0-9_.:-]+$/

function assertSafeValue(label: string, value: string): void {
  if (!SAFE_VALUE_PATTERN.test(value)) {
    throw new Error(`${label} contains characters outside [A-Za-z0-9_.:-]: ${value}`)
  }
}

export async function installEventInsertFailure(
  db: Queryable,
  options: { surveyId: string; eventType?: string },
): Promise<void> {
  assertSafeValue("surveyId", options.surveyId)
  if (options.eventType !== undefined) {
    assertSafeValue("eventType", options.eventType)
  }

  const surveyIdLiteral = options.surveyId.replace(/'/g, "''")
  const whenClauseParts = [`NEW.survey_id = '${surveyIdLiteral}'`]
  if (options.eventType !== undefined) {
    const eventTypeLiteral = options.eventType.replace(/'/g, "''")
    whenClauseParts.push(`NEW.event_type = '${eventTypeLiteral}'`)
  }
  const whenClause = whenClauseParts.join(" AND ")

  await db.query(
    `CREATE OR REPLACE FUNCTION ${FUNCTION_NAME}() RETURNS trigger AS $$
     BEGIN
       RAISE EXCEPTION 'e2e injected event failure' USING ERRCODE = 'P0001';
     END;
     $$ LANGUAGE plpgsql`,
  )

  // Only one injected trigger exists at a time: DROP before CREATE so a second
  // installEventInsertFailure call replaces the previous scope rather than
  // stacking triggers.
  await db.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON survey_events`)

  await db.query(
    `CREATE TRIGGER ${TRIGGER_NAME}
     BEFORE INSERT ON survey_events
     FOR EACH ROW
     WHEN (${whenClause})
     EXECUTE FUNCTION ${FUNCTION_NAME}()`,
  )
}

export async function removeEventInsertFailures(db: Queryable): Promise<void> {
  await db.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON survey_events`)
  await db.query(`DROP FUNCTION IF EXISTS ${FUNCTION_NAME}()`)
}
