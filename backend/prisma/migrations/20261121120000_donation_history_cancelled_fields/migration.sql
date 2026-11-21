-- Hand-written migration: audit fields for cancellation history rows.
--
-- `DATABASE_DESIGN.md` requires every cancellation to record the actor and the reason along
-- with the status change. `donations_cancelled_fields_check` enforces that on the donation
-- row; this constraint is the matching backstop for the append-only history row written in
-- the same transaction. System-driven transitions (expiry, auto-completion) are unaffected
-- because only `to_status = 'cancelled'` requires the fields.
ALTER TABLE "donation_status_history"
    ADD CONSTRAINT "donation_status_history_cancelled_fields_check"
    CHECK (
        "to_status" <> 'cancelled'
        OR ("changed_by_user_id" IS NOT NULL AND "reason" IS NOT NULL)
    );
