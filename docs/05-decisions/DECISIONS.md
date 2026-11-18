# Decisions

## 2026-11-18 — Remove email verification, password reset and donation photo upload from the MVP

**Context.** The MVP has no email delivery for account verification or password recovery, and
no image storage for donation listings. Keeping HTTP operations whose only job is to send
verification or reset mail, or to store a listing photo, would commit both halves of the app
to infrastructure that is out of scope for the first release.

**Options considered.**

- Keep the operations and leave them unimplemented or stubbed. Rejected: clients would
  integrate against operations that cannot work, and the frontend would build screens with no
  working backend.
- Remove the operations from the contract now and add them back later if the scope changes.
  Chosen.

**Outcome.**

- Removed `POST /auth/verify-email`, `POST /auth/resend-verification`,
  `POST /auth/forgot-password` and `POST /auth/reset-password`. `POST /auth/register`,
  `POST /auth/login`, `POST /auth/logout` and `GET /auth/me` remain.
- Removed `POST /donations/{donationId}/photo`. The read model keeps the optional `photoUrl`
  field so a later upload feature does not require a response-shape change.
- Removed the schemas used only by those operations: `MessageResponse`, `TokenRequest`,
  `EmailRequest`, `ResetPasswordRequest` and `PhotoUploadResponse`.
- `User.emailVerified` stays in the read model to avoid changing every auth response, but no
  operation changes it in the MVP.
- Consequence: there is no self-service password recovery or email verification in the MVP.
  Organisation access is gated by organisation verification only.
- `GET /health` now declares a `429` response, which clears the Redocly
  `operation-4xx-response` warning.

**Reversal.** Reintroducing any removed operation is a contract change: update
`openapi.yaml`, `API_NOTES.md` and the per-slice operation counts, and record a new entry
here. The email-verification and password-reset items in `docs/01-planning/PRODUCT_PLAN.md`
remain out of scope until that happens.

## 2026-11-18 — Adopt slice-based backend delivery order

**Context.** The backend phases are numbered 11–19 by functional area, but the API contract
already assigns every operation to slices 1–6 through `x-slice`. The frontend can only
integrate one runnable slice at a time. Building the backend in numeric phase order would
leave the frontend waiting while later backend areas are completed, and would delay the
first integration test.

**Options considered.**

- Build phases 11–19 in numeric order. Rejected: the frontend would be idle behind
  verification work, integration would start late, and the risk would concentrate at the end.
- Build the whole backend before the frontend. Rejected: it violates vertical-slice delivery
  and encourages endpoints the frontend has not exercised.
- Build in slices, keeping phase numbers as stable identifiers. Chosen.

**Outcome.**

- Slice 1: phases 11 (foundation), 12 (full database, migration and seed) and 13 (auth and
  roles).
- Slice 2: phase 16 (donations), including the verified-organisation guard from phase 15.
- Slice 3: phase 17 (claims and lifecycle), including double-claim and status-transition
  tests.
- Slice 4: phase 14 (organisation profile and documents) and phase 15 (admin verification).
- Slice 5: phase 18 (notifications).
- Slice 6: phase 19 (hardening and tests); no new endpoints.
- The full schema is built in phase 12, as requested, to avoid migration churn across
  slices. No future-slice routes or services are mounted early.
- The verified-organisation guard is delivered in phase 16 and reused in phase 17. Phase 15
  in Slice 4 delivers the admin review and decision, not a second guard.
- Seed data includes verified organisations so Slice 2 and Slice 3 can transact before the
  verification UI exists.
- In-app notification rows are written in the same transaction as the event that causes
  them, from the slice that owns the event. The inbox API is exposed in phase 18. This is a
  data-integrity requirement, not an early endpoint.
- Phase numbers are not execution order; the Slice column in `BACKEND_PLAN.md` is.

**Consequences.** The phase table is ordered 11, 12, 13, 16, 17, 14, 15, 18, 19. Some
phases are intentionally out of numeric order. Organisation onboarding is unavailable until
Slice 4, so the earlier slices use the seeded verified logins. Each slice ends with a
frontend handoff checklist.

**Change control.** Changing the phase list or slice grouping requires the project owner's
agreement and a new entry here.

## 2026-11-18 — In-app notifications only; no email provider in the MVP

**Context.** `PRODUCT_PLAN.md` and `API_NOTES.md` describe best-effort email in addition to
in-app notifications. The MVP will not integrate an email provider. The API contract has no
email endpoint; `Notification.emailedAt` is an optional response field and
`notifications.emailed_at` is an optional database column.

**Decision.** Notifications are durable in-app rows only. The backend does not build an
email service, adapter, outbox, retry queue or provider configuration.
`notifications.emailed_at` remains in the Prisma schema and `Notification.emailedAt`
remains in responses for contract compatibility, but the value is always null and nothing
reads or writes it as a delivery marker.

**Consequences.**

- The frontend exposes notifications only after login; there is no email channel.
- Phase 18 covers the in-app inbox and mark-read operations only.
- `PRODUCT_PLAN.md` and `API_NOTES.md` still describe email as a product intent. This
  decision governs the MVP implementation until those documents are updated with owner
  agreement.
- Authentication email verification and password reset remain removed by the earlier
  2026-11-18 decision.

**Reversal.** Adding email requires a provider choice, dependency and credential approval, a
delivery/retry design, tests, and a documentation update.

## 2026-11-18 — Require exact verification document types

**Context.** `DATABASE_DESIGN.md` says the `other` document type "allows the admin to accept
an equivalent document". The contract's verification decision request has no field that
records which required type an `other` document replaces, so substitution would be implicit
and hard to audit.

**Decision.** The MVP requires exact document types. A donor needs a current
`food_safety_licence` plus either `business_registration` or `institution_authorisation`. An
NGO needs a current `food_safety_licence` plus `ngo_registration`. `other` may be uploaded
and reviewed as additional context, but it never satisfies a missing required type and never
unlocks approval.

**Consequences.**

- The final approval check is deterministic and auditable from document types and statuses.
- An organisation with an equivalent document that has no matching type cannot be approved
  in the MVP; this is an accepted limitation until a future product/contract change adds an
  explicit substitution field.
- The sentence in `DATABASE_DESIGN.md` about `other` being accepted as an equivalent is
  superseded for the MVP by this entry.

**Reversal.** Allowing substitution requires a contract field that names the replaced
required type, an audit rule and an update to the database design.
