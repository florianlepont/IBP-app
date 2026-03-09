import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Surveys idempotency (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
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
      location: {}
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
        location: {}
      })
      .expect(201);

    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(422);

    expect(Array.isArray(submit.body.errors)).toBe(true);
    expect(submit.body.errors.join(' ')).toContain('factor B is required');
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
        location: {}
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
        location: {}
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
        location: {}
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
        location: {}
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
});
