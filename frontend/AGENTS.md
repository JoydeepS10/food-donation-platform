# AGENTS.md — frontend

Rules every AI session must follow when working in `frontend/`. The root `AGENTS.md` also
applies; this file adds the frontend-specific scope.

## 1. TypeScript strict
Everything here compiles with `strict: true`. No `any`, no `@ts-ignore`, no non-null
assertions used to silence the compiler. Props, hook results and API payloads are typed
explicitly.

## 2. Small, focused files
One component, hook or helper per file. Presentational components stay free of data
fetching; stateful logic lives in `features/` or `hooks/`.

## 3. No unapproved libraries
Do not add UI kits, data-fetching libraries, form libraries, state managers or styling
packages the project owner has not approved. Ask first.

## 4. The API contract is the source of truth
`docs/02-api-contract/openapi.yaml` defines every request and response the UI consumes.
Types and client functions follow it; the contract is never changed to match the frontend
without telling the project owner first.

## 5. Never edit `backend/`
You may read `backend/` for context, but every write stays inside `frontend/` or the shared
`docs/` files.

## 6. Every phase ends by updating the progress log
Update `docs/07-progress/PROGRESS.md` at the end of each phase with what changed, what
remains, and the date.

## 7. No `prompts/` folder
There is no `prompts/` directory in this repository. Do not create or use one.
