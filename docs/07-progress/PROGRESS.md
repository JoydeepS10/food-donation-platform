# Progress

## 2026-11-17 — Phase 0: repository scaffolding

- Created the agreed folder layout, the root/`frontend`/`backend` `AGENTS.md` rule files, a
  `README.md` in every folder, and the empty placeholder documents in `docs/` (`openapi.yaml`,
  planning, plan, decision, asset and progress files) plus `backend/prisma/schema.prisma`.
- Started the step table in `docs/00-workflow/WORKFLOW.md`.
- Open: all content documents are still empty, no dependencies installed, no application code.

## 2026-11-18 — Phase 1: product and data planning

- Wrote `docs/01-planning/PRODUCT_PLAN.md`: goals, roles, MVP feature list, product rules,
  explicit out-of-scope items, constraints and MVP done criteria.
- Wrote `docs/01-planning/USER_FLOWS.md`: access matrix, flows per role, the six-state
  donation lifecycle, allowed transitions, automation and edge cases.
- Wrote `docs/01-planning/DATABASE_DESIGN.md`: enums, nine tables, relations, indexes,
  constraints, critical transactions, privacy and seed/migration notes.
- Agreed decisions: instant atomic claim; public browsing with one login per organisation;
  required quantity, pickup window, vegetarian flag and best-before; address revealed only
  after a successful claim; email plus in-app notifications with no real time.
- Open: `docs/02-api-contract/openapi.yaml` is still a placeholder; frontend/backend plans
  and API contract are next; no application code or dependencies yet.

## 2026-11-18 — Phase 2: API contract

- Wrote `docs/02-api-contract/openapi.yaml` as a valid OpenAPI 3.0.3 contract with 25
  operations (5 / 5 / 3 / 9 / 3 / 0) across slices 1–5; slice 6 adds no endpoints.
- Tagged every operation with `x-slice`, `x-required-roles` and
  `x-requires-verified-organisation`.
- Defined the shared `ErrorResponse` envelope once and reused it through shared 4xx/5xx
  response components on every operation.
- Added reusable schemas, parameters, pagination, role-aware donation projections, upload and
  download rules, and auth/verification flows.
- Wrote `docs/02-api-contract/API_NOTES.md` with metadata semantics, error codes, pagination,
  slice ownership and projection rules.
- Validation: Redocly lint passes with only informational warnings (local server URL,
  license URL, health endpoint has no 4xx response).
- Open: frontend/backend plans; no application code or dependencies yet.
