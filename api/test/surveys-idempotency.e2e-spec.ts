import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Surveys idempotency (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    db = moduleFixture.get(DatabaseService);
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('accepts same id+sync_version replay and rejects older sync_version', async () => {
    const email = `e2e-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    expect(accessToken).toBeTruthy();

    const surveyId = `e2e-survey-${Date.now()}`;
    const payload = {
      id: surveyId,
      sync_version: 1,
      site_name: 'Test Forest',
      status: 'draft',
      visibility: 'private',
      factors: {},
      scores: {},
      location: { source: 'gps', lat: 48.643, lng: 1.829 }
    };

    const first = await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);

    const replay = await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);

    expect(first.body.id).toBe(surveyId);
    expect(replay.body.id).toBe(surveyId);
    expect(replay.body.server_status).toBe('synced');

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...payload, sync_version: 0 })
      .expect(409);
  });

  it('rejects submit when IBP factors are incomplete', async () => {
    const email = `e2e-submit-invalid-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-submit-invalid-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Incomplete Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: { A: 1, I: 2 },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(422);

    expect(Array.isArray(submit.body.errors)).toBe(true);
    expect(submit.body.errors.join(' ')).toContain('factor B is required');
  });

  it('rejects submit when parcel linkage is missing', async () => {
    const email = `e2e-submit-no-parcel-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-submit-no-parcel-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'No Location Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
        },
        location: {}
      })
      .expect(201);

    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(422);

    expect(Array.isArray(submit.body.errors)).toBe(true);
    expect(submit.body.errors.join(' ')).toContain('parcel_ids is required for submit');
  });

  it('marks survey as expired when submit is attempted after deadline', async () => {
    const email = `e2e-submit-expired-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-submit-expired-${Date.now()}`;
    const expiredAt = new Date(Date.now() - 60_000).toISOString();

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Expired Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        expires_at: expiredAt,
        factors: {
          A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 2, I: 2, J: 2
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(422);

    expect(Array.isArray(submit.body.errors)).toBe(true);
    expect(submit.body.errors.join(' ')).toContain('survey is expired');

    const detail = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(detail.body.status).toBe('expired');
  });

  it('submits valid IBP survey and returns computed scores', async () => {
    const email = `e2e-submit-valid-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-submit-valid-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Valid Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(submit.body.status).toBe('submitted');
    expect(submit.body.scores).toEqual({
      ibp_peuplement_gestion: 7,
      ibp_contexte: 5,
      ibp_total: 12
    });
  });

  it('rejects non-visibility PATCH fields after submit', async () => {
    const email = `e2e-submit-readonly-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-submit-readonly-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Read-only Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const patch = await request(app.getHttpServer())
      .patch(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        factors: { A: 5 }
      })
      .expect(422);

    expect(patch.body.code).toBe('submitted_read_only_fields');
    expect(patch.body.forbidden_fields).toContain('factors');
  });

  it('toggles visibility after submit via PATCH /v1/surveys/:id/visibility and writes visibility_changed event', async () => {
    const email = `e2e-submit-visibility-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-submit-visibility-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Visibility Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const toggle = await request(app.getHttpServer())
      .patch(`/v1/surveys/${surveyId}/visibility`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ visibility: 'public' })
      .expect(200);

    expect(toggle.body.id).toBe(surveyId);
    expect(toggle.body.visibility).toBe('public');
    expect(typeof toggle.body.updated_at).toBe('string');

    const detail = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(detail.body.visibility).toBe('public');

    const events = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/events`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const visibilityEvent = (events.body.items as Array<{ event_type: string; payload?: { from?: string; to?: string } }>).find(
      (event) => event.event_type === 'visibility_changed' && event.payload?.from === 'private' && event.payload?.to === 'public'
    );
    expect(visibilityEvent).toBeTruthy();
  });

  it('processes survey visibility_update operation via POST /v1/sync', async () => {
    const email = `e2e-sync-visibility-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-sync-visibility-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Sync Visibility Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const sync = await request(app.getHttpServer())
      .post('/v1/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: 'op-visibility',
            entity: 'survey',
            action: 'visibility_update',
            survey_id: surveyId,
            payload: {
              visibility: 'public'
            }
          }
        ]
      })
      .expect(200);

    expect(sync.body.results).toHaveLength(1);
    expect(sync.body.results[0]).toMatchObject({
      client_ref: 'op-visibility',
      entity: 'survey',
      action: 'visibility_update',
      status: 'synced'
    });
    expect(sync.body.results[0].data.visibility).toBe('public');

    const detail = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(detail.body.visibility).toBe('public');
  });

  it('exposes submitted+public surveys on /v1/public/map-items and removes them after public -> private', async () => {
    const email = `e2e-public-map-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const submittedPublicId = `e2e-public-map-pub-${Date.now()}`;
    const submittedPrivateId = `e2e-public-map-prv-${Date.now()}`;
    const draftPublicId = `e2e-public-map-draft-${Date.now()}`;

    const validFactors = {
      A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
    };

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: submittedPublicId,
        sync_version: 1,
        site_name: 'Public Submitted Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: validFactors,
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/surveys/${submittedPublicId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/v1/surveys/${submittedPublicId}/visibility`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ visibility: 'public' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: submittedPrivateId,
        sync_version: 1,
        site_name: 'Private Submitted Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: validFactors,
        location: { source: 'gps', lat: 48.645, lng: 1.821 }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/surveys/${submittedPrivateId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: draftPublicId,
        sync_version: 1,
        site_name: 'Public Draft Forest',
        status: 'draft',
        visibility: 'public',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: validFactors,
        location: { source: 'gps', lat: 48.649, lng: 1.827 }
      })
      .expect(201);

    const mapBeforeHide = await request(app.getHttpServer())
      .get('/v1/public/map-items')
      .query({ region: 'ACA' })
      .expect(200);

    const beforeItems = mapBeforeHide.body.items as Array<{ survey_id: string; region_code: string; ibp_total: number }>;
    expect(beforeItems.some((item) => item.survey_id === submittedPublicId)).toBe(true);
    expect(beforeItems.some((item) => item.survey_id === submittedPrivateId)).toBe(false);
    expect(beforeItems.some((item) => item.survey_id === draftPublicId)).toBe(false);

    const included = beforeItems.find((item) => item.survey_id === submittedPublicId);
    expect(included?.region_code).toBe('ACA');
    expect(typeof included?.ibp_total).toBe('number');

    await request(app.getHttpServer())
      .patch(`/v1/surveys/${submittedPublicId}/visibility`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ visibility: 'private' })
      .expect(200);

    const mapAfterHide = await request(app.getHttpServer())
      .get('/v1/public/map-items')
      .query({ region: 'ACA' })
      .expect(200);

    const afterItems = mapAfterHide.body.items as Array<{ survey_id: string }>;
    expect(afterItems.some((item) => item.survey_id === submittedPublicId)).toBe(false);
  });

  it('resolves a parcel from coordinates and returns parcel history entries', async () => {
    const runSeed = Date.now() % 900;
    const baseLat = 48.703 + runSeed / 100000;
    const baseLng = 2.191 + runSeed / 100000;
    const email = `e2e-parcel-history-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const validFactors = {
      A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
    };

    const resolved = await request(app.getHttpServer())
      .get('/v1/parcels/resolve')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ lat: String(baseLat), lng: String(baseLng) })
      .expect(200);

    const parcelId = resolved.body.parcel?.parcel_id as string;
    expect(parcelId).toBeTruthy();
    expect(typeof resolved.body.parcel?.commune_code).toBe('string');

    const surveyIdV1 = `e2e-parcel-history-v1-${Date.now()}`;
    const surveyIdV2 = `e2e-parcel-history-v2-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyIdV1,
        sync_version: 1,
        site_name: 'Parcel History Forest V1',
        status: 'draft',
        visibility: 'private',
        parcel_id: parcelId,
        observation_year: 2025,
        version_number: 1,
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: validFactors,
        location: { source: 'gps', lat: baseLat, lng: baseLng }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyIdV1}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyIdV2,
        sync_version: 1,
        site_name: 'Parcel History Forest V2',
        status: 'draft',
        visibility: 'private',
        parcel_id: parcelId,
        observation_year: 2026,
        version_number: 2,
        previous_survey_id: surveyIdV1,
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: validFactors,
        location: { source: 'gps', lat: baseLat + 0.0001, lng: baseLng + 0.0001 }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyIdV2}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const history = await request(app.getHttpServer())
      .get(`/v1/parcels/${encodeURIComponent(parcelId)}/surveys/history`)
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ limit: 10 })
      .expect(200);

    expect(history.body.parcel_id).toBe(parcelId);
    const items = history.body.items as Array<{ survey_id: string; observation_year: number; version_number: number }>;
    expect(items.some((item) => item.survey_id === surveyIdV1)).toBe(true);
    expect(items.some((item) => item.survey_id === surveyIdV2)).toBe(true);
  });

  it('exposes parcel study status on /v1/public/parcels/status', async () => {
    const runSeed = Date.now() % 800;
    const baseLat = 43.6045 + runSeed / 100000;
    const baseLng = 1.444 + runSeed / 100000;
    const email = `e2e-parcel-status-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const validFactors = {
      A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
    };
    const surveyId = `e2e-parcel-status-${Date.now()}`;

    const upsert = await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Parcel Status Forest',
        status: 'draft',
        visibility: 'private',
        observation_year: 2026,
        version_number: 1,
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: validFactors,
        location: { source: 'gps', lat: baseLat, lng: baseLng }
      })
      .expect(201);

    expect(upsert.body.id).toBe(surveyId);

    const detail = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const parcelId = detail.body.parcel_id as string;
    expect(parcelId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/v1/surveys/${surveyId}/visibility`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ visibility: 'public' })
      .expect(200);

    const statuses = await request(app.getHttpServer())
      .get('/v1/public/parcels/status')
      .query({ bbox: '1.0,43.0,2.0,44.0', zoom: 16, year: 2026 })
      .expect(200);

    const items = statuses.body.items as Array<{ parcel_id: string; study_status: string; latest_observation_year: number }>;
    const parcelItem = items.find((item) => item.parcel_id === parcelId);
    expect(parcelItem).toBeTruthy();
    expect(parcelItem?.study_status).toBe('studied');
    expect(parcelItem?.latest_observation_year).toBe(2026);

    const lowZoom = await request(app.getHttpServer())
      .get('/v1/public/parcels/status')
      .query({ bbox: '1.0,43.0,2.0,44.0', zoom: 14 })
      .expect(200);
    expect(lowZoom.body.items).toEqual([]);
  });

  it('submits a full raw-observation payload A..J and computes exact scores', async () => {
    const email = `e2e-raw-full-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-raw-full-${Date.now()}`;

    const upsert = await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Raw Full Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: { native_genus_count: 2 },
          B: { strata_count: 3, covered_autochthonous_percent: 40 },
          C: { bmg_count: 0, bmm_count: 2, surface_ha: 1 },
          D: { bmg_count: 4, bmm_count: 0, surface_ha: 1 },
          E: { tgb_count: 0, gb_count: 2, surface_ha: 1 },
          F: { trees_per_ha: 8 },
          G: { open_flowering_percent: 2 },
          H: { class_score: 5 },
          I: { type_count: 2 },
          J: { type_count: 1 }
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    expect(Array.isArray(upsert.body.warnings)).toBe(true);

    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(submit.body.scores).toEqual({
      ibp_peuplement_gestion: 20,
      ibp_contexte: 12,
      ibp_total: 32
    });
  });

  it('exposes canonical factor_results on survey detail endpoint', async () => {
    const email = `e2e-canonical-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-canonical-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Canonical Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: { native_genus_count: 4 },
          B: { strata_count: 2, covered_autochthonous_percent: 100 },
          C: { bmg_count: 0, bmm_count: 0, surface_ha: 1 },
          D: { bmg_count: 0, bmm_count: 0, surface_ha: 1 },
          E: { tgb_count: 0, gb_count: 0, surface_ha: 1 },
          F: { trees_per_ha: 1 },
          G: { open_flowering_percent: 0.5 },
          H: { class_score: 2 },
          I: { type_count: 1 },
          J: { type_count: 0 }
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(detail.body.id).toBe(surveyId);
    expect(detail.body.factor_results).toBeTruthy();
    expect(detail.body.factor_results.A).toMatchObject({
      factor_id: 'factor_a',
      selected_class: 'S2',
      score_points: 2
    });
    expect(detail.body.factor_results.G).toMatchObject({
      factor_id: 'factor_g',
      selected_class: 'S2',
      score_points: 2
    });
  });

  it('creates and soft-deletes a survey attachment', async () => {
    const email = `e2e-attachment-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-attachment-survey-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Attachment Forest',
        status: 'draft',
        visibility: 'private',
        region_version: 'ACA',
        vegetation_stage: 'collineen',
        factors: {
          A: 1
        },
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mime_type: 'image/jpeg',
        size_bytes: 2048000
      })
      .expect(201);

    expect(typeof created.body.attachment_id).toBe('string');
    expect(created.body.storage_key).toContain(`surveys/${surveyId}/`);
    expect(created.body.storage_key).toContain('.jpg');
    expect(created.body.confirm_url).toContain(`/surveys/${surveyId}/attachments/${created.body.attachment_id}/upload?token=`);
    expect(typeof created.body.upload_url).toBe('string');

    if (String(created.body.upload_url).startsWith('http')) {
      const presignedUpload = await fetch(created.body.upload_url as string, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg'
        },
        body: Buffer.from('fake-jpeg-binary')
      });
      expect(presignedUpload.ok).toBe(true);

      const confirm = await request(app.getHttpServer())
        .put(`/v1${created.body.confirm_url}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(confirm.body.attachment_id).toBe(created.body.attachment_id);
      expect(typeof confirm.body.uploaded_at).toBe('string');
    } else {
      expect(created.body.upload_url).toContain(`/surveys/${surveyId}/attachments/${created.body.attachment_id}/upload?token=`);

      const uploaded = await request(app.getHttpServer())
        .put(`/v1${created.body.upload_url}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('fake-jpeg-binary'), {
          filename: 'sample.jpg',
          contentType: 'image/jpeg'
        })
        .expect(200);

      expect(uploaded.body.attachment_id).toBe(created.body.attachment_id);
      expect(typeof uploaded.body.uploaded_at).toBe('string');
    }

    const listedBeforeDelete = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(listedBeforeDelete.body.items)).toBe(true);
    expect(listedBeforeDelete.body.items).toHaveLength(1);
    expect(listedBeforeDelete.body.items[0].id).toBe(created.body.attachment_id);
    expect(typeof listedBeforeDelete.body.items[0].uploaded_at).toBe('string');

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}/attachments/${created.body.attachment_id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}/attachments/${created.body.attachment_id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    const listedAfterDelete = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(listedAfterDelete.body.items).toHaveLength(0);

    const events = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/events`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const eventTypes = (events.body.items as Array<{ event_type: string }>).map((e) => e.event_type);
    expect(eventTypes).toContain('attachment_created');
    expect(eventTypes).toContain('attachment_uploaded');
    expect(eventTypes).toContain('attachment_deleted');
  });

  it('soft-deletes survey via DELETE /v1/surveys/:id and records deleted event', async () => {
    const email = `e2e-survey-delete-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-survey-delete-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Delete Forest',
        status: 'draft',
        visibility: 'private',
        factors: {},
        scores: {},
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    const listed = await request(app.getHttpServer())
      .get('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((listed.body.items as Array<{ id: string }>).some((survey) => survey.id === surveyId)).toBe(false);

    const changes = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ limit: 100 })
      .expect(200);

    const deletedEvent = (changes.body.events as Array<{ survey_id: string; event_type: string }>).find(
      (event) => event.survey_id === surveyId && event.event_type === 'deleted'
    );
    expect(deletedEvent).toBeTruthy();

    const deletedSurvey = (changes.body.surveys as Array<{ id: string; deleted_at: string | null }>).find(
      (survey) => survey.id === surveyId
    );
    expect(deletedSurvey?.deleted_at).toBeTruthy();
  });

  it('processes mixed operations via POST /v1/sync', async () => {
    const email = `e2e-sync-batch-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const validSurveyId = `e2e-sync-batch-valid-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/v1/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: 'op-valid-survey',
            entity: 'survey',
            action: 'upsert',
            payload: {
              id: validSurveyId,
              sync_version: 1,
              site_name: 'Batch Forest',
              status: 'draft',
              visibility: 'private',
              factors: {},
              scores: {},
              location: { source: 'gps', lat: 48.643, lng: 1.829 }
            }
          },
          {
            client_ref: 'op-invalid-survey',
            entity: 'survey',
            action: 'upsert',
            payload: {
              id: `e2e-sync-batch-invalid-${Date.now()}`,
              sync_version: 1,
              status: 'draft',
              visibility: 'private',
              factors: {},
              scores: {},
              location: { source: 'gps', lat: 48.643, lng: 1.829 }
            }
          }
        ]
      })
      .expect(200);

    expect(Array.isArray(response.body.results)).toBe(true);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0]).toMatchObject({
      client_ref: 'op-valid-survey',
      entity: 'survey',
      action: 'upsert',
      status: 'synced'
    });
    expect(response.body.results[0].data.id).toBe(validSurveyId);

    expect(response.body.results[1]).toMatchObject({
      client_ref: 'op-invalid-survey',
      entity: 'survey',
      action: 'upsert',
      status: 'fatal_error'
    });
    expect(response.body.results[1].error.http_status).toBe(400);
  });

  it('processes survey delete operation via POST /v1/sync', async () => {
    const email = `e2e-sync-delete-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-sync-delete-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Sync Delete Forest',
        status: 'draft',
        visibility: 'private',
        factors: {},
        scores: {},
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/v1/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: 'op-delete-survey',
            entity: 'survey',
            action: 'delete',
            survey_id: surveyId,
            payload: { id: surveyId }
          }
        ]
      })
      .expect(200);

    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      client_ref: 'op-delete-survey',
      entity: 'survey',
      action: 'delete',
      status: 'synced'
    });
    expect(response.body.results[0].data.id).toBe(surveyId);
    expect(response.body.results[0].data.deleted_at).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('processes attachment delete operation via POST /v1/sync', async () => {
    const email = `e2e-sync-attachment-delete-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-sync-attachment-delete-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Sync Attachment Delete Forest',
        status: 'draft',
        visibility: 'private',
        factors: {},
        scores: {},
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/v1/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: 'op-create-attachment',
            entity: 'attachment',
            action: 'create',
            survey_id: surveyId,
            payload: {
              mime_type: 'image/jpeg',
              size_bytes: 1024
            }
          }
        ]
      })
      .expect(200);

    expect(created.body.results).toHaveLength(1);
    expect(created.body.results[0].status).toBe('synced');
    const attachmentId = created.body.results[0].data.attachment_id as string;
    const uploadUrl = created.body.results[0].data.upload_url as string;
    const confirmUrl = created.body.results[0].data.confirm_url as string;

    if (uploadUrl.startsWith('http')) {
      const presignedUpload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg'
        },
        body: Buffer.from('fake-jpeg-binary')
      });
      expect(presignedUpload.ok).toBe(true);

      await request(app.getHttpServer())
        .put(`/v1${confirmUrl}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    } else {
      await request(app.getHttpServer())
        .put(`/v1${uploadUrl}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('fake-jpeg-binary'), {
          filename: 'sample.jpg',
          contentType: 'image/jpeg'
        })
        .expect(200);
    }

    const deleted = await request(app.getHttpServer())
      .post('/v1/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: 'op-delete-attachment',
            entity: 'attachment',
            action: 'delete',
            survey_id: surveyId,
            payload: {
              attachment_id: attachmentId
            }
          }
        ]
      })
      .expect(200);

    expect(deleted.body.results).toHaveLength(1);
    expect(deleted.body.results[0]).toMatchObject({
      client_ref: 'op-delete-attachment',
      entity: 'attachment',
      action: 'delete',
      status: 'synced'
    });
    expect(deleted.body.results[0].data.attachment_id).toBe(attachmentId);

    const listedAfterDelete = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(listedAfterDelete.body.items)).toBe(true);
    expect(listedAfterDelete.body.items).toHaveLength(0);
  });

  it('returns sync_version_conflict details in POST /v1/sync result', async () => {
    const email = `e2e-sync-conflict-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-sync-conflict-survey-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 2,
        site_name: 'Conflict Forest',
        status: 'draft',
        visibility: 'private',
        factors: {},
        scores: {},
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const conflict = await request(app.getHttpServer())
      .post('/v1/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: 'op-conflict',
            entity: 'survey',
            action: 'upsert',
            payload: {
              id: surveyId,
              sync_version: 1,
              site_name: 'Conflict Forest - stale',
              status: 'draft',
              visibility: 'private',
              factors: {},
              scores: {},
              location: { source: 'gps', lat: 48.643, lng: 1.829 }
            }
          }
        ]
      })
      .expect(200);

    expect(conflict.body.results).toHaveLength(1);
    expect(conflict.body.results[0]).toMatchObject({
      client_ref: 'op-conflict',
      entity: 'survey',
      action: 'upsert',
      status: 'fatal_error'
    });
    expect(conflict.body.results[0].error.code).toBe('sync_version_conflict');
    expect(conflict.body.results[0].error.http_status).toBe(409);
    expect(conflict.body.results[0].error.details).toMatchObject({
      survey_id: surveyId,
      server_sync_version: 2,
      client_sync_version: 1
    });
  });

  it('returns incremental changes via GET /v1/sync/changes with cursor', async () => {
    const email = `e2e-sync-changes-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const surveyId = `e2e-sync-changes-survey-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: 'Changes Forest',
        status: 'draft',
        visibility: 'private',
        factors: {},
        scores: {},
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const firstChanges = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .query({ limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(firstChanges.body.events)).toBe(true);
    expect(firstChanges.body.events.length).toBeGreaterThan(0);
    expect(Array.isArray(firstChanges.body.surveys)).toBe(true);
    expect(firstChanges.body.surveys.some((survey: { id: string }) => survey.id === surveyId)).toBe(true);
    expect(typeof firstChanges.body.cursor_out).toBe('string');

    const cursorOut = firstChanges.body.cursor_out as string;

    await request(app.getHttpServer())
      .patch(`/v1/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ site_name: 'Changes Forest Updated' })
      .expect(200);

    const createdAttachment = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mime_type: 'image/jpeg',
        size_bytes: 1024
      })
      .expect(201);

    const deltaChanges = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .query({ cursor: cursorOut, limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const eventTypes = (deltaChanges.body.events as Array<{ event_type: string }>).map((event) => event.event_type);
    expect(eventTypes).toContain('updated');
    expect(eventTypes).toContain('attachment_created');
    expect(deltaChanges.body.surveys.some((survey: { id: string; site_name: string }) => survey.id === surveyId && survey.site_name === 'Changes Forest Updated')).toBe(true);
    expect(deltaChanges.body.attachments.some((attachment: { id: string }) => attachment.id === createdAttachment.body.attachment_id)).toBe(true);
    expect(typeof deltaChanges.body.cursor_out).toBe('string');
    expect(deltaChanges.body.cursor_out).not.toBe(cursorOut);
  });

  it('returns surveys without events via GET /v1/sync/changes fallback', async () => {
    const email = `e2e-sync-changes-fallback-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const userId = me.body.id as string;

    const surveyId = `e2e-sync-no-event-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const payloadFactors = JSON.stringify({
      A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2
    });
    const payloadScores = JSON.stringify({
      ibp_peuplement_gestion: 7,
      ibp_contexte: 5,
      ibp_total: 12
    });
    const payloadLocation = JSON.stringify({
      source: 'gps',
      lat: 48.643,
      lng: 1.829
    });

    await db.query(
      `INSERT INTO surveys (
         id, user_id, site_name, status, visibility, region_version, vegetation_stage,
         factors, factor_results, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
       ) VALUES (
         $1, $2, $3, 'submitted', 'public', 'ACA', 'collineen',
         $4::jsonb, '{}'::jsonb, $5::jsonb, $6::jsonb, $7::timestamptz, $8::timestamptz, $9::timestamptz, ($8::timestamptz + INTERVAL '365 days'), 1
       )`,
      [surveyId, userId, 'No Event Forest', payloadFactors, payloadScores, payloadLocation, nowIso, nowIso, nowIso]
    );

    const changes = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .query({ limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(changes.body.events)).toBe(true);
    expect(changes.body.events.length).toBe(0);
    expect(Array.isArray(changes.body.surveys)).toBe(true);
    expect(changes.body.surveys.some((survey: { id: string }) => survey.id === surveyId)).toBe(true);
    expect(typeof changes.body.cursor_out).toBe('string');

    const cursorOut = changes.body.cursor_out as string;
    const delta = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .query({ cursor: cursorOut, limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(delta.body.surveys.some((survey: { id: string }) => survey.id === surveyId)).toBe(true);
  });

  it('returns surveys without events even when cursor is newer than survey.updated_at', async () => {
    const email = `e2e-sync-changes-fallback-cursor-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const userId = me.body.id as string;

    const eventSurveyId = `e2e-sync-cursor-anchor-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/v1/surveys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        id: eventSurveyId,
        sync_version: 1,
        site_name: 'Cursor Anchor',
        status: 'draft',
        visibility: 'private',
        factors: {},
        scores: {},
        location: { source: 'gps', lat: 48.643, lng: 1.829 }
      })
      .expect(201);

    const anchorChanges = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .query({ limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const anchorCursor = anchorChanges.body.cursor_out as string;
    expect(typeof anchorCursor).toBe('string');

    const surveyId = `e2e-sync-no-event-old-${Date.now()}`;
    const oldIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const payloadLocation = JSON.stringify({ source: 'gps', lat: 48.643, lng: 1.829 });

    await db.query(
      `INSERT INTO surveys (
         id, user_id, site_name, status, visibility, region_version, vegetation_stage,
         factors, factor_results, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
       ) VALUES (
         $1, $2, $3, 'submitted', 'public', 'ACA', 'collineen',
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, $4::jsonb, $5::timestamptz, $6::timestamptz, $7::timestamptz, ($6::timestamptz + INTERVAL '365 days'), 1
       )`,
      [surveyId, userId, 'No Event Forest Old', payloadLocation, oldIso, oldIso, oldIso]
    );

    const delta = await request(app.getHttpServer())
      .get('/v1/sync/changes')
      .query({ cursor: anchorCursor, limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(delta.body.surveys.some((survey: { id: string }) => survey.id === surveyId)).toBe(true);
  });
});
