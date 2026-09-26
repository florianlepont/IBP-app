// EXPLAIN reproduction of the two public map queries and the three paginated lists on 10 000
// surveys (01.7 D-11, D-13, D-15).
//
// Usage (from the repo root, against a *_test database only):
//   npm --workspace api run build
//   POSTGRES_DB=ibp_test node api/scripts/explain-public-routes.js
//
// Everything runs in one transaction on one client: seed 200 users, 8 000 parcels with random
// centroids in France (plus 200 parcels registered by id, with an empty centroid), 10 000
// surveys (4 000 submitted, 2 000 of them public, 1 000+ owned by one busy user), 1-3 parcel
// links per survey, 30 000 survey events (1 000 of them on one busy survey) and 20 000 reports
// over 20 days; ANALYZE; then EXPLAIN (ANALYZE, BUFFERS) of the pre-01.7 public queries
// ("before"), of the queries the API runs now ("after"), and of the first page (limit 50) and a
// middle page (cursor taken from row 500) of each paginated list; then ROLLBACK, so the
// database is left as it was (ANALYZE included).
// The database name must end in _test (assertResettableDatabase), and the seed never commits.
const path = require('path');
const { Client } = require('pg');
const { resolveDbConfig, assertResettableDatabase } = require('../test/e2e-env.js');

const DIST = path.resolve(__dirname, '../dist');
const COMPILED_QUERIES = path.join(DIST, 'surveys/public-map.queries.js');
// D-11: the list query builders, compiled.
const COMPILED_LIST_MODULES = [
  path.join(DIST, 'surveys/surveys.repository.js'),
  path.join(DIST, 'surveys/survey-events.service.js'),
  path.join(DIST, 'reports/reports.service.js'),
];

// A 1 degree square around Paris: a generous map viewport (the app asks at zoom >= 15, a few
// km wide). The seeded centroids spread over 42-51 N and 4 W-8 E, so it holds about 70 parcels.
const EXPLAIN_BBOX = { minLng: 2, maxLng: 3, minLat: 48, maxLat: 49 };

// Every EXPLAIN runs this many times; the summary reports the median execution time.
const EXPLAIN_RUNS = 3;

const SEEDED_USERS = 200;
const SEEDED_PARCELS = 8000;
const SEEDED_EMPTY_CENTROID_PARCELS = 200;
const SEEDED_SURVEYS = 10000;
const SEEDED_EVENTS = 30000;
const SEEDED_REPORTS = 20000;

// D-11: the list EXPLAINs page like a client would: a first page of LIST_PAGE_LIMIT rows, then
// the page after row LIST_MIDDLE_ROW of the unpaginated order.
const LIST_PAGE_LIMIT = 50;
const LIST_MIDDLE_ROW = 500;
// Every 10th survey belongs to explain-u1, and the first 1 000 events go to explain-s1.
const BUSY_USER_EMAIL = 'explain-u1@example.test';
const BUSY_SURVEY_ID = 'explain-s1';

const SEQ_SCAN_PATTERN = /Seq Scan on (surveys|parcels|survey_parcels|survey_events|reports)\b/g;
const WATCHED_RELATIONS = ['surveys', 'parcels', 'survey_parcels', 'survey_events', 'reports'];

// ---------------------------------------------------------------------------------------------
// Pre-01.7 SQL, copied verbatim from api/src/surveys/surveys.service.ts at the phase base
// (git merge-base HEAD origin/main, abcfcf6): getPublicMapItems and the database path of
// getPublicParcelStatuses. Only the template interpolations are expanded.
// ---------------------------------------------------------------------------------------------

// Port of the pre-01.7 filter builder of getPublicMapItems (same conditions, same order).
function buildLegacyMapItemsQuery(input) {
  const filters = [
    `deleted_at IS NULL`,
    `visibility = 'public'`,
    `status = 'submitted'`,
    `submitted_at IS NOT NULL`,
  ];
  const values = [];

  if (input && input.from) {
    values.push(input.from);
    filters.push(`submitted_at::date >= $${values.length}::date`);
  }
  if (input && input.to) {
    values.push(input.to);
    filters.push(`submitted_at::date <= $${values.length}::date`);
  }
  if (input && input.region) {
    values.push(input.region);
    filters.push(`region_version = $${values.length}`);
  }

  const text = `SELECT
         s.id,
         s.region_version,
         s.scores,
         s.submitted_at::text,
         AVG((p.centroid ->> 'lat')::double precision) AS parcel_centroid_lat,
         AVG((p.centroid ->> 'lng')::double precision) AS parcel_centroid_lng
       FROM surveys s
       LEFT JOIN survey_parcels sp
         ON sp.survey_id = s.id
       LEFT JOIN parcels p
         ON p.parcel_id = sp.parcel_id
       WHERE ${filters.map((filter) => `s.${filter}`).join(' AND ')}
       GROUP BY s.id, s.region_version, s.scores, s.submitted_at
       ORDER BY s.submitted_at DESC
       LIMIT 500`;

  return { text, values };
}

// before (pre-01.7): /public/map-items without optional filters.
const LEGACY_MAP_ITEMS_SQL = buildLegacyMapItemsQuery().text;

// Pre-01.7 database path of getPublicParcelStatuses. $1 year ceiling or NULL; with a bbox,
// $2 minLng, $3 maxLng, $4 minLat, $5 maxLat.
function buildLegacyParcelStatusesSql(withBbox) {
  const bboxFilters = [];
  if (withBbox) {
    bboxFilters.push(
      `(p.centroid ->> 'lng')::double precision BETWEEN $2::double precision AND $3::double precision`
    );
    bboxFilters.push(
      `(p.centroid ->> 'lat')::double precision BETWEEN $4::double precision AND $5::double precision`
    );
  }

  return `WITH latest_public AS (
         SELECT
           sp.parcel_id,
           s.id,
           s.observation_year,
           s.version_number,
           s.submitted_at,
           s.scores,
           ROW_NUMBER() OVER (
             PARTITION BY sp.parcel_id
             ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST
           ) AS rank_in_parcel
         FROM surveys s
         JOIN survey_parcels sp
           ON sp.survey_id = s.id
         WHERE s.deleted_at IS NULL
           AND s.status = 'submitted'
           AND s.visibility = 'public'
           AND ($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)
       )
       SELECT
         p.parcel_id,
         p.geometry,
         p.centroid,
         CASE WHEN lp.parcel_id IS NULL THEN 'not_studied' ELSE 'studied' END AS study_status,
         lp.id AS latest_submitted_survey_id,
         lp.observation_year AS latest_observation_year,
         (lp.scores ->> 'ibp_total')::integer AS latest_ibp_total
       FROM parcels p
       LEFT JOIN latest_public lp
         ON lp.parcel_id = p.parcel_id
        AND lp.rank_in_parcel = 1
       ${bboxFilters.length ? `WHERE ${bboxFilters.join(' AND ')}` : ''}
       ORDER BY p.parcel_id ASC
       LIMIT 1000`;
}

// before (pre-01.7): /public/parcels/status, database path with a bbox.
const LEGACY_PARCEL_STATUSES_BBOX_SQL = buildLegacyParcelStatusesSql(true);
// before (pre-01.7): /public/parcels/status, database path without a bbox.
const LEGACY_PARCEL_STATUSES_SQL = buildLegacyParcelStatusesSql(false);

// ---------------------------------------------------------------------------------------------
// Seed (RESEARCH Code Example 5). Every seeded key carries an "explain" marker so it cannot
// collide with fixture rows. Must run inside the caller's transaction.
// ---------------------------------------------------------------------------------------------
const SEED_STATEMENTS = [
  `INSERT INTO users (id, email, auth0_sub)
   SELECT gen_random_uuid(), 'explain-u' || g || '@example.test', 'explain|' || g
   FROM generate_series(1, ${SEEDED_USERS}) g`,
  // Reproducible random centroids.
  `SELECT setseed(0.17)`,
  // 8 000 parcels in 400 communes, random centroids over mainland France, rounded to 6
  // decimals like every centroid the API writes (toFixed(6) in CadastreProviderService).
  // Migration 015's generated columns accept at most 15 decimals.
  `INSERT INTO parcels (id, parcel_id, commune_code, section, number, centroid, source)
   SELECT gen_random_uuid(),
          '99' || lpad((g % 400)::text, 3, '0') || '000EX' || lpad(g::text, 4, '0'),
          '99' || lpad((g % 400)::text, 3, '0'),
          'EX',
          lpad(g::text, 4, '0'),
          jsonb_build_object(
            'lat', round((42 + random() * 9)::numeric, 6),
            'lng', round((-4 + random() * 12)::numeric, 6)
          ),
          'synthetic_v1'
   FROM generate_series(1, ${SEEDED_PARCELS}) g`,
  // Parcels registered by id only: empty centroid, so NULL generated columns.
  `INSERT INTO parcels (id, parcel_id, commune_code, section, number, centroid, source)
   SELECT gen_random_uuid(),
          '99' || lpad((g % 400)::text, 3, '0') || '000EY' || lpad(g::text, 4, '0'),
          '99' || lpad((g % 400)::text, 3, '0'),
          'EY',
          lpad(g::text, 4, '0'),
          '{}'::jsonb,
          'synthetic_v1'
   FROM generate_series(1, ${SEEDED_EMPTY_CENTROID_PARCELS}) g`,
  // 10 000 surveys: 40 % submitted, 20 % public and submitted (2 000), 10 % public drafts,
  // 100 of the public submitted ones soft-deleted. Distinct submission times. Every 10th
  // survey belongs to explain-u1 (the busy user of the GET /surveys EXPLAIN), the rest are
  // spread over the 200 users.
  // Plain joins only: a CTE read from a scalar subquery is inlined and re-aggregated per row,
  // and after a first rolled-back run the planner (whose reltuples survive the rollback) can
  // pick that per-row plan.
  `INSERT INTO surveys (id, user_id, site_name, status, visibility, region_version, scores,
                        created_at, updated_at, submitted_at, expires_at, sync_version,
                        observation_year, version_number, deleted_at)
   SELECT 'explain-s' || g,
          u.id,
          'Site ' || g,
          CASE WHEN g % 5 < 2 THEN 'submitted' ELSE 'draft' END,
          CASE WHEN g % 10 < 3 THEN 'public' ELSE 'private' END,
          CASE WHEN g % 3 = 0 THEN 'ACA' ELSE 'IDF' END,
          jsonb_build_object('ibp_total', g % 50),
          now() - (g || ' min')::interval,
          now() - (g || ' min')::interval,
          CASE WHEN g % 5 < 2 THEN now() - (g || ' min')::interval END,
          now() + interval '7 days',
          1,
          2020 + g % 6,
          1 + g % 2,
          CASE WHEN g % 100 = 0 THEN now() END
   FROM generate_series(1, ${SEEDED_SURVEYS}) g
   JOIN users u ON u.email = 'explain-u'
                             || CASE WHEN g % 10 = 0 THEN 1 ELSE 1 + g % ${SEEDED_USERS} END
                             || '@example.test'`,
  // 1-3 links per survey (none for every 97th), spread over the 8 000 located parcels; every
  // 211th survey also links one of the empty-centroid parcels. Parcel ids are computed from
  // their seed index, as in the parcel inserts above.
  `INSERT INTO survey_parcels (survey_id, parcel_id)
   SELECT 'explain-s' || g,
          CASE WHEN g % 211 = 0 AND k = 0
               THEN '99' || lpad(((1 + g % ${SEEDED_EMPTY_CENTROID_PARCELS}) % 400)::text, 3, '0')
                    || '000EY' || lpad((1 + g % ${SEEDED_EMPTY_CENTROID_PARCELS})::text, 4, '0')
               ELSE '99' || lpad(((1 + (g * 7 + k * 131) % ${SEEDED_PARCELS}) % 400)::text, 3, '0')
                    || '000EX' || lpad((1 + (g * 7 + k * 131) % ${SEEDED_PARCELS})::text, 4, '0')
          END
   FROM generate_series(1, ${SEEDED_SURVEYS}) g
   CROSS JOIN LATERAL generate_series(0, g % 3) k
   WHERE g % 97 <> 0
   ON CONFLICT DO NOTHING`,
  // D-11: 30 000 events, the first 1 000 on explain-s1 (the busy survey of the events
  // EXPLAIN), the rest spread over every survey. Ten events share each created_at second, so
  // the seq tiebreaker matters. seq and xid8 come from their column defaults.
  `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload, created_at)
   SELECT 'explain-e' || g,
          'explain-s' || CASE WHEN g <= 1000 THEN 1 ELSE 1 + g % ${SEEDED_SURVEYS} END,
          NULL,
          'updated',
          jsonb_build_object('step', g),
          date_trunc('second', now()) - ((g / 10) || ' s')::interval
   FROM generate_series(1, ${SEEDED_EVENTS}) g`,
  // D-11: 20 000 reports over 20 days (one every 86.4 s) on the seeded surveys. 1 in 20 is
  // still open (the moderation queue, 1 000 rows), the rest reviewed; the reports are
  // filed by the seeded users (joined on their email, not a scalar subquery).
  `INSERT INTO reports (id, survey_id, reporter_user_id, reason, status, created_at)
   SELECT gen_random_uuid()::text,
          'explain-s' || (1 + g % ${SEEDED_SURVEYS}),
          u.id,
          'Explain reason ' || g,
          CASE WHEN g % 20 = 0 THEN 'open' ELSE 'reviewed' END,
          now() - (g * 86.4 || ' s')::interval
   FROM generate_series(1, ${SEEDED_REPORTS}) g
   JOIN users u ON u.email = 'explain-u' || (1 + g % ${SEEDED_USERS}) || '@example.test'`,
  `ANALYZE users, parcels, surveys, survey_parcels, survey_events, reports`,
];

async function seed(client) {
  for (const statement of SEED_STATEMENTS) {
    await client.query(statement);
  }
}

function requireCompiled(file) {
  try {
    return require(file);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error(`Missing ${file}: run npm --workspace api run build first.`);
    }
    throw error;
  }
}

// The public map query module plus the three list builders (buildListForUserQuery,
// buildEventListQuery, buildReportListQuery), merged into one object.
function loadCompiledQueries() {
  return Object.assign(
    {},
    requireCompiled(COMPILED_QUERIES),
    ...COMPILED_LIST_MODULES.map(requireCompiled)
  );
}

// D-11: the first page and the page after row LIST_MIDDLE_ROW of each paginated list, built by
// the API's own builders. The middle cursor is read from the unpaginated query of the same
// builder, so it is exactly the cursor a client walking the pages would hold.
async function buildListCases(client, queries) {
  const busyUser = await client.query('SELECT id FROM users WHERE email = $1', [BUSY_USER_EMAIL]);
  const busyUserId = busyUser.rows[0].id;
  const firstPage = { limit: LIST_PAGE_LIMIT, after: null };

  const middleCursor = async (unpaginated, cursorOf) => {
    const rows = await client.query(unpaginated.text, unpaginated.values);
    const row = rows.rows[LIST_MIDDLE_ROW - 1];
    if (!row) {
      throw new Error(`The seed has fewer than ${LIST_MIDDLE_ROW} rows for ${unpaginated.text}`);
    }
    return cursorOf(row);
  };
  const unpaginated = { limit: null, after: null };

  const lists = [
    {
      query: 'GET /surveys (busy user)',
      build: (page) => queries.buildListForUserQuery(busyUserId, {}, page),
      cursorOf: (row) => ({ t: row.updated_at, i: row.id }),
    },
    {
      query: 'GET /surveys/:id/events (busy survey)',
      build: (page) => queries.buildEventListQuery(BUSY_SURVEY_ID, page),
      cursorOf: (row) => ({ t: row.created_at, i: row.seq }),
    },
    {
      query: 'GET /reports',
      build: (page) => queries.buildReportListQuery(null, page),
      cursorOf: (row) => ({ t: row.created_at, i: row.id }),
    },
    {
      query: 'GET /reports?status=open',
      build: (page) => queries.buildReportListQuery('open', page),
      cursorOf: (row) => ({ t: row.created_at, i: row.id }),
    },
  ];

  const cases = [];
  for (const list of lists) {
    const after = await middleCursor(list.build(unpaginated), list.cursorOf);
    for (const [variant, page] of [
      [`first page (limit ${LIST_PAGE_LIMIT})`, firstPage],
      [`middle page (after row ${LIST_MIDDLE_ROW})`, { limit: LIST_PAGE_LIMIT, after }],
    ]) {
      const query = list.build(page);
      cases.push({ query: list.query, variant, text: query.text, values: query.values });
    }
  }
  return cases;
}

// The before/after pairs, each with the parameters both variants take.
function buildCases(queries) {
  const bboxValues = [
    null,
    EXPLAIN_BBOX.minLng,
    EXPLAIN_BBOX.maxLng,
    EXPLAIN_BBOX.minLat,
    EXPLAIN_BBOX.maxLat,
  ];
  const mapItems = queries.buildPublicMapItemsQuery({});
  return [
    {
      query: '/public/map-items',
      variant: 'before (pre-01.7)',
      text: LEGACY_MAP_ITEMS_SQL,
      values: [],
    },
    { query: '/public/map-items', variant: 'after', text: mapItems.text, values: mapItems.values },
    {
      query: '/public/parcels/status?bbox',
      variant: 'before (pre-01.7)',
      text: LEGACY_PARCEL_STATUSES_BBOX_SQL,
      values: bboxValues,
    },
    {
      query: '/public/parcels/status?bbox',
      variant: 'after',
      text: queries.PUBLIC_PARCEL_STATUSES_BBOX_SQL,
      values: bboxValues,
    },
  ];
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Seeds, analyses and explains inside one transaction, then rolls back. Returns one entry per
// case: { query, variant, executionMs, seqScans, plan }.
async function runExplain(client, queries = loadCompiledQueries()) {
  const results = [];
  await client.query('BEGIN');
  try {
    // The API pool sets a 10 s statement_timeout (plan 06); seeding and ANALYZE can exceed it.
    // SET LOCAL ends with the transaction.
    await client.query('SET LOCAL statement_timeout = 0');
    await seed(client);

    const cases = [...buildCases(queries), ...(await buildListCases(client, queries))];
    for (const testCase of cases) {
      const timings = [];
      let plan = '';
      for (let run = 0; run < EXPLAIN_RUNS; run += 1) {
        const explained = await client.query(
          `EXPLAIN (ANALYZE, BUFFERS) ${testCase.text}`,
          testCase.values
        );
        plan = explained.rows.map((row) => row['QUERY PLAN']).join('\n');
        const match = /Execution Time: ([0-9.]+) ms/.exec(plan);
        timings.push(match ? Number(match[1]) : NaN);
      }
      const seqScans = [...new Set([...plan.matchAll(SEQ_SCAN_PATTERN)].map((m) => m[1]))];
      results.push({
        query: testCase.query,
        variant: testCase.variant,
        executionMs: median(timings),
        seqScans,
        plan,
      });
    }
  } finally {
    await client.query('ROLLBACK');
  }
  return results;
}

function formatSummary(results) {
  const header = ['query', 'variant', 'execution (ms, median)', 'seq scan on a watched relation'];
  const rows = results.map((result) => [
    result.query,
    result.variant,
    result.executionMs.toFixed(3),
    result.seqScans.length ? `yes (${result.seqScans.join(', ')})` : 'no',
  ]);
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => row[index].length))
  );
  const line = (cells) => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;
  return [
    line(header),
    `|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`,
    ...rows.map(line),
  ].join('\n');
}

async function main() {
  assertResettableDatabase(process.env);
  const queries = loadCompiledQueries();
  const config = resolveDbConfig(process.env);
  const client = new Client(config);
  await client.connect();
  try {
    const counts = async () =>
      (
        await client.query(
          'SELECT (SELECT count(*) FROM surveys)::int AS surveys, (SELECT count(*) FROM parcels)::int AS parcels, (SELECT count(*) FROM survey_parcels)::int AS links, (SELECT count(*) FROM survey_events)::int AS events, (SELECT count(*) FROM reports)::int AS reports'
        )
      ).rows[0];
    const before = await counts();
    const results = await runExplain(client, queries);
    const after = await counts();

    console.log(`Database: ${config.database} on ${config.host}:${config.port}`);
    console.log(
      `Seed: ${SEEDED_USERS} users, ${SEEDED_PARCELS} parcels (+${SEEDED_EMPTY_CENTROID_PARCELS} without centroid), ${SEEDED_SURVEYS} surveys, 1-3 links each, ${SEEDED_EVENTS} events, ${SEEDED_REPORTS} reports; rolled back.`
    );
    console.log(
      `Lists: first page (limit ${LIST_PAGE_LIMIT}) and the page after row ${LIST_MIDDLE_ROW}; busy user ${BUSY_USER_EMAIL}, busy survey ${BUSY_SURVEY_ID}.`
    );
    console.log(`Bbox: ${JSON.stringify(EXPLAIN_BBOX)}; each EXPLAIN runs ${EXPLAIN_RUNS} times.\n`);
    for (const result of results) {
      console.log(`===== ${result.query} - ${result.variant}`);
      console.log(`${result.plan}\n`);
    }
    console.log(formatSummary(results));
    console.log(
      `\nRow counts before/after the run: ${JSON.stringify(before)} / ${JSON.stringify(after)}`
    );
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error('Row counts changed: the seed was not rolled back');
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  EXPLAIN_BBOX,
  SEEDED_SURVEYS,
  SEEDED_EVENTS,
  SEEDED_REPORTS,
  LIST_PAGE_LIMIT,
  LIST_MIDDLE_ROW,
  BUSY_USER_EMAIL,
  BUSY_SURVEY_ID,
  WATCHED_RELATIONS,
  LEGACY_MAP_ITEMS_SQL,
  LEGACY_PARCEL_STATUSES_BBOX_SQL,
  LEGACY_PARCEL_STATUSES_SQL,
  buildLegacyMapItemsQuery,
  buildLegacyParcelStatusesSql,
  seed,
  loadCompiledQueries,
  buildListCases,
  runExplain,
  formatSummary,
};
