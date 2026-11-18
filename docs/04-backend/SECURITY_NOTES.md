# Security Notes — Food Donation Coordination System

**Status:** Living checklist, agreed 2026-11-18. No security item is implemented until the
slice that owns it lands.

**Legend**

- `[ ]` planned; not implemented yet.
- `[x]` implemented and verified by a test or manual check.
- `[~]` accepted MVP risk or deliberately deferred; the reason is recorded.

Every item is tagged with the slice that owns it. Update this file at the end of each slice.
The API contract is the source of truth; these notes do not add endpoints or change response
shapes.

## 1. Authentication and sessions (Slice 1)

- [ ] Passwords are hashed with Node `crypto.scrypt`, a per-user random salt and
      `timingSafeEqual`; no plaintext or reversible password storage.
- [ ] Password input is at least 8 characters and at most 128; no password is logged.
- [ ] Session tokens are at least 32 random bytes, base64url encoded, and never stored in
      plaintext; only a SHA-256 hash is stored.
- [ ] The `fd_session` cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in
      production.
- [ ] Sessions expire after the configured lifetime; expired and revoked sessions are
      rejected.
- [ ] Logout revokes the session server-side and clears the cookie with the same attributes.
- [ ] Login creates a new session token to prevent session fixation; there are no anonymous
      sessions.
- [ ] Login failures return a generic `401`; unknown emails still run a dummy scrypt check to
      reduce timing leakage.
- [ ] Inactive users cannot log in and existing sessions are rejected.
- [ ] Only the seeded admin can have the admin role; registration accepts only donor/NGO.
- [ ] Admin users have no organisation; donor/NGO users have exactly one.
- [ ] `email_verified_at` is stamped at registration because there is no verification email
      flow; it is not an access gate.
- [ ] No email-verification, resend-verification, forgot-password or reset-password route
      exists.
- [ ] The raw session token is never written to logs, error responses or the database.
- [ ] Auth endpoints are rate limited and return `429 RATE_LIMITED` with `Retry-After`.
- [ ] CORS names the exact frontend origin and allows credentials; a wildcard origin is
      never returned.

## 2. Authorization and IDOR (Slices 1–5)

- [ ] Every route declares its allowed roles from the contract's `x-required-roles`; there
      is no route without an explicit policy.
- [ ] `authenticate` runs before role checks; `requireRole` runs before verification checks.
- [ ] `requireVerifiedOrganisation` applies only to donor/NGO callers and returns
      `403 ORGANISATION_NOT_VERIFIED`; admins are exempt.
- [ ] The guard order is authentication → role → organisation verification → ownership →
      lifecycle state.
- [ ] Donation reads and writes check the donor organisation ownership in the service layer,
      not only in the UI.
- [ ] A non-owner donor receives `404 DONATION_NOT_FOUND` rather than another organisation's
      data.
- [ ] NGO full pickup/contact access is tied to the active claim; after release or
      completion the next fetch no longer includes it.
- [ ] `confirm_completed` is donor-owner only; `mark_picked_up` and `release_claim` are
      claimant-NGO only.
- [ ] Admin force-cancel is limited to `available` and `claimed`; admins cannot edit content
      or use donor/NGO lifecycle actions.
- [ ] Document download is owner-or-admin; another organisation's document returns `404`.
- [ ] Notification read/read-all is owner-only; another user's notification returns `404`.
- [ ] Admin endpoints reject non-admin callers with `403 FORBIDDEN`.
- [ ] Public endpoints never treat a forged cookie as an authenticated identity; optional
      authentication ignores invalid cookies.
- [ ] Unknown body fields are ignored; services assign only allow-listed fields.
- [ ] Response presenters select fields explicitly; no controller returns a raw Prisma row.

## 3. Input validation and output (Slices 1–5)

- [ ] All request bodies, params and query values enter as `unknown` and are narrowed by
      validators.
- [ ] UUID path/query values are validated; invalid UUIDs return `400 BAD_REQUEST`.
- [ ] Enum values, booleans, ISO dates and pagination bounds are validated.
- [ ] Body validation returns `422 VALIDATION_FAILED` with field-level `details`.
- [ ] Malformed JSON returns `400 BAD_REQUEST`, not an HTML error page.
- [ ] JSON body size is limited; multipart is allowed only on the document upload route.
- [ ] `pageSize` is capped at 50; no endpoint can request an unbounded list.
- [ ] String lengths match the contract (`title` 140, `description` 2000, reason 500/1000,
      document filename 255, etc.).
- [ ] Prisma queries are parameterized; raw SQL is used only in migrations/jobs with static
      SQL and bound parameters.
- [ ] Dates are parsed as UTC instants, not local-time strings.
- [ ] Decimal quantities are converted deliberately for JSON; no floating-point drift in
      stored values.
- [ ] Error messages never include SQL, stack traces, tokens or raw database errors.
- [ ] The 5xx handler returns a generic `INTERNAL_ERROR`; diagnostics stay in logs.

## 4. CSRF, CORS and security headers (Slices 1 and 6)

- [ ] Cookie authentication uses `SameSite=Lax` as the primary CSRF defence.
- [ ] State-changing requests validate the `Origin` header against `CORS_ORIGIN` in
      production; an unapproved origin is rejected.
- [ ] CORS uses an explicit origin, `Access-Control-Allow-Credentials: true`, and
      `Vary: Origin`; no wildcard with credentials.
- [ ] `GET` requests are side-effect free; state changes use `POST`/`PATCH`.
- [ ] Responses set `X-Content-Type-Options: nosniff`.
- [ ] Responses set frame denial (`X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`).
- [ ] Responses set a restrictive `Referrer-Policy` and a minimal `Permissions-Policy`.
- [ ] Auth and private responses use `Cache-Control: no-store`.
- [ ] Production sets HSTS when served over HTTPS.
- [ ] `trust proxy` is configured correctly behind the production reverse proxy so secure
      cookies and client IPs are handled correctly.
- [~] No CSRF-token endpoint exists in the contract; the MVP accepts Origin + SameSite as
      sufficient. A token flow would be a contract/UI change.

## 5. Uploads and storage (Slice 4, production Slice 6)

- [ ] `multer` with memory storage is the only multipart parser; its version and types are
      approved.
- [ ] The upload route enforces a 10 MB limit before reading the whole file into memory.
- [ ] File type is validated by magic bytes for PDF, JPEG and PNG, not by extension or
      client MIME type.
- [ ] Filenames are sanitised; the original filename is never used as a storage path.
- [ ] Storage keys are random and server-generated; they are never returned to clients.
- [ ] Local uploads live outside the web root and are gitignored.
- [ ] The local adapter rejects path traversal and stays inside its configured root.
- [ ] Local directories/files use restrictive permissions where the platform supports it.
- [ ] The production bucket is private, has no public ACL/policy or directory listing, and
      uses server-side encryption.
- [ ] S3 credentials come from environment/instance role and are never logged or committed.
- [ ] The S3 client package is approved before installation; the interface does not leak a
      provider SDK into services.
- [ ] Downloads require authentication and owner/admin authorization.
- [ ] Download responses use `Content-Disposition: attachment`, the stored MIME type,
      `nosniff` and `no-store`.
- [ ] A failed storage write leaves no document row; a failed database write triggers
      best-effort object deletion.
- [ ] Reviewed documents are immutable; replacements create a new current row and retain the
      old one as non-current.
- [ ] `other` documents are additional only; they cannot satisfy a required document type.
- [ ] No antivirus or content disarm is available; admin previews use a safe viewer and
      downloaded attachments, never inline execution.
- [ ] No donation photo upload or public image path exists; `photoUrl` is always null.

## 6. Privacy and data protection (Slices 2–6)

- [ ] Public donation projections contain only: id, title, description, vegetarian flag,
      quantity, unit, best-before, pickup window, area, city, donor display summary,
      optional photo URL (null), allergen notes, status and timestamps.
- [ ] Public projections never contain street address, address line 2, postcode, pickup
      instructions, contact name, phone, email or claim data.
- [ ] Claimant projections add full pickup details and donor contact only while the claim is
      active.
- [ ] After release, cancellation or completion, subsequent fetches revert to the masked
      projection.
- [ ] Donor-owner and admin projections are restricted to their own/all records as
      documented.
- [ ] The server, not the UI, enforces masking; a client cannot request a private field.
- [ ] Logs do not contain cookies, tokens, passwords, street addresses, postcodes, contact
      details or document contents.
- [ ] Error messages do not confirm whether a private resource exists to an unauthorised
      caller; invisible resources return `404`.
- [ ] Notification bodies avoid precise addresses and contact details; the linked resource
      supplies detail after authorization.
- [ ] Seed data is fake `.test` data and contains no real organisation or personal data.
- [ ] The demo seed refuses production and the seeded admin password is changed/removed
      before exposure.
- [ ] `emailed_at` remains null; no email provider receives notification content.
- [ ] No hard deletes for core records; retention jobs are limited to sessions and tokens.

## 7. Database and migrations (Slices 1–6)

- [ ] PostgreSQL enums and `CHECK` constraints enforce the critical data rules as a backstop
      to service validation.
- [ ] The partial unique index on active claims is present and tested; it is the final
      defence against double claims.
- [ ] The partial unique index on current documents is present and tested.
- [ ] Public browse, expiry, overdue and unread indexes exist; no list endpoint performs an
      unbounded scan.
- [ ] Donation and claim status changes and their history rows commit in one transaction.
- [ ] Status history is append-only; no update or delete path exists in the application.
- [ ] Reviewed documents are immutable; replacement is a new row.
- [ ] Foreign keys use `RESTRICT` for core records and `SET NULL` only for the optional
      notification links.
- [ ] The application database user is not a superuser and has only the privileges it needs.
- [ ] Production database connections use TLS where the provider supports it.
- [ ] Migrations are reviewed; the hand-written partial indexes and checks are never dropped
      by a later schema change.
- [ ] A clean `migrate reset` + seed is reproducible; production runs `migrate deploy`, never
      `migrate reset`.
- [ ] Backups and restore procedure are part of the deployment checklist.
- [ ] No real organisation data or secrets are committed in seed files.

## 8. Error handling, logging and monitoring (Slices 1–6)

- [ ] Every non-2xx response uses the shared error envelope.
- [ ] Every error response contains a UUID `requestId` that matches the server log.
- [ ] 4xx messages are safe to display; 5xx messages are generic.
- [ ] No stack traces, SQL, Prisma messages or file paths reach clients.
- [ ] Request logs include method, path, status, duration and request ID, but no bodies,
      cookies or tokens.
- [ ] PII is excluded from logs by construction, not by best-effort regex redaction.
- [ ] The `X-Request-Id` header is returned for support correlation.
- [ ] Health checks do not expose secrets or detailed dependency errors.
- [ ] Donation status history provides an audit trail with actor, timestamp and reason.
- [ ] Admin verification decisions record the admin and timestamp in the database.
- [~] No general admin audit log exists beyond the domain tables; adding one is a future
      schema/contract change.

## 9. Rate limits and abuse controls (Slices 1, 3, 4, 6)

- [ ] Register and login are limited by IP and email.
- [ ] Claim is limited by authenticated user.
- [ ] Document upload is limited by authenticated user.
- [ ] A broad per-IP limit covers the remaining API surface.
- [ ] `429 RATE_LIMITED` includes `Retry-After`.
- [ ] Limiter state is resettable in tests and does not leak between test suites.
- [ ] Duplicate-email errors are rate-limited to reduce account enumeration.
- [~] Rate limits are in-memory and single-instance; a multi-instance deployment needs a
      shared store or edge limiter.

## 10. Jobs and concurrency (Slice 3, cleanup Slice 6)

- [ ] Claiming uses a conditional update plus a unique active-claim index; exactly one
      concurrent request wins.
- [ ] Same-NGO retries are idempotent and return the existing claim without duplicate rows.
- [ ] Expiry and auto-completion jobs take advisory locks and use `FOR UPDATE SKIP LOCKED`
      where batches are selected.
- [ ] Jobs are idempotent; re-running produces no duplicate status rows or notifications.
- [ ] Expiry never changes a `claimed` or `picked_up` donation.
- [ ] Auto-completion runs only after 48 hours from pickup confirmation.
- [ ] Job-written history rows use a null actor for system actions.
- [ ] Job failures are logged with the job name and request/run context; one failed batch
      does not corrupt committed batches.
- [~] The scheduler is in-process and single-instance; multi-instance deployment needs an
      external scheduler or leader election.
- [ ] Session/token cleanup removes only expired/revoked auth artefacts, never business
      records.

## 11. Secrets and dependencies (all slices)

- [ ] `.env` files and local uploads are gitignored; `.env.example` contains names only.
- [ ] `DATABASE_URL`, S3 credentials and any future provider secrets are injected at runtime.
- [ ] Secrets are never logged, returned in errors or committed.
- [ ] The only approved runtime addition is `multer`; `@types/multer` is development-only.
- [ ] The S3 client package is approved before phase 19; no unapproved SDK is installed.
- [ ] No email provider or email library is installed.
- [ ] The lockfile is committed and dependency changes are reviewed.
- [ ] `npm audit` (or the available registry audit) is run before deployment; findings are
      triaged.
- [ ] No dependency is added for validation, logging, cookies, CORS, headers, rate limiting
      or testing without owner approval.

## 12. Deployment checklist (Slice 6)

- [ ] `NODE_ENV=production`.
- [ ] HTTPS terminates at the proxy; secure cookies and HSTS are active.
- [ ] `CORS_ORIGIN` is the deployed frontend origin only.
- [ ] `DATABASE_URL` points at the production database; migrations run before the app
      starts.
- [ ] Demo seeding is disabled in production.
- [ ] `STORAGE_DRIVER=s3`; the bucket is private and encrypted.
- [ ] The S3 client package and credentials are approved and configured.
- [ ] `JOBS_ENABLED=true` on exactly one application instance, or an external scheduler is
      used.
- [ ] The seeded admin password is changed or the demo admin is removed.
- [ ] Health check is wired to the platform.
- [ ] Structured logs are collected; alerting exists for 5xx and job failures.
- [ ] Database backups and a restore test are in place.
- [ ] `PROGRESS.md`, `BACKEND_PLAN.md` and this file are current.

## 13. Accepted risks and deliberate out-of-scope items

- [~] **No email provider.** Notifications are in-app only. There is no email verification,
      password reset or notification email. This is a product decision, not an oversight.
- [~] **No CSRF token.** `SameSite=Lax` plus Origin allowlist is the MVP defence; a token
      flow would need contract/UI changes.
- [~] **In-memory rate limits.** Adequate for a single-instance student deployment; not
      distributed.
- [~] **No antivirus.** Uploads are type/size checked, stored privately and downloaded as
      attachments; admin preview uses a safe viewer.
- [~] **No admin MFA or IP allowlist.** The seeded admin is the only admin in the MVP.
- [~] **No verification revocation or document renewal.** Out of scope; admin force-cancel
      covers active listings if a verified organisation must be stopped.
- [~] **No encryption at rest beyond the database/provider.** The deployment relies on the
      managed PostgreSQL and S3 provider.
- [~] **No general admin audit log.** Domain history and verification fields cover the MVP
      accountability requirements.
- [~] **No real-time transport.** Pages refetch; the server remains authoritative.
- [~] **No donation photo upload.** `photoUrl` is always null.
- [~] **No password reset.** Users cannot self-recover in the MVP; the seed/demo accounts are
      fixed.
- [~] **Demo seed credentials.** The seed is for local/demo use only and refuses production.

## 14. Slice completion rule

A slice may not be marked done until:

- Every security item tagged with that slice is implemented or explicitly accepted with a
  reason.
- The relevant permission, privacy, upload, error and rate-limit tests pass.
- `docs/07-progress/PROGRESS.md` is updated.
- Any new risk discovered during the slice is added here with a tag and a decision.
