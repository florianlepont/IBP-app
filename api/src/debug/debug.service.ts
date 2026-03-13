import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DebugService {
  constructor(private readonly db: DatabaseService) {}

  async resetIbpData(): Promise<{ surveys_deleted: number; attachments_deleted: number; events_deleted: number }> {
    this.assertEnabled();

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const events = await client.query('DELETE FROM survey_events');
      const attachments = await client.query('DELETE FROM attachments');
      const surveys = await client.query('DELETE FROM surveys');

      await client.query('COMMIT');

      return {
        surveys_deleted: surveys.rowCount ?? 0,
        attachments_deleted: attachments.rowCount ?? 0,
        events_deleted: events.rowCount ?? 0
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async resetUserData(): Promise<{
    users_deleted: number;
    surveys_deleted: number;
    attachments_deleted: number;
    events_deleted: number;
  }> {
    this.assertEnabled();

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const events = await client.query('DELETE FROM survey_events');
      const attachments = await client.query('DELETE FROM attachments');
      const surveys = await client.query('DELETE FROM surveys');
      const users = await client.query('DELETE FROM users');

      await client.query('COMMIT');

      return {
        users_deleted: users.rowCount ?? 0,
        surveys_deleted: surveys.rowCount ?? 0,
        attachments_deleted: attachments.rowCount ?? 0,
        events_deleted: events.rowCount ?? 0
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private assertEnabled(): void {
    const enabled = (process.env.DEBUG_DATA_RESET_ENABLED ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new ForbiddenException('Debug data reset is disabled');
    }
  }
}
