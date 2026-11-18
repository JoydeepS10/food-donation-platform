# Backend Plan — Food Donation Coordination System

**Status:** Agreed 2026-11-18. No application code has been written yet.

**Contract:** `docs/02-api-contract/openapi.yaml` is the source of truth. This plan
implements that contract; it does not change it.

## 1. Purpose and principles

The backend is a TypeScript API that owns the database, enforces the product rules and
serves the 25 operations in the API contract. It is built in vertical slices so the
frontend can integrate each slice before the next one starts.

Principles:

- **Contract first.** Paths, request shapes, response shapes, status codes and the shared
  error envelope come from `openapi.yaml` and `API_NOTES.md`.
- **No overbuilding.** A slice mounts only its own routes and builds only the services it
  needs. Future-slice endpoints are not stubbed or hidden behind flags.
- **One exception: the schema.** Phase 12 creates the full database schema, migration and
  seed as requested, so later slices do not churn migrations. The schema is data, not
  future-slice HTTP behaviour.
- **Small files, clear layers.** Routes declare paths, controllers translate HTTP,
  validators check input, services own business rules and transactions, presenters build
  response projections. Prisma queries stay out of controllers.
- **Strict TypeScript.** `strict: true`, no `any`, no `@ts-ignore`, no non-null assertions
  used to silence the compiler. Unknown input is narrowed explicitly.
- **No unapproved libraries.** The approved stack is Node.js, Express, TypeScript,
  PostgreSQL and Prisma. `multer` and `@types/multer` are approved for Slice 4 uploads.
  Nothing else is added without owner approval.
- **In-app notifications only.** The MVP has no email provider, email service or email
  adapter. The `notifications.emailed_at` column remains in the schema for contract
  compatibility and is left unused.
- **Privacy is server-side.** Projections are built on the server. Public callers never
  receive a street address, postcode, pickup instructions or contact details, regardless
  of what the client previously displayed.

## 2. Stack and approved dependencies

| Area | Choice |
| --- | --- |
| Runtime | Node.js LTS |
| HTTP | Express |
| Language | TypeScript, strict mode |
| Database | PostgreSQL 15+ |
| ORM | Prisma |
| API style | JSON over `/api/v1`; opaque session cookie |
| Password hashing | Node built-in `crypto.scrypt` |
| Tokens | Node built-in `crypto.randomBytes` and SHA-256 |
| Testing | Node built-in `node:test` and `node:assert` |
| Upload parsing | `multer` with memory storage; `@types/multer` for development |
| Production storage | S3-compatible private bucket behind the storage interface |

Approved for this plan:

- `multer` and `@types/multer` for `POST /organisations/me/documents`.
- An S3-compatible private bucket for production storage. The concrete S3 client package
  is **not yet approved**; it must be requested before phase 19. The storage interface and
  local adapter do not depend on it.
- No email provider, email library, queue, retry system or email adapter.
- No other runtime dependency without owner approval. In particular, do not add a
  validation framework, logging framework, cookie parser, CORS package, security-header
  package, rate-limit package or test framework without asking first.

Key environment variables:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test` or `production` |
| `PORT` | API port, default `4000` |
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGIN` | Exact frontend origin allowed with credentials |
| `SESSION_TTL_HOURS` | Session lifetime, default `168` (7 days) |
| `COOKIE_SECURE` | `true` in production, `false` in development |
| `STORAGE_DRIVER` | `local` in development, `s3` in production |
| `LOCAL_UPLOAD_DIR` | Local upload root, default `backend/var/uploads` |
| `MAX_UPLOAD_BYTES` | Document limit, default `10485760` (10 MB) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` | Production bucket settings |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Production credentials; never committed |
| `JOBS_ENABLED` | Start the in-process scheduler; `true` in normal runtime |
| `LOG_LEVEL` | Structured log threshold |
| `APP_VERSION` | Value returned by `GET /health` |

Configuration is validated at startup. A missing required variable stops the process with
a clear message; secrets are never printed.

## 3. Folder layout inside `backend/src`

The existing `config/`, `controllers/`, `middleware/`, `routes/`, `services/`, `utils/`
and `validators/` folders are retained. New folders are `db/`, `presenters/`, `storage/`,
`jobs/` and `types/`.

```text
backend/
  prisma/
    schema.prisma
    migrations/
      20261118_init/migration.sql
      20261118_constraints/migration.sql
    seed.ts
  src/
    app.ts                     # builds the Express app; does not listen
    server.ts                  # listens, handles shutdown, starts jobs
    config/
      env.ts                   # validated environment
      constants.ts
    db/
      prisma.ts                # single Prisma client
    routes/
      index.ts                 # mounts only current-slice routers
      health.routes.ts
      auth.routes.ts
      donation.routes.ts
      claim.routes.ts
      organisation.routes.ts
      admin.routes.ts
      notification.routes.ts
    controllers/
      health.controller.ts
      auth.controller.ts
      donation.controller.ts
      claim.controller.ts
      organisation.controller.ts
      admin.controller.ts
      notification.controller.ts
    services/
      auth.service.ts
      session.service.ts
      organisation.service.ts
      document.service.ts
      verification.service.ts
      donation.service.ts
      claim.service.ts
      notification.service.ts
    middleware/
      request-id.ts
      cors.ts
      security-headers.ts
      authenticate.ts
      require-role.ts
      require-verified-organisation.ts
      validate.ts
      rate-limit.ts
      upload.ts
      not-found.ts
      error-handler.ts
    validators/
      common.ts
      auth.validators.ts
      donation.validators.ts
      claim.validators.ts
      organisation.validators.ts
      admin.validators.ts
      notification.validators.ts
    presenters/
      auth.presenter.ts
      donation.presenter.ts
      claim.presenter.ts
      organisation.presenter.ts
      notification.presenter.ts
    storage/
      storage.types.ts         # StorageService interface
      local-storage.ts         # development adapter
      cloud-storage.ts         # S3-compatible production adapter, phase 19
      storage.factory.ts
    jobs/
      expire-donations.job.ts
      auto-complete-donations.job.ts
      cleanup.job.ts
      scheduler.ts
    utils/
      app-error.ts
      async-handler.ts
      clock.ts
      password.ts
      tokens.ts
      mime.ts
      pagination.ts
      cookies.ts
      logger.ts
    types/
      express.d.ts
  tests/
    unit/
    integration/
    e2e/
    helpers/
```

There is no `email/` folder and no `email.service.ts`. Notification delivery is an in-app
database write only.

## 4. Layering and request flow

`app.ts` builds the Express application and is used directly by tests. `server.ts` calls
`app.listen`, registers shutdown handlers and starts the scheduler when `JOBS_ENABLED` is
true. This keeps the HTTP surface testable without opening a port in unit tests.

Middleware order:

1. Request ID and structured request logging.
2. Security headers.
3. CORS with an explicit origin and credentials.
4. JSON body parser with a small limit (multipart is handled only by the upload route).
5. Cookie parsing and authentication (required or optional depending on the route).
6. Role guard.
7. Organisation-verification guard when the contract requires it.
8. Route handler.
9. Not-found handler.
10. Central error handler.

Layer rules:

- **Routes** declare paths and attach middleware and controllers. A route file for a
  future slice is not mounted until that slice starts.
- **Controllers** translate HTTP: read validated input, call one service, choose the status
  code, send a presenter-built response. No Prisma calls.
- **Validators** accept `unknown`, return a narrow typed value or a list of field errors.
  They do not query the database.
- **Services** own business rules, transactions, ownership checks and state transitions.
  They accept an injectable `now` where time matters.
- **Presenters** build the exact contract projection. A public presenter cannot receive
  private fields in the first place; it selects only the public fields.
- **Jobs** call services or dedicated job functions; they do not contain HTTP logic.

## 5. API contract conformance and endpoint ownership

The backend implements exactly 25 operations. Slice 6 adds none.

| Slice | Phase | Method and path | Roles | Verified org required |
| --- | --- | --- | --- | --- |
| 1 | 11 | `GET /health` | public | no |
| 1 | 13 | `POST /auth/register` | public | no |
| 1 | 13 | `POST /auth/login` | public | no |
| 1 | 13 | `POST /auth/logout` | donor, ngo, admin | no |
| 1 | 13 | `GET /auth/me` | donor, ngo, admin | no |
| 2 | 16 | `GET /donations` | public, donor, ngo, admin | no |
| 2 | 16 | `POST /donations` | donor | yes |
| 2 | 16 | `GET /donations/{donationId}` | public, donor, ngo, admin | no |
| 2 | 16 | `PATCH /donations/{donationId}` | donor | yes |
| 2 | 16 | `POST /donations/{donationId}/cancel` | donor, admin | yes (admin exempt) |
| 3 | 17 | `POST /donations/{donationId}/claims` | ngo | yes |
| 3 | 17 | `PATCH /donations/{donationId}/status` | donor, ngo | yes |
| 3 | 17 | `GET /claims/me` | ngo | yes |
| 4 | 14 | `GET /organisations/me` | donor, ngo | no |
| 4 | 14 | `PATCH /organisations/me` | donor, ngo | no |
| 4 | 14 | `POST /organisations/me/documents` | donor, ngo | no |
| 4 | 14 | `GET /organisations/me/documents/{documentId}/download` | donor, ngo | no |
| 4 | 14 | `POST /organisations/me/verification` | donor, ngo | no |
| 4 | 15 | `GET /admin/organisations` | admin | no |
| 4 | 15 | `GET /admin/organisations/{organisationId}` | admin | no |
| 4 | 15 | `GET /admin/organisations/{organisationId}/documents/{documentId}/download` | admin | no |
| 4 | 15 | `POST /admin/organisations/{organisationId}/verification` | admin | no |
| 5 | 18 | `GET /notifications` | donor, ngo, admin | no |
| 5 | 18 | `POST /notifications/{notificationId}/read` | donor, ngo, admin | no |
| 5 | 18 | `POST /notifications/read-all` | donor, ngo, admin | no |

Contract rules that shape the implementation:

- `x-required-roles` is copied into a route policy table. `public` means anonymous access
  is allowed; authenticated roles receive the extended projection where documented.
- `x-requires-verified-organisation` applies only to donor and NGO callers. Admins are
  exempt.
- Protected operations require the session cookie. Public operations that allow an optional
  session treat a missing, invalid or expired cookie as anonymous; `mine=true` still
  requires a valid donor session.
- Slice 6 must not add a path or operation. Missing functionality needs an owner-approved
  contract change, not an undocumented endpoint.
- The backend does not generate code from the OpenAPI file. Validators, presenters and the
  route policy are hand-written and tested against the contract's behaviour. This avoids an
  unapproved code-generation dependency and keeps the privacy projections explicit.

## 6. Prisma schema outline

### 6.1 Conventions

- PostgreSQL 15+; database and table names in `snake_case`.
- Primary keys are UUIDs with database default `gen_random_uuid()`; no sequential ids are
  exposed.
- All timestamps are `timestamptz`, stored and compared in UTC. HTTP responses use ISO-8601
  strings.
- Enums are PostgreSQL enums generated by Prisma. Application code imports generated types,
  not string literals.
- No hard deletes for users, organisations, donations, claims, documents or history.
  Sessions and auth tokens may be cleaned up. Core foreign keys use `ON DELETE RESTRICT`;
  notifications' optional donation/claim links use `ON DELETE SET NULL`.
- Reviewed documents are immutable. A replacement is a new row; the old row stays with
  `is_current = false`.
- Prisma cannot express partial unique indexes or `CHECK` constraints. They are added in a
  hand-written SQL migration and must stay in the migration history.

### 6.2 Enums

| Prisma enum | Database enum | Values |
| --- | --- | --- |
| `UserRole` | `user_role` | `donor`, `ngo`, `admin` |
| `OrgType` | `org_type` | `donor`, `ngo` |
| `OrgVerificationStatus` | `org_verification_status` | `pending`, `verified`, `rejected` |
| `DocumentType` | `document_type` | `business_registration`, `food_safety_licence`, `ngo_registration`, `institution_authorisation`, `other` |
| `DocumentStatus` | `document_status` | `pending`, `approved`, `rejected` |
| `QuantityUnit` | `quantity_unit` | `kg`, `portions`, `meals`, `packets` |
| `DonationStatus` | `donation_status` | `available`, `claimed`, `picked_up`, `completed`, `expired`, `cancelled` |
| `ClaimStatus` | `claim_status` | `active`, `cancelled`, `completed` |
| `NotificationType` | `notification_type` | `organisation_verified`, `organisation_rejected`, `donation_claimed`, `claim_released`, `donation_cancelled`, `pickup_confirmed`, `donation_completed`, `donation_expired` |
| `AuthTokenType` | `auth_token_type` | `email_verification`, `password_reset` |

`AuthTokenType` and the `auth_tokens` table are retained because the database design
includes them. No MVP operation creates or uses those tokens after the 2026-11-18 decision
that removed email verification and password reset.

### 6.3 Models

#### `User` → `users`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK, `gen_random_uuid()` |
| `organisationId` | UUID nullable, unique | one login per organisation; null only for admins |
| `role` | `UserRole` | donor, ngo, admin |
| `email` | varchar(254), unique | stored lowercase |
| `passwordHash` | text | scrypt hash, never returned |
| `emailVerifiedAt` | timestamptz nullable | stamped at registration; no verification email exists |
| `isActive` | boolean | default true |
| `lastLoginAt` | timestamptz nullable | updated on successful login |
| `createdAt`, `updatedAt` | timestamptz | database defaults / app-maintained |

Relations: optional organisation membership, organisations verified by this admin,
uploaded and reviewed documents, claims created, claims and donations cancelled, status
history changes, notifications, sessions and auth tokens. The two organisation-to-user FK
paths use explicit relation names (`OrganisationMembers` and `OrganisationVerifiedBy`).

Database checks: admins have `organisation_id IS NULL`; donors and NGOs have a non-null
organisation. The service layer also enforces `users.role` matching `organisations.type`.

#### `Organisation` → `organisations`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `type` | `OrgType` | donor or ngo |
| `name` | varchar(160) | display name |
| `registrationNumber` | varchar(80) nullable | official registration, if any |
| `contactName` | varchar(120) | |
| `contactPhone` | varchar(32) | normalised by the application |
| `contactEmail` | varchar(254) | lowercase |
| `addressLine1` | varchar(200) | |
| `addressLine2` | varchar(200) nullable | |
| `area` | varchar(120) | public masking |
| `city` | varchar(120) | public filter |
| `postcode` | varchar(16) nullable | never exposed publicly |
| `verificationStatus` | `OrgVerificationStatus` | default pending |
| `verificationSubmittedAt` | timestamptz nullable | set on submit/resubmit |
| `verifiedAt` | timestamptz nullable | |
| `verifiedByUserId` | UUID nullable FK User | admin |
| `rejectionReason` | text nullable | required when rejected |
| `createdAt`, `updatedAt` | timestamptz | |

Relations: users, verifier, documents, donations posted, claims made as NGO. Indexes:
`(verification_status, verification_submitted_at)`, `(type, city)`, and unique
`(type, registration_number)` where non-null. PostgreSQL's default null handling makes a
normal unique constraint behave as the required partial unique constraint.

Checks: verified organisations have `verified_at` and `verified_by_user_id`; rejected
organisations have `rejection_reason`; pending organisations have both verification fields
null.

#### `VerificationDocument` → `verification_documents`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `organisationId` | UUID FK Organisation | |
| `uploadedByUserId` | UUID FK User | |
| `documentType` | `DocumentType` | |
| `status` | `DocumentStatus` | default pending |
| `isCurrent` | boolean | default true |
| `storageKey` | text unique | random key, never a public URL |
| `originalFilename` | varchar(255) | sanitised for download headers |
| `mimeType` | varchar(100) | PDF, JPEG or PNG |
| `sizeBytes` | integer | > 0 |
| `reviewNote` | text nullable | required when rejected |
| `reviewedByUserId` | UUID nullable FK User | |
| `reviewedAt` | timestamptz nullable | |
| `uploadedAt` | timestamptz | |

Relations: organisation, uploader, reviewer. Indexes: `(organisation_id, uploaded_at
DESC)`, `(status, uploaded_at)`, and the raw partial unique
`(organisation_id, document_type) WHERE is_current`.

Checks: approved/rejected rows require reviewer and timestamp; rejected rows also require a
note; pending rows have no reviewer fields. Reviewed documents are immutable.

#### `Donation` → `donations`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `donorOrganisationId` | UUID FK Organisation | |
| `title` | varchar(140) | |
| `description` | text | |
| `isVegetarian` | boolean | |
| `quantity` | numeric(10,2) | > 0 |
| `unit` | `QuantityUnit` | |
| `bestBefore` | timestamptz | |
| `pickupWindowStart`, `pickupWindowEnd` | timestamptz | |
| `pickupAddressLine1` | varchar(200) | never public |
| `pickupAddressLine2` | varchar(200) nullable | never public |
| `pickupArea` | varchar(120) | public |
| `pickupCity` | varchar(120) | public |
| `pickupPostcode` | varchar(16) nullable | never public |
| `pickupInstructions` | text nullable | claimant only |
| `allergenNotes` | text nullable | public |
| `photoStorageKey` | text nullable | reserved; unused because photo upload is out of scope |
| `status` | `DonationStatus` | default available |
| `cancelledByUserId` | UUID nullable FK User | |
| `cancelReason` | text nullable | |
| `cancelledAt` | timestamptz nullable | |
| `completedAt` | timestamptz nullable | |
| `version` | integer | default 0; internal only |
| `createdAt`, `updatedAt` | timestamptz | |

Relations: donor organisation, claims, status history, notifications, cancelling user.
Indexes: `(status, created_at DESC)`, `(donor_organisation_id, created_at DESC)`, and raw
partial indexes for public browse `(pickup_city, created_at DESC) WHERE status =
'available'`, expiry `(pickup_window_end) WHERE status = 'available'`, and overdue
`(pickup_window_end) WHERE status IN ('claimed', 'picked_up')`.

Checks: `pickup_window_start < pickup_window_end`,
`pickup_window_end <= best_before`, `quantity > 0`; cancelled rows require actor, timestamp
and reason; completed rows require `completed_at`.

The `version` column is internal. The API contract exposes no version field, so the backend
does not offer client-side optimistic concurrency; edits are serialized by the service and
the last successful write wins. This is documented as a contract limitation.

#### `Claim` → `claims`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `donationId` | UUID FK Donation | |
| `ngoOrganisationId` | UUID FK Organisation | |
| `claimedByUserId` | UUID FK User | |
| `status` | `ClaimStatus` | default active |
| `claimedAt` | timestamptz | |
| `pickupConfirmedAt` | timestamptz nullable | pickup timestamp, not a separate status |
| `completedAt` | timestamptz nullable | |
| `cancelledAt` | timestamptz nullable | |
| `cancelledByUserId` | UUID nullable FK User | |
| `cancelReason` | text nullable | |
| `createdAt`, `updatedAt` | timestamptz | |

Relations: donation, NGO organisation, claiming user, cancelling user, notifications.
Indexes: raw partial unique `(donation_id) WHERE status = 'active'`;
`(ngo_organisation_id, claimed_at DESC)`, `(donation_id, claimed_at DESC)`, and
`(pickup_confirmed_at) WHERE status = 'active'`.

Checks: cancelled claims require actor, timestamp and reason; completed claims require
`completed_at` and `pickup_confirmed_at`; active claims have no cancellation or completion
fields.

#### `DonationStatusHistory` → `donation_status_history`

Fields: `id`, `donationId`, `fromStatus` nullable (null only for the creation row),
`toStatus`, `changedByUserId` nullable (null for the system job), `reason` nullable,
`createdAt`. Append-only; index `(donation_id, created_at ASC)`. Every donation transition
inserts exactly one row in the same transaction as the status change.

#### `Notification` → `notifications`

Fields: `id`, `userId`, `type`, `title` varchar(140), `body` text, `donationId` nullable,
`claimId` nullable, `readAt` nullable, `emailedAt` nullable, `createdAt`.

`emailedAt` is retained because the database design and API schema include it. It is always
null in the MVP; there is no email service or delivery path. Indexes:
`(user_id, created_at DESC)` and `(user_id) WHERE read_at IS NULL`.

#### `Session` → `sessions`

Fields: `id`, `userId`, `tokenHash` char(64) unique, `expiresAt`, `createdAt`,
`lastUsedAt` nullable, `revokedAt` nullable, `userAgent` varchar(255) nullable. Index
`(user_id, expires_at)`. The raw cookie token is never stored.

#### `AuthToken` → `auth_tokens`

Fields: `id`, `userId`, `type`, `tokenHash` char(64) unique, `expiresAt`, `usedAt`
nullable, `createdAt`. Index `(user_id, type, expires_at)`. Retained for schema
completeness; unused by the MVP.

### 6.4 Migration order

1. Prisma enums and tables, foreign keys, plain indexes and ordinary unique constraints.
2. Hand-written SQL: partial unique indexes, partial browse/expiry/overdue/unread indexes,
   and all `CHECK` constraints.
3. Seed.

The second migration is part of the Prisma migration history. A migration smoke test
asserts that the partial indexes and checks exist; they must not be dropped by later
schema changes.

### 6.5 Seed data

The seed is idempotent, uses fixed UUIDs for stable demos, and uses fake `.test` data only.
It refuses to run in production unless an explicit demo flag is set.

Seed organisations and logins:

| Email | Password | Role | Organisation | Verification |
| --- | --- | --- | --- | --- |
| `admin@food-demo.test` | `Admin1234!` | admin | — | — |
| `donor.verified@food-demo.test` | `Demo1234!` | donor | Green Leaf Kitchen | verified |
| `donor.pending@food-demo.test` | `Demo1234!` | donor | Campus Canteen | pending |
| `donor.rejected@food-demo.test` | `Demo1234!` | donor | Sunset Bistro | rejected |
| `ngo.verified@food-demo.test` | `Demo1234!` | ngo | Hope Kitchen | verified |
| `ngo.verified2@food-demo.test` | `Demo1234!` | ngo | City Harvest | verified |
| `ngo.rejected@food-demo.test` | `Demo1234!` | ngo | Open Hands | rejected |

The second verified NGO exists so the frontend and backend can demonstrate a double-claim
conflict without registering a new organisation.

Seed content:

- One admin, three donors (verified, pending, rejected) and three NGOs (two verified, one
  rejected).
- Current documents for the pending and rejected organisations, with review notes where the
  database requires them.
- Donations in `available`, `claimed`, `picked_up`, `completed`, `expired` and `cancelled`
  states, with timestamps relative to the seed run so the demo stays usable.
- Active claims for `claimed` and `picked_up`; a completed claim for `completed`; a
  historical cancelled claim and a complete status timeline for the demo.
- In-app notification rows for the seeded events, with `emailed_at` null.
- Password hashes generated with the same scrypt helper the application uses. No plaintext
  password is stored.
- `photo_storage_key` null everywhere.

## 7. Authentication and role-guard design

### 7.1 Registration

`POST /auth/register` runs in one transaction:

1. Normalise the login email and contact email to lowercase.
2. Validate the organisation type (`donor` or `ngo`), organisation fields, address, contact
   fields and password. Admin registration is not possible.
3. Hash the password with `crypto.scrypt`.
4. Create the organisation with `verification_status = pending` and its single user with the
   matching role and `email_verified_at = now()`. The timestamp is stamped because the MVP
   has no email-verification flow; it is not an access gate.
5. Create a session and set the `fd_session` cookie.
6. Return `AuthResponse` with the user and organisation summary.

Registration does not grant transaction rights. A newly registered organisation can log
in, browse public listings and (from Slice 4) manage its profile and documents, but cannot
post or claim until an admin verifies it.

### 7.2 Login, logout and session identity

- `POST /auth/login` looks up the lowercase email, verifies the scrypt hash, checks
  `is_active`, creates a new session and updates `last_login_at`.
- An unknown email still performs a dummy scrypt verification so the response time does not
  reveal whether the account exists. The response is `401 UNAUTHENTICATED`.
- `POST /auth/logout` revokes the current session and clears the cookie with the same
  attributes.
- `GET /auth/me` returns the current user, organisation summary and session expiry.
- An inactive user receives `403 ACCOUNT_INACTIVE` at login. An existing session for an
  inactive user is rejected with `401 UNAUTHENTICATED` and should be revoked.

Session details:

| Property | Value |
| --- | --- |
| Cookie name | `fd_session` |
| Token | 32 random bytes, base64url encoded |
| Storage | SHA-256 hex hash in `sessions.token_hash`; raw token only in the cookie |
| Lifetime | 7 days absolute by default; configurable |
| Revocation | `revoked_at` set on logout; lookup rejects revoked/expired sessions |
| `last_used_at` | Updated on authenticated requests, throttled to avoid a write per request |
| Cookie flags | `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` only in production |
| CORS | `Access-Control-Allow-Credentials: true` and an exact allowed origin; never `*` |
| Session fixation | New token on every login; no anonymous sessions |

### 7.3 Password and token helpers

- Password format: `scrypt$N$r$p$<salt-base64>$<hash-base64>`, using Node's `crypto.scrypt`
  with a per-password random salt and `timingSafeEqual` comparison.
- Session/token hashes use SHA-256 hex (64 characters). No JWT, no signing secret and no
  bearer token.
- Password reset is not implemented. There is no reset token, endpoint or email.

### 7.4 Middleware and guards

`authenticate`:

- Reads the `fd_session` cookie (a small hand-written parser; no cookie-parser dependency).
- Hashes the token and loads the session with the user and organisation.
- Rejects expired sessions with `401 SESSION_EXPIRED`, revoked/missing sessions with
  `401 UNAUTHENTICATED`, and inactive users with `401 UNAUTHENTICATED`.
- Attaches a typed `req.auth` containing the user, organisation and session.

`optionalAuthenticate`:

- Used on public donation endpoints. A missing or invalid cookie is treated as anonymous;
  an expired cookie is cleared. It never turns a public request into a 401.
- `mine=true` and any non-public status filter still require a valid donor session.

`requireRole(...roles)`:

- Runs after authentication. A missing session is `401`; a role not in the list is
  `403 FORBIDDEN`.
- Roles come from the route policy, not from request data.

`requireVerifiedOrganisation`:

- Runs after the role check.
- Applies only to donor and NGO callers; admin callers are exempt.
- Checks `organisation.verificationStatus === 'verified'`.
- Returns `403 ORGANISATION_NOT_VERIFIED` with a safe message explaining that the
  organisation is not verified.
- Delivered in phase 16 (Slice 2), reused by phase 17, and regression-tested in phase 15.

Guard order is fixed: authentication → role → organisation verification → resource
ownership → current state. This gives predictable errors:

- No session → `401`.
- Wrong role → `403 FORBIDDEN`.
- Correct role but unverified organisation → `403 ORGANISATION_NOT_VERIFIED`.
- Correct role and verification but not the owner/claimant → `404` for the resource (to
  avoid leaking existence).
- Correct actor but wrong lifecycle state → `409 INVALID_STATUS_TRANSITION` or a specific
  conflict code.

### 7.5 Object-level authorization

Role checks are not enough. Services enforce:

- A donor may read, edit or cancel only its own donations. Non-owner donors receive
  `404 DONATION_NOT_FOUND`.
- An NGO may see full pickup details only while it holds the active claim.
- A donor may confirm completion only for its own `picked_up` donation.
- An NGO may release or mark pickup only for its own active claim.
- An owner may download only its own organisation's documents; admins may download any.
- A user may read or mark only its own notifications; another user's notification is
  `404 NOTIFICATION_NOT_FOUND`.
- Admins may read all donations and organisations but cannot edit donation content or use
  donor/NGO lifecycle actions.

### 7.6 Route policy summary

| Group | Access |
| --- | --- |
| Health, register, login | public |
| Logout, me | any authenticated role |
| Donation list/detail | public with optional session; projections depend on caller |
| Donation create/update | donor + verified organisation |
| Donation cancel | donor + verified organisation, or admin |
| Claim create, status update, claims list | ngo/donor as specified + verified organisation |
| Own organisation profile and documents | donor or ngo; pending/rejected allowed |
| Admin organisation review | admin |
| Notifications | any authenticated role |

### 7.7 Rate limiting, CSRF and abuse controls

- In-memory sliding-window rate limits, no external store: login/register by IP and email,
  claim by user, upload by user, and a broad per-IP limit.
- `429 RATE_LIMITED` with `Retry-After`. Limiter state is resettable in tests.
- CSRF defence: `SameSite=Lax` plus an Origin allowlist on state-changing requests in
  production. The contract has no CSRF-token endpoint, so no token flow is invented.
- Login errors are generic. Duplicate registration email is `409 DUPLICATE_EMAIL` because
  the contract requires it; rate limiting reduces enumeration abuse.
- Single-instance rate limits are an accepted MVP limitation.

## 8. File upload and storage design

Only verification documents are uploaded. Donation photo upload is out of scope, so
`photo_storage_key` stays null and `photoUrl` is always null.

### 8.1 Storage service interface

| Method | Purpose |
| --- | --- |
| `put(key, data, contentType)` | Store bytes at a server-generated key |
| `get(key)` | Return a readable stream and metadata for an authorised download |
| `delete(key)` | Best-effort removal, used for compensation and orphan cleanup |
| `exists(key)` | Check presence without reading the whole object |

The interface is storage-agnostic. Services depend on the interface, never on a concrete
adapter.

### 8.2 Local disk adapter (development)

- Root: `backend/var/uploads`, outside the web root and gitignored.
- Directories created with restrictive permissions; files written with `0600` where the
  platform supports it.
- Keys are server-generated, never user paths. The adapter resolves the final path and
  verifies it stays inside the root (path-traversal guard).
- Writes go to a temporary file and are renamed atomically.

### 8.3 S3-compatible adapter (production)

- Private bucket; no public ACL, no public bucket policy, no directory listing.
- Server-side encryption enabled.
- Credentials from environment/instance role; never committed or logged.
- The API streams uploads and downloads; no presigned URL is exposed in the MVP.
- The concrete S3 client package is the remaining dependency approval for phase 19.

### 8.4 Upload pipeline

1. Authenticate; require donor or NGO role.
2. Load the caller's organisation and reject if `verificationStatus = verified`
   (`409 INVALID_STATUS_TRANSITION`, because document renewal after approval is out of
   scope). Pending and rejected organisations may upload.
3. Parse `multipart/form-data` with `multer` memory storage, limited to 10 MB.
4. Validate the declared document type against the enum.
5. Sniff the file content:
   - PDF: starts with `%PDF-`.
   - JPEG: starts with `FF D8 FF`.
   - PNG: starts with the 8-byte PNG signature.
   The extension and client-provided MIME type are not trusted.
6. Generate a random storage key, for example
   `organisations/{organisationId}/documents/{uuid}`. The original filename is stored only
   as metadata and sanitised for download headers.
7. Write the object through the storage service.
8. In a database transaction: mark the previous current document of the same type
   `is_current = false`, insert the new current row with status `pending`.
9. If the database step fails, delete the just-written object best-effort. If storage fails,
   no row is created and the previous current document remains unchanged.

There is no distributed transaction between storage and PostgreSQL; the compensation step
is documented explicitly. An orphan sweep can be added in phase 19.

### 8.5 Validation limits

| Rule | Result |
| --- | --- |
| Missing file or document type | `422 VALIDATION_FAILED` |
| File over 10 MB | `413 FILE_TOO_LARGE` |
| Content not PDF/JPEG/PNG | `415 UNSUPPORTED_FILE_TYPE` |
| Verified organisation uploads | `409 INVALID_STATUS_TRANSITION` |
| Wrong role | `403 FORBIDDEN` |
| Unknown document id | `404 DOCUMENT_NOT_FOUND` |

### 8.6 Download

- Owner or admin only.
- Load metadata from the database, then stream from storage.
- Set the stored MIME type, `Content-Disposition: attachment` with a sanitised filename,
  `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.
- Never expose `storage_key`; never serve files from a static directory.
- A missing object returns `404 DOCUMENT_NOT_FOUND` and logs the inconsistency.

### 8.7 Required document types

The MVP requires exact document types. `other` is an additional document only; it never
substitutes for a required type.

| Organisation type | Required current documents |
| --- | --- |
| Donor | `food_safety_licence` and (`business_registration` or `institution_authorisation`) |
| NGO | `food_safety_licence` and `ngo_registration` |

Final admin approval requires every required type to have a current `approved` document.
A rejected or missing required type blocks approval. An `other` document may be uploaded
and reviewed for context, but it does not satisfy a missing requirement.

### 8.8 No photo upload

The 2026-11-18 decision removed donation photo upload from the MVP. There is no photo
endpoint, no public photo serving and no image storage path. The `photoUrl` response field
is always null; the `photo_storage_key` column is reserved for a future change.

## 9. Error handling approach

### 9.1 Shared envelope

Every non-2xx response uses the contract envelope:

```json
{
  "error": {
    "code": "DONATION_ALREADY_CLAIMED",
    "message": "This donation has already been claimed.",
    "requestId": "6c1f7a1e-5b41-4a9b-b06c-5f7e5e1f6a2d",
    "details": [
      { "field": "pickupWindow.end", "message": "Must be later than the start time." }
    ]
  }
}
```

Rules:

- `code` is stable upper-snake-case. Clients branch on it.
- `message` is safe to display; it contains no stack trace, SQL, token, password or PII.
- `requestId` is always present and matches the request log entry.
- `details` is optional and used mainly for field validation.
- 5xx responses keep a generic message; diagnostics stay in server logs.

### 9.2 Mapping

| Situation | Status | Code |
| --- | --- | --- |
| Malformed JSON, invalid UUID, unknown query value | 400 | `BAD_REQUEST` |
| Missing/invalid session | 401 | `UNAUTHENTICATED` |
| Expired session | 401 | `SESSION_EXPIRED` |
| Wrong role | 403 | `FORBIDDEN` |
| Correct role, unverified organisation | 403 | `ORGANISATION_NOT_VERIFIED` |
| Inactive account at login | 403 | `ACCOUNT_INACTIVE` |
| Unknown route or invisible resource | 404 | `NOT_FOUND` or resource-specific code |
| Unknown/invisible donation | 404 | `DONATION_NOT_FOUND` |
| Unknown/invisible document | 404 | `DOCUMENT_NOT_FOUND` |
| Unknown/not-owned notification | 404 | `NOTIFICATION_NOT_FOUND` |
| Duplicate login email | 409 | `DUPLICATE_EMAIL` |
| Duplicate organisation registration number | 409 | `DUPLICATE_REGISTRATION_NUMBER` |
| Donation already claimed | 409 | `DONATION_ALREADY_CLAIMED` |
| Claim at/after pickup-window end | 409 | `DONATION_EXPIRED` |
| Disallowed lifecycle action | 409 | `INVALID_STATUS_TRANSITION` |
| Pickup before window start | 409 | `PICKUP_WINDOW_NOT_STARTED` |
| Document already reviewed | 409 | `DOCUMENT_ALREADY_REVIEWED` |
| Required documents missing at approval | 422 | `REQUIRED_DOCUMENTS_MISSING` |
| Body validation failed | 422 | `VALIDATION_FAILED` |
| File over limit | 413 | `FILE_TOO_LARGE` |
| Unsupported file content | 415 | `UNSUPPORTED_FILE_TYPE` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| Unexpected failure | 500 | `INTERNAL_ERROR` |

Prisma errors are mapped explicitly:

- Unique violation: context-specific 409. A second active claim maps to
  `DONATION_ALREADY_CLAIMED`; a duplicate email maps to `DUPLICATE_EMAIL`.
- Record not found: 404.
- Foreign-key violation: 409 or 422 depending on the operation.
- Write conflict/deadlock: one retry where safe, otherwise 409 with a stable code; never a
  raw Prisma message.

### 9.3 Validation

- Body fields: collect all invalid fields and return `422 VALIDATION_FAILED` with one
  `details` item per field, using JSON paths such as `pickupWindow.end`.
- Malformed JSON, unknown query values and invalid UUIDs: `400 BAD_REQUEST`.
- Enum values, booleans, dates, pagination bounds and string lengths are validated before
  reaching services.
- Unknown body fields are ignored rather than mass-assigned. Services select allowed fields
  explicitly.
- Query filters are applied server-side; illegal role/status combinations return 403, not a
  silently widened result.

### 9.4 Request IDs and logging

- Request-ID middleware generates a UUID, sets `X-Request-Id`, and attaches it to the
  request and error envelope.
- Structured JSON logs contain timestamp, level, request ID, method, path, status, duration
  and optional user ID/role.
- Never log cookies, tokens, passwords, request bodies, street addresses, postcodes,
  contact details or document contents.
- The central error handler logs operational errors with stack traces server-side only.
- A 404 handler produces the same envelope so clients never receive Express HTML.

## 10. Lifecycle automation and jobs

### 10.1 Expiry job

Every five minutes:

1. Take a PostgreSQL advisory lock so only one instance runs the batch.
2. Select `available` donations with `pickup_window_end <= now()` in batches, using
   `FOR UPDATE SKIP LOCKED`.
3. In a transaction per batch: set each donation to `expired`, append exactly one status
   history row with `changed_by_user_id = null`, and insert the donor's in-app
   `donation_expired` notification.
4. Commit and release the lock. Re-running finds nothing to change.

A `claimed` donation is never auto-expired; it becomes visibly overdue and must be resolved
by pickup, donor/admin cancellation or completion.

### 10.2 Auto-completion job

Every five minutes:

1. Take an advisory lock.
2. Select `picked_up` donations whose active claim has `pickup_confirmed_at <= now() - 48
   hours`.
3. In a transaction: set the claim to `completed` with `completed_at`, set the donation to
   `completed` with `completed_at`, append one history row, and insert in-app
   `donation_completed` notifications for the donor and the NGO.
4. Commit. The job is idempotent; a second run finds no eligible rows.

### 10.3 Cleanup job

Daily, best-effort:

- Delete expired or revoked sessions older than 30 days.
- Delete used or expired auth-token rows older than the retention window, even though the
  MVP auth flows do not create them.
- Notification retention is not shortened in the MVP; old notifications remain readable.

### 10.4 Scheduler

- In-process `setInterval` scheduler started by `server.ts` when `JOBS_ENABLED=true`.
- Jobs accept an injectable `now`, so tests do not wait for wall-clock time.
- Single-instance assumption; advisory locks protect against accidental overlap. A
  multi-instance deployment would need an external scheduler or leader election, documented
  as a limitation.
- No email job, no outbox, no retry queue and no real-time transport.

### 10.5 Overdue

`overdue` is derived, not stored: `status IN ('claimed', 'picked_up')` and
`pickupWindowEnd < now`. The API exposes status and pickup window; the frontend computes the
warning. No automatic status change occurs.

## 11. Testing approach

### 11.1 Tools and environment

- `node:test` and `node:assert`; no Jest/Vitest.
- Native `fetch` against an app bound to an ephemeral port for HTTP integration tests.
- Prisma against a dedicated PostgreSQL test database.
- `node:test` coverage is not enforced as a percentage; risk-based coverage is the goal.
- Test data factories create organisations, users, sessions, donations, claims, documents
  and notifications with sensible defaults. No faker dependency.
- Integration tests run serially against one test database. The database is reset between
  suites; unit tests may run in parallel.
- Local storage tests use a temporary directory. No S3 credentials are needed in tests.
- The clock is injected into services/jobs that compare time, so tests can set fixed
  timestamps without mock-timer libraries.

### 11.2 Test layers

| Layer | What it covers |
| --- | --- |
| Unit | Lifecycle transition rules, validators, projection masking, password/token helpers, MIME sniffing, pagination, document-requirement checks |
| Integration | Every endpoint, role/verification matrix, ownership, error envelope, database constraints, transactions, uploads/downloads |
| Concurrency | Atomic claim, same-NGO idempotency, active-claim unique index |
| Privacy | Public responses never contain address/postcode/instructions/contact fields; claimant access ends after a claim ends |
| Job | Expiry, auto-completion, idempotency, advisory-lock behaviour, notification rows |
| Contract | Response shapes, status codes, no extra routes, pagination envelope, error codes |
| E2E | One full happy path over HTTP in Slice 6 |

### 11.3 Critical tests

- **Double claim:** 20 simultaneous claim requests from two or more verified NGOs with
  separate sessions. Exactly one `201`, the rest `409 DONATION_ALREADY_CLAIMED`, exactly
  one active claim row, and no pickup address in the losing responses.
- **Same-NGO retry:** a retry returns the existing claim (the contract's only success status
  is 201) and creates no second claim, history row or notification.
- **Status matrix:** every allowed transition and every disallowed pair from
  `USER_FLOWS.md` is tested, including release only before window start, pickup only after
  start, late pickup allowed, and terminal states never reopening.
- **Cancellation:** donor/admin cancel requires a reason; cancelling a claimed donation
  cancels the active claim and does not relist; `picked_up` cannot be cancelled.
- **Jobs:** expiry ignores claimed donations; auto-completion waits 48 hours; both are
  idempotent and write one history row per transition.
- **Privacy:** the serialized public response string is checked for street line, postcode,
  instructions, phone and email. Claimant sees full details only while active; after release
  or completion the same detail fetch no longer includes them.
- **Permissions:** table-driven tests for every route and role, including unverified
  organisations, non-owners, admins using donor/NGO actions, and notification/document
  ownership.
- **Uploads:** PDF/JPEG/PNG accepted; extension spoof and wrong magic bytes rejected; 10 MB
  limit; replacement keeps the old row non-current; path traversal fails; downloads are
  authenticated and use attachment headers.
- **Migrations:** clean `prisma migrate reset` + seed; raw SQL attempts prove the partial
  unique indexes and checks reject invalid rows.
- **Contract:** every mounted route appears in the endpoint manifest; no future-slice route
  is mounted; error responses always include `requestId`; status codes match the contract.

### 11.4 Commands

The implementation will expose scripts equivalent to:

- `npm run dev`
- `npm run build`
- `npm start`
- `npm run typecheck`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run db:seed`
- `npm test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`

No test framework or runner dependency is added; TypeScript tests compile with the backend.

## 12. Phase table

Phase numbers are stable identifiers, not execution order. The Slice column is the build
order. Slice 6 adds no endpoints.

| Phase | Slice | Phase name | Delivers | Done when |
| --- | --- | --- | --- | --- |
| 11 | 1 | Foundation | Express app, config, request IDs, CORS, security headers, logging, health, shared error envelope | Health works; errors share the envelope; strict build passes; config fails fast |
| 12 | 1 | Database | Full Prisma schema, migrations, raw constraints/indexes, seed | Clean reset + seed works; constraints and partial indexes are proven; seeded logins exist |
| 13 | 1 | Auth and roles | Register, login, logout, me, sessions, password hashing, role guards | Session flow, cookie flags and role matrix pass; raw tokens are absent from the database |
| 16 | 2 | Donations | Donation browse/detail/create/update/cancel plus the phase-15 verified-organisation guard | Public masking, owner/admin projections, validation, filters and guard all pass |
| 17 | 3 | Claims and lifecycle | Atomic claim, release, pickup, completion, cancel-claimed, history, expiry/auto-complete jobs, in-app notification writes | Concurrency has one winner; lifecycle matrix passes; jobs are idempotent |
| 14 | 4 | Organisation profile and documents | Own profile, document upload/download, storage interface + local adapter, verification submission | Upload validation, current-document replacement and submission rules pass |
| 15 | 4 | Admin verification | Admin organisation list/detail, document review, final decision, in-app notification writes | Only pending organisations can be decided; exact required documents and reasons are enforced |
| 18 | 5 | Notifications | In-app inbox, unread filter, unread count, mark one/all | Ownership, idempotency and event-generated rows pass |
| 19 | 6 | Hardening and tests | Full test suite, security checks, contract conformance, deployment checklist, docs | E2E, privacy, permission, upload and concurrency suites pass; 25 operations only |

## 13. Acceptance criteria by phase

### Phase 11 — Foundation (Slice 1)

- [ ] `npm run build` / `npm run typecheck` passes with strict TypeScript and no `any` or
      `@ts-ignore`.
- [ ] The server starts from a valid environment; a missing required variable exits with a
      clear message and does not print secrets.
- [ ] `GET /api/v1/health` returns `200` with `status`, `version` and an ISO timestamp. With
      the database unavailable it returns `status: "degraded"` rather than an HTML error.
- [ ] An unknown route returns the shared error envelope with `404 NOT_FOUND`, a UUID
      `requestId` and no stack trace.
- [ ] Malformed JSON returns `400 BAD_REQUEST` in the same envelope.
- [ ] The `X-Request-Id` response header matches the `requestId` in an error response.
- [ ] CORS preflight from `CORS_ORIGIN` succeeds with credentials; a different origin gets
      no allow-origin header.
- [ ] Security headers are present (`nosniff`, frame denial, referrer policy, no-store on
      auth/private responses).
- [ ] Structured logs include request ID, method, path, status and duration, and contain no
      cookies, tokens, bodies or PII.
- [ ] Only the Slice 1 route file is mounted. No donation, claim, organisation, admin or
      notification route exists yet.

### Phase 12 — Database (Slice 1)

- [ ] `prisma validate` passes and the schema contains all nine models and all enums from
      the database design.
- [ ] `prisma migrate reset` followed by `prisma db seed` succeeds from a clean database.
- [ ] All tables, foreign keys, plain indexes and ordinary unique constraints exist.
- [ ] The hand-written migration adds the partial unique indexes for one active claim per
      donation and one current document per organisation/type.
- [ ] The browse, expiry, overdue and unread partial indexes exist and are visible in
      `pg_indexes`.
- [ ] Raw SQL attempts prove these constraints reject invalid rows:
      - a second active claim for the same donation;
      - a second current document of the same type;
      - duplicate login email;
      - a second user for the same organisation;
      - an admin with an organisation, or a donor/NGO without one;
      - `pickup_window_start >= pickup_window_end`;
      - `pickup_window_end > best_before`;
      - quantity `<= 0`;
      - a cancelled donation without actor/timestamp/reason;
      - a completed donation without `completed_at`;
      - a cancelled claim without actor/timestamp/reason;
      - a completed claim without pickup/completion timestamps;
      - a reviewed document without reviewer/timestamp, or a rejected document without a
        note;
      - a verified organisation without verification fields, or a rejected organisation
        without a reason.
- [ ] Seed contains the admin, verified/pending/rejected donors, two verified NGOs and a
      rejected NGO, with the logins in §6.5.
- [ ] Seed contains donations in all six statuses, an active claim where required, a
      completed claim, a historical cancelled claim and status history rows.
- [ ] Seed contains in-app notifications with `emailed_at` null; `photo_storage_key` is null
      everywhere.
- [ ] Every seeded password hash verifies with the application's scrypt helper; no plaintext
      password is stored.
- [ ] Re-running the seed does not duplicate rows or violate a unique constraint.

### Phase 13 — Auth and roles (Slice 1)

- [ ] `POST /auth/register` creates a pending organisation, one matching user and a session;
      it returns `201 AuthResponse` and sets `fd_session`.
- [ ] Registering an admin role is impossible; `organisationType` can only be `donor` or
      `ngo`.
- [ ] Duplicate email returns `409 DUPLICATE_EMAIL`; duplicate registration number returns
      `409 DUPLICATE_REGISTRATION_NUMBER`.
- [ ] Invalid registration fields return `422 VALIDATION_FAILED` with one detail per field.
- [ ] A password shorter than 8 characters is rejected; a valid password is stored only as a
      scrypt hash.
- [ ] `email_verified_at` is stamped at registration and `User.emailVerified` is true; no
      verification email or endpoint exists.
- [ ] `POST /auth/login` returns `200` and a new session for valid credentials; wrong
      credentials return `401 UNAUTHENTICATED`; an inactive user returns
      `403 ACCOUNT_INACTIVE`.
- [ ] `GET /auth/me` returns the user, organisation summary and session expiry; without a
      session it returns `401`.
- [ ] `POST /auth/logout` returns `204`, revokes the session and clears the cookie with the
      same attributes.
- [ ] A revoked, expired or malformed session returns `401` on protected routes; an expired
      session uses `SESSION_EXPIRED`.
- [ ] Cookie flags are correct: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` only in
      production.
- [ ] The raw session token is never stored; `sessions.token_hash` is a 64-character hash.
- [ ] `requireRole` returns `403 FORBIDDEN` for an authenticated wrong role and `401` for a
      missing session.
- [ ] Auth rate limits return `429 RATE_LIMITED` with `Retry-After`.
- [ ] Removed auth paths (`verify-email`, `resend-verification`, `forgot-password`,
      `reset-password`) return `404`; they are not stubbed.
- [ ] CORS with credentials works from the frontend origin; a wildcard origin is never
      returned.

### Phase 16 — Donations (Slice 2)

- [ ] A verified donor creates a donation with valid fields; it is stored as `available`
      with a status-history creation row and returned as `201 DonationDetail`.
- [ ] Creating with quantity `<= 0`, start `>=` end, end after best-before, or best-before
      in the past returns `422 VALIDATION_FAILED`.
- [ ] An unverified donor receives `403 ORGANISATION_NOT_VERIFIED` on create, update and
      cancel.
- [ ] An NGO or admin calling a donor-only donation write receives `403 FORBIDDEN`.
- [ ] Public `GET /donations` returns only `available` donations whose pickup window has not
      ended, sorted by `ending_soon` by default; `newest` works.
- [ ] Filters `city`, `area` and `isVegetarian` work; pagination defaults to page 1 and 20
      items, caps at 50, and returns the shared pagination envelope.
- [ ] Invalid query values, unknown sort values and invalid UUIDs return `400 BAD_REQUEST`.
- [ ] Public list items and public detail contain no street line, postcode, instructions,
      donor contact details or claim details. `pickup` and `donorContact` are null.
- [ ] The donor owner sees its own donations in all statuses with full pickup details.
- [ ] An admin sees all statuses with full details.
- [ ] `mine=true` is allowed only for an authenticated donor; anonymous returns `401`,
      NGO/admin returns `403`.
- [ ] A status filter other than `available` requires donor `mine=true` or admin; others get
      `403 FORBIDDEN`.
- [ ] Editing an `available` donation updates allowed fields and increments `version`.
- [ ] Editing a `claimed` donation rejects content changes with
      `409 INVALID_STATUS_TRANSITION`; only a later pickup end is accepted, not beyond
      best-before, and the start must not change.
- [ ] Cancelling an `available` donation by its owner or an admin requires a reason; it
      becomes `cancelled`, writes history and disappears from public listings.
- [ ] Cancelling without a reason returns `422`; cancelling twice or cancelling a terminal
      donation returns `409`.
- [ ] A non-owner donor receives `404 DONATION_NOT_FOUND`, not another organisation's data.
- [ ] Public detail of a claimed, picked-up, completed, expired or cancelled donation
      returns `404`; the frontend renders its unavailable state.
- [ ] `photoUrl` is null and no photo endpoint exists.
- [ ] No claim routes are mounted yet; `activeClaim` is null in every response.
- [ ] `requireVerifiedOrganisation` is delivered and tested in this phase; phase 15 only
      regression-tests it.

### Phase 17 — Claims and lifecycle (Slice 3)

- [ ] A verified NGO claims an available donation with an unexpired window and receives
      `201 Claim` with full `pickup` and `donorContact`; the donation becomes `claimed`.
- [ ] The claim transaction writes one active claim, one status-history row and one donor
      `donation_claimed` notification.
- [ ] A different NGO receives `409 DONATION_ALREADY_CLAIMED` with no address data.
- [ ] A claim at or after `pickupWindow.end` returns `409 DONATION_EXPIRED`.
- [ ] An unverified NGO gets `403 ORGANISATION_NOT_VERIFIED`; donor/admin callers get
      `403 FORBIDDEN`.
- [ ] A same-NGO retry returns the existing claim with `201` and creates no second claim,
      history row or notification.
- [ ] A 20-request concurrency test produces exactly one `201`, the rest `409`, and exactly
      one active claim row.
- [ ] The partial unique index independently rejects a manually inserted second active
      claim.
- [ ] `release_claim` requires a reason, is allowed only before pickup-window start, cancels
      the claim, returns the donation to `available`, writes history and notifies the donor.
- [ ] Release at/after start returns `409`; a non-claimant receives `403`/`404` without
      leaking details.
- [ ] After release, the NGO's subsequent donation detail no longer includes `pickup` or
      `donorContact`.
- [ ] `mark_picked_up` before window start returns `409 PICKUP_WINDOW_NOT_STARTED`; at/after
      start it sets `pickup_confirmed_at`, moves the donation to `picked_up`, writes history
      and notifies the donor.
- [ ] Late pickup after window end is allowed.
- [ ] `confirm_completed` by the donor works only for `picked_up`; it sets the claim to
      `completed`, the donation to `completed`, writes history and notifies both parties.
- [ ] A non-owner donor cannot confirm completion; a repeat or wrong-state confirmation
      returns `409`.
- [ ] A donor cancelling a claimed donation requires a reason, cancels the active claim and
      the donation, does not relist it, and notifies the NGO.
- [ ] An admin force-cancel of an available or claimed donation works with a reason and
      notifies the donor and, where present, the claimant NGO.
- [ ] A `picked_up` donation cannot be cancelled by anyone; it completes or auto-completes.
- [ ] `GET /claims/me` returns only the requesting NGO's claims, paginated; `status` filters
      work; `pickup`/`donorContact` are present only while active.
- [ ] Every donation transition writes exactly one history row; terminal statuses never
      transition again.
- [ ] The expiry job moves only past-end `available` donations to `expired`, writes history
      and a donor notification; it never touches `claimed`.
- [ ] The auto-completion job completes `picked_up` donations 48 hours after pickup
      confirmation, writes history and notifications, and is idempotent.
- [ ] Re-running either job produces no duplicate rows or notifications.
- [ ] No email delivery, outbox or email adapter is involved.

### Phase 14 — Organisation profile and documents (Slice 4)

- [ ] `GET /organisations/me` returns the caller's full profile and current/historical
      documents; admin callers get `403`; anonymous gets `401`.
- [ ] `PATCH /organisations/me` updates only allowed profile fields; type and verification
      status cannot be changed by the owner; validation errors return `422`.
- [ ] A pending or rejected organisation can upload a PDF, JPEG or PNG up to 10 MB; the
      response is `201 DocumentMetadata` with no storage key.
- [ ] A verified organisation cannot upload; it receives `409 INVALID_STATUS_TRANSITION`.
- [ ] A file whose content does not match PDF/JPEG/PNG is rejected with
      `415 UNSUPPORTED_FILE_TYPE`, even if the extension is correct.
- [ ] A file over 10 MB returns `413 FILE_TOO_LARGE`; a missing file/type returns `422`.
- [ ] Uploading a new current document of the same type marks the previous row
      `is_current = false` and inserts a new current row; the old row is retained.
- [ ] The object is stored at a random key; the local directory is outside the web root and
      not publicly served.
- [ ] Download by the owner returns the bytes with the stored MIME type,
      `Content-Disposition: attachment`, `nosniff` and `no-store`.
- [ ] Another organisation's document returns `404 DOCUMENT_NOT_FOUND`; admin download
      works for any organisation; anonymous returns `401`.
- [ ] `POST /organisations/me/verification` requires every exact required document type for
      the organisation type, sets status `pending`, records `verification_submitted_at` and
      clears previous rejection fields.
- [ ] A rejected organisation can replace failed documents and resubmit; old documents stay
      non-current and retained.
- [ ] A verified organisation cannot resubmit; it receives `409`.
- [ ] `other` documents are additional only and never satisfy a required type.
- [ ] Storage failure creates no row; a database failure triggers best-effort object
      deletion.
- [ ] No donation-photo endpoint or public photo path exists.

### Phase 15 — Admin verification (Slice 4)

- [ ] `GET /admin/organisations` is admin-only, paginated, and filters by
      `verificationStatus`, `type` and `city`.
- [ ] `GET /admin/organisations/{id}` returns the full profile, documents and verification
      state; unknown id returns `404`.
- [ ] Non-admin callers receive `403 FORBIDDEN`; anonymous receives `401`.
- [ ] Only a `pending` organisation can be decided; a verified or rejected organisation
      returns `409 INVALID_STATUS_TRANSITION`.
- [ ] Document review accepts `approved` or `rejected`; rejection requires a note;
      reviewing a document from another organisation returns `404`; re-reviewing a reviewed
      document returns `409 DOCUMENT_ALREADY_REVIEWED`.
- [ ] The admin's review and final decision set reviewer/timestamp and are committed
      atomically.
- [ ] Final approval requires every exact required document type to be current and
      approved; missing/rejected required types return
      `422 REQUIRED_DOCUMENTS_MISSING`.
- [ ] An approved `other` document does not satisfy a missing required type.
- [ ] Final rejection requires a reason; the organisation becomes `rejected`, the reason is
      stored and visible to the owner, and verified fields are null.
- [ ] Final approval sets `verified_at` and `verified_by_user_id` and clears the rejection
      reason.
- [ ] The decision writes an in-app `organisation_verified` or `organisation_rejected`
      notification for the organisation's user.
- [ ] The owner sees the rejection reason and document review notes via
      `GET /organisations/me`.
- [ ] A rejected organisation can resubmit to `pending` and be reviewed again.
- [ ] The phase-16 `requireVerifiedOrganisation` guard still allows verified organisations
      and blocks pending/rejected ones (regression test).

### Phase 18 — Notifications (Slice 5)

- [ ] `GET /notifications` returns only the current user's notifications, newest first,
      paginated, with `unreadCount` for the whole inbox.
- [ ] `unreadOnly=true` filters correctly; invalid pagination returns `400`.
- [ ] `POST /notifications/{id}/read` marks only the owner's notification and is idempotent;
      another user's id returns `404 NOTIFICATION_NOT_FOUND`.
- [ ] `POST /notifications/read-all` marks all unread notifications for the caller and
      returns the updated count.
- [ ] Anonymous callers receive `401`; admins see only their own notifications.
- [ ] All eight notification types are generated by the event slices:
      `organisation_verified`, `organisation_rejected`, `donation_claimed`,
      `claim_released`, `donation_cancelled`, `pickup_confirmed`, `donation_completed`,
      `donation_expired`.
- [ ] Notification rows are written in the same transaction as the business event.
- [ ] Seed data gives the verified donor, verified NGOs and admin a usable inbox.
- [ ] The inbox is read-only apart from the two mark-read operations.

### Phase 19 — Hardening and tests (Slice 6)

- [ ] The full unit, integration, concurrency, privacy, job and contract suites pass.
- [ ] The backend E2E happy path passes: register donor → admin verifies → donor posts →
      register NGO → admin verifies → NGO claims → pickup → donor completes.
- [ ] All permission and IDOR cases from §7.5 pass.
- [ ] Public responses never contain private address/contact fields; claimant details
      disappear after the claim ends.
- [ ] Every 4xx/5xx response uses the envelope, includes a request ID, and contains no stack
      trace, SQL, token or PII.
- [ ] Auth, claim and upload rate limits return `429` with `Retry-After`.
- [ ] Cookie flags, CORS, Origin checks and security headers are verified in production
      configuration.
- [ ] Upload security is verified: size, magic bytes, path traversal, unauthorised
      download, response headers.
- [ ] Logs contain request IDs and no PII; 5xx diagnostics stay server-side.
- [ ] A clean-database migration + seed run succeeds; a seed re-run is idempotent.
- [ ] The mounted endpoint manifest contains exactly the 25 contract operations and no
      Slice 6 path.
- [ ] Deployment checklist passes: HTTPS, secure cookies, CORS origin, migrations, seed
      disabled, S3 bucket private, jobs enabled once, health check, backups, admin password
      changed/removed.
- [ ] `BACKEND_PLAN.md`, `SECURITY_NOTES.md`, `PROGRESS.md` and the run instructions are
      current.
- [ ] No new endpoints, no email provider and no unapproved dependency were added.

## 14. Frontend handoff checklists

Each slice ends with a handoff note containing the endpoints that are actually mounted,
sample requests and responses, the seeded logins to use, and the limitations the frontend
must design around. A slice is not complete until its checklist is true.

Base URL: `http://localhost:4000/api/v1` in development. The frontend must send
`credentials: 'include'` on every request.

### 14.1 Slice 1 — Foundation and auth (phases 11–13)

**Endpoints ready**

- [ ] `GET /health`
- [ ] `POST /auth/register`
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`

**Sample: health**

```http
GET /api/v1/health
```

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-11-18T10:00:00.000Z"
}
```

**Sample: register**

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "organisationType": "donor",
  "organisationName": "Green Leaf Kitchen",
  "registrationNumber": "DON-1001",
  "contactName": "Maya Rao",
  "contactPhone": "+15550101",
  "contactEmail": "contact@greenleaf.test",
  "address": {
    "line1": "12 Market Street",
    "line2": null,
    "area": "Downtown",
    "city": "Springfield",
    "postcode": "10001"
  },
  "email": "donor.new@food-demo.test",
  "password": "Demo1234!"
}
```

```http
201 Created
Set-Cookie: fd_session=<opaque>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
Content-Type: application/json
```

```json
{
  "user": {
    "id": "00000000-0000-4000-8000-000000000001",
    "role": "donor",
    "email": "donor.new@food-demo.test",
    "emailVerified": true,
    "organisationId": "10000000-0000-4000-8000-000000000001",
    "isActive": true,
    "createdAt": "2026-11-18T10:00:00.000Z"
  },
  "organisation": {
    "id": "10000000-0000-4000-8000-000000000001",
    "type": "donor",
    "name": "Green Leaf Kitchen",
    "area": "Downtown",
    "city": "Springfield"
  },
  "sessionExpiresAt": "2026-11-25T10:00:00.000Z"
}
```

In production the cookie also has `Secure`. The browser stores it only when the request
uses `credentials: 'include'`.

**Sample: login and me**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "donor.verified@food-demo.test",
  "password": "Demo1234!"
}
```

```json
{
  "user": {
    "id": "00000000-0000-4000-8000-000000000002",
    "role": "donor",
    "email": "donor.verified@food-demo.test",
    "emailVerified": true,
    "organisationId": "10000000-0000-4000-8000-000000000002",
    "isActive": true,
    "createdAt": "2026-11-17T09:00:00.000Z"
  },
  "organisation": {
    "id": "10000000-0000-4000-8000-000000000002",
    "type": "donor",
    "name": "Green Leaf Kitchen",
    "area": "Downtown",
    "city": "Springfield"
  },
  "sessionExpiresAt": "2026-11-25T10:00:00.000Z"
}
```

```http
GET /api/v1/auth/me
Cookie: fd_session=<opaque>
```

Returns the same `AuthResponse` shape. `POST /auth/logout` returns `204` and clears the
cookie.

**Sample: duplicate email**

```json
{
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "An account with this email already exists.",
    "requestId": "70000000-0000-4000-8000-000000000001"
  }
}
```

**Seeded logins for this slice**

| Email | Password | Role | Organisation | Status |
| --- | --- | --- | --- | --- |
| `admin@food-demo.test` | `Admin1234!` | admin | — | — |
| `donor.verified@food-demo.test` | `Demo1234!` | donor | Green Leaf Kitchen | verified |
| `ngo.verified@food-demo.test` | `Demo1234!` | ngo | Hope Kitchen | verified |
| `donor.pending@food-demo.test` | `Demo1234!` | donor | Campus Canteen | pending |
| `ngo.rejected@food-demo.test` | `Demo1234!` | ngo | Open Hands | rejected |

**Known limitations**

- No organisation-verification endpoint yet. New registrations stay `pending`; only seeded
  verified organisations will be able to transact in later slices.
- `AuthResponse.organisation` does not include `verificationStatus` or
  `rejectionReason`. Until Slice 4, the UI cannot pre-read verification state; it must rely
  on the `403 ORGANISATION_NOT_VERIFIED` response from protected actions.
- No email verification and no password reset. Do not build “verify your email” or “forgot
  password” screens.
- Admin registration is not possible; use the seeded admin.
- Public browsing endpoints do not exist yet.
- Development cookies are not `Secure`; production cookies are.

### 14.2 Slice 2 — Donations (phase 16)

**Endpoints ready**

- [ ] `GET /donations`
- [ ] `POST /donations`
- [ ] `GET /donations/{donationId}`
- [ ] `PATCH /donations/{donationId}`
- [ ] `POST /donations/{donationId}/cancel`

The verified-organisation guard from phase 15 is active on create, update and cancel.

**Sample: public list**

```http
GET /api/v1/donations?city=Springfield&isVegetarian=true&page=1&pageSize=20
```

```json
{
  "data": [
    {
      "id": "30000000-0000-4000-8000-000000000001",
      "title": "Vegetable curry and rice",
      "description": "Freshly cooked vegetarian curry with steamed rice.",
      "isVegetarian": true,
      "quantity": 12.5,
      "unit": "kg",
      "bestBefore": "2026-11-18T20:00:00.000Z",
      "pickupWindow": {
        "start": "2026-11-18T14:00:00.000Z",
        "end": "2026-11-18T18:00:00.000Z"
      },
      "pickupArea": "Downtown",
      "pickupCity": "Springfield",
      "photoUrl": null,
      "allergenNotes": "Contains dairy.",
      "status": "available",
      "donor": {
        "id": "10000000-0000-4000-8000-000000000002",
        "type": "donor",
        "name": "Green Leaf Kitchen",
        "area": "Downtown",
        "city": "Springfield"
      },
      "createdAt": "2026-11-18T09:00:00.000Z",
      "updatedAt": "2026-11-18T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

No street address, postcode, instructions or contact details appear.

**Sample: create**

```http
POST /api/v1/donations
Cookie: fd_session=<opaque>
Content-Type: application/json

{
  "title": "Vegetable curry and rice",
  "description": "Freshly cooked vegetarian curry with steamed rice.",
  "isVegetarian": true,
  "quantity": 12.5,
  "unit": "kg",
  "bestBefore": "2026-11-18T20:00:00.000Z",
  "pickupWindow": {
    "start": "2026-11-18T14:00:00.000Z",
    "end": "2026-11-18T18:00:00.000Z"
  },
  "pickupAddress": {
    "line1": "12 Market Street",
    "line2": "Rear entrance",
    "area": "Downtown",
    "city": "Springfield",
    "postcode": "10001"
  },
  "pickupInstructions": "Ring the bell at the rear entrance.",
  "allergenNotes": "Contains dairy."
}
```

```http
201 Created
```

The response is `DonationDetail` with `status: "available"`, full `pickup` (because the
caller is the owner), `donorContact: null` and `activeClaim: null`.

**Sample: public detail**

```http
GET /api/v1/donations/30000000-0000-4000-8000-000000000001
```

The response has the same summary fields as the list item plus:

```json
{
  "pickup": null,
  "donorContact": null,
  "activeClaim": null
}
```

The owner and admin receive `pickup` with `line1`, `line2`, `postcode` and `instructions`.
An anonymous or non-claimant NGO does not.

**Sample: cancel**

```http
POST /api/v1/donations/30000000-0000-4000-8000-000000000001/cancel
Cookie: fd_session=<opaque>
Content-Type: application/json

{
  "reason": "Food is no longer available."
}
```

Returns `200 DonationDetail` with `status: "cancelled"` and the cancellation fields populated
in the owner projection.

**Seeded logins for this slice**

| Email | Password | Use |
| --- | --- | --- |
| `donor.verified@food-demo.test` | `Demo1234!` | create, edit, cancel own donations |
| `admin@food-demo.test` | `Admin1234!` | view all, force-cancel available donations |
| `donor.pending@food-demo.test` | `Demo1234!` | demonstrate `403 ORGANISATION_NOT_VERIFIED` |
| `ngo.verified@food-demo.test` | `Demo1234!` | browse; creating a donation must return `403` |

**Known limitations**

- Claims do not exist yet. `activeClaim` is always null, and claimed donations in seed data
  are not reachable through public detail.
- Public detail of a non-available donation returns `404`; render the “no longer available”
  state.
- The expiry job is not part of this slice. Public queries hide `available` donations whose
  pickup window has ended, but their stored status remains `available` until Slice 3.
- No notification inbox yet.
- No organisation profile edit, document upload or admin verification yet.
- No donation photo upload; `photoUrl` is always null.
- The donor dashboard gets summaries only; full pickup details require the detail endpoint.
- Admin filters do not include organisation or date, and there is no status-history
  endpoint.

### 14.3 Slice 3 — Claims and lifecycle (phase 17)

**Endpoints ready**

- [ ] `POST /donations/{donationId}/claims`
- [ ] `PATCH /donations/{donationId}/status`
- [ ] `GET /claims/me`

**Sample: claim**

```http
POST /api/v1/donations/30000000-0000-4000-8000-000000000001/claims
Cookie: fd_session=<ngo session>
```

No request body.

```http
201 Created
```

```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "donationId": "30000000-0000-4000-8000-000000000001",
  "status": "active",
  "claimedAt": "2026-11-18T10:15:00.000Z",
  "pickupConfirmedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "cancelReason": null,
  "ngo": {
    "id": "20000000-0000-4000-8000-000000000001",
    "type": "ngo",
    "name": "Hope Kitchen",
    "area": "Eastside",
    "city": "Springfield"
  },
  "donation": {
    "id": "30000000-0000-4000-8000-000000000001",
    "title": "Vegetable curry and rice",
    "description": "Freshly cooked vegetarian curry with steamed rice.",
    "isVegetarian": true,
    "quantity": 12.5,
    "unit": "kg",
    "bestBefore": "2026-11-18T20:00:00.000Z",
    "pickupWindow": {
      "start": "2026-11-18T14:00:00.000Z",
      "end": "2026-11-18T18:00:00.000Z"
    },
    "pickupArea": "Downtown",
    "pickupCity": "Springfield",
    "photoUrl": null,
    "allergenNotes": "Contains dairy.",
    "status": "claimed",
    "donor": {
      "id": "10000000-0000-4000-8000-000000000002",
      "type": "donor",
      "name": "Green Leaf Kitchen",
      "area": "Downtown",
      "city": "Springfield"
    },
    "createdAt": "2026-11-18T09:00:00.000Z",
    "updatedAt": "2026-11-18T10:15:00.000Z"
  },
  "pickup": {
    "line1": "12 Market Street",
    "line2": "Rear entrance",
    "area": "Downtown",
    "city": "Springfield",
    "postcode": "10001",
    "instructions": "Ring the bell at the rear entrance."
  },
  "donorContact": {
    "name": "Maya Rao",
    "phone": "+15550101",
    "email": "contact@greenleaf.test"
  }
}
```

`pickup` and `donorContact` are present because the claim is active. They are absent from
past claims returned by `GET /claims/me`.

**Sample: conflict**

```http
POST /api/v1/donations/30000000-0000-4000-8000-000000000001/claims
Cookie: fd_session=<different NGO session>
```

```http
409 Conflict
```

```json
{
  "error": {
    "code": "DONATION_ALREADY_CLAIMED",
    "message": "This donation has already been claimed.",
    "requestId": "70000000-0000-4000-8000-000000000002"
  }
}
```

No address data is present. A retry by the same NGO returns the existing claim as `201` and
does not create a second claim.

**Sample: status actions**

```http
PATCH /api/v1/donations/30000000-0000-4000-8000-000000000001/status
Cookie: fd_session=<claimant NGO session>
Content-Type: application/json

{ "action": "mark_picked_up" }
```

Returns `200 DonationDetail` with `status: "picked_up"` and an `activeClaim` summary whose
`pickupConfirmedAt` is set.

```http
PATCH /api/v1/donations/30000000-0000-4000-8000-000000000001/status
Cookie: fd_session=<claimant NGO session>
Content-Type: application/json

{
  "action": "release_claim",
  "reason": "Van broke down; cannot collect."
}
```

Returns `200 DonationDetail` with `status: "available"`, `pickup: null`,
`donorContact: null` and `activeClaim: null`. Release is allowed only before
`pickupWindow.start`.

```http
PATCH /api/v1/donations/30000000-0000-4000-8000-000000000001/status
Cookie: fd_session=<donor owner session>
Content-Type: application/json

{ "action": "confirm_completed" }
```

Returns `200 DonationDetail` with `status: "completed"` and `activeClaim: null`. The claim is
completed in the database, but the contract exposes only the active claim.

**Sample: my claims**

```http
GET /api/v1/claims/me?status=active&page=1&pageSize=20
Cookie: fd_session=<NGO session>
```

```json
{
  "data": [
    {
      "id": "40000000-0000-4000-8000-000000000001",
      "donationId": "30000000-0000-4000-8000-000000000001",
      "status": "active",
      "claimedAt": "2026-11-18T10:15:00.000Z",
      "pickupConfirmedAt": null,
      "completedAt": null,
      "cancelledAt": null,
      "cancelReason": null,
      "ngo": {
        "id": "20000000-0000-4000-8000-000000000001",
        "type": "ngo",
        "name": "Hope Kitchen",
        "area": "Eastside",
        "city": "Springfield"
      },
      "donation": {
        "id": "30000000-0000-4000-8000-000000000001",
        "title": "Vegetable curry and rice",
        "description": "Freshly cooked vegetarian curry with steamed rice.",
        "isVegetarian": true,
        "quantity": 12.5,
        "unit": "kg",
        "bestBefore": "2026-11-18T20:00:00.000Z",
        "pickupWindow": {
          "start": "2026-11-18T14:00:00.000Z",
          "end": "2026-11-18T18:00:00.000Z"
        },
        "pickupArea": "Downtown",
        "pickupCity": "Springfield",
        "photoUrl": null,
        "allergenNotes": "Contains dairy.",
        "status": "claimed",
        "donor": {
          "id": "10000000-0000-4000-8000-000000000002",
          "type": "donor",
          "name": "Green Leaf Kitchen",
          "area": "Downtown",
          "city": "Springfield"
        },
        "createdAt": "2026-11-18T09:00:00.000Z",
        "updatedAt": "2026-11-18T10:15:00.000Z"
      },
      "pickup": {
        "line1": "12 Market Street",
        "line2": "Rear entrance",
        "area": "Downtown",
        "city": "Springfield",
        "postcode": "10001",
        "instructions": "Ring the bell at the rear entrance."
      },
      "donorContact": {
        "name": "Maya Rao",
        "phone": "+15550101",
        "email": "contact@greenleaf.test"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Seeded logins for this slice**

| Email | Password | Use |
| --- | --- | --- |
| `ngo.verified@food-demo.test` | `Demo1234!` | claim, release, pickup |
| `ngo.verified2@food-demo.test` | `Demo1234!` | demonstrate the double-claim conflict |
| `donor.verified@food-demo.test` | `Demo1234!` | view claims on own donations, confirm completion, cancel |
| `admin@food-demo.test` | `Admin1234!` | force-cancel available or claimed donations |

**Known limitations**

- No notification inbox yet. Notification rows are written for claim, release, pickup,
  completion, cancellation and expiry events, but the frontend cannot read them until
  Slice 5.
- No email delivery of any kind.
- No admin claim list, admin dashboard counts or donation history endpoint. Admin oversight
  of a specific donation uses `GET /donations/{id}` and the cancel endpoint.
- `DonationDetail` exposes only `activeClaim`. After a claim ends, the donor loses the NGO
  summary and the claim timestamps from that endpoint.
- `GET /claims/me` is NGO-only; donors cannot list claims on their donations.
- `overdue` is not a field. Derive it from `status` and `pickupWindow.end`.
- Jobs run in-process and are single-instance in the MVP.
- No real-time updates; refetch after actions and conflicts.
- The donor/admin cannot edit donation content after a claim; only the pickup end may be
  extended, up to best-before.

### 14.4 Slice 4 — Organisation profile and documents (phases 14–15)

**Endpoints ready**

- [ ] `GET /organisations/me`
- [ ] `PATCH /organisations/me`
- [ ] `POST /organisations/me/documents`
- [ ] `GET /organisations/me/documents/{documentId}/download`
- [ ] `POST /organisations/me/verification`
- [ ] `GET /admin/organisations`
- [ ] `GET /admin/organisations/{organisationId}`
- [ ] `GET /admin/organisations/{organisationId}/documents/{documentId}/download`
- [ ] `POST /admin/organisations/{organisationId}/verification`

**Sample: own profile**

```http
GET /api/v1/organisations/me
Cookie: fd_session=<pending donor session>
```

```json
{
  "id": "10000000-0000-4000-8000-000000000003",
  "type": "donor",
  "name": "Campus Canteen",
  "registrationNumber": "DON-1002",
  "contactName": "Arjun Mehta",
  "contactPhone": "+15550102",
  "contactEmail": "contact@campuscanteen.test",
  "address": {
    "line1": "8 University Road",
    "line2": null,
    "area": "University",
    "city": "Springfield",
    "postcode": "10002"
  },
  "verificationStatus": "pending",
  "verificationSubmittedAt": "2026-11-18T09:30:00.000Z",
  "rejectionReason": null,
  "documents": [
    {
      "id": "50000000-0000-4000-8000-000000000001",
      "documentType": "food_safety_licence",
      "status": "pending",
      "isCurrent": true,
      "originalFilename": "food-safety-licence.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 245760,
      "uploadedAt": "2026-11-18T09:20:00.000Z",
      "reviewedAt": null,
      "reviewNote": null
    }
  ],
  "createdAt": "2026-11-17T09:00:00.000Z",
  "updatedAt": "2026-11-18T09:30:00.000Z"
}
```

**Sample: update profile**

```http
PATCH /api/v1/organisations/me
Cookie: fd_session=<pending donor session>
Content-Type: application/json

{
  "contactPhone": "+15550199",
  "address": {
    "line1": "10 University Road",
    "line2": null,
    "area": "University",
    "city": "Springfield",
    "postcode": "10002"
  }
}
```

Returns `200 OrganisationProfile`. The owner cannot change `type`, `verificationStatus`,
`verifiedAt`, `verifiedBy` or `verificationSubmittedAt` through this endpoint.

**Sample: upload**

```bash
curl -X POST http://localhost:4000/api/v1/organisations/me/documents \
  -b "fd_session=<opaque>" \
  -F "documentType=food_safety_licence" \
  -F "file=@food-safety-licence.pdf;type=application/pdf"
```

```http
201 Created
```

```json
{
  "id": "50000000-0000-4000-8000-000000000002",
  "documentType": "food_safety_licence",
  "status": "pending",
  "isCurrent": true,
  "originalFilename": "food-safety-licence.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245760,
  "uploadedAt": "2026-11-18T10:00:00.000Z",
  "reviewedAt": null,
  "reviewNote": null
}
```

Only PDF, JPEG and PNG up to 10 MB are accepted. The response never contains the storage
key.

**Sample: submit for verification**

```http
POST /api/v1/organisations/me/verification
Cookie: fd_session=<pending donor session>
```

```http
202 Accepted
```

```json
{
  "verificationStatus": "pending",
  "submittedAt": "2026-11-18T10:05:00.000Z"
}
```

The exact required document types must already be current. `other` does not substitute for
a required type.

**Sample: admin queue**

```http
GET /api/v1/admin/organisations?verificationStatus=pending&type=donor&page=1&pageSize=20
Cookie: fd_session=<admin session>
```

```json
{
  "data": [
    {
      "id": "10000000-0000-4000-8000-000000000003",
      "type": "donor",
      "name": "Campus Canteen",
      "city": "Springfield",
      "verificationStatus": "pending",
      "verificationSubmittedAt": "2026-11-18T10:05:00.000Z",
      "createdAt": "2026-11-17T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Sample: decision**

```http
POST /api/v1/admin/organisations/10000000-0000-4000-8000-000000000003/verification
Cookie: fd_session=<admin session>
Content-Type: application/json

{
  "decision": "verified",
  "documentReviews": [
    {
      "documentId": "50000000-0000-4000-8000-000000000002",
      "status": "approved",
      "note": "Valid until 2027."
    },
    {
      "documentId": "50000000-0000-4000-8000-000000000003",
      "status": "approved",
      "note": null
    }
  ]
}
```

Returns `200 OrganisationProfile` with `verificationStatus: "verified"`,
`verificationSubmittedAt` retained, `rejectionReason: null` and `documents` showing the
reviewed state.

Rejection uses:

```json
{
  "decision": "rejected",
  "reason": "Food safety licence expired.",
  "documentReviews": [
    {
      "documentId": "50000000-0000-4000-8000-000000000002",
      "status": "rejected",
      "note": "The licence expired on 2026-10-31."
    }
  ]
}
```

**Seeded logins for this slice**

| Email | Password | Use |
| --- | --- | --- |
| `admin@food-demo.test` | `Admin1234!` | review queue, document download, decision |
| `donor.pending@food-demo.test` | `Demo1234!` | profile, upload, submit, resubmit |
| `donor.rejected@food-demo.test` | `Demo1234!` | see rejection reason and replace documents |
| `ngo.rejected@food-demo.test` | `Demo1234!` | rejected NGO flow |
| `donor.verified@food-demo.test` | `Demo1234!` | view-only documents and blocked renewal |

**Known limitations**

- Development uses local disk storage. The S3-compatible production adapter is wired in
  phase 19; the frontend must not assume a public file URL.
- No email notifications for verification decisions. The in-app rows are written, but the
  inbox endpoint arrives in Slice 5.
- No document renewal after verification; a verified organisation receives
  `409 INVALID_STATUS_TRANSITION` on upload and submission.
- No verification revocation or periodic re-verification.
- `other` documents are additional only and never satisfy a required type.
- No antivirus scan; admin previews must download as an attachment and use a safe viewer.
- Admin list filters are limited to `verificationStatus`, `type` and `city`; there is no
  name search or pending-document count.
- `OrganisationProfile` does not expose the verifying admin or `verifiedAt`; the database
  records them.
- No donation-photo upload.

### 14.5 Slice 5 — Notifications (phase 18)

**Endpoints ready**

- [ ] `GET /notifications`
- [ ] `POST /notifications/{notificationId}/read`
- [ ] `POST /notifications/read-all`

Notification rows have been written by the event slices since Slice 2. This slice exposes
the in-app inbox only.

**Sample: list unread**

```http
GET /api/v1/notifications?unreadOnly=true&page=1&pageSize=20
Cookie: fd_session=<donor session>
```

```json
{
  "data": [
    {
      "id": "60000000-0000-4000-8000-000000000001",
      "type": "donation_claimed",
      "title": "Your donation was claimed",
      "body": "Hope Kitchen claimed \"Vegetable curry and rice\".",
      "donationId": "30000000-0000-4000-8000-000000000001",
      "claimId": "40000000-0000-4000-8000-000000000001",
      "readAt": null,
      "createdAt": "2026-11-18T10:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  },
  "unreadCount": 1
}
```

The inbox is in-app only.

**Sample: mark one read**

```http
POST /api/v1/notifications/60000000-0000-4000-8000-000000000001/read
Cookie: fd_session=<donor session>
```

```json
{
  "id": "60000000-0000-4000-8000-000000000001",
  "type": "donation_claimed",
  "title": "Your donation was claimed",
  "body": "Hope Kitchen claimed \"Vegetable curry and rice\".",
  "donationId": "30000000-0000-4000-8000-000000000001",
  "claimId": "40000000-0000-4000-8000-000000000001",
  "readAt": "2026-11-18T10:20:00.000Z",
  "createdAt": "2026-11-18T10:15:00.000Z"
}
```

The call is idempotent. A notification belonging to another user returns
`404 NOTIFICATION_NOT_FOUND`.

**Sample: mark all read**

```http
POST /api/v1/notifications/read-all
Cookie: fd_session=<donor session>
```

```json
{
  "updated": 3
}
```

**Seeded logins for this slice**

| Email | Password | Inbox |
| --- | --- | --- |
| `donor.verified@food-demo.test` | `Demo1234!` | claim, pickup, completion, expiry rows |
| `ngo.verified@food-demo.test` | `Demo1234!` | claim outcomes and cancellation rows |
| `ngo.verified2@food-demo.test` | `Demo1234!` | cancellation/conflict demo rows |
| `admin@food-demo.test` | `Admin1234!` | own in-app rows only; no admin queue notifications |

**Known limitations**

- No email delivery of any kind. Notifications are in-app only.
- No real-time push; the frontend refetches on navigation, after actions and via its normal
  polling or focus strategy.
- No notification preferences, muting or per-type settings.
- No retention cleanup for old notifications in the MVP.
- Admin verification work is driven by the admin dashboard/queue, not by notification rows.
- A notification about a donation whose claim ended still links to the donation/claim ids;
  the frontend must handle a `404` on the linked detail.

### 14.6 Slice 6 — Hardening and deploy (phase 19)

**Endpoints ready**

- [ ] No new endpoints. The Slice 1–5 endpoints are unchanged.

**Sample: full happy path**

| Step | Request | Expected |
| --- | --- | --- |
| 1 | `POST /auth/register` as donor | `201`, pending donor org |
| 2 | `POST /auth/register` as NGO | `201`, pending NGO org |
| 3 | `GET /admin/organisations?verificationStatus=pending` as admin | `200`, both orgs |
| 4 | `GET /admin/organisations/{id}` for each org | `200`, documents |
| 5 | `POST /admin/organisations/{id}/verification` with approved docs | `200`, verified |
| 6 | `POST /donations` as donor | `201`, available |
| 7 | `POST /donations/{id}/claims` as NGO | `201`, active claim, full pickup details |
| 8 | `PATCH /donations/{id}/status` `mark_picked_up` as NGO | `200`, picked_up |
| 9 | `PATCH /donations/{id}/status` `confirm_completed` as donor | `200`, completed |
| 10 | `GET /notifications` as both parties | `200`, event rows |

**Seeded logins for this slice**

All logins from §6.5. For the deployment demo, change or remove the seeded admin password
before exposing the environment.

**Known limitations**

- The deployment target is not fixed by this plan. The checklist requires an HTTPS host, a
  PostgreSQL instance, a private S3-compatible bucket and a single application instance (or
  an external scheduler for jobs).
- The concrete S3 client package still needs owner approval before phase 19.
- No email provider, email verification, password reset or donation photo upload.
- No antivirus, MFA, CSRF-token flow, distributed rate limiting or multi-instance job
  coordination.
- No admin claim list, admin dashboard counts, donation history endpoint or organisation/date
  filters on admin donation lists.
- The contract remains the source of truth; any missing endpoint requires an agreed contract
  change.

## 15. Contract gaps and known limitations

These are deliberate consequences of implementing the current contract. They must not be
silently patched with undocumented response fields.

| Gap | Consequence | Handling |
| --- | --- | --- |
| `AuthResponse.organisation` has no `verificationStatus` | Login UI cannot pre-read pending/rejected state | Use `403 ORGANISATION_NOT_VERIFIED` until Slice 4; then call `GET /organisations/me` |
| `DonationDetail` exposes only `activeClaim` | No claim history for donors/admins after a claim ends | Show history from notifications where possible; a future contract change is needed for full history |
| No admin claim list or dashboard counts | Admin cannot list all claims or get operational counts | Use donation detail/cancel; counts need a future contract change |
| No donation status-history endpoint | History rows are not directly readable by clients | Keep the audit in the database; expose via a future contract change if required |
| Admin donation filters omit organisation/date | Admin cannot filter by organisation or date | Use the filters in the contract; future change if needed |
| No version field | No client-side optimistic concurrency | Service serializes writes; last successful write wins |
| No CSRF-token endpoint | No token flow | `SameSite=Lax` + Origin allowlist; documented accepted risk |
| No email provider | No email delivery | In-app notifications only; `emailedAt` always null |
| No photo upload | No listing images | `photoUrl` always null; reserved schema column |
| No verification revocation/renewal | Verified organisations stay verified | Out of scope; admin force-cancel covers active listings |
| No real-time transport | Pages can be stale | Refetch on navigation and after actions |
| No antivirus | Uploaded files are not scanned | Private storage, attachment download, safe admin viewer |
| Public unavailable detail returns 404 | No “claimed by” page | Frontend renders its “no longer available” state |
| Slice 2 expiry is query-time only | Stored status may lag | Slice 3 expiry job catches up; public queries hide past-end listings |
| `other` documents do not substitute | Some equivalent documents cannot satisfy a requirement | Owner-approved exact-type rule; future product change if needed |

## 16. Approvals, assumptions and change control

Approved:

- `multer` and `@types/multer`.
- In-app notifications only; no email provider, service, adapter, queue or retry.
- Exact document types; `other` is additional only.
- S3-compatible private bucket for production storage.
- `node:test` and `scrypt`.
- Phase list and slice grouping exactly as documented above.

Open dependency gate:

- The concrete S3 client package for phase 19. The storage interface and local adapter are
  independent of it. Do not install an S3 SDK until the owner approves the package.

Assumptions:

- PostgreSQL 15+ and `gen_random_uuid()` are available.
- One city, English, metric units, UTC storage.
- The frontend is served from the exact `CORS_ORIGIN` and sends credentials.
- The process runs as a single instance in the MVP; jobs use advisory locks as a backstop.
- The API contract is not changed by this plan.

Change control:

- Changing the phase list or slice grouping requires owner agreement and a new decision
  entry.
- Changing the contract requires owner agreement, an `openapi.yaml` update, an
  `API_NOTES.md` update and a new decision entry.
- Adding a runtime dependency requires owner approval.

## 17. Definition of done

A slice is done when:

- All phase acceptance criteria for that slice pass.
- The frontend handoff checklist is complete, including samples, seeded logins and known
  limitations.
- The API contract is unchanged, and no future-slice endpoint is mounted.
- The test suite for the slice is green and the migration/seed path is reproducible.
- `docs/07-progress/PROGRESS.md` records what was built, what remains and the date.
- `SECURITY_NOTES.md` is updated with the implemented security items for the slice.

The MVP backend is done when the Slice 6 acceptance criteria pass, the full happy path works
from a clean database with seed data, the concurrency test has exactly one winner, public
responses leak no private address/contact data, and the contract matches the implemented
behaviour.

