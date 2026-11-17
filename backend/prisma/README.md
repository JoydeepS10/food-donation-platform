# prisma

This folder holds the database layer: `schema.prisma` describes the models, relations and
enums that implement `docs/01-planning/DATABASE_DESIGN.md`, and the generated migrations
record every applied schema change in order. Schema edits are made here and shipped as
migrations, never as ad-hoc database changes.
