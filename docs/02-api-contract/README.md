# 02-api-contract

This folder holds the API contract, `openapi.yaml`, which is the single source of truth for
every request and response exchanged between the frontend and backend, plus `API_NOTES.md`
for conventions, error shapes and explanations that do not fit in the schema. Both halves
implement against this contract, and it is never changed without telling the project owner
first.
