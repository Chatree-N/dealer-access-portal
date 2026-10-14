import 'server-only';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db as defaultDb } from '@/db/client';
import * as schema from '@/db/schema';
import { branchCodeSchema } from './lookup';

export const checksRequestSchema = z.object({
  branchCode: branchCodeSchema,
  email: z.string().trim().email('Invalid email address'),
});

/**
 * Check if the given email matches any of the branch dealer's configured domains.
 * Returns { isDomainMismatch: true } if dealer has domains configured and email is not on them.
 * If dealer has no configured domains (e.g. Maple), returns { isDomainMismatch: false }.
 * Never blocks the request.
 */
export async function checkEmailDomain(
  branchCode: string,
  email: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb
): Promise<{ isDomainMismatch: boolean }> {
  if (!email || !email.includes('@')) {
    return { isDomainMismatch: false };
  }

  const parts = email.trim().toLowerCase().split('@');
  if (parts.length < 2 || !parts[1]) {
    return { isDomainMismatch: false };
  }
  const emailDomain = parts[1];

  const branchRows = await targetDb
    .select({ dealerId: schema.branches.dealerId })
    .from(schema.branches)
    .where(eq(schema.branches.dmsCode, branchCode.trim()))
    .limit(1);

  if (branchRows.length === 0) {
    return { isDomainMismatch: false };
  }

  const domainRows = await targetDb
    .select({ domain: schema.dealerEmailDomains.domain })
    .from(schema.dealerEmailDomains)
    .where(eq(schema.dealerEmailDomains.dealerId, branchRows[0].dealerId));

  if (domainRows.length === 0) {
    return { isDomainMismatch: false };
  }

  const matches = domainRows.some((d) => d.domain.toLowerCase() === emailDomain);
  return { isDomainMismatch: !matches };
}

/**
 * Check if a pending request already exists for the same branch and email.
 * Returns only a boolean flag without revealing request details or identity.
 */
export async function checkDuplicateRequest(
  branchCode: string,
  email: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb
): Promise<{ isDuplicate: boolean }> {
  const branchRows = await targetDb
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(eq(schema.branches.dmsCode, branchCode.trim()))
    .limit(1);

  if (branchRows.length === 0) {
    return { isDuplicate: false };
  }

  const existing = await targetDb
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(
      and(
        eq(schema.requests.branchId, branchRows[0].id),
        sql`LOWER(${schema.requests.email}) = LOWER(${email.trim()})`,
        eq(schema.requests.status, 'pending_review')
      )
    )
    .limit(1);

  return { isDuplicate: existing.length > 0 };
}
