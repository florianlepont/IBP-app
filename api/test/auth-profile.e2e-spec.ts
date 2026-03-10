import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Auth + profile (e2e)', () => {
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

  it('returns profile fields via GET /me after login', async () => {
    const email = `e2e-profile-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.email).toBe(email);
    expect(typeof me.body.display_name).toBe('string');
    expect(me.body.email_change_required).toBe(false);
  });

  it('registers a new account and blocks duplicate registration', async () => {
    const email = `e2e-register-${Date.now()}@ibp.local`;

    const register = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'demo123', display_name: 'New User' })
      .expect(201);

    expect(register.body.user.email).toBe(email);
    expect(register.body.user.display_name).toBe('New User');
    expect(typeof register.body.access_token).toBe('string');
    expect(typeof register.body.refresh_token).toBe('string');

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'demo123' })
      .expect(409);
  });

  it('rejects login when account does not exist and create_if_missing is false', async () => {
    const email = `e2e-login-no-create-${Date.now()}@ibp.local`;

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123', create_if_missing: false })
      .expect(401);
  });

  it('requires email confirmation before changing login email', async () => {
    const email = `e2e-email-pending-${Date.now()}@ibp.local`;
    const requestedEmail = `e2e-email-confirmed-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;

    const patch = await request(app.getHttpServer())
      .patch('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: requestedEmail })
      .expect(200);

    expect(patch.body.email).toBe(email);
    expect(patch.body.email_change_required).toBe(true);
    expect(patch.body.email_change_pending_to).toBe(requestedEmail);

    let confirmationToken = patch.body.email_change_token_dev as string | undefined;
    if (!confirmationToken) {
      const db = app.get(DatabaseService);
      const tokenResult = await db.query<{ email_change_token: string | null }>(
        'SELECT email_change_token FROM users WHERE id = $1',
        [login.body.user.id]
      );
      confirmationToken = tokenResult.rows[0]?.email_change_token ?? undefined;
    }
    expect(typeof confirmationToken).toBe('string');

    await request(app.getHttpServer())
      .post('/v1/me/email/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'invalid-token' })
      .expect(400);

    const confirm = await request(app.getHttpServer())
      .post('/v1/me/email/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: confirmationToken })
      .expect(200);

    expect(confirm.body.email).toBe(requestedEmail);
    expect(confirm.body.email_change_required).toBe(false);
    expect(confirm.body.email_change_pending_to).toBe(null);
  });

  it('uploads, serves and deletes profile picture', async () => {
    const email = `e2e-avatar-${Date.now()}@ibp.local`;
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'demo123' })
      .expect(201);

    const accessToken = login.body.access_token as string;
    const pngStub = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    const upload = await request(app.getHttpServer())
      .put('/v1/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', pngStub, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);

    expect(typeof upload.body.profile_picture_url).toBe('string');

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(typeof me.body.profile_picture_url).toBe('string');

    const picture = await request(app.getHttpServer())
      .get('/v1/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(String(picture.headers['content-type'] ?? '')).toContain('image/');
    expect(picture.body.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete('/v1/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/v1/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
