# AGENTS.md

Rules every AI session must follow in this repository.

## 1. TypeScript strict
All TypeScript must compile with `strict: true` (plus `noUncheckedIndexedAccess` and
`noImplicitOverride` where the toolchain allows). No `any`, no `@ts-ignore`, no non-null
assertions used to silence the compiler. Prefer explicit, narrow types at module boundaries.

## 2. Small, focused files
One responsibility per file. Split modules before they grow past a few hundred lines.
Keep pure logic out of controllers and UI components.

## 3. No unapproved libraries
Do not add a dependency that the project owner has not approved. If something seems to
require a new library, stop and ask first. Standard-library and already-installed
solutions come first.

## 4. The API contract is the source of truth
`docs/02-api-contract/openapi.yaml` defines the contract between frontend and backend.
Implementation follows the contract, never the other way around. The contract is never
changed without telling the project owner first and getting agreement.

## 5. Never edit the other side's folder
- Work inside `frontend/` only touches `frontend/`.
- Work inside `backend/` only touches `backend/`.
- Shared documents are updated in `docs/`, and cross-cutting rules in the root `AGENTS.md`.
Read the other half freely; never write to it.

## 6. Every phase ends by updating the progress log
Before a phase is considered done, append or update the relevant entry in
`docs/07-progress/PROGRESS.md`: what was done, what is still open, and the date.

## 7. No `prompts/` folder
This repository does not use a `prompts/` directory. Do not create one, and do not store
prompt text in it or anywhere else in the tree.
