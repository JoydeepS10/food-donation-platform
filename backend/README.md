# Backend

The server half of the food donation platform: a TypeScript API that owns the database,
enforces the rules and serves the endpoints defined in `docs/02-api-contract/openapi.yaml`.
Its source lives in `src/`, its database schema and migrations in `prisma/`, and the rules
for working here are in this folder's `AGENTS.md`.

## Phase 11 status

Only the foundation and `GET /api/v1/health` are implemented. No database, auth, donation,
claim, organisation, admin or notification routes are mounted yet.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

`FRONTEND_URL` is required and must be the exact browser origin that calls the API with
credentials. `DATABASE_URL` is optional in phase 11 and becomes required in phase 12.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run `src/server.ts` directly with Node's TypeScript support and watch mode |
| `npm run build` | Compile `src/` to `dist/` with strict TypeScript |
| `npm start` | Run the compiled server from `dist/` |
| `npm run typecheck` | Type-check source and tests without emitting |
| `npm run lint` | Alias for `npm run typecheck`; no linter dependency is approved yet |
| `npm test` | Type-check, then run unit and integration tests with `node:test` |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |

## Local endpoint

```text
GET http://localhost:4000/api/v1/health
```

The response follows `HealthResponse` from the contract. Unknown routes and malformed JSON
return the shared `ErrorResponse` envelope with a `requestId`, and every response carries an
`X-Request-Id` header.
