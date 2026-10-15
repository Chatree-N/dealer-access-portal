import 'server-only';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db as defaultDb } from '@/db/client';
import * as schema from '@/db/schema';
import { emailSender, EmailSender } from './email';

export const OTP_RULES = {
  CODE_LENGTH: 6,
  EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  COOLDOWN_MS: 60 * 1000, // 60 seconds
  MAX_ATTEMPTS: 3, // 3 attempts then lock
  MAX_RESENDS: 5, // resend cap
  LOCK_DURATION_MS: 15 * 60 * 1000, // 15 minute lockout
  WINDOW_MS: 60 * 60 * 1000, // 1 hour window for counter reset
  PROOF_VALIDITY_MS: 30 * 60 * 1000, // 30 minutes to finish submission
};

export function getOtpCodePepper(): string {
  const pepper = process.env.OTP_CODE_PEPPER;
  if (!pepper) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return 'build-time-otp-code-pepper';
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTP_CODE_PEPPER environment variable is required in production');
    }
    return 'dev-insecure-otp-code-pepper';
  }
  return pepper;
}

export function getOtpProofSecret(): string {
  const secret = process.env.OTP_PROOF_SECRET;
  if (!secret) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return 'build-time-otp-proof-secret';
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTP_PROOF_SECRET environment variable is required in production');
    }
    return 'dev-insecure-otp-proof-secret';
  }
  return secret;
}

/**
 * Creates a one-way cryptographic HMAC-SHA256 hash of a 6-digit OTP code bound to the email using OTP_CODE_PEPPER.
 * Raw code is never stored in PostgreSQL or logged.
 */
export function hashCode(code: string, email: string): string {
  const pepper = getOtpCodePepper();
  return crypto
    .createHmac('sha256', pepper)
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest('hex');
}

/**
 * Cryptographically generates a secure 6-digit numeric OTP code.
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export interface OtpProofPayload {
  email: string;
  verifiedAt: number;
  exp: number;
  jti: string;
}

/**
 * Creates an HMAC-signed proof token returned upon successful OTP verification.
 * Includes a random 16-byte hex nonce (jti) for single-use verification during request submission.
 */
export function createOtpProof(email: string): string {
  const payload: OtpProofPayload = {
    email: email.trim().toLowerCase(),
    verifiedAt: Date.now(),
    exp: Date.now() + OTP_RULES.PROOF_VALIDITY_MS,
    jti: crypto.randomBytes(16).toString('hex'),
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getOtpProofSecret())
    .update(serialized)
    .digest('base64url');

  return `${serialized}.${signature}`;
}

/**
 * Verifies an HMAC-signed proof token and returns the verified payload, or null if invalid/expired.
 */
export function decodeAndVerifyOtpProof(
  proof: string,
  expectedEmail: string
): OtpProofPayload | null {
  if (!proof || typeof proof !== 'string' || !proof.includes('.')) {
    return null;
  }

  const parts = proof.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [serialized, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getOtpProofSecret())
    .update(serialized)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedSigBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return null;
  }

  try {
    const payload: OtpProofPayload = JSON.parse(
      Buffer.from(serialized, 'base64url').toString('utf8')
    );

    if (payload.email !== expectedEmail.trim().toLowerCase()) {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null;
    }

    if (!payload.jti || typeof payload.jti !== 'string') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies an HMAC-signed proof token in constant time.
 */
export function verifyOtpProof(proof: string, expectedEmail: string): boolean {
  return decodeAndVerifyOtpProof(proof, expectedEmail) !== null;
}

export type SendOtpResult =
  | { success: true; cooldownMs: number; expiresAt: number }
  | { success: false; reason: 'cooldown' | 'locked' | 'max_resends'; retryAfterMs?: number };

/**
 * Sends a newly generated 6-digit OTP code to the recipient and stores the hashed code in PostgreSQL.
 * Uses atomic conditional statements to enforce cooldown, resend cap, and locks safely under concurrency.
 */
export async function sendOtpRecord(
  email: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb,
  sender: EmailSender = emailSender
): Promise<SendOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const code = generateOtpCode();
  const codeHash = hashCode(code, normalizedEmail);
  const expiresAt = new Date(now.getTime() + OTP_RULES.EXPIRY_MS);
  const cooldownThreshold = new Date(now.getTime() - OTP_RULES.COOLDOWN_MS);
  const windowThreshold = new Date(now.getTime() - OTP_RULES.WINDOW_MS);

  // Atomic conditional update on existing row:
  // - If row is older than WINDOW_MS: full counter reset (attempts = 0, resend_count = 0, locked_until = null, created_at = now)
  // - If row is within WINDOW_MS: must not be locked, cooldown must have elapsed, resend_count under cap.
  //   Inside the window, attempts and locked_until are preserved (not reset).
  const updateResult = await targetDb.execute<{
    id: number;
    email: string;
    resend_count: number;
    attempts: number;
  }>(sql`
    UPDATE email_verifications
    SET
      code_hash = ${codeHash},
      expires_at = ${expiresAt},
      last_sent_at = ${now},
      resend_count = CASE
        WHEN created_at <= ${windowThreshold} THEN 0
        ELSE resend_count + 1
      END,
      created_at = CASE
        WHEN created_at <= ${windowThreshold} THEN ${now}
        ELSE created_at
      END,
      attempts = CASE
        WHEN created_at <= ${windowThreshold} THEN 0
        WHEN locked_until IS NOT NULL AND locked_until <= ${now} THEN 0
        ELSE attempts
      END,
      locked_until = CASE
        WHEN created_at <= ${windowThreshold} THEN NULL
        WHEN locked_until IS NOT NULL AND locked_until <= ${now} THEN NULL
        ELSE locked_until
      END
    WHERE email = ${normalizedEmail}
      AND (
        created_at <= ${windowThreshold}
        OR (
          (locked_until IS NULL OR locked_until <= ${now})
          AND last_sent_at <= ${cooldownThreshold}
          AND resend_count < ${OTP_RULES.MAX_RESENDS}
        )
      )
    RETURNING id, email, resend_count, attempts
  `);

  if (updateResult.rows.length > 0) {
    await sender.sendOtpEmail(normalizedEmail, code);
    return {
      success: true,
      cooldownMs: OTP_RULES.COOLDOWN_MS,
      expiresAt: expiresAt.getTime(),
    };
  }

  // If no row was updated, inspect existing record to return exact failure reason
  const existingResult = await targetDb.execute<{
    id: number;
    locked_until: string | null;
    last_sent_at: string;
    resend_count: number;
  }>(sql`
    SELECT id, locked_until, last_sent_at, resend_count
    FROM email_verifications
    WHERE email = ${normalizedEmail}
  `);

  if (existingResult.rows.length > 0) {
    const row = existingResult.rows[0];
    if (row.locked_until && new Date(row.locked_until) > now) {
      return {
        success: false,
        reason: 'locked',
        retryAfterMs: new Date(row.locked_until).getTime() - now.getTime(),
      };
    }

    const elapsed = now.getTime() - new Date(row.last_sent_at).getTime();
    if (elapsed < OTP_RULES.COOLDOWN_MS) {
      return {
        success: false,
        reason: 'cooldown',
        retryAfterMs: OTP_RULES.COOLDOWN_MS - elapsed,
      };
    }

    if (row.resend_count >= OTP_RULES.MAX_RESENDS) {
      return {
        success: false,
        reason: 'max_resends',
      };
    }
  }

  // No row exists: atomic insert with ON CONFLICT (email) DO NOTHING
  const insertResult = await targetDb.execute<{ id: number }>(sql`
    INSERT INTO email_verifications (
      email, code_hash, expires_at, attempts, last_sent_at, resend_count, locked_until, created_at
    ) VALUES (
      ${normalizedEmail}, ${codeHash}, ${expiresAt}, 0, ${now}, 0, NULL, ${now}
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `);

  if (insertResult.rows.length > 0) {
    await sender.sendOtpEmail(normalizedEmail, code);
    return {
      success: true,
      cooldownMs: OTP_RULES.COOLDOWN_MS,
      expiresAt: expiresAt.getTime(),
    };
  }

  // Parallel insert won the race; this request is in cooldown
  return {
    success: false,
    reason: 'cooldown',
    retryAfterMs: OTP_RULES.COOLDOWN_MS,
  };
}

export type VerifyOtpResult =
  | { success: true; proof: string }
  | {
      success: false;
      reason: 'invalid' | 'expired' | 'max_attempts' | 'locked';
      remainingAttempts?: number;
      retryAfterMs?: number;
    };

/**
 * Validates a submitted 6-digit OTP code against the salted hash in PostgreSQL.
 * Uses a single conditional UPDATE statement to atomically increment attempts and set locked_until.
 * On success, invalidates the code in the database ensuring single-use.
 */
export async function verifyOtpRecord(
  email: string,
  code: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb
): Promise<VerifyOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const lockUntil = new Date(now.getTime() + OTP_RULES.LOCK_DURATION_MS);

  // 1. Atomic conditional update incrementing attempts only while under MAX_ATTEMPTS and not locked/expired
  const updateResult = await targetDb.execute<{
    id: number;
    code_hash: string;
    attempts: number;
    locked_until: string | null;
  }>(sql`
    UPDATE email_verifications
    SET
      attempts = attempts + 1,
      locked_until = CASE
        WHEN attempts + 1 >= ${OTP_RULES.MAX_ATTEMPTS} THEN ${lockUntil}
        ELSE locked_until
      END
    WHERE email = ${normalizedEmail}
      AND (locked_until IS NULL OR locked_until <= ${now})
      AND expires_at > ${now}
      AND attempts < ${OTP_RULES.MAX_ATTEMPTS}
    RETURNING id, code_hash, attempts, locked_until
  `);

  if (updateResult.rows.length > 0) {
    const row = updateResult.rows[0];
    const expectedHash = hashCode(code, normalizedEmail);
    const codeHashBuf = Buffer.from(row.code_hash, 'hex');
    const expectedHashBuf = Buffer.from(expectedHash, 'hex');

    const matches =
      codeHashBuf.length === expectedHashBuf.length &&
      crypto.timingSafeEqual(codeHashBuf, expectedHashBuf);

    if (matches) {
      // Single use: Invalidate the verification code atomically upon match
      const deleteResult = await targetDb.execute<{ id: number }>(sql`
        DELETE FROM email_verifications
        WHERE id = ${row.id} AND code_hash = ${row.code_hash}
        RETURNING id
      `);

      if (deleteResult.rows.length > 0) {
        const proof = createOtpProof(normalizedEmail);
        return { success: true, proof };
      }

      return { success: false, reason: 'invalid' };
    }

    // Code mismatch: the attempt has been atomically incremented in PostgreSQL
    if (row.attempts >= OTP_RULES.MAX_ATTEMPTS) {
      return { success: false, reason: 'max_attempts' };
    }

    return {
      success: false,
      reason: 'invalid',
      remainingAttempts: OTP_RULES.MAX_ATTEMPTS - row.attempts,
    };
  }

  // No row was updated; inspect record to return exact failure reason
  const checkResult = await targetDb.execute<{
    attempts: number;
    locked_until: string | null;
    expires_at: string;
  }>(sql`
    SELECT attempts, locked_until, expires_at
    FROM email_verifications
    WHERE email = ${normalizedEmail}
  `);

  if (checkResult.rows.length === 0) {
    return { success: false, reason: 'expired' };
  }

  const row = checkResult.rows[0];
  if (row.locked_until && new Date(row.locked_until) > now) {
    return {
      success: false,
      reason: 'locked',
      retryAfterMs: new Date(row.locked_until).getTime() - now.getTime(),
    };
  }

  if (row.attempts >= OTP_RULES.MAX_ATTEMPTS) {
    return { success: false, reason: 'max_attempts' };
  }

  if (new Date(row.expires_at) <= now) {
    return { success: false, reason: 'expired' };
  }

  return { success: false, reason: 'invalid' };
}
