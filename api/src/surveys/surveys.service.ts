import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { IbpRulesService } from './ibp-rules.service';
import { SurveyEventRow, SurveyPatchBody, SurveyRow, SurveyUpsertBody } from './surveys.types';

@Injectable()
export class SurveysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService
  ) {}

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

    const draftValidation = this.ibpRules.validateDraft(body.factors);
    if (!draftValidation.ok) {
      throw new UnprocessableEntityException({
        message: 'IBP factor validation failed',
        errors: draftValidation.errors
      });
    }

    const now = new Date();
    const expiresAt = body.expires_at ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const computedScores = draftValidation.scores ?? {
      ibp_peuplement_gestion: 0,
      ibp_contexte: 0,
      ibp_total: 0
    };

    const existing = await this.getSurveyForUser(body.id, user.id, false);

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
          JSON.stringify(computedScores),
          JSON.stringify(body.location ?? {}),
          createdAt,
          createdAt,
          null,
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
           expires_at = $11,
           sync_version = $12,
           updated_at = $13
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
        JSON.stringify(computedScores),
        JSON.stringify(body.location ?? existing.location ?? {}),
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

  async patchSurvey(user: AuthenticatedUser, surveyId: string, body: SurveyPatchBody): Promise<{ id: string; updated_at: string }> {
    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id);

    if (body.factors) {
      const check = this.ibpRules.validateDraft(body.factors);
      if (!check.ok) {
        throw new UnprocessableEntityException({ message: 'IBP factor validation failed', errors: check.errors });
      }
      if (check.scores) {
        body.scores = check.scores;
      }
    }

    const result = await this.db.query<{ id: string; updated_at: string }>(
      `UPDATE surveys
       SET site_name = COALESCE($3, site_name),
           visibility = COALESCE($4, visibility),
           region_version = COALESCE($5, region_version),
           vegetation_stage = COALESCE($6, vegetation_stage),
           factors = COALESCE($7::jsonb, factors),
           scores = COALESCE($8::jsonb, scores),
           location = COALESCE($9::jsonb, location),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, updated_at::text`,
      [
        surveyId,
        user.id,
        body.site_name ?? null,
        body.visibility ?? null,
        body.region_version ?? null,
        body.vegetation_stage ?? null,
        body.factors ? JSON.stringify(body.factors) : null,
        body.scores ? JSON.stringify(body.scores) : null,
        body.location ? JSON.stringify(body.location) : null
      ]
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Survey not found');
    }

    await this.insertEvent(surveyId, user.id, 'updated', {
      changed_fields: Object.keys(body)
    });

    if (body.visibility && body.visibility !== existing.visibility) {
      await this.insertEvent(surveyId, user.id, 'visibility_changed', {
        from: existing.visibility,
        to: body.visibility
      });
    }

    return result.rows[0];
  }

  async submitSurvey(user: AuthenticatedUser, surveyId: string): Promise<{ id: string; status: 'submitted'; submitted_at: string; scores: Record<string, number> }> {
    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id);

    const validation = this.ibpRules.validateSubmit({
      region_version: existing.region_version,
      vegetation_stage: existing.vegetation_stage,
      expires_at: existing.expires_at,
      factors: existing.factors
    });

    if (!validation.ok || !validation.scores) {
      throw new UnprocessableEntityException({
        message: 'Survey cannot be submitted',
        errors: validation.errors
      });
    }

    const result = await this.db.query<{ id: string; status: 'submitted'; submitted_at: string }>(
      `UPDATE surveys
       SET status = 'submitted',
           submitted_at = NOW(),
           scores = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, status, submitted_at::text`,
      [surveyId, user.id, JSON.stringify(validation.scores)]
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Survey not found');
    }

    await this.insertEvent(surveyId, user.id, 'submitted', {
      scores: validation.scores
    });

    return {
      ...result.rows[0],
      scores: validation.scores
    };
  }

  async getEvents(user: AuthenticatedUser, surveyId: string): Promise<{ items: SurveyEventRow[] }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id);

    const events = await this.db.query<SurveyEventRow>(
      `SELECT id, survey_id, actor_id, event_type, payload, created_at::text
       FROM survey_events
       WHERE survey_id = $1
       ORDER BY created_at DESC`,
      [surveyId]
    );

    return { items: events.rows };
  }

  private async getSurveyForUserOrThrow(surveyId: string, userId: string): Promise<SurveyRow> {
    const survey = await this.getSurveyForUser(surveyId, userId, true);
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    return survey;
  }

  private async getSurveyForUser(surveyId: string, userId: string, activeOnly: boolean): Promise<SurveyRow | null> {
    const where = activeOnly ? 'AND deleted_at IS NULL' : '';
    const result = await this.db.query<SurveyRow>(
      `SELECT *
       FROM surveys
       WHERE id = $1 AND user_id = $2 ${where}`,
      [surveyId, userId]
    );
    return result.rows[0] ?? null;
  }

  private async insertEvent(surveyId: string, actorId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), surveyId, actorId, eventType, JSON.stringify(payload)]
    );
  }
}
