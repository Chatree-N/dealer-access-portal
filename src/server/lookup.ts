import 'server-only';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db as defaultDb } from '@/db/client';
import * as schema from '@/db/schema';

export const branchCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Branch code must be exactly 4 digits');

export const lookupRequestSchema = z.object({
  branchCode: branchCodeSchema,
  honeypot: z.string().optional(),
});

export type LookupOutput = {
  status: 'found' | 'not_found';
  maskedDealer?: string;
  maskedBranch?: string;
};

/**
 * Masking rule: first word + space + first letter of the second word + "…"
 * If single word: word + "…"
 */
export function maskName(name: string, uppercase = false): string {
  const parts = name.trim().split(/\s+/);
  const firstWord = parts[0] || '';
  const secondLetter = parts[1] ? parts[1][0] : '';
  const result = secondLetter ? `${firstWord} ${secondLetter}…` : `${firstWord}…`;
  return uppercase ? result.toUpperCase() : result;
}

/**
 * Server-side branch lookup querying PostgreSQL.
 * Never returns dms_code, room info, email domains, or full names.
 */
export async function lookupBranch(
  branchCode: string,
  targetDb: NodePgDatabase<typeof schema> = defaultDb
): Promise<LookupOutput> {
  const parsed = branchCodeSchema.safeParse(branchCode);
  if (!parsed.success) {
    return { status: 'not_found' };
  }

  const rows = await targetDb
    .select({
      branchName: schema.branches.name,
      status: schema.branches.status,
      dealerName: schema.dealers.name,
    })
    .from(schema.branches)
    .innerJoin(schema.dealers, eq(schema.branches.dealerId, schema.dealers.id))
    .where(eq(schema.branches.dmsCode, parsed.data))
    .limit(1);

  if (rows.length === 0) {
    return { status: 'not_found' };
  }

  const branch = rows[0];
  if (branch.status === 'inactive') {
    return { status: 'not_found' };
  }

  return {
    status: 'found',
    maskedDealer: maskName(branch.dealerName, false),
    maskedBranch: maskName(branch.branchName, true),
  };
}
