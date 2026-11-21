-- Hand-written migration: partial unique indexes, partial performance indexes and CHECK
-- constraints that Prisma's schema language cannot express.
--
-- These objects are part of the database contract in
-- `docs/01-planning/DATABASE_DESIGN.md` and `docs/04-backend/BACKEND_PLAN.md` §6. They must
-- never be dropped by a later migration.

-- ---------------------------------------------------------------------------
-- Partial unique indexes
-- ---------------------------------------------------------------------------

-- At most one active claim per donation. This is the database backstop for the atomic
-- claim transaction.
CREATE UNIQUE INDEX "claims_one_active_per_donation_idx"
    ON "claims" ("donation_id")
    WHERE "status" = 'active';

-- At most one current document per organisation and document type. Replacements mark the
-- previous row `is_current = false` and insert a new current row.
CREATE UNIQUE INDEX "verification_documents_one_current_per_type_idx"
    ON "verification_documents" ("organisation_id", "document_type")
    WHERE "is_current";

-- ---------------------------------------------------------------------------
-- Partial performance indexes
-- ---------------------------------------------------------------------------

-- Public browse: available donations by city, newest first.
CREATE INDEX "donations_available_city_created_idx"
    ON "donations" ("pickup_city", "created_at" DESC)
    WHERE "status" = 'available';

-- Expiry job: available donations whose pickup window has ended.
CREATE INDEX "donations_available_pickup_end_idx"
    ON "donations" ("pickup_window_end")
    WHERE "status" = 'available';

-- Overdue queries: claimed or picked-up donations past their pickup window.
CREATE INDEX "donations_overdue_pickup_end_idx"
    ON "donations" ("pickup_window_end")
    WHERE "status" IN ('claimed', 'picked_up');

-- Auto-completion job: active claims with a pickup confirmation time.
CREATE INDEX "claims_active_pickup_confirmed_idx"
    ON "claims" ("pickup_confirmed_at")
    WHERE "status" = 'active';

-- Notification inbox unread badge.
CREATE INDEX "notifications_user_unread_idx"
    ON "notifications" ("user_id")
    WHERE "read_at" IS NULL;

-- ---------------------------------------------------------------------------
-- CHECK constraints
-- ---------------------------------------------------------------------------

-- Admins have no organisation; donor and NGO users have exactly one.
ALTER TABLE "users"
    ADD CONSTRAINT "users_role_organisation_check"
    CHECK (
        ("role" = 'admin' AND "organisation_id" IS NULL)
        OR ("role" IN ('donor', 'ngo') AND "organisation_id" IS NOT NULL)
    );

-- A verified organisation records who verified it and when.
ALTER TABLE "organisations"
    ADD CONSTRAINT "organisations_verified_fields_check"
    CHECK (
        "verification_status" <> 'verified'
        OR ("verified_at" IS NOT NULL AND "verified_by_user_id" IS NOT NULL)
    );

-- A rejected organisation always records a reason.
ALTER TABLE "organisations"
    ADD CONSTRAINT "organisations_rejected_reason_check"
    CHECK (
        "verification_status" <> 'rejected'
        OR "rejection_reason" IS NOT NULL
    );

-- A pending organisation has no verification decision fields.
ALTER TABLE "organisations"
    ADD CONSTRAINT "organisations_pending_fields_check"
    CHECK (
        "verification_status" <> 'pending'
        OR ("verified_at" IS NULL AND "verified_by_user_id" IS NULL)
    );

-- Uploaded document size is positive.
ALTER TABLE "verification_documents"
    ADD CONSTRAINT "verification_documents_size_positive_check"
    CHECK ("size_bytes" > 0);

-- Pending documents have no reviewer fields; approved and rejected documents require both
-- the reviewer and the review timestamp.
ALTER TABLE "verification_documents"
    ADD CONSTRAINT "verification_documents_review_fields_check"
    CHECK (
        ("status" = 'pending' AND "reviewed_by_user_id" IS NULL AND "reviewed_at" IS NULL)
        OR (
            "status" IN ('approved', 'rejected')
            AND "reviewed_by_user_id" IS NOT NULL
            AND "reviewed_at" IS NOT NULL
        )
    );

-- A rejected document always records a review note.
ALTER TABLE "verification_documents"
    ADD CONSTRAINT "verification_documents_rejection_note_check"
    CHECK ("status" <> 'rejected' OR "review_note" IS NOT NULL);

-- Pickup window start is before pickup window end, and the window ends no later than the
-- best-before time.
ALTER TABLE "donations"
    ADD CONSTRAINT "donations_window_order_check"
    CHECK ("pickup_window_start" < "pickup_window_end");

ALTER TABLE "donations"
    ADD CONSTRAINT "donations_window_before_best_before_check"
    CHECK ("pickup_window_end" <= "best_before");

-- Donation quantity is strictly positive.
ALTER TABLE "donations"
    ADD CONSTRAINT "donations_quantity_positive_check"
    CHECK ("quantity" > 0);

-- A cancelled donation records the actor, timestamp and reason.
ALTER TABLE "donations"
    ADD CONSTRAINT "donations_cancelled_fields_check"
    CHECK (
        "status" <> 'cancelled'
        OR (
            "cancelled_at" IS NOT NULL
            AND "cancelled_by_user_id" IS NOT NULL
            AND "cancel_reason" IS NOT NULL
        )
    );

-- A completed donation records its completion timestamp.
ALTER TABLE "donations"
    ADD CONSTRAINT "donations_completed_at_check"
    CHECK ("status" <> 'completed' OR "completed_at" IS NOT NULL);

-- Active claims have no cancellation or completion fields.
ALTER TABLE "claims"
    ADD CONSTRAINT "claims_active_fields_check"
    CHECK (
        "status" <> 'active'
        OR (
            "cancelled_at" IS NULL
            AND "cancelled_by_user_id" IS NULL
            AND "cancel_reason" IS NULL
            AND "completed_at" IS NULL
        )
    );

-- A cancelled claim records the actor, timestamp and reason.
ALTER TABLE "claims"
    ADD CONSTRAINT "claims_cancelled_fields_check"
    CHECK (
        "status" <> 'cancelled'
        OR (
            "cancelled_at" IS NOT NULL
            AND "cancelled_by_user_id" IS NOT NULL
            AND "cancel_reason" IS NOT NULL
        )
    );

-- A completed claim records both the pickup confirmation and the completion timestamp.
ALTER TABLE "claims"
    ADD CONSTRAINT "claims_completed_fields_check"
    CHECK (
        "status" <> 'completed'
        OR ("completed_at" IS NOT NULL AND "pickup_confirmed_at" IS NOT NULL)
    );

-- A completed claim is completed after it was picked up.
ALTER TABLE "claims"
    ADD CONSTRAINT "claims_completed_after_pickup_check"
    CHECK (
        "status" <> 'completed'
        OR "completed_at" > "pickup_confirmed_at"
    );
