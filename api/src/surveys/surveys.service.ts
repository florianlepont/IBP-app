import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { IbpRulesService } from './ibp-rules.service';
import {
  AttachmentRow,
  CreateAttachmentBody,
  SurveyEventRow,
  SurveyPatchBody,
  SurveyRow,
  SurveyUpsertBody,
  SyncBatchBody,
  SyncChangeAttachment,
  SyncChangeEvent,
  SyncChangeSurvey,
  SyncOperationResult
} from './surveys.types';

@Injectable()
export class SurveysService {
  private readonly objectStorageMode: 'local' | 'minio';
  private readonly s3Bucket: string;
  private readonly s3Client?: S3Client;
  private s3BucketReady = false;
  private readonly uploadsRootDir: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService
  ) {
    this.objectStorageMode = (process.env.OBJECT_STORAGE_MODE ?? 'local') === 'minio' ? 'minio' : 'local';
    this.s3Bucket = process.env.OBJECT_STORAGE_BUCKET ?? 'ibp-surveys';
    this.uploadsRootDir = process.env.ATTACHMENTS_UPLOAD_DIR ?? '/tmp/ibp-uploads';

    if (this.objectStorageMode === 'minio') {
      const endpoint = process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://localhost:9000';
      const region = process.env.OBJECT_STORAGE_REGION ?? 'us-east-1';
      const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY ?? 'minio';
      const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_KEY ?? 'minio123';

      this.s3Client = new S3Client({
        endpoint,
        region,
        forcePathStyle: true,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
  }

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

  async upsertForUser(
    user: AuthenticatedUser,
    body: SurveyUpsertBody
  ): Promise<{ id: string; server_status: 'synced'; updated_at: string; warnings?: string[]; factor_results?: SurveyRow['factor_results'] }> {
    if (!body.id) {
      throw new BadRequestException('id is required');
    }

    if (typeof body.sync_version !== 'number') {
      throw new BadRequestException('sync_version is required');
    }

    if (!body.site_name) {
      throw new BadRequestException('site_name is required');
    }

    const draftValidation = this.ibpRules.validateDraft(body.factors, body.region_version, body.vegetation_stage);
    if (!draftValidation.ok) {
      throw new UnprocessableEntityException({
        message: 'IBP factor validation failed',
        errors: draftValidation.errors,
        warnings: draftValidation.warnings
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
          factors, factor_results, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16
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
          JSON.stringify(draftValidation.factor_results ?? {}),
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
        site_name: body.site_name,
        warnings: draftValidation.warnings
      });

      return {
        id: insertResult.rows[0].id,
        server_status: 'synced',
        updated_at: insertResult.rows[0].updated_at,
        warnings: draftValidation.warnings,
        factor_results: draftValidation.factor_results ?? undefined
      };
    }

    if (body.sync_version < existing.sync_version) {
      throw new ConflictException({
        code: 'sync_version_conflict',
        message: 'Older sync_version received',
        details: {
          survey_id: body.id,
          server_sync_version: existing.sync_version,
          client_sync_version: body.sync_version
        }
      });
    }

    if (body.sync_version === existing.sync_version) {
      return {
        id: existing.id,
        server_status: 'synced',
        updated_at: existing.updated_at,
        warnings: draftValidation.warnings,
        factor_results: draftValidation.factor_results ?? undefined
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
           factor_results = $9::jsonb,
           scores = $10::jsonb,
           location = $11::jsonb,
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
        JSON.stringify(draftValidation.factor_results ?? existing.factor_results ?? {}),
        JSON.stringify(computedScores),
        JSON.stringify(body.location ?? existing.location ?? {}),
        expiresAt,
        body.sync_version,
        now.toISOString()
      ]
    );

    await this.insertEvent(body.id, user.id, 'updated', {
      sync_version: body.sync_version,
      site_name: body.site_name,
      warnings: draftValidation.warnings
    });

    return {
      id: updateResult.rows[0].id,
      server_status: 'synced',
      updated_at: updateResult.rows[0].updated_at,
      warnings: draftValidation.warnings,
      factor_results: draftValidation.factor_results ?? undefined
    };
  }

  async patchSurvey(user: AuthenticatedUser, surveyId: string, body: SurveyPatchBody): Promise<{ id: string; updated_at: string }> {
    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id);

    if (body.factors) {
      const check = this.ibpRules.validateDraft(
        body.factors,
        body.region_version ?? existing.region_version,
        body.vegetation_stage ?? existing.vegetation_stage
      );
      if (!check.ok) {
        throw new UnprocessableEntityException({
          message: 'IBP factor validation failed',
          errors: check.errors,
          warnings: check.warnings
        });
      }
      if (check.scores) {
        body.scores = check.scores;
      }
      if (check.factor_results) {
        const mutableBody = body as SurveyPatchBody & { factor_results?: SurveyRow['factor_results'] };
        mutableBody.factor_results = check.factor_results;
      }
    }

    const result = await this.db.query<{ id: string; updated_at: string }>(
      `UPDATE surveys
       SET site_name = COALESCE($3, site_name),
           visibility = COALESCE($4, visibility),
           region_version = COALESCE($5, region_version),
           vegetation_stage = COALESCE($6, vegetation_stage),
           factors = COALESCE($7::jsonb, factors),
           factor_results = COALESCE($8::jsonb, factor_results),
           scores = COALESCE($9::jsonb, scores),
           location = COALESCE($10::jsonb, location),
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
        (body as SurveyPatchBody & { factor_results?: SurveyRow['factor_results'] }).factor_results
          ? JSON.stringify((body as SurveyPatchBody & { factor_results?: SurveyRow['factor_results'] }).factor_results)
          : null,
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

  async getSurveyById(
    user: AuthenticatedUser,
    surveyId: string
  ): Promise<
    Pick<
      SurveyRow,
      | 'id'
      | 'site_name'
      | 'status'
      | 'visibility'
      | 'region_version'
      | 'vegetation_stage'
      | 'factors'
      | 'factor_results'
      | 'scores'
      | 'location'
      | 'created_at'
      | 'updated_at'
      | 'submitted_at'
      | 'expires_at'
      | 'sync_version'
    >
  > {
    const survey = await this.getSurveyForUserOrThrow(surveyId, user.id);

    return {
      id: survey.id,
      site_name: survey.site_name,
      status: survey.status,
      visibility: survey.visibility,
      region_version: survey.region_version,
      vegetation_stage: survey.vegetation_stage,
      factors: survey.factors,
      factor_results: survey.factor_results,
      scores: survey.scores,
      location: survey.location,
      created_at: survey.created_at,
      updated_at: survey.updated_at,
      submitted_at: survey.submitted_at,
      expires_at: survey.expires_at,
      sync_version: survey.sync_version
    };
  }

  async submitSurvey(
    user: AuthenticatedUser,
    surveyId: string
  ): Promise<{ id: string; status: 'submitted'; submitted_at: string; scores: Record<string, number>; warnings?: string[] }> {
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
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const result = await this.db.query<{ id: string; status: 'submitted'; submitted_at: string }>(
      `UPDATE surveys
       SET status = 'submitted',
           submitted_at = NOW(),
           factor_results = $3::jsonb,
           scores = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, status, submitted_at::text`,
      [surveyId, user.id, JSON.stringify(validation.factor_results ?? {}), JSON.stringify(validation.scores)]
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Survey not found');
    }

    await this.insertEvent(surveyId, user.id, 'submitted', {
      scores: validation.scores,
      warnings: validation.warnings
    });

    return {
      ...result.rows[0],
      scores: validation.scores,
      warnings: validation.warnings
    };
  }

  async deleteSurvey(
    user: AuthenticatedUser,
    surveyId: string,
    options?: { allowMissing?: boolean }
  ): Promise<{ id: string; deleted_at: string | null; already_deleted: boolean; missing: boolean }> {
    const existing = await this.getSurveyForUser(surveyId, user.id, false);
    if (!existing) {
      if (options?.allowMissing) {
        return { id: surveyId, deleted_at: null, already_deleted: false, missing: true };
      }
      throw new NotFoundException('Survey not found');
    }

    if (existing.deleted_at) {
      return { id: existing.id, deleted_at: existing.deleted_at, already_deleted: true, missing: false };
    }

    const attachmentsResult = await this.db.query<Pick<AttachmentRow, 'id' | 'storage_key'>>(
      `SELECT id, storage_key
       FROM attachments
       WHERE survey_id = $1
         AND deleted_at IS NULL`,
      [surveyId]
    );

    await this.db.query(
      `UPDATE attachments
       SET deleted_at = NOW()
       WHERE survey_id = $1
         AND deleted_at IS NULL`,
      [surveyId]
    );

    for (const attachment of attachmentsResult.rows) {
      await this.cleanupAttachmentStorage(attachment.storage_key);
    }

    const deletedSurvey = await this.db.query<{ id: string; deleted_at: string }>(
      `UPDATE surveys
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND deleted_at IS NULL
       RETURNING id, deleted_at::text`,
      [surveyId, user.id]
    );

    const deletedAt = deletedSurvey.rows[0]?.deleted_at ?? existing.deleted_at ?? null;

    await this.insertEvent(surveyId, user.id, 'deleted', {
      attachment_count_deleted: attachmentsResult.rows.length
    });

    return {
      id: surveyId,
      deleted_at: deletedAt,
      already_deleted: false,
      missing: false
    };
  }

  async createAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    body: CreateAttachmentBody
  ): Promise<{ attachment_id: string; storage_key: string; upload_url: string; confirm_url: string }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id);

    if (!body?.mime_type || typeof body.mime_type !== 'string') {
      throw new BadRequestException('mime_type is required');
    }

    if (!Number.isInteger(body.size_bytes) || (body.size_bytes ?? 0) <= 0) {
      throw new BadRequestException('size_bytes must be a positive integer');
    }

    if ((body.size_bytes ?? 0) > 25 * 1024 * 1024) {
      throw new BadRequestException('size_bytes exceeds V1 max size (25MB)');
    }

    const attachmentId = randomUUID();
    const uploadToken = randomUUID();
    const extension = this.extensionFromMime(body.mime_type);
    const storageKey = `surveys/${surveyId}/${attachmentId}${extension}`;
    const confirmUrl = this.buildConfirmUrl(surveyId, attachmentId, uploadToken);
    const uploadUrl = await this.buildUploadUrl(storageKey, body.mime_type, confirmUrl);

    await this.db.query(
      `INSERT INTO attachments (id, survey_id, storage_key, mime_type, size_bytes, captured_at, metadata, upload_token, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
      [
        attachmentId,
        surveyId,
        storageKey,
        body.mime_type,
        body.size_bytes,
        body.captured_at ?? null,
        JSON.stringify(body.metadata ?? {}),
        uploadToken
      ]
    );

    await this.insertEvent(surveyId, user.id, 'attachment_created', {
      attachment_id: attachmentId,
      storage_key: storageKey,
      mime_type: body.mime_type,
      size_bytes: body.size_bytes
    });

    return {
      attachment_id: attachmentId,
      storage_key: storageKey,
      upload_url: uploadUrl,
      confirm_url: confirmUrl
    };
  }

  async uploadAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
    token?: string,
    file?: { buffer: Buffer; mimetype?: string; size?: number; originalname?: string }
  ): Promise<{ attachment_id: string; uploaded_at: string }> {
    if (!token) {
      throw new BadRequestException('upload token is required');
    }

    await this.getSurveyForUserOrThrow(surveyId, user.id);

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId]
    );

    if (!existing.rows[0]) {
      throw new NotFoundException('Attachment not found');
    }

    if (existing.rows[0].upload_token !== token) {
      throw new BadRequestException('invalid upload token');
    }

    if (existing.rows[0].uploaded_at) {
      return {
        attachment_id: existing.rows[0].id,
        uploaded_at: existing.rows[0].uploaded_at
      };
    }

    if (this.objectStorageMode === 'minio') {
      if (!this.s3Client) {
        throw new BadRequestException('object storage client is not configured');
      }
      // In MinIO mode, file upload is done directly via presigned URL.
      // Here we only confirm object existence before marking uploaded.
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.s3Bucket,
            Key: existing.rows[0].storage_key
          })
        );
      } catch {
        throw new BadRequestException('uploaded object not found in storage');
      }
    } else {
      if (!file?.buffer || file.buffer.length === 0) {
        throw new BadRequestException('file is required');
      }

      if (file.buffer.length > 25 * 1024 * 1024) {
        throw new BadRequestException('file exceeds V1 max size (25MB)');
      }

      const storagePath = join(this.uploadsRootDir, existing.rows[0].storage_key);
      await mkdir(dirname(storagePath), { recursive: true });
      await writeFile(storagePath, file.buffer);
    }

    const updated = await this.db.query<{ id: string; uploaded_at: string }>(
      `UPDATE attachments
       SET uploaded_at = NOW()
       WHERE id = $1 AND survey_id = $2
       RETURNING id, uploaded_at::text`,
      [attachmentId, surveyId]
    );

    await this.insertEvent(surveyId, user.id, 'attachment_uploaded', {
      attachment_id: attachmentId,
      storage_key: existing.rows[0].storage_key,
      object_storage_mode: this.objectStorageMode,
      bytes_written: file?.buffer?.length ?? null
    });

    return {
      attachment_id: updated.rows[0].id,
      uploaded_at: updated.rows[0].uploaded_at
    };
  }

  async deleteAttachment(user: AuthenticatedUser, surveyId: string, attachmentId: string): Promise<void> {
    await this.getSurveyForUserOrThrow(surveyId, user.id);

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId]
    );

    if (!existing.rows[0]) {
      throw new NotFoundException('Attachment not found');
    }

    await this.db.query(
      `UPDATE attachments
       SET deleted_at = NOW()
       WHERE id = $1 AND survey_id = $2`,
      [attachmentId, surveyId]
    );

    await this.cleanupAttachmentStorage(existing.rows[0].storage_key);

    await this.insertEvent(surveyId, user.id, 'attachment_deleted', {
      attachment_id: attachmentId,
      storage_key: existing.rows[0].storage_key
    });
  }

  async listAttachments(
    user: AuthenticatedUser,
    surveyId: string
  ): Promise<{ items: Array<Pick<AttachmentRow, 'id' | 'survey_id' | 'storage_key' | 'mime_type' | 'size_bytes' | 'created_at' | 'uploaded_at'>> }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id);

    const result = await this.db.query<
      Pick<AttachmentRow, 'id' | 'survey_id' | 'storage_key' | 'mime_type' | 'size_bytes' | 'created_at' | 'uploaded_at'>
    >(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, uploaded_at::text
       FROM attachments
       WHERE survey_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [surveyId]
    );

    return { items: result.rows };
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

  async syncBatch(user: AuthenticatedUser, body: SyncBatchBody): Promise<{ results: SyncOperationResult[] }> {
    const operations = body.operations;
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new BadRequestException('operations must be a non-empty array');
    }
    if (operations.length > 100) {
      throw new BadRequestException('operations exceeds V1 batch limit (100)');
    }

    const results: SyncOperationResult[] = [];

    for (const operation of operations) {
      const clientRef = typeof operation.client_ref === 'string' && operation.client_ref.trim() ? operation.client_ref : null;
      const entity = typeof operation.entity === 'string' ? operation.entity : 'unknown';
      const action = typeof operation.action === 'string' ? operation.action : 'unknown';

      try {
        if (operation.entity === 'survey' && operation.action === 'upsert') {
          if (!operation.payload || typeof operation.payload !== 'object') {
            throw new BadRequestException('survey upsert payload is required');
          }
          const data = await this.upsertForUser(user, operation.payload as SurveyUpsertBody);
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: 'synced',
            data: data as Record<string, unknown>
          });
          continue;
        }

        if (operation.entity === 'survey' && operation.action === 'delete') {
          const payloadSurveyId =
            operation.payload && typeof operation.payload === 'object'
              ? (operation.payload as { id?: unknown }).id
              : undefined;
          const surveyId = operation.survey_id ?? (typeof payloadSurveyId === 'string' ? payloadSurveyId : undefined);
          if (!surveyId || typeof surveyId !== 'string') {
            throw new BadRequestException('survey_id is required for survey delete');
          }

          const data = await this.deleteSurvey(user, surveyId, { allowMissing: true });
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: 'synced',
            data: data as Record<string, unknown>
          });
          continue;
        }

        if (operation.entity === 'attachment' && operation.action === 'create') {
          if (!operation.survey_id) {
            throw new BadRequestException('survey_id is required for attachment create');
          }
          if (!operation.payload || typeof operation.payload !== 'object') {
            throw new BadRequestException('attachment create payload is required');
          }
          const data = await this.createAttachment(user, operation.survey_id, operation.payload as CreateAttachmentBody);
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: 'synced',
            data: data as Record<string, unknown>
          });
          continue;
        }

        throw new BadRequestException(`Unsupported sync operation: ${entity}.${action}`);
      } catch (error) {
        const mapped = this.mapSyncError(error);
        results.push({
          client_ref: clientRef,
          entity,
          action,
          status: mapped.status,
          error: mapped.error
        });
      }
    }

    return { results };
  }

  async getSyncChanges(
    user: AuthenticatedUser,
    cursor?: string,
    limitRaw?: number
  ): Promise<{
    cursor_in: string | null;
    cursor_out: string | null;
    has_more: boolean;
    events: SyncChangeEvent[];
    surveys: SyncChangeSurvey[];
    attachments: SyncChangeAttachment[];
  }> {
    const limit = this.normalizeChangesLimit(limitRaw);
    const parsedCursor = this.parseChangesCursor(cursor);

    const rawEvents = await this.db.query<SyncChangeEvent>(
      `SELECT e.id, e.survey_id, e.actor_id, e.event_type, e.payload, e.created_at::text
       FROM survey_events e
       JOIN surveys s ON s.id = e.survey_id
       WHERE s.user_id = $1
         AND (
           e.created_at > $2::timestamptz
           OR (e.created_at = $2::timestamptz AND e.id > $3)
         )
       ORDER BY e.created_at ASC, e.id ASC
       LIMIT $4`,
      [user.id, parsedCursor.timestamp, parsedCursor.eventId, limit + 1]
    );

    const hasMore = rawEvents.rows.length > limit;
    const events = hasMore ? rawEvents.rows.slice(0, limit) : rawEvents.rows;

    if (events.length === 0) {
      return {
        cursor_in: parsedCursor.original,
        cursor_out: parsedCursor.original,
        has_more: false,
        events: [],
        surveys: [],
        attachments: []
      };
    }

    const surveyIds = Array.from(new Set(events.map((event) => event.survey_id)));
    const attachmentIds = Array.from(
      new Set(
        events
          .map((event) => this.extractAttachmentId(event.payload))
          .filter((value): value is string => Boolean(value))
      )
    );

    const surveys = surveyIds.length
      ? (
          await this.db.query<SyncChangeSurvey>(
            `SELECT
               id,
               site_name,
               status,
               visibility,
               region_version,
               vegetation_stage,
               factors,
               factor_results,
               scores,
               location,
               created_at::text,
               updated_at::text,
               submitted_at::text,
               expires_at::text,
               sync_version,
               deleted_at::text
             FROM surveys
             WHERE user_id = $1
               AND id = ANY($2::text[])
             ORDER BY updated_at ASC, id ASC`,
            [user.id, surveyIds]
          )
        ).rows
      : [];

    const attachments = attachmentIds.length
      ? (
          await this.db.query<SyncChangeAttachment>(
            `SELECT
               a.id,
               a.survey_id,
               a.storage_key,
               a.mime_type,
               a.size_bytes,
               a.captured_at::text,
               a.metadata,
               a.created_at::text,
               a.uploaded_at::text,
               a.deleted_at::text
             FROM attachments a
             JOIN surveys s ON s.id = a.survey_id
             WHERE s.user_id = $1
               AND a.id = ANY($2::text[])
             ORDER BY a.created_at ASC, a.id ASC`,
            [user.id, attachmentIds]
          )
        ).rows
      : [];

    const lastEvent = events[events.length - 1];
    const cursorOut = this.buildChangesCursor(lastEvent.created_at, lastEvent.id);

    return {
      cursor_in: parsedCursor.original,
      cursor_out: cursorOut,
      has_more: hasMore,
      events,
      surveys,
      attachments
    };
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

  private extensionFromMime(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/heic') return '.heic';
    if (normalized === 'image/webp') return '.webp';
    return '.bin';
  }

  private buildConfirmUrl(surveyId: string, attachmentId: string, uploadToken: string): string {
    const token = encodeURIComponent(uploadToken);
    return `/surveys/${surveyId}/attachments/${attachmentId}/upload?token=${token}`;
  }

  private async buildUploadUrl(storageKey: string, mimeType: string, fallbackUrl: string): Promise<string> {
    if (this.objectStorageMode !== 'minio' || !this.s3Client) {
      return fallbackUrl;
    }

    await this.ensureS3Bucket();

    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: storageKey,
      ContentType: mimeType
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 15 * 60 });
  }

  private async cleanupAttachmentStorage(storageKey: string): Promise<void> {
    if (this.objectStorageMode === 'minio') {
      if (this.s3Client) {
        await this.s3Client
          .send(
            new DeleteObjectCommand({
              Bucket: this.s3Bucket,
              Key: storageKey
            })
          )
          .catch(() => undefined);
      }
      return;
    }

    const storagePath = join(this.uploadsRootDir, storageKey);
    await rm(storagePath, { force: true }).catch(() => undefined);
  }

  private async ensureS3Bucket(): Promise<void> {
    if (this.s3BucketReady || !this.s3Client) return;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }));
      this.s3BucketReady = true;
      return;
    } catch {
      // Bucket might not exist yet.
    }

    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.s3Bucket }));
      this.s3BucketReady = true;
    } catch {
      // If created concurrently by another request/process, verify it exists now.
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }));
      this.s3BucketReady = true;
    }
  }

  private mapSyncError(error: unknown): {
    status: 'retryable_error' | 'fatal_error';
    error: { code: string; message: string; http_status?: number; details?: Record<string, unknown> };
  } {
    let httpStatus: number | undefined;
    if (error instanceof HttpException) {
      httpStatus = error.getStatus();
    }

    const extracted = this.extractSyncErrorPayload(error);
    const retryable = typeof httpStatus === 'number' ? httpStatus >= 500 || httpStatus === 429 : true;
    const code = extracted.code
      ? extracted.code
      : retryable
        ? this.defaultRetryableSyncCode(httpStatus)
        : typeof httpStatus === 'number'
          ? `http_${httpStatus}`
          : 'sync_fatal_error';

    return {
      status: retryable ? 'retryable_error' : 'fatal_error',
      error: {
        code,
        message: extracted.message,
        http_status: httpStatus,
        details: extracted.details
      }
    };
  }

  private extractSyncErrorPayload(error: unknown): {
    code?: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string' && response.trim().length > 0) {
        return { message: response };
      }
      if (response && typeof response === 'object') {
        const objectResponse = response as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          error?: unknown;
        };
        const message = Array.isArray(objectResponse.message)
          ? objectResponse.message.map((value) => String(value)).join(' | ')
          : typeof objectResponse.message === 'string'
            ? objectResponse.message
            : typeof objectResponse.error === 'string'
              ? objectResponse.error
              : 'Sync operation failed';
        const code = typeof objectResponse.code === 'string' ? objectResponse.code : undefined;
        const details =
          objectResponse.details && typeof objectResponse.details === 'object' && !Array.isArray(objectResponse.details)
            ? (objectResponse.details as Record<string, unknown>)
            : undefined;
        return { code, message, details };
      }
    }

    if (error instanceof Error && error.message) {
      return { message: error.message };
    }

    return { message: 'Unexpected sync failure' };
  }

  private defaultRetryableSyncCode(httpStatus?: number): string {
    if (httpStatus === 429) {
      return 'rate_limited';
    }
    if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504 || typeof httpStatus !== 'number') {
      return 'network_gateway_error';
    }
    return 'transient_upstream_error';
  }

  private normalizeChangesLimit(limitRaw?: number): number {
    if (!Number.isFinite(limitRaw)) return 50;
    const integer = Math.trunc(limitRaw ?? 0);
    if (integer <= 0) return 50;
    return Math.min(200, integer);
  }

  private parseChangesCursor(cursor?: string): { timestamp: string; eventId: string; original: string | null } {
    if (!cursor || cursor.trim().length === 0) {
      return {
        timestamp: '1970-01-01T00:00:00.000Z',
        eventId: '',
        original: null
      };
    }

    const [timestampRaw, eventIdRaw] = cursor.split('|');
    if (!timestampRaw || Number.isNaN(Date.parse(timestampRaw))) {
      throw new BadRequestException('Invalid sync cursor');
    }

    return {
      timestamp: timestampRaw,
      eventId: eventIdRaw ?? '',
      original: cursor
    };
  }

  private buildChangesCursor(timestamp: string, eventId: string): string {
    return `${timestamp}|${eventId}`;
  }

  private extractAttachmentId(payload: Record<string, unknown> | null): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const value = (payload as { attachment_id?: unknown }).attachment_id;
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    return value;
  }
}
