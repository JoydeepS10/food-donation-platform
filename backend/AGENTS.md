# AGENTS.md — backend

Rules every AI session must follow when working in `backend/`. The root `AGENTS.md` also
applies; this file adds the backend-specific scope.

## 1. TypeScript strict
Everything here compiles with `strict: true`. No `any`, no `@ts-ignore`, no non-null
assertions used to silence the compiler. Validate unknown input at the edge and narrow it
explicitly.

## 2. Small, focused files
One responsibility per file: routes declare paths, controllers translate HTTP, services hold
business logic, validators check shapes, utils stay tiny and generic. Keep Prisma queries out
of controllers.

## 3. No unapproved libraries
Do not install or import a package the project owner has not approved. Ask before adding
anything (ORM extensions, auth helpers, test runners included).

## 4. The API contract is the source of truth
`docs/02-api-contract/openapi.yaml` governs every request and response this server handles.
Implement to the contract; never adjust the contract to match the code without telling the
project owner first.

## 5. Never edit `frontend/`
You may read `frontend/` to understand consumers, but every write stays inside `backend/`
or the shared `docs/` files.

## 6. Every phase ends by updating the progress log
Update `docs/07-progress/PROGRESS.md` at the end of each phase with what changed, what
remains, and the date.

## 7. No `prompts/` folder
There is no `prompts/` directory in this repository. Do not create or use one.
