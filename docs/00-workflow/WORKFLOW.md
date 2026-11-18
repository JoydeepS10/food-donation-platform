# Workflow

The steps we followed, in order.

| Step | What it does | Model/mode | Reads | Produces | Run by | Date |
| --- | --- | --- | --- | --- | --- | --- |
| 0. Scaffold | Creates the agreed repository layout, rule files and empty placeholder documents; no application code. | DeepSeek V4.1 Flash Free / build | This task brief | `AGENTS.md` files, folder `README.md`s, empty placeholders, this table | AI session | 2026-11-17 |
| 1. Product and data planning | Defines scope, role flows, donation lifecycle, edge cases and the database schema. | DeepSeek V4.1 Flash Free / plan | Confirmed answers on claim model, verification, privacy, lifecycle and real time | `PRODUCT_PLAN.md`, `USER_FLOWS.md`, `DATABASE_DESIGN.md` | AI session (product architecture) | 2026-11-18 |
| 2. API contract | Defines 25 operations (5 / 5 / 3 / 9 / 3 / 0) in five build slices with role, verification and shared error metadata. | DeepSeek V4.1 Flash Free / build | Planning docs and confirmed API conventions | `openapi.yaml`, `API_NOTES.md` | AI session (API design) | 2026-11-18 |
