# Food Donation Platform

A web application that connects people and businesses with surplus food to charities,
community kitchens and individuals who can collect it, with listings, claims and pickup
coordination in one place. This repository holds both halves of the product: a React
frontend in `frontend/` and a TypeScript API in `backend/`, plus the shared planning,
contract and progress documents in `docs/`.

## Running the two halves

Nothing is implemented yet, so there is nothing to start: this repository currently
contains only the agreed folder structure and empty placeholder files. Once each half is
built, the backend will be started from `backend/` with its own install, Prisma migration
and dev-server scripts, and the frontend from `frontend/` with its own install and dev-server
scripts, pointing at the backend API URL. Both command sequences will be documented here as
soon as the first runnable code lands.
