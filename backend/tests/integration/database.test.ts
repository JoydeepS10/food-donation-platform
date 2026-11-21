import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../src/app.ts';
import { prisma } from '../../src/db/prisma.ts';
import { createDatabaseReadiness, createPrismaDatabasePing } from '../../src/db/readiness.ts';
import { createLogger } from '../../src/utils/logger.ts';
import { verifyPassword } from '../../src/utils/password.ts';
import { isRecord } from '../helpers/json.ts';
import { testConfig } from '../helpers/test-config.ts';
import { startTestApp } from '../helpers/test-server.ts';

const hasDatabaseUrl =
  typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;

let databaseSkip: boolean | string = 'DATABASE_URL is not set.';

if (hasDatabaseUrl) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseSkip = false;
  } catch {
    databaseSkip = 'The database is unreachable. Start PostgreSQL and apply the migrations.';
  }
}

after(async () => {
  await prisma.$disconnect();
});

const EXPECTED_TABLES = [
  'auth_tokens',
  'claims',
  'donation_status_history',
  'donations',
  'notifications',
  'organisations',
  'sessions',
  'users',
  'verification_documents',
];

const EXPECTED_ENUMS = [
  'auth_token_type',
  'claim_status',
  'document_status',
  'document_type',
  'donation_status',
  'notification_type',
  'org_type',
  'org_verification_status',
  'quantity_unit',
  'user_role',
];

const PARTIAL_INDEXES: Readonly<Record<string, RegExp>> = {
  claims_one_active_per_donation_idx: /status = 'active'/,
  verification_documents_one_current_per_type_idx: /is_current/,
  donations_available_city_created_idx: /status = 'available'/,
  donations_available_pickup_end_idx: /status = 'available'/,
  donations_overdue_pickup_end_idx: /claimed/,
  claims_active_pickup_confirmed_idx: /status = 'active'/,
  notifications_user_unread_idx: /read_at IS NULL/,
};

const ORDINARY_UNIQUE_INDEXES = [
  'users_organisation_id_key',
  'users_email_key',
  'organisations_type_registration_number_key',
  'verification_documents_storage_key_key',
  'sessions_token_hash_key',
  'auth_tokens_token_hash_key',
];

const CHECK_CONSTRAINTS = [
  'users_role_organisation_check',
  'organisations_verified_fields_check',
  'organisations_rejected_reason_check',
  'organisations_pending_fields_check',
  'verification_documents_size_positive_check',
  'verification_documents_review_fields_check',
  'verification_documents_rejection_note_check',
  'donations_window_order_check',
  'donations_window_before_best_before_check',
  'donations_quantity_positive_check',
  'donations_cancelled_fields_check',
  'donations_completed_at_check',
  'claims_active_fields_check',
  'claims_cancelled_fields_check',
  'claims_completed_fields_check',
  'claims_completed_after_pickup_check',
  'donation_status_history_cancelled_fields_check',
];

const BACKEND_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const FIXTURE = {
  adminUser: '9a000000-0000-4000-8000-000000000001',
  donorUser: '9a000000-0000-4000-8000-000000000002',
  ngoUser: '9a000000-0000-4000-8000-000000000003',
  invalidAdminWithOrg: '9a000000-0000-4000-8000-000000000004',
  invalidDonorWithoutOrg: '9a000000-0000-4000-8000-000000000005',
  invalidSecondUser: '9a000000-0000-4000-8000-000000000006',
  invalidDuplicateEmail: '9a000000-0000-4000-8000-000000000007',
  donorOrganisation: '9b000000-0000-4000-8000-000000000001',
  donorOrganisation2: '9b000000-0000-4000-8000-000000000002',
  ngoOrganisation: '9b000000-0000-4000-8000-000000000003',
  invalidVerifiedOrganisation: '9b000000-0000-4000-8000-000000000004',
  invalidRejectedOrganisation: '9b000000-0000-4000-8000-000000000005',
  invalidPendingOrganisation: '9b000000-0000-4000-8000-000000000006',
  donation: '9c000000-0000-4000-8000-000000000001',
  invalidDonationWindowOrder: '9c000000-0000-4000-8000-000000000002',
  invalidDonationWindowBestBefore: '9c000000-0000-4000-8000-000000000003',
  invalidDonationQuantity: '9c000000-0000-4000-8000-000000000004',
  invalidDonationCancelled: '9c000000-0000-4000-8000-000000000005',
  invalidDonationCompleted: '9c000000-0000-4000-8000-000000000006',
  activeClaim: '9d000000-0000-4000-8000-000000000001',
  invalidSecondActiveClaim: '9d000000-0000-4000-8000-000000000002',
  invalidCancelledClaim: '9d000000-0000-4000-8000-000000000003',
  invalidCompletedClaim: '9d000000-0000-4000-8000-000000000004',
  currentDocument: '9e000000-0000-4000-8000-000000000001',
  invalidReviewedDocument: '9e000000-0000-4000-8000-000000000002',
  invalidRejectedDocument: '9e000000-0000-4000-8000-000000000003',
  invalidSecondCurrentDocument: '9e000000-0000-4000-8000-000000000004',
  invalidCancelledHistory: '9f000000-0000-4000-8000-000000000001',
} as const;

const FIXTURE_ORGANISATION_IDS = [
  FIXTURE.donorOrganisation,
  FIXTURE.donorOrganisation2,
  FIXTURE.ngoOrganisation,
  FIXTURE.invalidVerifiedOrganisation,
  FIXTURE.invalidRejectedOrganisation,
  FIXTURE.invalidPendingOrganisation,
];

const FIXTURE_USER_IDS = [
  FIXTURE.adminUser,
  FIXTURE.donorUser,
  FIXTURE.ngoUser,
  FIXTURE.invalidAdminWithOrg,
  FIXTURE.invalidDonorWithoutOrg,
  FIXTURE.invalidSecondUser,
  FIXTURE.invalidDuplicateEmail,
];

const FIXTURE_DONATION_IDS = [
  FIXTURE.donation,
  FIXTURE.invalidDonationWindowOrder,
  FIXTURE.invalidDonationWindowBestBefore,
  FIXTURE.invalidDonationQuantity,
  FIXTURE.invalidDonationCancelled,
  FIXTURE.invalidDonationCompleted,
];

const SEEDED_LOGINS = [
  { email: 'admin@food-demo.test', password: 'Admin1234!' },
  { email: 'donor.verified@food-demo.test', password: 'Demo1234!' },
  { email: 'donor.pending@food-demo.test', password: 'Demo1234!' },
  { email: 'donor.rejected@food-demo.test', password: 'Demo1234!' },
  { email: 'ngo.verified@food-demo.test', password: 'Demo1234!' },
  { email: 'ngo.verified2@food-demo.test', password: 'Demo1234!' },
  { email: 'ngo.rejected@food-demo.test', password: 'Demo1234!' },
];

const SEEDED_ROW_COUNTS: SeededRowCounts = {
  users: 7,
  organisations: 6,
  documents: 12,
  donations: 6,
  claims: 5,
  history: 17,
  notifications: 12,
  unreadNotifications: 10,
};

interface SeededRowCounts {
  readonly users: number;
  readonly organisations: number;
  readonly documents: number;
  readonly donations: number;
  readonly claims: number;
  readonly history: number;
  readonly notifications: number;
  readonly unreadNotifications: number;
}

interface SeedCountRow {
  readonly users: bigint;
  readonly organisations: bigint;
  readonly documents: bigint;
  readonly donations: bigint;
  readonly claims: bigint;
  readonly history: bigint;
  readonly notifications: bigint;
  readonly unread_notifications: bigint;
}

interface SeedRunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runSeed(envOverrides: NodeJS.ProcessEnv = {}): SeedRunResult {
  const result = spawnSync(process.execPath, ['prisma/seed.ts'], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, ...envOverrides },
    encoding: 'utf8',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function assertSeedSucceeded(result: SeedRunResult): void {
  assert.equal(
    result.status,
    0,
    `Seed failed with status ${String(result.status)}: ${result.stderr}`,
  );
}

interface PrismaRawError {
  readonly sqlState: string;
  readonly message: string;
}

function readPrismaRawError(error: unknown): PrismaRawError {
  assert.ok(error instanceof Error, 'Expected an Error.');

  const meta = Reflect.get(error, 'meta');
  assert.ok(isRecord(meta), 'Expected a Prisma raw-query error with meta.');

  const sqlState = meta.code;
  const message = meta.message;

  if (typeof sqlState !== 'string' || typeof message !== 'string') {
    assert.fail('Expected a PostgreSQL SQLSTATE and message.');
  }

  return { sqlState, message };
}

function rejectsCheckViolation(constraint: string) {
  return (error: unknown): true => {
    const { sqlState, message } = readPrismaRawError(error);
    assert.equal(sqlState, '23514', `Expected a CHECK violation, got ${sqlState}: ${message}`);
    assert.match(message, new RegExp(`violates check constraint "${constraint}"`));
    return true;
  };
}

function rejectsUniqueViolation(columns: string) {
  return (error: unknown): true => {
    const { sqlState, message } = readPrismaRawError(error);
    assert.equal(sqlState, '23505', `Expected a unique violation, got ${sqlState}: ${message}`);
    assert.match(message, new RegExp(`Key \\(${columns}\\)=`));
    return true;
  };
}

async function readSeededRowCounts(): Promise<SeededRowCounts> {
  const rows = await prisma.$queryRaw<SeedCountRow[]>`
    SELECT
      (SELECT count(*) FROM "users" WHERE "id"::text LIKE '00000000%') AS "users",
      (
        SELECT count(*) FROM "organisations"
        WHERE "id"::text LIKE '10000000%' OR "id"::text LIKE '20000000%'
      ) AS "organisations",
      (SELECT count(*) FROM "verification_documents" WHERE "id"::text LIKE '50000000%') AS "documents",
      (SELECT count(*) FROM "donations" WHERE "id"::text LIKE '30000000%') AS "donations",
      (SELECT count(*) FROM "claims" WHERE "id"::text LIKE '40000000%') AS "claims",
      (SELECT count(*) FROM "donation_status_history" WHERE "id"::text LIKE '70000000%') AS "history",
      (SELECT count(*) FROM "notifications" WHERE "id"::text LIKE '60000000%') AS "notifications",
      (
        SELECT count(*) FROM "notifications"
        WHERE "id"::text LIKE '60000000%' AND "read_at" IS NULL
      ) AS "unread_notifications"
  `;

  const row = rows[0];
  assert.ok(row !== undefined);

  return {
    users: Number(row.users),
    organisations: Number(row.organisations),
    documents: Number(row.documents),
    donations: Number(row.donations),
    claims: Number(row.claims),
    history: Number(row.history),
    notifications: Number(row.notifications),
    unreadNotifications: Number(row.unread_notifications),
  };
}

async function cleanupFixtures(): Promise<void> {
  await prisma.organisation.updateMany({
    where: { id: { in: FIXTURE_ORGANISATION_IDS } },
    data: {
      verificationStatus: 'pending',
      verifiedAt: null,
      verifiedByUserId: null,
      rejectionReason: null,
    },
  });
  await prisma.verificationDocument.deleteMany({
    where: {
      OR: [
        { organisationId: { in: FIXTURE_ORGANISATION_IDS } },
        { uploadedByUserId: { in: FIXTURE_USER_IDS } },
      ],
    },
  });
  await prisma.claim.deleteMany({
    where: {
      OR: [
        { donationId: { in: FIXTURE_DONATION_IDS } },
        { ngoOrganisationId: { in: FIXTURE_ORGANISATION_IDS } },
        { claimedByUserId: { in: FIXTURE_USER_IDS } },
      ],
    },
  });
  await prisma.donationStatusHistory.deleteMany({
    where: { donationId: { in: FIXTURE_DONATION_IDS } },
  });
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: FIXTURE_USER_IDS } },
        { donationId: { in: FIXTURE_DONATION_IDS } },
      ],
    },
  });
  await prisma.donation.deleteMany({
    where: {
      OR: [
        { id: { in: FIXTURE_DONATION_IDS } },
        { donorOrganisationId: { in: FIXTURE_ORGANISATION_IDS } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: FIXTURE_USER_IDS } } });
  await prisma.organisation.deleteMany({ where: { id: { in: FIXTURE_ORGANISATION_IDS } } });
}

async function createFixtures(): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
    VALUES (
      ${FIXTURE.adminUser}::uuid,
      NULL,
      'admin'::user_role,
      'fixture.admin@example.test',
      'fixture-hash',
      true,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "organisations" (
      "id", "type", "name", "contact_name", "contact_phone", "contact_email",
      "address_line1", "area", "city", "verification_status", "verification_submitted_at",
      "verified_at", "verified_by_user_id", "rejection_reason", "created_at", "updated_at"
    )
    VALUES (
      ${FIXTURE.donorOrganisation}::uuid,
      'donor'::org_type,
      'Fixture Donor',
      'Fixture Contact',
      '+15550000',
      'fixture.donor@example.test',
      '1 Fixture Road',
      'Test',
      'Testville',
      'verified'::org_verification_status,
      now(),
      now(),
      ${FIXTURE.adminUser}::uuid,
      NULL,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "organisations" (
      "id", "type", "name", "contact_name", "contact_phone", "contact_email",
      "address_line1", "area", "city", "verification_status", "verification_submitted_at",
      "verified_at", "verified_by_user_id", "rejection_reason", "created_at", "updated_at"
    )
    VALUES (
      ${FIXTURE.donorOrganisation2}::uuid,
      'donor'::org_type,
      'Fixture Second Donor',
      'Fixture Contact',
      '+15550001',
      'fixture.donor2@example.test',
      '2 Fixture Road',
      'Test',
      'Testville',
      'pending'::org_verification_status,
      now(),
      NULL,
      NULL,
      NULL,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "organisations" (
      "id", "type", "name", "contact_name", "contact_phone", "contact_email",
      "address_line1", "area", "city", "verification_status", "verification_submitted_at",
      "verified_at", "verified_by_user_id", "rejection_reason", "created_at", "updated_at"
    )
    VALUES (
      ${FIXTURE.ngoOrganisation}::uuid,
      'ngo'::org_type,
      'Fixture NGO',
      'Fixture Contact',
      '+15550002',
      'fixture.ngo@example.test',
      '3 Fixture Road',
      'Test',
      'Testville',
      'verified'::org_verification_status,
      now(),
      now(),
      ${FIXTURE.adminUser}::uuid,
      NULL,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
    VALUES (
      ${FIXTURE.donorUser}::uuid,
      ${FIXTURE.donorOrganisation}::uuid,
      'donor'::user_role,
      'fixture.donor.user@example.test',
      'fixture-hash',
      true,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
    VALUES (
      ${FIXTURE.ngoUser}::uuid,
      ${FIXTURE.ngoOrganisation}::uuid,
      'ngo'::user_role,
      'fixture.ngo.user@example.test',
      'fixture-hash',
      true,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "donations" (
      "id", "donor_organisation_id", "title", "description", "is_vegetarian", "quantity", "unit",
      "best_before", "pickup_window_start", "pickup_window_end", "pickup_address_line1",
      "pickup_area", "pickup_city", "status", "version", "created_at", "updated_at"
    )
    VALUES (
      ${FIXTURE.donation}::uuid,
      ${FIXTURE.donorOrganisation}::uuid,
      'Fixture donation',
      'Fixture description',
      true,
      1.00,
      'kg'::quantity_unit,
      now() + interval '4 hours',
      now() + interval '1 hour',
      now() + interval '2 hours',
      '1 Fixture Road',
      'Test',
      'Testville',
      'available'::donation_status,
      0,
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "claims" (
      "id", "donation_id", "ngo_organisation_id", "claimed_by_user_id", "status", "claimed_at", "created_at", "updated_at"
    )
    VALUES (
      ${FIXTURE.activeClaim}::uuid,
      ${FIXTURE.donation}::uuid,
      ${FIXTURE.ngoOrganisation}::uuid,
      ${FIXTURE.ngoUser}::uuid,
      'active'::claim_status,
      now(),
      now(),
      now()
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "verification_documents" (
      "id", "organisation_id", "uploaded_by_user_id", "document_type", "status", "is_current",
      "storage_key", "original_filename", "mime_type", "size_bytes", "uploaded_at"
    )
    VALUES (
      ${FIXTURE.currentDocument}::uuid,
      ${FIXTURE.ngoOrganisation}::uuid,
      ${FIXTURE.ngoUser}::uuid,
      'food_safety_licence'::document_type,
      'pending'::document_status,
      true,
      'fixture/current-document.pdf',
      'current-document.pdf',
      'application/pdf',
      1024,
      now()
    )
  `;
}

test('all nine tables and all ten enums exist', { skip: databaseSkip }, async () => {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  assert.deepEqual(
    tables.map((table) => table.tablename),
    EXPECTED_TABLES,
  );

  const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
    SELECT typname
    FROM pg_type
    WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace
    ORDER BY typname
  `;

  assert.deepEqual(
    enums.map((enumType) => enumType.typname),
    EXPECTED_ENUMS,
  );
});

test('partial indexes and ordinary unique indexes exist', { skip: databaseSkip }, async () => {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;

  const byName = new Map(indexes.map((index) => [index.indexname, index.indexdef]));

  for (const [name, predicate] of Object.entries(PARTIAL_INDEXES)) {
    const definition = byName.get(name);
    assert.ok(definition !== undefined, `Missing partial index ${name}.`);
    assert.match(definition, /WHERE/, `Index ${name} must be partial.`);
    assert.match(definition, predicate, `Index ${name} has an unexpected predicate.`);
  }

  const overdue = byName.get('donations_overdue_pickup_end_idx') ?? '';
  assert.match(overdue, /picked_up/);

  for (const name of ORDINARY_UNIQUE_INDEXES) {
    const definition = byName.get(name);
    assert.ok(definition !== undefined, `Missing unique index ${name}.`);
    assert.match(definition, /UNIQUE INDEX/, `Index ${name} must be unique.`);
  }
});

test('all database CHECK constraints exist', { skip: databaseSkip }, async () => {
  const constraints = await prisma.$queryRaw<Array<{ conname: string; definition: string }>>`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace
    ORDER BY conname
  `;

  const byName = new Map(constraints.map((constraint) => [constraint.conname, constraint.definition]));

  for (const name of CHECK_CONSTRAINTS) {
    assert.ok(byName.has(name), `Missing CHECK constraint ${name}.`);
  }

  assert.match(byName.get('donations_window_order_check') ?? '', /pickup_window_start/);
  assert.match(byName.get('donations_window_before_best_before_check') ?? '', /best_before/);
  assert.match(byName.get('claims_completed_after_pickup_check') ?? '', /completed_at/);
});

test('raw SQL cannot bypass partial indexes or CHECK constraints', { skip: databaseSkip }, async () => {
  await cleanupFixtures();

  try {
    await createFixtures();

    // users
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
        VALUES (
          ${FIXTURE.invalidAdminWithOrg}::uuid,
          ${FIXTURE.donorOrganisation2}::uuid,
          'admin'::user_role,
          'fixture.invalid.admin@example.test',
          'fixture-hash',
          true,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('users_role_organisation_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
        VALUES (
          ${FIXTURE.invalidDonorWithoutOrg}::uuid,
          NULL,
          'donor'::user_role,
          'fixture.invalid.donor@example.test',
          'fixture-hash',
          true,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('users_role_organisation_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
        VALUES (
          ${FIXTURE.invalidSecondUser}::uuid,
          ${FIXTURE.donorOrganisation}::uuid,
          'donor'::user_role,
          'fixture.second.user@example.test',
          'fixture-hash',
          true,
          now(),
          now()
        )
      `,
      rejectsUniqueViolation('organisation_id'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "users" ("id", "organisation_id", "role", "email", "password_hash", "is_active", "created_at", "updated_at")
        VALUES (
          ${FIXTURE.invalidDuplicateEmail}::uuid,
          ${FIXTURE.donorOrganisation2}::uuid,
          'donor'::user_role,
          'fixture.donor.user@example.test',
          'fixture-hash',
          true,
          now(),
          now()
        )
      `,
      rejectsUniqueViolation('email'),
    );

    // organisations
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "organisations" (
          "id", "type", "name", "contact_name", "contact_phone", "contact_email",
          "address_line1", "area", "city", "verification_status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidVerifiedOrganisation}::uuid,
          'donor'::org_type,
          'Invalid Verified Org',
          'Fixture Contact',
          '+15550003',
          'fixture.invalid.verified@example.test',
          '4 Fixture Road',
          'Test',
          'Testville',
          'verified'::org_verification_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('organisations_verified_fields_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "organisations" (
          "id", "type", "name", "contact_name", "contact_phone", "contact_email",
          "address_line1", "area", "city", "verification_status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidRejectedOrganisation}::uuid,
          'ngo'::org_type,
          'Invalid Rejected Org',
          'Fixture Contact',
          '+15550004',
          'fixture.invalid.rejected@example.test',
          '5 Fixture Road',
          'Test',
          'Testville',
          'rejected'::org_verification_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('organisations_rejected_reason_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "organisations" (
          "id", "type", "name", "contact_name", "contact_phone", "contact_email",
          "address_line1", "area", "city", "verification_status", "verified_at",
          "verified_by_user_id", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidPendingOrganisation}::uuid,
          'ngo'::org_type,
          'Invalid Pending Org',
          'Fixture Contact',
          '+15550005',
          'fixture.invalid.pending@example.test',
          '6 Fixture Road',
          'Test',
          'Testville',
          'pending'::org_verification_status,
          now(),
          ${FIXTURE.adminUser}::uuid,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('organisations_pending_fields_check'),
    );

    // donations
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "donations" (
          "id", "donor_organisation_id", "title", "description", "is_vegetarian", "quantity",
          "unit", "best_before", "pickup_window_start", "pickup_window_end",
          "pickup_address_line1", "pickup_area", "pickup_city", "status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidDonationWindowOrder}::uuid,
          ${FIXTURE.donorOrganisation}::uuid,
          'Bad window order',
          'Fixture description',
          true,
          1.00,
          'kg'::quantity_unit,
          now() + interval '4 hours',
          now() + interval '2 hours',
          now() + interval '1 hour',
          '1 Fixture Road',
          'Test',
          'Testville',
          'available'::donation_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('donations_window_order_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "donations" (
          "id", "donor_organisation_id", "title", "description", "is_vegetarian", "quantity",
          "unit", "best_before", "pickup_window_start", "pickup_window_end",
          "pickup_address_line1", "pickup_area", "pickup_city", "status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidDonationWindowBestBefore}::uuid,
          ${FIXTURE.donorOrganisation}::uuid,
          'Bad best-before',
          'Fixture description',
          true,
          1.00,
          'kg'::quantity_unit,
          now() + interval '3 hours',
          now() + interval '1 hour',
          now() + interval '4 hours',
          '1 Fixture Road',
          'Test',
          'Testville',
          'available'::donation_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('donations_window_before_best_before_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "donations" (
          "id", "donor_organisation_id", "title", "description", "is_vegetarian", "quantity",
          "unit", "best_before", "pickup_window_start", "pickup_window_end",
          "pickup_address_line1", "pickup_area", "pickup_city", "status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidDonationQuantity}::uuid,
          ${FIXTURE.donorOrganisation}::uuid,
          'Zero quantity',
          'Fixture description',
          true,
          0,
          'kg'::quantity_unit,
          now() + interval '4 hours',
          now() + interval '1 hour',
          now() + interval '2 hours',
          '1 Fixture Road',
          'Test',
          'Testville',
          'available'::donation_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('donations_quantity_positive_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "donations" (
          "id", "donor_organisation_id", "title", "description", "is_vegetarian", "quantity",
          "unit", "best_before", "pickup_window_start", "pickup_window_end",
          "pickup_address_line1", "pickup_area", "pickup_city", "status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidDonationCancelled}::uuid,
          ${FIXTURE.donorOrganisation}::uuid,
          'Cancelled without fields',
          'Fixture description',
          true,
          1.00,
          'kg'::quantity_unit,
          now() + interval '4 hours',
          now() + interval '1 hour',
          now() + interval '2 hours',
          '1 Fixture Road',
          'Test',
          'Testville',
          'cancelled'::donation_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('donations_cancelled_fields_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "donations" (
          "id", "donor_organisation_id", "title", "description", "is_vegetarian", "quantity",
          "unit", "best_before", "pickup_window_start", "pickup_window_end",
          "pickup_address_line1", "pickup_area", "pickup_city", "status", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidDonationCompleted}::uuid,
          ${FIXTURE.donorOrganisation}::uuid,
          'Completed without timestamp',
          'Fixture description',
          true,
          1.00,
          'kg'::quantity_unit,
          now() + interval '4 hours',
          now() + interval '1 hour',
          now() + interval '2 hours',
          '1 Fixture Road',
          'Test',
          'Testville',
          'completed'::donation_status,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('donations_completed_at_check'),
    );

    // claims
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "claims" (
          "id", "donation_id", "ngo_organisation_id", "claimed_by_user_id", "status", "claimed_at", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidSecondActiveClaim}::uuid,
          ${FIXTURE.donation}::uuid,
          ${FIXTURE.ngoOrganisation}::uuid,
          ${FIXTURE.ngoUser}::uuid,
          'active'::claim_status,
          now(),
          now(),
          now()
        )
      `,
      rejectsUniqueViolation('donation_id'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "claims" (
          "id", "donation_id", "ngo_organisation_id", "claimed_by_user_id", "status", "claimed_at", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidCancelledClaim}::uuid,
          ${FIXTURE.donation}::uuid,
          ${FIXTURE.ngoOrganisation}::uuid,
          ${FIXTURE.ngoUser}::uuid,
          'cancelled'::claim_status,
          now(),
          now(),
          now()
        )
      `,
      rejectsCheckViolation('claims_cancelled_fields_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "claims" (
          "id", "donation_id", "ngo_organisation_id", "claimed_by_user_id", "status", "claimed_at", "created_at", "updated_at"
        )
        VALUES (
          ${FIXTURE.invalidCompletedClaim}::uuid,
          ${FIXTURE.donation}::uuid,
          ${FIXTURE.ngoOrganisation}::uuid,
          ${FIXTURE.ngoUser}::uuid,
          'completed'::claim_status,
          now(),
          now(),
          now()
        )
      `,
      rejectsCheckViolation('claims_completed_fields_check'),
    );

    // verification documents
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "verification_documents" (
          "id", "organisation_id", "uploaded_by_user_id", "document_type", "status", "is_current",
          "storage_key", "original_filename", "mime_type", "size_bytes", "uploaded_at"
        )
        VALUES (
          ${FIXTURE.invalidReviewedDocument}::uuid,
          ${FIXTURE.ngoOrganisation}::uuid,
          ${FIXTURE.ngoUser}::uuid,
          'business_registration'::document_type,
          'approved'::document_status,
          true,
          'fixture/reviewed-without-reviewer.pdf',
          'reviewed-without-reviewer.pdf',
          'application/pdf',
          1024,
          now()
        )
      `,
      rejectsCheckViolation('verification_documents_review_fields_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "verification_documents" (
          "id", "organisation_id", "uploaded_by_user_id", "document_type", "status", "is_current",
          "storage_key", "original_filename", "mime_type", "size_bytes", "reviewed_by_user_id",
          "reviewed_at", "uploaded_at"
        )
        VALUES (
          ${FIXTURE.invalidRejectedDocument}::uuid,
          ${FIXTURE.ngoOrganisation}::uuid,
          ${FIXTURE.ngoUser}::uuid,
          'other'::document_type,
          'rejected'::document_status,
          true,
          'fixture/rejected-without-note.pdf',
          'rejected-without-note.pdf',
          'application/pdf',
          1024,
          ${FIXTURE.adminUser}::uuid,
          now(),
          now()
        )
      `,
      rejectsCheckViolation('verification_documents_rejection_note_check'),
    );

    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "verification_documents" (
          "id", "organisation_id", "uploaded_by_user_id", "document_type", "status", "is_current",
          "storage_key", "original_filename", "mime_type", "size_bytes", "uploaded_at"
        )
        VALUES (
          ${FIXTURE.invalidSecondCurrentDocument}::uuid,
          ${FIXTURE.ngoOrganisation}::uuid,
          ${FIXTURE.ngoUser}::uuid,
          'food_safety_licence'::document_type,
          'pending'::document_status,
          true,
          'fixture/second-current-document.pdf',
          'second-current-document.pdf',
          'application/pdf',
          1024,
          now()
        )
      `,
      rejectsUniqueViolation('organisation_id, document_type'),
    );

    // donation status history
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "donation_status_history" (
          "id", "donation_id", "from_status", "to_status", "changed_by_user_id", "reason", "created_at"
        )
        VALUES (
          ${FIXTURE.invalidCancelledHistory}::uuid,
          ${FIXTURE.donation}::uuid,
          'claimed'::donation_status,
          'cancelled'::donation_status,
          NULL,
          NULL,
          now()
        )
      `,
      rejectsCheckViolation('donation_status_history_cancelled_fields_check'),
      'A cancellation history row without an actor and reason must be rejected.',
    );
  } finally {
    await cleanupFixtures();
  }
});

test('health uses the real database readiness check', { skip: databaseSkip }, async (t) => {
  const server = await startTestApp(createApp(testConfig()));
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);

  const body: unknown = await response.json();
  assert.ok(isRecord(body));
  assert.equal(body.status, 'ok');
});

test('seeded passwords verify with the application scrypt helper', { skip: databaseSkip }, async (t) => {
  const users = await prisma.user.findMany({
    where: { email: { in: SEEDED_LOGINS.map((login) => login.email) } },
    select: { email: true, passwordHash: true },
  });

  if (users.length === 0) {
    t.skip('Seed data is not present. Run npm run db:seed first.');
    return;
  }

  assert.equal(users.length, SEEDED_LOGINS.length);

  const byEmail = new Map(users.map((user) => [user.email, user.passwordHash]));

  for (const login of SEEDED_LOGINS) {
    const passwordHash = byEmail.get(login.email);
    assert.ok(passwordHash !== undefined, `Missing seeded user ${login.email}.`);
    assert.match(passwordHash, /^scrypt\$/);
    assert.equal(await verifyPassword(login.password, passwordHash), true, login.email);
    assert.notEqual(passwordHash, login.password);
  }
});

test('the live database ping reports ready', { skip: databaseSkip }, async () => {
  const readiness = createDatabaseReadiness(
    createPrismaDatabasePing(prisma),
    createLogger('error'),
  );

  assert.equal(await readiness(), true);
});

test('the seed is idempotent and contains the documented demo data', { skip: databaseSkip }, async () => {
  assertSeedSucceeded(runSeed());

  const firstCounts = await readSeededRowCounts();
  assert.deepEqual(firstCounts, SEEDED_ROW_COUNTS);

  assertSeedSucceeded(runSeed());

  const secondCounts = await readSeededRowCounts();
  assert.deepEqual(secondCounts, SEEDED_ROW_COUNTS);

  const donations = await prisma.$queryRaw<Array<{ status: string; photo_storage_key: string | null }>>`
    SELECT "status"::text AS "status", "photo_storage_key"
    FROM "donations"
    WHERE "id"::text LIKE '30000000%'
  `;

  assert.deepEqual(
    [...new Set(donations.map((donation) => donation.status))].sort(),
    ['available', 'cancelled', 'claimed', 'completed', 'expired', 'picked_up'],
  );
  assert.equal(donations.every((donation) => donation.photo_storage_key === null), true);

  const notifications = await prisma.$queryRaw<Array<{ emailed_at: Date | null }>>`
    SELECT "emailed_at"
    FROM "notifications"
    WHERE "id"::text LIKE '60000000%'
  `;

  assert.equal(notifications.every((notification) => notification.emailed_at === null), true);
});

test('the seed refuses to run in production', { skip: databaseSkip }, () => {
  const result = runSeed({ NODE_ENV: 'production' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to seed: NODE_ENV=production/);
  assert.doesNotMatch(result.stdout, /Demo seed complete/);
});
