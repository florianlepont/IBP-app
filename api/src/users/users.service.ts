import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

type UserRow = AuthenticatedUser;

export type PatchMeBody = {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email?: string;
  profile_picture_url?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async patchMe(user: AuthenticatedUser, body: PatchMeBody): Promise<AuthenticatedUser & { updated_at: string }> {
    const nextEmail = body.email?.trim().toLowerCase();

    if (nextEmail && nextEmail !== user.email) {
      const existing = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND id <> $2', [nextEmail, user.id]);
      if (existing.rowCount) {
        throw new BadRequestException('Email already in use');
      }
    }

    const result = await this.db.query<UserRow & { updated_at: string }>(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           display_name = COALESCE($4, display_name),
           email = COALESCE($5, email),
           profile_picture_url = CASE WHEN $6::boolean THEN NULL ELSE COALESCE($7, profile_picture_url) END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, role, first_name, last_name, display_name, profile_picture_url, updated_at::text`,
      [
        user.id,
        body.first_name ?? null,
        body.last_name ?? null,
        body.display_name ?? null,
        nextEmail ?? null,
        body.profile_picture_url === null,
        body.profile_picture_url ?? null
      ]
    );

    const updated = result.rows[0];
    if (!updated) {
      throw new BadRequestException('User not found');
    }

    return updated;
  }
}
