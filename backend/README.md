# backend

The server half of the food donation platform: a TypeScript API that owns the database,
enforces the rules and serves the endpoints defined in `docs/02-api-contract/openapi.yaml`.
Its source lives in `src/`, its database schema and migrations in `prisma/`, and the rules
for working here are in this folder's `AGENTS.md`.
