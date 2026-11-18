# Product Plan — Food Donation Coordination System

**Status:** MVP definition agreed 2026-11-17.

## 1. Problem and product

Restaurants, food chains and college canteens regularly have edible surplus food but no reliable way to hand it to a trustworthy recipient before it spoils. NGOs need a predictable source of donations and a clear record of what they claimed and collected. An administrator needs to confirm that both sides are legitimate before food changes hands.

This product is a responsive web application for one city that closes that loop: donors publish time-boxed surplus food listings, verified NGOs claim them atomically, both sides coordinate pickup, and an admin verifies organisations by reviewing their documents. It is a coordination tool — it does not handle food, payments or transport.

## 2. Goals and success criteria

**Goals**

- **Trust:** only admin-verified organisations can post or claim.
- **Speed:** a donor can publish a valid listing in under three minutes; an NGO can claim in two actions.
- **Clarity:** one unambiguous donation lifecycle with no double claims and no silent expiration of an active commitment.
- **Accountability:** every status change and every admin decision has an actor, a timestamp and, where relevant, a reason.
- **Professional student delivery:** contract-first API, strict TypeScript, responsive and accessible UI, and tests around the risky rules.

**MVP success criteria**

- The full demo works end to end: donor registers → admin verifies → donor posts → NGO registers → admin verifies → NGO claims → pickup confirmed → donation completed.
- A concurrency test with many simultaneous claim attempts produces exactly one winner and no duplicate active claims.
- No public API response exposes a street address, pickup instructions or contact details before a successful claim.
- Every donation status change has a matching history row; every verification rejection has a reason.
- Core screens work at 360 px and 1280 px widths and are keyboard-operable.
- The documented lifecycle has no transition that bypasses the rules in section 5.

## 3. Roles

| Role | Description | Core capabilities |
| --- | --- | --- |
| Visitor | Unauthenticated person | Browse available donations; view masked listing detail; register or log in |
| Donor organisation | Restaurant, food chain, canteen or similar | Manage organisation profile and documents; create, edit and cancel listings; view claims; confirm completion; view history |
| NGO | Verified non-governmental organisation | Manage profile and documents; browse and filter listings; claim atomically; view full pickup details while the claim is active; release a claim before pickup starts; mark pickup; view history |
| Admin | Platform operator, seeded account | Review and verify/reject organisations; view all listings, claims and histories; force-cancel available or claimed donations; view operational counts |

An organisation account has exactly **one login** in the MVP. Organisation states are `pending`, `verified` and `rejected`; only `verified` organisations can transact.

## 4. MVP features

### 4.1 Public and account features

- **A1 — Public browse:** available donations sorted by soonest pickup deadline, filterable by city, area and vegetarian flag, paginated.
- **A2 — Masked detail:** title, description, quantity, unit, vegetarian flag, best-before, pickup window, area/city, donor display name and optional photo. Exact address, postcode, instructions and contact details are hidden.
- **A3 — Authentication:** email/password registration and login, logout, session expiry. Public browsing needs no account.
- **A4 — Organisation onboarding:** organisation type, name, contact details, address; upload of required verification documents; submission for review; verification status and rejection reason visible to the owner.
- **A5 — Responsive shell:** mobile-first layout, accessible forms, clear loading, empty and error states.

### 4.2 Donor features

- **D1 — Donation dashboard:** own listings grouped by status with expiry and overdue indicators.
- **D2 — Create listing:** title, description, vegetarian flag, quantity and unit, best-before, pickup window, pickup address, optional instructions, optional photo.
- **D3 — Manage while available:** edit listing fields, extend the pickup end, cancel with a reason.
- **D4 — Manage after claim:** no content edits; may extend the pickup end (not beyond best-before) and notify the claimant; may cancel with a reason.
- **D5 — Claim awareness:** see the claiming NGO's name and contact details, the pickup window and the claim status.
- **D6 — Completion:** see pickup confirmation and confirm completion; otherwise completion happens automatically 48 hours after pickup confirmation.
- **D7 — History and notifications:** past donations, status history and in-app notifications.

### 4.3 NGO features

- **N1 — Discover:** search and filter available donations; open masked details.
- **N2 — Atomic claim:** confirm and claim in one transaction; first successful claim wins; full address, instructions and donor contact become visible only after success.
- **N3 — Claim management:** see active and past claims; release a claim with a reason before the pickup window starts.
- **N4 — Pickup:** mark picked up once the pickup window has started; late pickup is allowed with a warning.
- **N5 — History and notifications:** past collections, outcomes and in-app notifications.

### 4.4 Admin features

- **AD1 — Verification queue:** pending organisations, document preview, per-document approve/reject notes, final organisation approve/reject with a required reason.
- **AD2 — Organisation overview:** profile, contact details, document history and verification state.
- **AD3 — Oversight:** all listings and claims with filters, full status history, claiming NGO, and force-cancel for available or claimed donations with a reason.
- **AD4 — Operational dashboard:** counts for pending verifications, available donations, active claims, overdue claims and completed donations.
- **AD5 — Accountability:** every admin decision records the admin, timestamp and reason; reviewed documents are retained.

### 4.5 Platform features

- **P1 — Role-based access control** on every endpoint and page.
- **P2 — Notifications:** durable in-app notification inbox for defined events. Notifications are stored as rows; there is no email channel.
- **P3 — Scheduled jobs:** expire unclaimed donations at pickup-window end; auto-complete picked-up donations after 48 hours; idempotent and safe to re-run.
- **P4 — Audit trail:** append-only donation status history; claim and document history retained.
- **P5 — Secure uploads:** type and size validation, private document storage, random storage keys.
- **P6 — Privacy masking** applied server-side, never only in the UI.
- **P7 — Demo seed data:** one admin, verified and pending donors, verified and rejected NGOs, and listings in several states.

## 5. Product rules

1. Both donors and NGOs must have a verified organisation before posting or claiming.
2. One login per organisation; admins are seeded and have no organisation.
3. A donation has at most one active claim. Claiming is atomic and idempotent for retries by the same NGO.
4. The exact pickup address, instructions and contact details are revealed only to the NGO holding the active claim; the donor and admin always see their own/all data.
5. `pickup_window_start < pickup_window_end <= best_before`. Publishing with a best-before in the past is rejected.
6. An **available** donation expires automatically at pickup-window end. A **claimed** donation never expires automatically; it becomes visibly overdue and must be resolved by pickup, donor cancellation or admin action.
7. Every cancellation requires a reason. NGO release is allowed only before the pickup window starts.
8. A donor may extend the pickup end while the donation is available or claimed, never beyond best-before; a claimed donation triggers a notification to the NGO.
9. Admins may force-cancel available or claimed donations but cannot edit content; picked-up donations resolve to completed, not cancelled.
10. No payments, delivery or food-safety guarantee is part of the product.

## 6. Explicitly out of scope

- **Commerce:** payments, invoices, tax receipts, paid delivery, courier booking.
- **Logistics and discovery:** maps, geolocation, route planning, live tracking, distance matching.
- **Communication:** in-app chat, SMS, push notifications, WebSockets or any real-time updates.
- **Accounts:** multi-user organisations, staff roles or invitations, social/SSO login, self-service account deletion, document renewal after approval.
- **Donation features:** recurring or scheduled donations, multiple photos per listing, waitlists for claimed donations, ratings/reviews, pickup proof photos or signatures, gamification.
- **Admin extras:** analytics suite, CSV exports, OCR or automated document checks, government registry integration, content management, abuse-report workflows.
- **Platform extras:** native apps, offline/PWA mode, multi-city operation, multi-language, multi-currency, public API or partner integrations.
- **Security extras:** antivirus scanning of uploads and background-check integrations; standard validation and safe file handling still apply.

## 7. Constraints and assumptions

- Two developers: one frontend, one backend. Neither edits the other's folder.
- `docs/02-api-contract/openapi.yaml` is the source of truth and changes only with the owner's agreement.
- Student project: small scope, short timeline, professional quality rather than production scale.
- One city, English, metric units, no currency. Free donations, pickup only.
- PostgreSQL with Prisma, as scaffolded. No unapproved libraries.
- Notifications are in-app only; the notification row is the durable record.
- UTC in the database, local time in the UI.
- The platform coordinates handover; donors remain responsible for food safety and NGOs inspect food at pickup.

## 8. Non-functional requirements

- **Security:** password hashing, hashed session tokens, secure cookies, CSRF protection for cookie-authenticated writes, rate limiting on auth and claim endpoints, role checks on every route, private document access.
- **Privacy:** collect only necessary personal data; mask addresses and contacts publicly; do not log secrets, tokens or full addresses.
- **Accessibility:** WCAG 2.1 AA target for core flows — labels, focus states, contrast, keyboard operation, meaningful errors.
- **Responsive design:** usable from 360 px; primary breakpoints at 360, 768 and 1280 px.
- **Performance:** paginated lists, lazy-loaded images, no unbounded queries; core pages usable on a throttled mobile connection.
- **Reliability:** state changes and their history/notifications commit together; scheduled jobs are idempotent.
- **Testing:** unit tests for status rules and validation; integration tests for claim concurrency and permissions; one end-to-end happy-path test.
- **Observability:** structured server logs with request IDs, no PII; clear user-facing error codes.

## 9. Definition of done for the MVP

The demo can be run from a clean database with seed data; the full happy path above succeeds; the concurrency test has exactly one winner; rejected-organisation and stale-listing paths show correct messages; public responses leak no precise address; the progress log is updated; and the API contract matches the implemented behaviour.
