import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';

type UserRow = AuthenticatedUser & { password_hash: string | null };

type TokenKind = 'access' | 'refresh';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: AuthenticatedUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const user = await this.findOrCreateUser(normalizedEmail, password);
    const passwordOk = await this.verifyOrBootstrapPassword(user, password);

    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      access_token: this.signToken(user.id, 'access'),
      refresh_token: this.signToken(user.id, 'refresh'),
      user: this.toPublicUser(user)
    };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const userId = this.verifyToken(refreshToken, 'refresh');
    await this.requireUserById(userId);

    return {
      access_token: this.signToken(userId, 'access'),
      refresh_token: this.signToken(userId, 'refresh')
    };
  }

  async getUserFromAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const userId = this.verifyToken(accessToken, 'access');
    return this.requireUserById(userId);
  }

  private async requireUserById(userId: string): Promise<AuthenticatedUser> {
    const result = await this.db.query<AuthenticatedUser>(
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

  private async findOrCreateUser(email: string, password: string): Promise<UserRow> {
    const existing = await this.db.query<UserRow>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url, password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const id = randomUUID();
    const displayName = email.split('@')[0] || 'Contributor';
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.db.query<UserRow>(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name, display_name)
       VALUES ($1, $2, $3, 'contributor', '', '', $4)
       RETURNING id, email, role, first_name, last_name, display_name, profile_picture_url, password_hash`,
      [id, email, passwordHash, displayName]
    );

    return created.rows[0];
  }

  private async verifyOrBootstrapPassword(user: UserRow, password: string): Promise<boolean> {
    if (!user.password_hash) {
      const hash = await bcrypt.hash(password, 10);
      await this.db.query(
        `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
        [user.id, hash]
      );
      return true;
    }

    return bcrypt.compare(password, user.password_hash);
  }

  private signToken(userId: string, kind: TokenKind): string {
    const secret = kind === 'access'
      ? process.env.ACCESS_TOKEN_SECRET ?? 'dev-access-secret'
      : process.env.REFRESH_TOKEN_SECRET ?? 'dev-refresh-secret';

    const expiresIn = (kind === 'access'
      ? process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m'
      : process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

    return jwt.sign({ sub: userId, typ: kind }, secret, { expiresIn });
  }

  private verifyToken(token: string, expectedKind: TokenKind): string {
    const secret = expectedKind === 'access'
      ? process.env.ACCESS_TOKEN_SECRET ?? 'dev-access-secret'
      : process.env.REFRESH_TOKEN_SECRET ?? 'dev-refresh-secret';

    try {
      const payload = jwt.verify(token, secret) as { sub?: string; typ?: string };
      if (!payload.sub || payload.typ !== expectedKind) {
        throw new UnauthorizedException('Invalid token payload');
      }
      return payload.sub;
    } catch (_error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private toPublicUser(user: UserRow): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: user.display_name,
      profile_picture_url: user.profile_picture_url
    };
  }
}
