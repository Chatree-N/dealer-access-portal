import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Enums
export const branchStatusEnum = pgEnum('branch_status', ['active', 'inactive']);

export const requestStatusEnum = pgEnum('request_status', [
  'pending_review',
  'approved',
  'invite_sent',
  'rejected',
]);

export const signatureKindEnum = pgEnum('signature_kind', ['drawn', 'typed']);

// 1. Dealers
export const dealers = pgTable('dealers', {
  id: text('id').primaryKey(), // e.g. 'd-lotus'
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Dealer Email Domains
export const dealerEmailDomains = pgTable(
  'dealer_email_domains',
  {
    id: serial('id').primaryKey(),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('dealer_email_domains_dealer_domain_idx').on(table.dealerId, table.domain),
    index('dealer_email_domains_domain_idx').on(table.domain),
  ]
);

// 3. Branches
export const branches = pgTable(
  'branches',
  {
    id: serial('id').primaryKey(),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'restrict' }),
    dmsCode: text('dms_code').notNull().unique(), // unique DMS code, e.g. '1234', '0042'
    name: text('name').notNull(),
    province: text('province').notNull(),
    region: text('region').notNull(),
    status: branchStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('branches_dealer_id_idx').on(table.dealerId),
    index('branches_status_idx').on(table.status),
  ]
);

// 4. OpenChat Rooms (URLs stored ONLY here, server-side only)
export const openchatRooms = pgTable('openchat_rooms', {
  id: text('id').primaryKey(), // e.g. 'r-lotus-bkk'
  name: text('name').notNull(),
  url: text('url').notNull(), // server-side only room link
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Room to Dealer Region Mapping
export const roomToDealerRegion = pgTable(
  'room_to_dealer_region',
  {
    id: serial('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => openchatRooms.id, { onDelete: 'cascade' }),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    regionName: text('region_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('room_dealer_region_idx').on(table.dealerId, table.regionName),
    index('room_dealer_region_room_id_idx').on(table.roomId),
  ]
);

// 6. Consent Texts
export const consentTexts = pgTable('consent_texts', {
  version: text('version').primaryKey(), // e.g. 'v0-draft'
  content: text('content').notNull(),
  activeFrom: timestamp('active_from', { withTimezone: true }).defaultNow().notNull(),
  activeTo: timestamp('active_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Admin Users
export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

// 8. Requests
export const requests = pgTable(
  'requests',
  {
    id: text('id').primaryKey(), // e.g. 'REQ-0001'
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    consentTextVersion: text('consent_text_version')
      .notNull()
      .references(() => consentTexts.version, { onDelete: 'restrict' }),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    signatureKind: signatureKindEnum('signature_kind').notNull(),
    signatureRef: text('signature_ref').notNull(),
    status: requestStatusEnum('status').notNull().default('pending_review'),
    rejectionReason: text('rejection_reason'),
    reviewerId: integer('reviewer_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    roomId: text('room_id').references(() => openchatRooms.id, { onDelete: 'set null' }),
    inviteSentAt: timestamp('invite_sent_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('requests_email_status_idx').on(table.email, table.status),
    index('requests_status_idx').on(table.status),
    index('requests_branch_id_idx').on(table.branchId),
    index('requests_created_at_idx').on(table.createdAt),
  ]
);

// 9. Email Verifications
export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(), // hashed OTP
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull(),
    resendCount: integer('resend_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('email_verifications_email_idx').on(table.email)]
);

// 10. Audit Log
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entity, table.entityId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ]
);

// 11. Rate Limits
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(1),
});

// 12. Invite Tokens (Present but UNUSED per ADR 7)
export const inviteTokens = pgTable(
  'invite_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    requestId: text('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    roomId: text('room_id')
      .notNull()
      .references(() => openchatRooms.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('invite_tokens_request_id_idx').on(table.requestId)]
);

// Type inference
export type Dealer = typeof dealers.$inferSelect;
export type NewDealer = typeof dealers.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type OpenchatRoom = typeof openchatRooms.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type ConsentText = typeof consentTexts.$inferSelect;
