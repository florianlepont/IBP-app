import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';

type UserRow = AuthenticatedUser;

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(email: string, _password: string): Promise<{ access_token: string; refresh_token: string; user: AuthenticatedUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new UnauthorizedException('Email is required');
    }

    const user = await this.findOrCreateUser(normalizedEmail);

    const accessToken = this.encodeUserToken(user.id, 'access');
    const refreshToken = this.encodeUserToken(user.id, 'refresh');

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user
    };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const userId = this.decodeUserToken(refreshToken, 'refresh');

    // Ensure user still exists.
    await this.requireUserById(userId);

    return {
      access_token: this.encodeUserToken(userId, 'access'),
      refresh_token: this.encodeUserToken(userId, 'refresh')
    };
  }

  async getUserFromAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const userId = this.decodeUserToken(accessToken, 'access');
    return this.requireUserById(userId);
  }

  private async requireUserById(userId: string): Promise<AuthenticatedUser> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }

  private async findOrCreateUser(email: string): Promise<AuthenticatedUser> {
    const existing = await this.db.query<UserRow>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const id = randomUUID();
    const displayName = email.split('@')[0] || 'Contributor';

    const created = await this.db.query<UserRow>(
      `INSERT INTO users (id, email, role, first_name, last_name, display_name)
       VALUES ($1, $2, 'contributor', '', '', $3)
       RETURNING id, email, role, first_name, last_name, display_name, profile_picture_url`,
      [id, email, displayName]
    );

    return created.rows[0];
  }

  private encodeUserToken(userId: string, kind: 'access' | 'refresh'): string {
    const raw = `${kind}:${userId}`;
    return `dev.${Buffer.from(raw).toString('base64url')}`;
  }

  private decodeUserToken(token: string, expectedKind: 'access' | 'refresh'): string {
    if (!token.startsWith('dev.')) {
      throw new UnauthorizedException('Invalid token format');
    }

    const encoded = token.slice(4);
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    const [kind, userId] = decoded.split(':');

    if (kind !== expectedKind || !userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return userId;
  }
}
