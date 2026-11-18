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
