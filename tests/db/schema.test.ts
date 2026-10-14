import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import path from 'path';
import * as schema from '../../src/db/schema';
import { seed } from '../../src/db/seed';
import { lookupBranch } from '../../src/server/lookup';
import { checkEmailDomain, checkDuplicateRequest } from '../../src/server/checks';
import { checkRateLimit, hashIdentifier } from '../../src/server/rate-limit';

const ADMIN_DB_URL =
  process.env.ADMIN_DATABASE_URL || 'postgresql://user:password@localhost:5432/openchat';
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/openchat_test';

describe('Database Foundation (Phase 3A)', () => {
  let adminClient: Client;
  let testPool: Pool;
  let testDb: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    // 1. Connect to admin DB to recreate openchat_test cleanly
    adminClient = new Client({ connectionString: ADMIN_DB_URL });
    await adminClient.connect();

    // Terminate existing connections to openchat_test if any, and drop/recreate
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'openchat_test'
        AND pid <> pg_backend_pid();
    `);
    await adminClient.query('DROP DATABASE IF EXISTS openchat_test;');
    await adminClient.query('CREATE DATABASE openchat_test;');

    // 2. Connect to the fresh openchat_test database
    testPool = new Pool({ connectionString: TEST_DB_URL });
    testDb = drizzle(testPool, { schema });
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
    if (adminClient) {
      await adminClient.end();
    }
  });

  it('migrations apply cleanly on an empty DB', async () => {
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    await expect(migrate(testDb, { migrationsFolder })).resolves.not.toThrow();

    // Verify all 12 tables exist in openchat_test
    const res = await testPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const tables = res.rows.map((r) => r.table_name);
    const expectedTables = [
      'dealers',
      'dealer_email_domains',
      'branches',
      'openchat_rooms',
      'room_to_dealer_region',
      'consent_texts',
      'requests',
      'email_verifications',
      'admin_users',
      'audit_log',
      'rate_limits',
      'invite_tokens',
    ];
    for (const expected of expectedTables) {
      expect(tables).toContain(expected);
    }
  });

  it('dms_code unique constraint rejects duplicates', async () => {
    // Ensure parent dealer exists
    await testDb
      .insert(schema.dealers)
      .values({ id: 'd-test', name: 'Test Dealer' })
      .onConflictDoNothing();

    // Insert first branch with dms_code 'TEST-UNIQ'
    await testDb.insert(schema.branches).values({
      dmsCode: 'TEST-UNIQ',
      dealerId: 'd-test',
      name: 'Test Branch 1',
      province: 'Bangkok',
      region: 'Central',
      status: 'active',
    });

    // Attempting to insert duplicate dms_code must reject with unique violation (code 23505)
    await expect(
      testDb.insert(schema.branches).values({
        dmsCode: 'TEST-UNIQ',
        dealerId: 'd-test',
        name: 'Test Branch 2 (Duplicate)',
        province: 'Bangkok',
        region: 'Central',
        status: 'active',
      })
    ).rejects.toThrow();

    // Clean up test records before seed
    await testDb.delete(schema.branches).where(eq(schema.branches.dmsCode, 'TEST-UNIQ'));
    await testDb.delete(schema.dealers).where(eq(schema.dealers.id, 'd-test'));
  });

  it('seed is idempotent (row counts equal after running twice)', async () => {
    // Run seed once
    await seed(testDb);

    const getCounts = async () => {
      const dealersCount = await testPool.query('SELECT COUNT(*) FROM dealers');
      const domainsCount = await testPool.query('SELECT COUNT(*) FROM dealer_email_domains');
      const branchesCount = await testPool.query('SELECT COUNT(*) FROM branches');
      const roomsCount = await testPool.query('SELECT COUNT(*) FROM openchat_rooms');
      const roomRegionCount = await testPool.query('SELECT COUNT(*) FROM room_to_dealer_region');
      const consentCount = await testPool.query('SELECT COUNT(*) FROM consent_texts');
      const requestsCount = await testPool.query('SELECT COUNT(*) FROM requests');

      return {
        dealers: parseInt(dealersCount.rows[0].count, 10),
        dealerEmailDomains: parseInt(domainsCount.rows[0].count, 10),
        branches: parseInt(branchesCount.rows[0].count, 10),
        openchatRooms: parseInt(roomsCount.rows[0].count, 10),
        roomToDealerRegion: parseInt(roomRegionCount.rows[0].count, 10),
        consentTexts: parseInt(consentCount.rows[0].count, 10),
        requests: parseInt(requestsCount.rows[0].count, 10),
      };
    };

    const countsAfterFirst = await getCounts();

    // Run seed a second time
    await seed(testDb);

    const countsAfterSecond = await getCounts();

    // Row counts must be strictly equal
    expect(countsAfterSecond).toEqual(countsAfterFirst);
  });

  it('34 branches seeded; branch 9999 is inactive; edge cases 0042, 6001, 5001 exist', async () => {
    // Branch count check
    const branches = await testDb.select().from(schema.branches);
    expect(branches).toHaveLength(34);

    // Inactive branch 9999 check
    const branch9999 = branches.find((b) => b.dmsCode === '9999');
    expect(branch9999).toBeDefined();
    expect(branch9999?.status).toBe('inactive');
    expect(branch9999?.name).toBe('LOTUS CLOSED BRANCH (DEMO)');

    // Edge case 0042 (leading zeros)
    const branch0042 = branches.find((b) => b.dmsCode === '0042');
    expect(branch0042).toBeDefined();
    expect(branch0042?.status).toBe('active');
    expect(branch0042?.name).toBe('LOTUS HUB (RIVERSIDE)');

    // Edge case 6001 (long branch name)
    const branch6001 = branches.find((b) => b.dmsCode === '6001');
    expect(branch6001).toBeDefined();
    expect(branch6001?.status).toBe('active');
    expect(branch6001?.name).toContain('VERY LONG BRANCH NAME');

    // Edge case 5001 (dealer with 0 email domains)
    const branch5001 = branches.find((b) => b.dmsCode === '5001');
    expect(branch5001).toBeDefined();
    expect(branch5001?.dealerId).toBe('d-maple');
  });

  describe('Phase 3B: Server-side Lookup, Checks, and Rate Limiting', () => {
    it('lookup statuses: 1234 (found), 9999 (inactive), 0000 (not_found), 0042 (found)', async () => {
      // 1234 -> found with masked names
      const res1234 = await lookupBranch('1234', testDb);
      expect(res1234.status).toBe('found');
      expect(res1234.maskedDealer).toBe('Lotus T…');
      expect(res1234.maskedBranch).toBe('LOTUS C…');

      // 9999 -> inactive
      const res9999 = await lookupBranch('9999', testDb);
      expect(res9999.status).toBe('inactive');
      expect(res9999.maskedDealer).toBeUndefined();

      // 0000 -> not_found
      const res0000 = await lookupBranch('0000', testDb);
      expect(res0000.status).toBe('not_found');

      // 0042 -> found (leading zeros preserved)
      const res0042 = await lookupBranch('0042', testDb);
      expect(res0042.status).toBe('found');
      expect(res0042.maskedBranch).toBe('LOTUS H…');
    });

    it('email domain mismatch: warning flag only, never blocks', async () => {
      // Lotus Telecom has domain lotustelecom.example
      const match = await checkEmailDomain('1234', 'somchai@lotustelecom.example', testDb);
      expect(match.isDomainMismatch).toBe(false);

      const upperMatch = await checkEmailDomain('1234', 'SOMCHAI@LOTUSTELECOM.EXAMPLE', testDb);
      expect(upperMatch.isDomainMismatch).toBe(false);

      const mismatch = await checkEmailDomain('1234', 'somchai@gmail.example', testDb);
      expect(mismatch.isDomainMismatch).toBe(true);

      // Dealer with 0 configured domains (Maple, branch 5001) never warns
      const maple = await checkEmailDomain('5001', 'somchai@custom.example', testDb);
      expect(maple.isDomainMismatch).toBe(false);

      // Unknown branch
      const unknown = await checkEmailDomain('0000', 'somchai@lotustelecom.example', testDb);
      expect(unknown.isDomainMismatch).toBe(false);
    });

    it('duplicate-request check: returns flag without revealing who requested', async () => {
      // Query branch 1234
      const b1234 = await testDb
        .select()
        .from(schema.branches)
        .where(eq(schema.branches.dmsCode, '1234'))
        .limit(1);
      expect(b1234).toHaveLength(1);

      // Initially no duplicate
      const initial = await checkDuplicateRequest('1234', 'pending-user@example.com', testDb);
      expect(initial.isDuplicate).toBe(false);

      // Insert a request with status 'pending_review'
      await testDb.insert(schema.requests).values({
        id: 'REQ-TEST-DUPE',
        branchId: b1234[0].id,
        firstName: 'Test',
        lastName: 'User',
        email: 'pending-user@example.com',
        consentTextVersion: 'v0-draft',
        consentAt: new Date(),
        signatureKind: 'typed',
        signatureRef: 'Test User',
        status: 'pending_review',
      });

      // Now duplicate check returns true
      const dupeResult = await checkDuplicateRequest('1234', 'pending-user@example.com', testDb);
      expect(dupeResult.isDuplicate).toBe(true);

      // Case-insensitive email check
      const dupeUpper = await checkDuplicateRequest('1234', 'PENDING-USER@EXAMPLE.COM', testDb);
      expect(dupeUpper.isDuplicate).toBe(true);

      // Different email returns false
      const diffEmail = await checkDuplicateRequest('1234', 'other-user@example.com', testDb);
      expect(diffEmail.isDuplicate).toBe(false);

      // Different branch returns false
      const diffBranch = await checkDuplicateRequest('0042', 'pending-user@example.com', testDb);
      expect(diffBranch.isDuplicate).toBe(false);

      // Clean up test request
      await testDb.delete(schema.requests).where(eq(schema.requests.id, 'REQ-TEST-DUPE'));
    });

    it('rate limiting with rate_limits table: hashed keys, limit, window expiration', async () => {
      const clientIp = '192.0.2.10';
      const key = hashIdentifier(clientIp, 'test_action');

      // Key must be a SHA-256 hex string (64 characters), never storing raw IP
      expect(key).toHaveLength(64);
      expect(key).not.toContain(clientIp);

      // Clean up key if exists
      await testDb.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));

      // Limit of 3 requests within window
      const opts = { limit: 3, windowMs: 10_000 };

      const r1 = await checkRateLimit(key, opts, testDb);
      expect(r1.allowed).toBe(true);
      expect(r1.count).toBe(1);

      const r2 = await checkRateLimit(key, opts, testDb);
      expect(r2.allowed).toBe(true);
      expect(r2.count).toBe(2);

      const r3 = await checkRateLimit(key, opts, testDb);
      expect(r3.allowed).toBe(true);
      expect(r3.count).toBe(3);

      // 4th request must be rejected (HTTP 429 semantics)
      const r4 = await checkRateLimit(key, opts, testDb);
      expect(r4.allowed).toBe(false);
      expect(r4.count).toBe(4);
      expect(r4.retryAfter).toBeGreaterThan(0);

      // Verify row in rate_limits table
      const stored = await testDb
        .select()
        .from(schema.rateLimits)
        .where(eq(schema.rateLimits.key, key));
      expect(stored).toHaveLength(1);
      expect(stored[0].key).toBe(key);
      expect(stored[0].count).toBe(4);

      // Window expiration: simulate past window
      const pastTime = new Date(Date.now() - 20_000);
      await testDb
        .update(schema.rateLimits)
        .set({ windowStart: pastTime })
        .where(eq(schema.rateLimits.key, key));

      // After window expiration, count resets to 1 and is allowed
      const rAfterReset = await checkRateLimit(key, opts, testDb);
      expect(rAfterReset.allowed).toBe(true);
      expect(rAfterReset.count).toBe(1);

      // Clean up test key
      await testDb.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));
    });
  });
});
