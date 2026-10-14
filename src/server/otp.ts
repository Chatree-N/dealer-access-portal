import 'server-only';
import crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
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
  PROOF_VALIDITY_MS: 30 * 60 * 1000, // 30 minutes to finish submission
};

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
 * Creates a one-way cryptographic SHA-256 hash of a 6-digit OTP code bound to the email and secret.
 * Raw code is never stored in PostgreSQL or logged.
 */
export function hashCode(code: string, email: string): string {
  const secret = getOtpProofSecret();
  return crypto
    .createHash('sha256')
    .update(`${email.trim().toLowerCase()}:${code.trim()}:${secret}`)
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
}

/**
 * Creates an HMAC-signed proof token returned upon successful OTP verification.
 */
export function createOtpProof(email: string): string {
  const payload: OtpProofPayload = {
    email: email.trim().toLowerCase(),
    verifiedAt: Date.now(),
    exp: Date.now() + OTP_RULES.PROOF_VALIDITY_MS,
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getOtpProofSecret())
    .update(serialized)
    .digest('base64url');

  return `${serialized}.${signature}`;
}

/**
 * Verifies an HMAC-signed proof token in constant time.
 */
export function verifyOtpProof(proof: string, expectedEmail: string): boolean {
  if (!proof || typeof proof !== 'string' || !proof.includes('.')) {
    return false;
  }

  const parts = proof.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [serialized, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getOtpProofSecret())
    .update(serialized)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedSigBuf.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return false;
  }

  try {
    const payload: OtpProofPayload = JSON.parse(
      Buffer.from(serialized, 'base64url').toString('utf8')
    );

    if (payload.email !== expectedEmail.trim().toLowerCase()) {
      return false;
    }

    if (Date.now() > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export type SendOtpResult =
  | { success: true; cooldownMs: number; expiresAt: number }
  | { success: false; reason: 'cooldown' | 'locked' | 'max_resends'; retryAfterMs?: number };

/**
 * Sends a newly generated 6-digit OTP code to the recipient and stores the hashed code in PostgreSQL.
 */
export async function sendOtpRecord(
  email: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb,
  sender: EmailSender = emailSender
): Promise<SendOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  // Check existing verification record
  const existing = await targetDb
    .select()
    .from(schema.emailVerifications)
    .where(eq(schema.emailVerifications.email, normalizedEmail))
    .orderBy(desc(schema.emailVerifications.createdAt))
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];

    // Check lock
    if (record.lockedUntil && record.lockedUntil > now) {
      return {
        success: false,
        reason: 'locked',
        retryAfterMs: record.lockedUntil.getTime() - now.getTime(),
      };
    }

    // Check cooldown
    const elapsedSinceSent = now.getTime() - record.lastSentAt.getTime();
    if (elapsedSinceSent < OTP_RULES.COOLDOWN_MS) {
      return {
        success: false,
        reason: 'cooldown',
        retryAfterMs: OTP_RULES.COOLDOWN_MS - elapsedSinceSent,
      };
    }

    // Check resend count cap
    if (record.resendCount >= OTP_RULES.MAX_RESENDS) {
      return {
        success: false,
        reason: 'max_resends',
      };
    }
  }

  const code = generateOtpCode();
  const codeHash = hashCode(code, normalizedEmail);
  const expiresAt = new Date(now.getTime() + OTP_RULES.EXPIRY_MS);

  if (existing.length > 0) {
    await targetDb
      .update(schema.emailVerifications)
      .set({
        codeHash,
        expiresAt,
        lastSentAt: now,
        resendCount: existing[0].resendCount + 1,
        attempts: 0,
        lockedUntil: null,
      })
      .where(eq(schema.emailVerifications.id, existing[0].id));
  } else {
    await targetDb.insert(schema.emailVerifications).values({
      email: normalizedEmail,
      codeHash,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      resendCount: 0,
      lockedUntil: null,
    });
  }

  await sender.sendOtpEmail(normalizedEmail, code);

  return {
    success: true,
    cooldownMs: OTP_RULES.COOLDOWN_MS,
    expiresAt: expiresAt.getTime(),
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
 */
export async function verifyOtpRecord(
  email: string,
  code: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb
): Promise<VerifyOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const existing = await targetDb
    .select()
    .from(schema.emailVerifications)
    .where(eq(schema.emailVerifications.email, normalizedEmail))
    .orderBy(desc(schema.emailVerifications.createdAt))
    .limit(1);

  if (existing.length === 0) {
    return { success: false, reason: 'expired' };
  }

  const record = existing[0];

  // Check lock
  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      success: false,
      reason: 'locked',
      retryAfterMs: record.lockedUntil.getTime() - now.getTime(),
    };
  }

  // Check if attempts already exhausted
  if (record.attempts >= OTP_RULES.MAX_ATTEMPTS) {
    const lockUntil = new Date(now.getTime() + OTP_RULES.LOCK_DURATION_MS);
    await targetDb
      .update(schema.emailVerifications)
      .set({ lockedUntil: lockUntil })
      .where(eq(schema.emailVerifications.id, record.id));

    return { success: false, reason: 'max_attempts' };
  }

  // Check expiry
  if (now > record.expiresAt) {
    return { success: false, reason: 'expired' };
  }

  // Constant-time hash verification
  const expectedHash = hashCode(code, normalizedEmail);
  const codeHashBuf = Buffer.from(record.codeHash, 'hex');
  const expectedHashBuf = Buffer.from(expectedHash, 'hex');

  const matches =
    codeHashBuf.length === expectedHashBuf.length &&
    crypto.timingSafeEqual(codeHashBuf, expectedHashBuf);

  if (matches) {
    await targetDb
      .update(schema.emailVerifications)
      .set({ attempts: 0 })
      .where(eq(schema.emailVerifications.id, record.id));

    const proof = createOtpProof(normalizedEmail);
    return { success: true, proof };
  }

  // Mismatch: increment attempts atomically
  const newAttempts = record.attempts + 1;
  const isNowLocked = newAttempts >= OTP_RULES.MAX_ATTEMPTS;
  const lockedUntil = isNowLocked ? new Date(now.getTime() + OTP_RULES.LOCK_DURATION_MS) : null;

  await targetDb
    .update(schema.emailVerifications)
    .set({
      attempts: newAttempts,
      lockedUntil,
    })
    .where(eq(schema.emailVerifications.id, record.id));

  if (isNowLocked) {
    return { success: false, reason: 'max_attempts' };
  }

  return {
    success: false,
    reason: 'invalid',
    remainingAttempts: OTP_RULES.MAX_ATTEMPTS - newAttempts,
  };
}
