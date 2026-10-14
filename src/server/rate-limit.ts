import 'server-only';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db as defaultDb } from '@/db/client';
import * as schema from '@/db/schema';

export interface RateLimitOptions {
  limit?: number; // Maximum allowed requests within window (default: 10)
  windowMs?: number; // Window size in milliseconds (default: 60,000 = 1 min)
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfter?: number;
}

export function getRateLimitSalt(): string {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return 'build-time-rate-limit-salt';
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RATE_LIMIT_SALT environment variable is required in production');
    }
    return 'dev-insecure-rate-limit-salt';
  }
  return salt;
}

const SALT = getRateLimitSalt();

/**
 * Creates a one-way cryptographic SHA-256 hash from a client identifier, action, and salt.
 * Ensures raw IP addresses or emails are NEVER stored in the database or logs.
 */
export function hashIdentifier(identifier: string, action: string): string {
  return crypto
    .createHash('sha256')
    .update(`${identifier.trim()}:${action}:${SALT}`)
    .digest('hex');
}

/**
 * Extract client IP from standard HTTP headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Evaluates and updates the rate limit counter in PostgreSQL rate_limits table atomically.
 */
export async function checkRateLimit(
  hashedKey: string,
  options: RateLimitOptions = {},
  targetDb: NodePgDatabase<typeof schema> = defaultDb
): Promise<RateLimitResult> {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  const now = new Date();

  // Atomic upsert with window check
  const res = await targetDb.execute(sql`
    INSERT INTO ${schema.rateLimits} ("key", "window_start", "count")
    VALUES (${hashedKey}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE
    SET
      count = CASE
        WHEN ${schema.rateLimits.windowStart} + (${windowMs} * interval '1 millisecond') <= ${now}
        THEN 1
        ELSE ${schema.rateLimits.count} + 1
      END,
      window_start = CASE
        WHEN ${schema.rateLimits.windowStart} + (${windowMs} * interval '1 millisecond') <= ${now}
        THEN ${now}
        ELSE ${schema.rateLimits.windowStart}
      END
    RETURNING "key", "window_start", "count"
  `);

  const row = res.rows[0];
  const count = Number(row.count);
  const windowStart = new Date(row.window_start as string | Date);
  const elapsed = now.getTime() - windowStart.getTime();

  const allowed = count <= limit;
  const retryAfter = allowed ? undefined : Math.max(1, Math.ceil((windowMs - elapsed) / 1000));

  return { allowed, count, retryAfter };
}
