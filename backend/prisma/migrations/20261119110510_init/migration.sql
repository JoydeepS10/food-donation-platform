-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('donor', 'ngo', 'admin');

-- CreateEnum
CREATE TYPE "org_type" AS ENUM ('donor', 'ngo');

-- CreateEnum
CREATE TYPE "org_verification_status" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('business_registration', 'food_safety_licence', 'ngo_registration', 'institution_authorisation', 'other');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "quantity_unit" AS ENUM ('kg', 'portions', 'meals', 'packets');

-- CreateEnum
CREATE TYPE "donation_status" AS ENUM ('available', 'claimed', 'picked_up', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "claim_status" AS ENUM ('active', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('organisation_verified', 'organisation_rejected', 'donation_claimed', 'claim_released', 'donation_cancelled', 'pickup_confirmed', 'donation_completed', 'donation_expired');

-- CreateEnum
CREATE TYPE "auth_token_type" AS ENUM ('email_verification', 'password_reset');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organisation_id" UUID,
    "role" "user_role" NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "org_type" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "registration_number" VARCHAR(80),
    "contact_name" VARCHAR(120) NOT NULL,
    "contact_phone" VARCHAR(32) NOT NULL,
    "contact_email" VARCHAR(254) NOT NULL,
    "address_line1" VARCHAR(200) NOT NULL,
    "address_line2" VARCHAR(200),
    "area" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "postcode" VARCHAR(16),
    "verification_status" "org_verification_status" NOT NULL DEFAULT 'pending',
    "verification_submitted_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_user_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organisation_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "document_type" "document_type" NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'pending',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "storage_key" TEXT NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "review_note" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donor_organisation_id" UUID NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" TEXT NOT NULL,
    "is_vegetarian" BOOLEAN NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "quantity_unit" NOT NULL,
    "best_before" TIMESTAMPTZ(6) NOT NULL,
    "pickup_window_start" TIMESTAMPTZ(6) NOT NULL,
    "pickup_window_end" TIMESTAMPTZ(6) NOT NULL,
    "pickup_address_line1" VARCHAR(200) NOT NULL,
    "pickup_address_line2" VARCHAR(200),
    "pickup_area" VARCHAR(120) NOT NULL,
    "pickup_city" VARCHAR(120) NOT NULL,
    "pickup_postcode" VARCHAR(16),
    "pickup_instructions" TEXT,
    "allergen_notes" TEXT,
    "photo_storage_key" TEXT,
    "status" "donation_status" NOT NULL DEFAULT 'available',
    "cancelled_by_user_id" UUID,
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_id" UUID NOT NULL,
    "ngo_organisation_id" UUID NOT NULL,
    "claimed_by_user_id" UUID NOT NULL,
    "status" "claim_status" NOT NULL DEFAULT 'active',
    "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickup_confirmed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_id" UUID NOT NULL,
    "from_status" "donation_status",
    "to_status" "donation_status" NOT NULL,
    "changed_by_user_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "body" TEXT NOT NULL,
    "donation_id" UUID,
    "claim_id" UUID,
    "read_at" TIMESTAMPTZ(6),
    "emailed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent" VARCHAR(255),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "auth_token_type" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_organisation_id_key" ON "users"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "organisations_verification_status_verification_submitted_at_idx" ON "organisations"("verification_status", "verification_submitted_at");

-- CreateIndex
CREATE INDEX "organisations_type_city_idx" ON "organisations"("type", "city");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_type_registration_number_key" ON "organisations"("type", "registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "verification_documents_storage_key_key" ON "verification_documents"("storage_key");

-- CreateIndex
CREATE INDEX "verification_documents_organisation_id_uploaded_at_idx" ON "verification_documents"("organisation_id", "uploaded_at" DESC);

-- CreateIndex
CREATE INDEX "verification_documents_status_uploaded_at_idx" ON "verification_documents"("status", "uploaded_at");

-- CreateIndex
CREATE INDEX "donations_status_created_at_idx" ON "donations"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "donations_donor_organisation_id_created_at_idx" ON "donations"("donor_organisation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "claims_ngo_organisation_id_claimed_at_idx" ON "claims"("ngo_organisation_id", "claimed_at" DESC);

-- CreateIndex
CREATE INDEX "claims_donation_id_claimed_at_idx" ON "claims"("donation_id", "claimed_at" DESC);

-- CreateIndex
CREATE INDEX "donation_status_history_donation_id_created_at_idx" ON "donation_status_history"("donation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_type_expires_at_idx" ON "auth_tokens"("user_id", "type", "expires_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_organisation_id_fkey" FOREIGN KEY ("donor_organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_ngo_organisation_id_fkey" FOREIGN KEY ("ngo_organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_status_history" ADD CONSTRAINT "donation_status_history_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_status_history" ADD CONSTRAINT "donation_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
