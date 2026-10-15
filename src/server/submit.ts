import 'server-only';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db as defaultDb } from '@/db/client';
import * as schema from '@/db/schema';
import { branchCodeSchema } from './lookup';
import { decodeAndVerifyOtpProof } from './otp';
import { validateSignature, signatureInputSchema } from './signature';
import { storageProvider, generateStorageKey, StorageProvider } from './storage';
import { checkEmailDomain } from './checks';
import { hashIdentifier } from './rate-limit';

export const submitInputSchema = z.object({
  branchCode: branchCodeSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address'),
  consent: z.literal(true, {
    message: 'Consent is required',
  }),
  consentVersion: z.string().trim().min(1, 'Consent version is required'),
  signature: signatureInputSchema,
  proof: z.string().trim().min(1, 'Proof token is required'),
  honeypot: z.string().optional(),
});

export type SubmitInput = z.infer<typeof submitInputSchema>;

export type SubmitResult =
  | { success: true; requestId: string }
  | {
      success: false;
      reason:
        | 'invalid_signature'
        | 'invalid_proof'
        | 'proof_replayed'
        | 'branch_not_found'
        | 'invalid_consent'
        | 'duplicate'
        | 'database_error';
      message: string;
      status: number;
    };

export async function submitRequest(
  input: SubmitInput,
  clientIp: string,
  userAgent: string | null = null,
  targetDb: NodePgDatabase<typeof schema> = defaultDb,
  storage: StorageProvider = storageProvider
): Promise<SubmitResult> {
  // 1. Honeypot check: silently return success without writing anything
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { success: true, requestId: 'REQ-0001' };
  }

  // 2. Signature validation (PNG magic bytes / 200 KB cap / typed length & no control chars)
  let validatedSignature;
  try {
    validatedSignature = validateSignature(input.signature);
  } catch (err: unknown) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid signature';
    return {
      success: false,
      reason: 'invalid_signature',
      message: msg || 'Invalid signature',
      status: 400,
    };
  }

  // 3. Verify OTP Proof token (HMAC signature, exp, email match, non-empty jti)
  const normalizedEmail = input.email.trim().toLowerCase();
  const proofPayload = decodeAndVerifyOtpProof(input.proof, normalizedEmail);
  if (!proofPayload) {
    return {
      success: false,
      reason: 'invalid_proof',
      message: 'Verification expired or invalid. Please verify your email again.',
      status: 400,
    };
  }

  // 4. Branch lookup & status check: inactive and unknown return identical not_found
  const branchRows = await targetDb
    .select({
      id: schema.branches.id,
      status: schema.branches.status,
    })
    .from(schema.branches)
    .where(eq(schema.branches.dmsCode, input.branchCode.trim()))
    .limit(1);

  if (branchRows.length === 0 || branchRows[0].status !== 'active') {
    return {
      success: false,
      reason: 'branch_not_found',
      message: 'Branch not found',
      status: 404,
    };
  }
  const branch = branchRows[0];

  // 5. Consent version validation against active consent text
  const now = new Date();
  const consentRows = await targetDb
    .select({ version: schema.consentTexts.version })
    .from(schema.consentTexts)
    .where(
      and(
        sql`${schema.consentTexts.activeFrom} <= ${now}`,
        sql`(${schema.consentTexts.activeTo} IS NULL OR ${schema.consentTexts.activeTo} > ${now})`
      )
    )
    .orderBy(sql`${schema.consentTexts.activeFrom} DESC`)
    .limit(1);

  if (consentRows.length === 0 || consentRows[0].version !== input.consentVersion.trim()) {
    return {
      success: false,
      reason: 'invalid_consent',
      message: 'Invalid or outdated consent version',
      status: 400,
    };
  }
  const activeConsent = consentRows[0];

  // 6. Check duplicate pending_review request for the same branch and email
  const duplicateRows = await targetDb
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(
      and(
        eq(schema.requests.branchId, branch.id),
        sql`LOWER(${schema.requests.email}) = ${normalizedEmail}`,
        eq(schema.requests.status, 'pending_review')
      )
    )
    .limit(1);

  if (duplicateRows.length > 0) {
    return {
      success: false,
      reason: 'duplicate',
      message: 'A request for this email is already pending approval.',
      status: 409,
    };
  }

  // 7. Compute domain mismatch flag
  const domainCheck = await checkEmailDomain(input.branchCode, normalizedEmail, targetDb);

  // 8. Write signature to StorageProvider FIRST
  const ext = validatedSignature.kind === 'drawn' ? 'png' : 'txt';
  const storageKey = generateStorageKey(ext);

  await storage.put(storageKey, validatedSignature.buffer, validatedSignature.contentType);

  // 9. Atomic insert of request and audit_log in one database transaction
  let requestId = '';
  try {
    const nextIdRes = await targetDb.execute<{ next_id: string }>(sql`
      SELECT 'REQ-' || LPAD(nextval('requests_id_seq')::text, 4, '0') AS next_id
    `);
    requestId = nextIdRes.rows[0]?.next_id || `REQ-${Math.floor(1000 + Math.random() * 9000)}`;

    await targetDb.transaction(async (tx) => {
      // Insert request
      await tx.insert(schema.requests).values({
        id: requestId,
        branchId: branch.id,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail,
        emailVerifiedAt: new Date(proofPayload.verifiedAt),
        consentTextVersion: activeConsent.version,
        consentAt: now,
        signatureKind: validatedSignature.kind,
        signatureRef: storageKey,
        status: 'pending_review',
        proofJti: proofPayload.jti,
        domainMismatch: domainCheck.isDomainMismatch,
        ipHash: hashIdentifier(clientIp, 'request_ip'),
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      });

      // Insert audit_log: strictly IDs only, no names or emails in before/after
      await tx.insert(schema.auditLog).values({
        actor: 'public_requester',
        action: 'create_request',
        entity: 'requests',
        entityId: requestId,
        before: null,
        after: {
          requestId,
          branchId: branch.id,
          status: 'pending_review',
          signatureKind: validatedSignature.kind,
          domainMismatch: domainCheck.isDomainMismatch,
        },
      });
    });

    return {
      success: true,
      requestId,
    };
  } catch (err: unknown) {
    // 10. Rollback: delete stored signature file if insert fails
    await storage.delete(storageKey);

    const errorObj =
      (err as { cause?: { code?: string; constraint?: string; detail?: string; message?: string } })?.cause ||
      (err as { code?: string; constraint?: string; detail?: string; message?: string });
    const code = errorObj?.code || (err as { code?: string })?.code;
    const constraint = String(errorObj?.constraint || (err as { constraint?: string })?.constraint || '');
    const detail = String(errorObj?.detail || '');
    const msg = String((err as Error)?.message || '');

    const isProofReplay =
      (code === '23505' || msg.includes('23505')) &&
      (constraint.includes('proof_jti') || detail.includes('proof_jti') || msg.includes('proof_jti'));

    if (isProofReplay) {
      return {
        success: false,
        reason: 'proof_replayed',
        message: 'This verification has already been used. Please verify your email again.',
        status: 409,
      };
    }

    return {
      success: false,
      reason: 'database_error',
      message: 'Could not submit request',
      status: 500,
    };
  }
}
