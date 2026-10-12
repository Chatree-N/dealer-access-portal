import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import seedData from '../../fixtures/seed-data.json';
import roomsData from '../../fixtures/server-only/rooms.json';

export async function seed(targetDb: NodePgDatabase<typeof schema>) {
  console.log('🌱 Starting database seed...');

  // 1. Dealers
  const dealersValues = seedData.dealers.map((d) => ({
    id: d.id,
    name: d.name,
  }));

  await targetDb
    .insert(schema.dealers)
    .values(dealersValues)
    .onConflictDoUpdate({
      target: schema.dealers.id,
      set: { name: sql.raw('excluded.name') },
    });
  console.log(`✓ Seeded ${dealersValues.length} dealers`);

  // 2. Dealer Email Domains
  const domainValues: { dealerId: string; domain: string }[] = [];
  for (const d of seedData.dealers) {
    for (const dom of d.emailDomains) {
      domainValues.push({
        dealerId: d.id,
        domain: dom,
      });
    }
  }

  if (domainValues.length > 0) {
    await targetDb
      .insert(schema.dealerEmailDomains)
      .values(domainValues)
      .onConflictDoNothing({
        target: [schema.dealerEmailDomains.dealerId, schema.dealerEmailDomains.domain],
      });
  }
  console.log(`✓ Seeded ${domainValues.length} dealer email domains`);

  // 3. OpenChat Rooms (server-side only)
  const roomsValues = roomsData.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
  }));

  await targetDb
    .insert(schema.openchatRooms)
    .values(roomsValues)
    .onConflictDoUpdate({
      target: schema.openchatRooms.id,
      set: {
        name: sql.raw('excluded.name'),
        url: sql.raw('excluded.url'),
      },
    });
  console.log(`✓ Seeded ${roomsValues.length} OpenChat rooms`);

  // 4. Room to Dealer Region Mapping
  const roomRegionMap = new Map<string, { dealerId: string; regionName: string; roomId: string }>();
  for (const b of seedData.branches) {
    const key = `${b.dealerId}__${b.region}`;
    if (!roomRegionMap.has(key)) {
      roomRegionMap.set(key, {
        dealerId: b.dealerId,
        regionName: b.region,
        roomId: b.roomId,
      });
    }
  }

  const roomRegionValues = Array.from(roomRegionMap.values());
  await targetDb
    .insert(schema.roomToDealerRegion)
    .values(roomRegionValues)
    .onConflictDoUpdate({
      target: [schema.roomToDealerRegion.dealerId, schema.roomToDealerRegion.regionName],
      set: {
        roomId: sql.raw('excluded.room_id'),
      },
    });
  console.log(`✓ Seeded ${roomRegionValues.length} room-to-dealer-region mappings`);

  // 5. Branches (dmsCode unique, 34 branches)
  const branchValues = seedData.branches.map((b) => ({
    dmsCode: b.code,
    dealerId: b.dealerId,
    name: b.name,
    province: b.province,
    region: b.region,
    status: b.status as 'active' | 'inactive',
  }));

  await targetDb
    .insert(schema.branches)
    .values(branchValues)
    .onConflictDoUpdate({
      target: schema.branches.dmsCode,
      set: {
        name: sql.raw('excluded.name'),
        dealerId: sql.raw('excluded.dealer_id'),
        province: sql.raw('excluded.province'),
        region: sql.raw('excluded.region'),
        status: sql.raw('excluded.status'),
      },
    });
  console.log(`✓ Seeded ${branchValues.length} branches`);

  // 6. Consent Text (active "v0-draft [Legal to confirm]")
  await targetDb
    .insert(schema.consentTexts)
    .values({
      version: 'v0-draft',
      content:
        'v0-draft [Legal to confirm]\n\nBy proceeding, you consent to the collection and use of your personal data for branch verification and Line OpenChat access provisioning.',
      activeFrom: new Date('2026-01-01T00:00:00.000Z'),
      activeTo: null,
    })
    .onConflictDoUpdate({
      target: schema.consentTexts.version,
      set: {
        content: sql.raw('excluded.content'),
        activeFrom: sql.raw('excluded.active_from'),
      },
    });
  console.log('✓ Seeded active consent text (v0-draft)');

  // 7. Optional sample requests behind --with-samples flag
  const withSamples = process.argv.includes('--with-samples');
  if (withSamples) {
    console.log('🌱 Adding sample requests (--with-samples flag enabled)...');
    // Find branch 1234
    const branch1234 = await targetDb.query.branches?.findFirst({
      where: (branches, { eq }) => eq(branches.dmsCode, '1234'),
    });

    const branchId = branch1234?.id || 1;

    await targetDb
      .insert(schema.requests)
      .values([
        {
          id: 'REQ-0001',
          branchId,
          firstName: 'Somchai',
          lastName: 'Fictional',
          email: 'somchai.fictional@lotustelecom.example',
          emailVerifiedAt: new Date('2026-10-01T10:00:00.000Z'),
          consentTextVersion: 'v0-draft',
          consentAt: new Date('2026-10-01T10:05:00.000Z'),
          signatureKind: 'drawn',
          signatureRef: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
          status: 'pending_review',
          roomId: 'r-lotus-central',
          createdAt: new Date('2026-10-01T10:05:00.000Z'),
        },
        {
          id: 'REQ-0002',
          branchId,
          firstName: 'Kanda',
          lastName: 'Sample',
          email: 'kanda.sample@lotustelecom.example',
          emailVerifiedAt: new Date('2026-10-02T11:00:00.000Z'),
          consentTextVersion: 'v0-draft',
          consentAt: new Date('2026-10-02T11:05:00.000Z'),
          signatureKind: 'typed',
          signatureRef: 'Kanda Sample',
          status: 'approved',
          roomId: 'r-lotus-central',
          createdAt: new Date('2026-10-02T11:05:00.000Z'),
        },
      ])
      .onConflictDoNothing({ target: schema.requests.id });
    console.log('✓ Seeded 2 fictional sample requests');
  } else {
    console.log('✓ Skipped requests (fictional requests only added with --with-samples)');
  }

  console.log('✅ Seed completed successfully.');
}

async function run() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/openchat';
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    await seed(db);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  run();
} else if (process.argv[1]?.includes('seed.ts')) {
  run();
}
