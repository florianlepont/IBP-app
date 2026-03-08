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
});
