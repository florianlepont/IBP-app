import {
  BadRequestException,
  ConflictException,
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
import { normalizeDateInput, PublicMapDbRow, toPublicMapItem } from './public-map.utils';
import { mapSyncError } from './sync-error.utils';
import {
  AttachmentRow,
  CreateAttachmentBody,
  ParcelRow,
  SurveyEventRow,
  SurveyPatchBody,
  SurveyVisibilityPatchBody,
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

  async listForUser(
    user: AuthenticatedUser,
    input?: { status?: string; from?: string; to?: string; q?: string }
  ): Promise<
    Array<
      Pick<
        SurveyRow,
        'id' | 'site_name' | 'status' | 'visibility' | 'parcel_id' | 'observation_year' | 'version_number' | 'updated_at' | 'sync_version'
      >
    >
  > {
    const filters: string[] = ['user_id = $1', 'deleted_at IS NULL'];
    const values: unknown[] = [user.id];

    const normalizedStatus = this.normalizeSurveyStatusFilter(input?.status);
    if (normalizedStatus) {
      values.push(normalizedStatus);
      filters.push(`status = $${values.length}`);
    }

    const fromDate = normalizeDateInput(input?.from);
    if (fromDate) {
      values.push(fromDate);
      filters.push(`updated_at::date >= $${values.length}::date`);
    }

    const toDate = normalizeDateInput(input?.to);
    if (toDate) {
      values.push(toDate);
      filters.push(`updated_at::date <= $${values.length}::date`);
    }

    const query = input?.q?.trim();
    if (query) {
      values.push(`%${query}%`);
      filters.push(`(site_name ILIKE $${values.length} OR parcel_id ILIKE $${values.length})`);
    }

    const result = await this.db.query<
      Pick<SurveyRow, 'id' | 'site_name' | 'status' | 'visibility' | 'parcel_id' | 'observation_year' | 'version_number' | 'updated_at' | 'sync_version'>
    >(
      `SELECT id, site_name, status, visibility, parcel_id, observation_year, version_number, updated_at::text, sync_version
       FROM surveys
       WHERE ${filters.join(' AND ')}
       ORDER BY updated_at DESC`,
      values
    );

    return result.rows;
  }

  private normalizeSurveyStatusFilter(status?: string): SurveyRow['status'] | null {
    if (!status || typeof status !== 'string') {
      return null;
    }

    const normalized = status.trim().toLowerCase();
    if (normalized === 'draft' || normalized === 'submitted' || normalized === 'synced' || normalized === 'error' || normalized === 'expired') {
      return normalized;
    }

    return null;
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
    const locationPayload = this.normalizeLocationPayload(body.location ?? existing?.location ?? {});
    const normalizedParcelId = this.normalizeParcelId(body.parcel_id) ?? existing?.parcel_id ?? null;
    const resolvedParcel = normalizedParcelId
      ? await this.ensureParcelById(normalizedParcelId, locationPayload)
      : await this.resolveParcelFromLocation(locationPayload);
    const parcelId = normalizedParcelId ?? resolvedParcel?.parcel_id ?? null;
    const observationYear = this.normalizeObservationYear(body.observation_year) ?? existing?.observation_year ?? (parcelId ? now.getUTCFullYear() : null);
    const versionNumber =
      this.normalizeVersionNumber(body.version_number) ?? existing?.version_number ?? (parcelId ? await this.getDefaultVersionNumber(parcelId, body.id) : null);
    const previousSurveyId = this.normalizePreviousSurveyId(body.previous_survey_id) ?? existing?.previous_survey_id ?? null;

    if (!existing) {
      const createdAt = now.toISOString();
      const insertResult = await this.db.query<{ id: string; updated_at: string }>(
        `INSERT INTO surveys (
          id, user_id, site_name, status, visibility, parcel_id, observation_year, version_number, previous_survey_id, region_version, vegetation_stage,
          factors, factor_results, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20
        )
        RETURNING id, updated_at::text`,
        [
          body.id,
          user.id,
          body.site_name,
          body.status ?? 'draft',
          body.visibility ?? 'private',
          parcelId,
          observationYear,
          versionNumber,
          previousSurveyId,
          body.region_version ?? null,
          body.vegetation_stage ?? null,
          JSON.stringify(body.factors ?? {}),
          JSON.stringify(draftValidation.factor_results ?? {}),
          JSON.stringify(computedScores),
          JSON.stringify(locationPayload),
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
           parcel_id = $6,
           observation_year = $7,
           version_number = $8,
           previous_survey_id = $9,
           region_version = $10,
           vegetation_stage = $11,
           factors = $12::jsonb,
           factor_results = $13::jsonb,
           scores = $14::jsonb,
           location = $15::jsonb,
           expires_at = $16,
           sync_version = $17,
           updated_at = $18
       WHERE id = $1 AND user_id = $2
       RETURNING id, updated_at::text`,
      [
        body.id,
        user.id,
        body.site_name,
        body.status ?? existing.status,
        body.visibility ?? existing.visibility,
        parcelId,
        observationYear,
        versionNumber,
        previousSurveyId,
        body.region_version ?? existing.region_version,
        body.vegetation_stage ?? existing.vegetation_stage,
        JSON.stringify(body.factors ?? existing.factors ?? {}),
        JSON.stringify(draftValidation.factor_results ?? existing.factor_results ?? {}),
        JSON.stringify(computedScores),
        JSON.stringify(locationPayload),
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
    const forbiddenPostSubmitFields = this.getSubmittedReadOnlyFields(body);

    if (existing.status === 'submitted' && forbiddenPostSubmitFields.length > 0) {
      throw new UnprocessableEntityException({
        code: 'submitted_read_only_fields',
        message: 'submitted survey is read-only for observation fields',
        forbidden_fields: forbiddenPostSubmitFields
      });
    }

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

    const normalizedLocation = body.location ? this.normalizeLocationPayload(body.location) : null;
    const normalizedParcelId = this.normalizeParcelId(body.parcel_id);
    const resolvedParcel = normalizedParcelId
      ? await this.ensureParcelById(normalizedParcelId, normalizedLocation ?? existing.location)
      : normalizedLocation
        ? await this.resolveParcelFromLocation(normalizedLocation)
        : null;
    const parcelIdForPatch = normalizedParcelId ?? resolvedParcel?.parcel_id ?? null;
    const observationYearForPatch =
      this.normalizeObservationYear(body.observation_year) ??
      (parcelIdForPatch && !existing.observation_year ? new Date().getUTCFullYear() : null);
    const versionNumberForPatch =
      this.normalizeVersionNumber(body.version_number) ??
      (parcelIdForPatch && !existing.version_number ? await this.getDefaultVersionNumber(parcelIdForPatch, surveyId) : null);
    const hasPreviousSurveyId = Object.prototype.hasOwnProperty.call(body, 'previous_survey_id');
    const previousSurveyIdForPatch = hasPreviousSurveyId ? this.normalizePreviousSurveyId(body.previous_survey_id) : null;

    const result = await this.db.query<{ id: string; updated_at: string }>(
      `UPDATE surveys
       SET site_name = COALESCE($3, site_name),
           visibility = COALESCE($4, visibility),
           parcel_id = COALESCE($5, parcel_id),
           observation_year = COALESCE($6, observation_year),
           version_number = COALESCE($7, version_number),
           previous_survey_id = COALESCE($8, previous_survey_id),
           region_version = COALESCE($9, region_version),
           vegetation_stage = COALESCE($10, vegetation_stage),
           factors = COALESCE($11::jsonb, factors),
           factor_results = COALESCE($12::jsonb, factor_results),
           scores = COALESCE($13::jsonb, scores),
           location = COALESCE($14::jsonb, location),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, updated_at::text`,
      [
        surveyId,
        user.id,
        body.site_name ?? null,
        body.visibility ?? null,
        parcelIdForPatch,
        observationYearForPatch,
        versionNumberForPatch,
        previousSurveyIdForPatch,
        body.region_version ?? null,
        body.vegetation_stage ?? null,
        body.factors ? JSON.stringify(body.factors) : null,
        (body as SurveyPatchBody & { factor_results?: SurveyRow['factor_results'] }).factor_results
          ? JSON.stringify((body as SurveyPatchBody & { factor_results?: SurveyRow['factor_results'] }).factor_results)
          : null,
        body.scores ? JSON.stringify(body.scores) : null,
        normalizedLocation ? JSON.stringify(normalizedLocation) : null
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

  async patchSurveyVisibility(
    user: AuthenticatedUser,
    surveyId: string,
    body: SurveyVisibilityPatchBody
  ): Promise<{ id: string; visibility: 'private' | 'public'; updated_at: string }> {
    if (body.visibility !== 'private' && body.visibility !== 'public') {
      throw new BadRequestException('visibility must be private or public');
    }

    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id);
    if (existing.visibility === body.visibility) {
      return {
        id: existing.id,
        visibility: existing.visibility,
        updated_at: existing.updated_at
      };
    }

    const result = await this.db.query<{ id: string; visibility: 'private' | 'public'; updated_at: string }>(
      `UPDATE surveys
       SET visibility = $3,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING id, visibility, updated_at::text`,
      [surveyId, user.id, body.visibility]
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Survey not found');
    }

    await this.insertEvent(surveyId, user.id, 'visibility_changed', {
      from: existing.visibility,
      to: result.rows[0].visibility
    });

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
      | 'parcel_id'
      | 'observation_year'
      | 'version_number'
      | 'previous_survey_id'
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
      parcel_id: survey.parcel_id,
      observation_year: survey.observation_year,
      version_number: survey.version_number,
      previous_survey_id: survey.previous_survey_id,
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
      factors: existing.factors,
      location: existing.location
    });
    const parcelValidation = await this.validateParcelSubmit(existing);

    if (parcelValidation.versionConflict) {
      throw new ConflictException({
        code: 'parcel_version_conflict',
        message: 'Parcel version conflict',
        details: {
          parcel_id: existing.parcel_id,
          expected_version_number: parcelValidation.versionConflict.expectedVersionNumber,
          client_version_number: existing.version_number
        }
      });
    }

    if (!validation.ok || !validation.scores || parcelValidation.errors.length > 0) {
      const isExpired = validation.issues.some((issue) => issue.code === 'survey_expired');
      if (isExpired && existing.status !== 'expired') {
        await this.db.query(
          `UPDATE surveys
           SET status = 'expired',
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [surveyId, user.id]
        );
        await this.insertEvent(surveyId, user.id, 'expired', {
          reason: 'submit_after_deadline',
          expires_at: existing.expires_at
        });
      }

      throw new UnprocessableEntityException({
        code: parcelValidation.code,
        message: 'Survey cannot be submitted',
        errors: [...validation.errors, ...parcelValidation.errors],
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

  async deleteAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
    options?: { allowMissing?: boolean }
  ): Promise<{ survey_id: string; attachment_id: string; missing: boolean; deleted: boolean }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id);

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId]
    );

    if (!existing.rows[0]) {
      if (options?.allowMissing) {
        return {
          survey_id: surveyId,
          attachment_id: attachmentId,
          missing: true,
          deleted: false
        };
      }
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

    return {
      survey_id: surveyId,
      attachment_id: attachmentId,
      missing: false,
      deleted: true
    };
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

  async getPublicMapItems(input?: {
    from?: string;
    to?: string;
    region?: string;
  }): Promise<{
    items: Array<{
      survey_id: string;
      display_location: { lat: number; lng: number };
      survey_date: string;
      region_code: string;
      ibp_total: number;
    }>;
  }> {
    const filters: string[] = [
      `deleted_at IS NULL`,
      `visibility = 'public'`,
      `status = 'submitted'`,
      `submitted_at IS NOT NULL`
    ];
    const values: unknown[] = [];

    const fromDate = normalizeDateInput(input?.from);
    if (fromDate) {
      values.push(fromDate);
      filters.push(`submitted_at::date >= $${values.length}::date`);
    }

    const toDate = normalizeDateInput(input?.to);
    if (toDate) {
      values.push(toDate);
      filters.push(`submitted_at::date <= $${values.length}::date`);
    }

    if (input?.region && input.region.trim().length > 0) {
      values.push(input.region.trim());
      filters.push(`region_version = $${values.length}`);
    }

    const result = await this.db.query<PublicMapDbRow>(
      `SELECT id, region_version, location, scores, submitted_at::text
       FROM surveys
       WHERE ${filters.join(' AND ')}
       ORDER BY submitted_at DESC
       LIMIT 500`,
      values
    );

    const items = result.rows
      .map((row) => toPublicMapItem(row))
      .filter(
        (
          item
        ): item is {
          survey_id: string;
          display_location: { lat: number; lng: number };
          survey_date: string;
          region_code: string;
          ibp_total: number;
        } => Boolean(item)
      );

    return { items };
  }

  async getPublicParcelStatuses(input?: { bbox?: string; zoom?: string; year?: string }): Promise<{
    items: Array<{
      parcel_id: string;
      study_status: 'studied' | 'not_studied';
      latest_submitted_survey_id: string | null;
      latest_observation_year: number | null;
      latest_ibp_total: number | null;
    }>;
  }> {
    const zoom = this.toFiniteNumber(input?.zoom);
    if (zoom !== null && zoom < 15) {
      return { items: [] };
    }

    const bbox = this.parseBbox(input?.bbox);
    const year = this.normalizeObservationYear(input?.year);
    const values: unknown[] = [year];
    const bboxFilters: string[] = [];

    if (bbox) {
      values.push(bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat);
      bboxFilters.push(`(p.centroid ->> 'lng')::double precision BETWEEN $2::double precision AND $3::double precision`);
      bboxFilters.push(`(p.centroid ->> 'lat')::double precision BETWEEN $4::double precision AND $5::double precision`);
    }

    const result = await this.db.query<{
      parcel_id: string;
      study_status: 'studied' | 'not_studied';
      latest_submitted_survey_id: string | null;
      latest_observation_year: number | null;
      latest_ibp_total: number | null;
    }>(
      `WITH latest_public AS (
         SELECT
           s.parcel_id,
           s.id,
           s.observation_year,
           s.version_number,
           s.submitted_at,
           s.scores,
           ROW_NUMBER() OVER (
             PARTITION BY s.parcel_id
             ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST
           ) AS rank_in_parcel
         FROM surveys s
         WHERE s.deleted_at IS NULL
           AND s.status = 'submitted'
           AND s.visibility = 'public'
           AND s.parcel_id IS NOT NULL
           AND ($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)
       )
       SELECT
         p.parcel_id,
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
       LIMIT 1000`,
      values
    );

    return {
      items: result.rows.map((row) => ({
        parcel_id: row.parcel_id,
        study_status: row.study_status,
        latest_submitted_survey_id: row.latest_submitted_survey_id,
        latest_observation_year: row.latest_observation_year,
        latest_ibp_total: row.latest_ibp_total
      }))
    };
  }

  async resolveParcelByCoordinates(input?: { lat?: string; lng?: string }): Promise<{
    parcel: {
      parcel_id: string;
      commune_code: string;
      section: string;
      number: string;
      centroid: { lat: number; lng: number };
    };
  }> {
    const lat = this.toFiniteNumber(input?.lat);
    const lng = this.toFiniteNumber(input?.lng);
    if (lat === null || lng === null) {
      throw new BadRequestException('lat and lng query parameters are required');
    }

    const parcel = await this.resolveParcelFromLocation({ source: 'gps', lat, lng });
    if (!parcel) {
      throw new UnprocessableEntityException({
        code: 'parcel_invalid',
        message: 'Parcel could not be resolved from coordinates'
      });
    }

    const centroid = this.normalizeCentroid(parcel.centroid);
    if (!centroid) {
      throw new UnprocessableEntityException({
        code: 'parcel_invalid',
        message: 'Resolved parcel has invalid centroid metadata'
      });
    }

    return {
      parcel: {
        parcel_id: parcel.parcel_id,
        commune_code: parcel.commune_code,
        section: parcel.section,
        number: parcel.number,
        centroid
      }
    };
  }

  async getParcelSurveyHistory(
    user: AuthenticatedUser,
    parcelIdRaw: string,
    limitRaw?: string
  ): Promise<{
    parcel_id: string;
    items: Array<{
      survey_id: string;
      observation_year: number | null;
      version_number: number | null;
      scores: Record<string, unknown>;
      factor_results: Record<string, unknown>;
      submitted_at: string;
    }>;
  }> {
    const parcelId = this.normalizeParcelId(parcelIdRaw);
    if (!parcelId) {
      throw new BadRequestException('parcel_id is required');
    }

    const limit = this.normalizeParcelHistoryLimit(limitRaw);
    const result = await this.db.query<{
      survey_id: string;
      observation_year: number | null;
      version_number: number | null;
      scores: Record<string, unknown>;
      factor_results: Record<string, unknown>;
      submitted_at: string;
    }>(
      `SELECT
         id AS survey_id,
         observation_year,
         version_number,
         scores,
         factor_results,
         submitted_at::text
       FROM surveys
       WHERE parcel_id = $1
         AND deleted_at IS NULL
         AND status = 'submitted'
         AND submitted_at IS NOT NULL
         AND (visibility = 'public' OR user_id = $2)
       ORDER BY observation_year ASC NULLS LAST, version_number ASC NULLS LAST, submitted_at ASC
       LIMIT $3`,
      [parcelId, user.id, limit]
    );

    return {
      parcel_id: parcelId,
      items: result.rows
    };
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

        if (operation.entity === 'survey' && operation.action === 'visibility_update') {
          const payloadVisibility =
            operation.payload && typeof operation.payload === 'object'
              ? (operation.payload as { visibility?: unknown }).visibility
              : undefined;

          if (!operation.survey_id || typeof operation.survey_id !== 'string') {
            throw new BadRequestException('survey_id is required for survey visibility_update');
          }
          if (payloadVisibility !== 'private' && payloadVisibility !== 'public') {
            throw new BadRequestException('visibility must be private or public for survey visibility_update');
          }

          const data = await this.patchSurveyVisibility(user, operation.survey_id, {
            visibility: payloadVisibility
          });
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

        if (operation.entity === 'attachment' && operation.action === 'delete') {
          const payloadAttachmentId =
            operation.payload && typeof operation.payload === 'object'
              ? (operation.payload as { attachment_id?: unknown }).attachment_id
              : undefined;

          if (!operation.survey_id || typeof operation.survey_id !== 'string') {
            throw new BadRequestException('survey_id is required for attachment delete');
          }
          if (!payloadAttachmentId || typeof payloadAttachmentId !== 'string') {
            throw new BadRequestException('attachment_id is required for attachment delete');
          }

          const data = await this.deleteAttachment(user, operation.survey_id, payloadAttachmentId, { allowMissing: true });
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
        const mapped = mapSyncError(error);
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

    const hasMoreEvents = rawEvents.rows.length > limit;
    const events = hasMoreEvents ? rawEvents.rows.slice(0, limit) : rawEvents.rows;

    if (events.length > 0) {
      const surveyIds = Array.from(new Set(events.map((event) => event.survey_id)));
      const attachmentIds = Array.from(
        new Set(
          events
            .map((event) => this.extractAttachmentId(event.payload))
            .filter((value): value is string => Boolean(value))
        )
      );

      const surveys = surveyIds.length ? await this.loadSyncChangeSurveys(user.id, surveyIds) : [];
      const attachments = attachmentIds.length ? await this.loadSyncChangeAttachmentsByIds(user.id, attachmentIds) : [];

      const lastEvent = events[events.length - 1];
      const cursorOut = this.buildChangesCursor(lastEvent.created_at, lastEvent.id);

      return {
        cursor_in: parsedCursor.original,
        cursor_out: cursorOut,
        has_more: hasMoreEvents,
        events,
        surveys,
        attachments
      };
    }

    // Fallback path: include surveys changed without explicit survey_events (e.g. direct DB inserts for debug/demo).
    const rawSurveys = await this.db.query<SyncChangeSurvey>(
      `SELECT
         id,
         site_name,
         status,
         visibility,
         parcel_id,
         observation_year,
         version_number,
         previous_survey_id,
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
         AND (
           updated_at > $2::timestamptz
           OR (updated_at = $2::timestamptz AND id > $3)
         )
       ORDER BY updated_at ASC, id ASC
       LIMIT $4`,
      [user.id, parsedCursor.timestamp, parsedCursor.eventId, limit + 1]
    );

    const hasMoreSurveys = rawSurveys.rows.length > limit;
    const surveysByCursor = hasMoreSurveys ? rawSurveys.rows.slice(0, limit) : rawSurveys.rows;
    const surveys: SyncChangeSurvey[] = [...surveysByCursor];

    if (surveys.length < limit) {
      const surveysWithoutEvents = await this.loadSyncChangeSurveysWithoutEvents(user.id, limit);
      const knownSurveyIds = new Set(surveys.map((survey) => survey.id));
      for (const survey of surveysWithoutEvents) {
        if (knownSurveyIds.has(survey.id)) {
          continue;
        }
        surveys.push(survey);
        knownSurveyIds.add(survey.id);
        if (surveys.length >= limit) {
          break;
        }
      }
    }

    if (surveys.length === 0) {
      return {
        cursor_in: parsedCursor.original,
        cursor_out: parsedCursor.original,
        has_more: false,
        events: [],
        surveys: [],
        attachments: []
      };
    }

    const surveyIds = surveys.map((survey) => survey.id);
    const attachments = await this.loadSyncChangeAttachmentsBySurveyIds(user.id, surveyIds);
    const cursorOut =
      surveysByCursor.length > 0
        ? this.buildChangesCursor(surveysByCursor[surveysByCursor.length - 1].updated_at, surveysByCursor[surveysByCursor.length - 1].id)
        : parsedCursor.original;

    return {
      cursor_in: parsedCursor.original,
      cursor_out: cursorOut,
      has_more: surveysByCursor.length > 0 ? hasMoreSurveys : false,
      events: [],
      surveys,
      attachments
    };
  }

  private async loadSyncChangeSurveys(userId: string, surveyIds: string[]): Promise<SyncChangeSurvey[]> {
    const result = await this.db.query<SyncChangeSurvey>(
      `SELECT
         id,
         site_name,
         status,
         visibility,
         parcel_id,
         observation_year,
         version_number,
         previous_survey_id,
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
      [userId, surveyIds]
    );

    return result.rows;
  }

  private async loadSyncChangeAttachmentsByIds(userId: string, attachmentIds: string[]): Promise<SyncChangeAttachment[]> {
    const result = await this.db.query<SyncChangeAttachment>(
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
      [userId, attachmentIds]
    );

    return result.rows;
  }

  private async loadSyncChangeAttachmentsBySurveyIds(userId: string, surveyIds: string[]): Promise<SyncChangeAttachment[]> {
    const result = await this.db.query<SyncChangeAttachment>(
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
         AND a.survey_id = ANY($2::text[])
       ORDER BY a.created_at ASC, a.id ASC`,
      [userId, surveyIds]
    );

    return result.rows;
  }

  private async loadSyncChangeSurveysWithoutEvents(userId: string, limit: number): Promise<SyncChangeSurvey[]> {
    const result = await this.db.query<SyncChangeSurvey>(
      `SELECT
         s.id,
         s.site_name,
         s.status,
         s.visibility,
         s.parcel_id,
         s.observation_year,
         s.version_number,
         s.previous_survey_id,
         s.region_version,
         s.vegetation_stage,
         s.factors,
         s.factor_results,
         s.scores,
         s.location,
         s.created_at::text,
         s.updated_at::text,
         s.submitted_at::text,
         s.expires_at::text,
         s.sync_version,
         s.deleted_at::text
       FROM surveys s
       WHERE s.user_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM survey_events e
           WHERE e.survey_id = s.id
         )
       ORDER BY s.updated_at ASC, s.id ASC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
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

  private getSubmittedReadOnlyFields(body: SurveyPatchBody): string[] {
    const readonlyFields: Array<keyof SurveyPatchBody> = [
      'site_name',
      'parcel_id',
      'observation_year',
      'version_number',
      'previous_survey_id',
      'region_version',
      'vegetation_stage',
      'factors',
      'scores',
      'location'
    ];

    return readonlyFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
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

  private normalizeLocationPayload(value?: SurveyRow['location']): SurveyRow['location'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
  }

  private normalizeParcelId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeObservationYear(value: unknown): number | null {
    const parsed = this.toFiniteNumber(value);
    if (parsed === null) {
      return null;
    }
    const integer = Math.trunc(parsed);
    if (integer < 1900 || integer > 2200) {
      return null;
    }
    return integer;
  }

  private normalizeVersionNumber(value: unknown): number | null {
    const parsed = this.toFiniteNumber(value);
    if (parsed === null) {
      return null;
    }
    const integer = Math.trunc(parsed);
    return integer >= 1 ? integer : null;
  }

  private normalizePreviousSurveyId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private normalizeCentroid(value: Record<string, unknown>): { lat: number; lng: number } | null {
    const lat = this.toFiniteNumber(value.lat);
    const lng = this.toFiniteNumber(value.lng);
    if (lat === null || lng === null) {
      return null;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6))
    };
  }

  private parseParcelIdentifier(parcelId: string): { communeCode: string; section: string; number: string } {
    const normalized = parcelId.trim().toUpperCase();
    const match = /^(\d{5})([A-Z]{1,3})(\d{1,4})$/.exec(normalized);
    if (match) {
      return {
        communeCode: match[1],
        section: match[2].padEnd(2, 'A').slice(0, 3),
        number: match[3].padStart(4, '0').slice(-4)
      };
    }
    return {
      communeCode: '00000',
      section: 'AA',
      number: '0000'
    };
  }

  private buildSyntheticParcelDescriptor(lat: number, lng: number): {
    parcelId: string;
    communeCode: string;
    section: string;
    number: string;
    centroid: { lat: number; lng: number };
  } {
    const latKey = Math.round((lat + 90) * 10000);
    const lngKey = Math.round((lng + 180) * 10000);
    const communeCode = String(Math.abs((latKey * 13 + lngKey * 7) % 100000)).padStart(5, '0');
    const section = `${String.fromCharCode(65 + (Math.abs(latKey) % 26))}${String.fromCharCode(65 + (Math.abs(lngKey) % 26))}`;
    const number = String(Math.abs((latKey * 31 + lngKey * 17) % 10000)).padStart(4, '0');

    return {
      parcelId: `${communeCode}${section}${number}`,
      communeCode,
      section,
      number,
      centroid: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      }
    };
  }

  private async resolveParcelFromLocation(location: SurveyRow['location']): Promise<ParcelRow | null> {
    const centroid = this.normalizeCentroid(location);
    if (!centroid) {
      return null;
    }
    const descriptor = this.buildSyntheticParcelDescriptor(centroid.lat, centroid.lng);
    const result = await this.db.query<ParcelRow>(
      `INSERT INTO parcels (id, parcel_id, commune_code, section, number, geometry, centroid, source)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       ON CONFLICT (parcel_id) DO UPDATE
         SET centroid = COALESCE(NULLIF(parcels.centroid, '{}'::jsonb), EXCLUDED.centroid),
             updated_at = NOW()
       RETURNING
         id::text,
         parcel_id,
         commune_code,
         section,
         number,
         geometry,
         centroid,
         area_m2,
         source,
         created_at::text,
         updated_at::text`,
      [
        randomUUID(),
        descriptor.parcelId,
        descriptor.communeCode,
        descriptor.section,
        descriptor.number,
        JSON.stringify({}),
        JSON.stringify(descriptor.centroid),
        'synthetic_v1'
      ]
    );

    return result.rows[0] ?? null;
  }

  private async ensureParcelById(parcelId: string, location?: SurveyRow['location']): Promise<ParcelRow> {
    const existing = await this.db.query<ParcelRow>(
      `SELECT
         id::text,
         parcel_id,
         commune_code,
         section,
         number,
         geometry,
         centroid,
         area_m2,
         source,
         created_at::text,
         updated_at::text
       FROM parcels
       WHERE parcel_id = $1`,
      [parcelId]
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const parsed = this.parseParcelIdentifier(parcelId);
    const centroid = location ? this.normalizeCentroid(location) : null;
    const inserted = await this.db.query<ParcelRow>(
      `INSERT INTO parcels (id, parcel_id, commune_code, section, number, geometry, centroid, source)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       ON CONFLICT (parcel_id) DO UPDATE
         SET updated_at = NOW()
       RETURNING
         id::text,
         parcel_id,
         commune_code,
         section,
         number,
         geometry,
         centroid,
         area_m2,
         source,
         created_at::text,
         updated_at::text`,
      [
        randomUUID(),
        parcelId,
        parsed.communeCode,
        parsed.section,
        parsed.number,
        JSON.stringify({}),
        JSON.stringify(centroid ?? {}),
        'manual'
      ]
    );

    return inserted.rows[0];
  }

  private async getDefaultVersionNumber(parcelId: string, surveyIdToExclude?: string): Promise<number> {
    const result = await this.db.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM surveys
       WHERE parcel_id = $1
         AND deleted_at IS NULL
         AND status = 'submitted'
         AND ($2::text IS NULL OR id <> $2)`,
      [parcelId, surveyIdToExclude ?? null]
    );
    return result.rows[0]?.next_version ?? 1;
  }

  private async validateParcelSubmit(
    survey: SurveyRow
  ): Promise<{
    code?: 'parcel_required' | 'parcel_invalid';
    errors: string[];
    versionConflict?: { expectedVersionNumber: number };
  }> {
    const errors: string[] = [];
    const parcelId = survey.parcel_id;
    const observationYear = survey.observation_year;
    const versionNumber = survey.version_number;

    if (!parcelId) {
      errors.push('parcel_id is required for submit');
    }
    if (!observationYear) {
      errors.push('observation_year is required for submit');
    }
    if (!versionNumber) {
      errors.push('version_number is required for submit');
    }

    if (errors.length > 0 || !parcelId || !observationYear || !versionNumber) {
      return {
        code: 'parcel_required',
        errors
      };
    }

    const parcelExists = await this.db.query<{ parcel_id: string }>(
      `SELECT parcel_id
       FROM parcels
       WHERE parcel_id = $1
       LIMIT 1`,
      [parcelId]
    );

    if (!parcelExists.rows[0]) {
      return {
        code: 'parcel_invalid',
        errors: ['parcel_id does not exist in parcel registry']
      };
    }

    const expectedVersionNumber = await this.getDefaultVersionNumber(parcelId, survey.id);
    if (versionNumber !== expectedVersionNumber) {
      return {
        errors: [],
        versionConflict: {
          expectedVersionNumber
        }
      };
    }

    return {
      errors: []
    };
  }

  private normalizeParcelHistoryLimit(limitRaw?: string): number {
    const parsed = this.toFiniteNumber(limitRaw);
    if (parsed === null) {
      return 20;
    }
    const integer = Math.trunc(parsed);
    if (integer <= 0) {
      return 20;
    }
    return Math.min(100, integer);
  }

  private parseBbox(raw?: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
    if (!raw || raw.trim().length === 0) {
      return null;
    }

    const parts = raw.split(',').map((part) => part.trim());
    if (parts.length !== 4) {
      throw new BadRequestException('bbox must contain exactly 4 comma-separated numbers');
    }

    const minLng = this.toFiniteNumber(parts[0]);
    const minLat = this.toFiniteNumber(parts[1]);
    const maxLng = this.toFiniteNumber(parts[2]);
    const maxLat = this.toFiniteNumber(parts[3]);
    if (minLng === null || minLat === null || maxLng === null || maxLat === null) {
      throw new BadRequestException('bbox contains invalid coordinate values');
    }
    if (minLng >= maxLng || minLat >= maxLat) {
      throw new BadRequestException('bbox bounds are invalid');
    }

    return { minLng, minLat, maxLng, maxLat };
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
