import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { SurveyRow, SurveyUpsertBody } from './surveys.types';

@Injectable()
export class SurveysService {
  constructor(private readonly db: DatabaseService) {}

  async listForUser(user: AuthenticatedUser, status?: string): Promise<Array<Pick<SurveyRow, 'id' | 'site_name' | 'status' | 'visibility' | 'updated_at' | 'sync_version'>>> {
    const filters: string[] = ['user_id = $1', 'deleted_at IS NULL'];
    const values: unknown[] = [user.id];

    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }

    const result = await this.db.query<Pick<SurveyRow, 'id' | 'site_name' | 'status' | 'visibility' | 'updated_at' | 'sync_version'>>(
      `SELECT id, site_name, status, visibility, updated_at::text, sync_version
       FROM surveys
       WHERE ${filters.join(' AND ')}
       ORDER BY updated_at DESC`,
      values
    );

    return result.rows;
  }

  async upsertForUser(user: AuthenticatedUser, body: SurveyUpsertBody): Promise<{ id: string; server_status: 'synced'; updated_at: string }> {
    if (!body.id) {
      throw new BadRequestException('id is required');
    }

    if (typeof body.sync_version !== 'number') {
      throw new BadRequestException('sync_version is required');
    }

    if (!body.site_name) {
      throw new BadRequestException('site_name is required');
    }

    const now = new Date();
    const submittedAt = body.status === 'submitted' ? now.toISOString() : null;
    const expiresAt = body.expires_at ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const existingResult = await this.db.query<SurveyRow>(
      `SELECT *
       FROM surveys
       WHERE id = $1 AND user_id = $2`,
      [body.id, user.id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      const createdAt = now.toISOString();
      const insertResult = await this.db.query<{ id: string; updated_at: string }>(
        `INSERT INTO surveys (
          id, user_id, site_name, status, visibility, region_version, vegetation_stage,
          factors, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15
        )
        RETURNING id, updated_at::text`,
        [
          body.id,
          user.id,
          body.site_name,
          body.status ?? 'draft',
          body.visibility ?? 'private',
          body.region_version ?? null,
          body.vegetation_stage ?? null,
          JSON.stringify(body.factors ?? {}),
          JSON.stringify(body.scores ?? {}),
          JSON.stringify(body.location ?? {}),
          createdAt,
          createdAt,
          submittedAt,
          expiresAt,
          body.sync_version
        ]
      );

      await this.insertEvent(body.id, user.id, 'created', {
        sync_version: body.sync_version,
        site_name: body.site_name
      });

      return {
        id: insertResult.rows[0].id,
        server_status: 'synced',
        updated_at: insertResult.rows[0].updated_at
      };
    }

    if (body.sync_version < existing.sync_version) {
      throw new ConflictException('Older sync_version received');
    }

    if (body.sync_version === existing.sync_version) {
      return {
        id: existing.id,
        server_status: 'synced',
        updated_at: existing.updated_at
      };
    }

    const updateResult = await this.db.query<{ id: string; updated_at: string }>(
      `UPDATE surveys
       SET site_name = $3,
           status = $4,
           visibility = $5,
           region_version = $6,
           vegetation_stage = $7,
           factors = $8::jsonb,
           scores = $9::jsonb,
           location = $10::jsonb,
           submitted_at = $11,
           expires_at = $12,
           sync_version = $13,
           updated_at = $14
       WHERE id = $1 AND user_id = $2
       RETURNING id, updated_at::text`,
      [
        body.id,
        user.id,
        body.site_name,
        body.status ?? existing.status,
        body.visibility ?? existing.visibility,
        body.region_version ?? existing.region_version,
        body.vegetation_stage ?? existing.vegetation_stage,
        JSON.stringify(body.factors ?? existing.factors ?? {}),
        JSON.stringify(body.scores ?? existing.scores ?? {}),
        JSON.stringify(body.location ?? existing.location ?? {}),
        submittedAt,
        expiresAt,
        body.sync_version,
        now.toISOString()
      ]
    );

    await this.insertEvent(body.id, user.id, 'updated', {
      sync_version: body.sync_version,
      site_name: body.site_name
    });

    return {
      id: updateResult.rows[0].id,
      server_status: 'synced',
      updated_at: updateResult.rows[0].updated_at
    };
  }

  private async insertEvent(surveyId: string, actorId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), surveyId, actorId, eventType, JSON.stringify(payload)]
    );
  }
}
