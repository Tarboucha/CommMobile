
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('home', 'work', 'other');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('text', 'booking_request', 'price_offer', 'offer_response', 'status_update');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled', 'refunded', 'loaned_out', 'returned', 'overdue');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('purchase', 'booking', 'loan', 'free');

-- CreateEnum
CREATE TYPE "community_access_type" AS ENUM ('open', 'request_to_join', 'invite_only');

-- CreateEnum
CREATE TYPE "conversation_type" AS ENUM ('direct', 'community', 'booking');

-- CreateEnum
CREATE TYPE "fulfillment_method" AS ENUM ('pickup', 'delivery', 'online', 'at_location');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "join_method" AS ENUM ('invite_link', 'direct_invite', 'request');

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('owner', 'admin', 'moderator', 'member');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('pending', 'active', 'removed', 'left');

-- CreateEnum
CREATE TYPE "offering_category" AS ENUM ('product', 'service', 'event');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('in_app', 'cash', 'external');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'paid', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "price_type" AS ENUM ('fixed', 'negotiable', 'free', 'donation');

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "profile_id" UUID NOT NULL,
    "address_type" "address_type" DEFAULT 'home',
    "label" TEXT,
    "street_name" TEXT NOT NULL,
    "street_number" TEXT,
    "apartment_unit" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT DEFAULT 'Germany',
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "location" geography,
    "delivery_instructions" TEXT,
    "is_default" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "visibility" TEXT DEFAULT 'private',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "offering_id" UUID NOT NULL,
    "dtstart" DATE NOT NULL,
    "dtend" DATE,
    "rrule" TEXT NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "slots_available" INTEGER NOT NULL DEFAULT 10,
    "slot_unit" TEXT,
    "slot_label" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "loan_duration_days" INTEGER NOT NULL DEFAULT 1,
    "loan_max_duration_days" INTEGER,
    "slot_duration_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_community_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "original_community_id" UUID,
    "snapshot_community_name" TEXT NOT NULL,
    "snapshot_community_description" TEXT,
    "snapshot_community_image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_community_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_customer_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "original_customer_id" UUID NOT NULL,
    "snapshot_display_name" TEXT,
    "snapshot_first_name" TEXT,
    "snapshot_last_name" TEXT,
    "snapshot_email" TEXT,
    "snapshot_phone" TEXT,
    "snapshot_avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_customer_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_delivery_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "snapshot_address_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_delivery_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "schedule_id" UUID,
    "instance_date" DATE,
    "fulfillment_method" "fulfillment_method" NOT NULL,
    "delivery_fee_amount" DECIMAL(10,2) DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_amount" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency_code" TEXT DEFAULT 'EUR',
    "offering_version" INTEGER NOT NULL,
    "snapshot_title" TEXT NOT NULL,
    "snapshot_description" TEXT,
    "snapshot_image_url" TEXT,
    "snapshot_category" "offering_category" NOT NULL,
    "snapshot_transaction_type" "transaction_type",
    "snapshot_price_type" "price_type",
    "special_instructions" TEXT,
    "instance_start_time" TIME(6),
    "instance_end_time" TIME(6),
    "is_loan" BOOLEAN NOT NULL DEFAULT false,
    "loan_start_date" DATE,
    "loan_due_date" DATE,
    "loan_returned_at" TIMESTAMPTZ(6),
    "deposit_amount" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_provider_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_item_id" UUID NOT NULL,
    "original_provider_id" UUID NOT NULL,
    "snapshot_display_name" TEXT NOT NULL,
    "snapshot_avatar_url" TEXT,
    "snapshot_email" TEXT,
    "snapshot_phone" TEXT,
    "snapshot_address_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_provider_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_schedule_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_item_id" UUID NOT NULL,
    "original_schedule_id" UUID,
    "snapshot_dtstart" DATE NOT NULL,
    "snapshot_dtend" DATE,
    "snapshot_rrule" TEXT NOT NULL,
    "snapshot_start_time" TIME(6) NOT NULL,
    "snapshot_end_time" TIME(6) NOT NULL,
    "snapshot_slots_available" INTEGER NOT NULL,
    "snapshot_slot_unit" TEXT,
    "snapshot_slot_label" TEXT,
    "snapshot_loan_duration_days" INTEGER,
    "snapshot_loan_max_duration_days" INTEGER,
    "had_exception" BOOLEAN DEFAULT false,
    "exception_id" UUID,
    "exception_override_start_time" TIME(6),
    "exception_override_end_time" TIME(6),
    "exception_override_slots" INTEGER,
    "exception_override_loan_duration_days" INTEGER,
    "exception_override_slot_duration_minutes" INTEGER,
    "exception_reason" TEXT,
    "slots_booked_at_booking" INTEGER,
    "snapshot_slot_duration_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_schedule_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "from_status" "booking_status",
    "to_status" "booking_status" NOT NULL,
    "changed_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "customer_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "booking_number" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "booking_status" "booking_status" DEFAULT 'pending',
    "delivery_address_id" UUID,
    "special_instructions" TEXT,
    "currency_code" TEXT DEFAULT 'EUR',
    "subtotal_amount" DECIMAL(10,2) NOT NULL,
    "service_fee_amount" DECIMAL(10,2) DEFAULT 0,
    "tip_amount" DECIMAL(10,2),
    "discount_amount" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "platform_fee_amount" DECIMAL(10,2) DEFAULT 0,
    "deposit_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deposit_status" TEXT NOT NULL DEFAULT 'none',
    "payment_method" "payment_method" DEFAULT 'cash',
    "payment_status" "payment_status" DEFAULT 'pending',
    "payment_reference" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_id" UUID,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "provider_id" UUID NOT NULL,
    "accepted_offer_id" UUID,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_by_profile_id" UUID NOT NULL,
    "community_name" TEXT NOT NULL,
    "community_description" TEXT,
    "community_image_url" TEXT,
    "access_type" "community_access_type" DEFAULT 'invite_only',
    "auto_approve_join_requests" BOOLEAN DEFAULT false,
    "allow_member_invites" BOOLEAN DEFAULT true,
    "address_id" UUID,
    "invite_link_token" TEXT,
    "invite_link_expires_at" TIMESTAMPTZ(6),
    "max_members" INTEGER DEFAULT 100,
    "current_members_count" INTEGER DEFAULT 0,
    "plan" TEXT DEFAULT 'free',
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_invitations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "community_id" UUID NOT NULL,
    "invited_by_profile_id" UUID NOT NULL,
    "invited_profile_id" UUID,
    "invited_email" TEXT,
    "invitation_token" TEXT NOT NULL,
    "invitation_message" TEXT,
    "invitation_status" "invitation_status" DEFAULT 'pending',
    "max_uses" INTEGER DEFAULT 1,
    "current_uses" INTEGER DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "declined_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "community_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "join_method" "join_method" NOT NULL,
    "invited_by_profile_id" UUID,
    "approved_by_profile_id" UUID,
    "membership_status" "membership_status" DEFAULT 'pending',
    "member_role" "member_role" DEFAULT 'member',
    "can_post_offerings" BOOLEAN DEFAULT false,
    "can_invite_members" BOOLEAN DEFAULT false,
    "admin_notes" TEXT,
    "removal_reason" TEXT,
    "removed_by_profile_id" UUID,
    "join_requested_at" TIMESTAMPTZ(6),
    "membership_approved_at" TIMESTAMPTZ(6),
    "membership_removed_at" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_pinned_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "community_id" UUID NOT NULL,
    "pinned_offering_id" UUID,
    "pinned_post_id" UUID,
    "pinned_by_profile_id" UUID NOT NULL,
    "pinned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_pinned_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "community_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "link_url" TEXT,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(6),
    "is_muted" BOOLEAN DEFAULT false,
    "muted_until" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "removed_by_id" UUID,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","profile_id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_type" "conversation_type" NOT NULL,
    "created_by_profile_id" UUID,
    "community_id" UUID,
    "booking_id" UUID,
    "title" TEXT,
    "last_message_at" TIMESTAMPTZ(6),
    "last_message_preview" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "message_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "file_name" TEXT,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) DEFAULT (now() + interval '72 hours'),

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT,
    "message_type" "message_type" NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "reply_to_message_id" UUID,
    "has_attachments" BOOLEAN DEFAULT false,
    "is_edited" BOOLEAN DEFAULT false,
    "edited_at" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_offers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "offered_by" UUID NOT NULL,
    "offered_amount" DECIMAL(10,2) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'EUR',
    "note" TEXT,
    "offer_status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '24:00:00'::interval),
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "profile_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data_json" JSONB,
    "related_booking_id" UUID,
    "related_offering_id" UUID,
    "related_community_id" UUID,
    "is_read" BOOLEAN DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "offering_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "display_order" INTEGER DEFAULT 0,
    "is_primary" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "provider_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "category" "offering_category" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_amount" DECIMAL(10,2),
    "currency_code" TEXT DEFAULT 'EUR',
    "price_type" "price_type" DEFAULT 'fixed',
    "fulfillment_method" "fulfillment_method" DEFAULT 'pickup',
    "is_delivery_available" BOOLEAN DEFAULT false,
    "delivery_radius_km" DECIMAL(5,2),
    "delivery_fee_amount" DECIMAL(10,2) DEFAULT 0,
    "pickup_address_id" UUID,
    "is_featured" BOOLEAN DEFAULT false,
    "version" INTEGER DEFAULT 1,
    "status" TEXT DEFAULT 'active',
    "transaction_type" "transaction_type" NOT NULL DEFAULT 'purchase',
    "requires_deposit" BOOLEAN NOT NULL DEFAULT false,
    "deposit_amount" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "auth_user_id" UUID NOT NULL,
    "display_name" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "preferred_language" TEXT DEFAULT 'de',
    "subscription_type" TEXT DEFAULT 'free',
    "subscription_expires_at" TIMESTAMPTZ(6),
    "is_verified" BOOLEAN DEFAULT false,
    "business_type" TEXT,
    "verification_documents_json" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "is_email_verified" BOOLEAN DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "profile_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "device_type" TEXT,
    "device_name" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "community_id" UUID,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "is_visible" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "schedule_id" UUID NOT NULL,
    "exception_date" DATE NOT NULL,
    "is_cancelled" BOOLEAN DEFAULT false,
    "cancellation_reason" TEXT,
    "override_start_time" TIME(6),
    "override_end_time" TIME(6),
    "override_slots" INTEGER,
    "override_loan_duration_days" INTEGER,
    "override_loan_max_duration_days" INTEGER,
    "override_slot_duration_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_instances" (
    "schedule_id" UUID NOT NULL,
    "instance_date" DATE NOT NULL,
    "slot_start_time" TIME(6) NOT NULL DEFAULT '00:00:00'::time without time zone,
    "slots_booked" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_instances_pkey" PRIMARY KEY ("schedule_id","instance_date","slot_start_time")
);

-- CreateTable
CREATE TABLE "snapshot_addresses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "original_address_id" UUID,
    "street_name" TEXT,
    "street_number" TEXT,
    "apartment_unit" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshot_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_addresses_one_default_per_profile" ON "addresses"("profile_id") WHERE ((is_default = true) AND (deleted_at IS NULL));

-- CreateIndex
CREATE INDEX "idx_addresses_deleted_at" ON "addresses"("deleted_at") WHERE (deleted_at IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_addresses_location" ON "addresses" USING GIST ("location");

-- CreateIndex
CREATE INDEX "idx_addresses_offering_pickup" ON "addresses"("id") WHERE ((visibility = 'offering_pickup'::text) AND (is_active = true) AND (deleted_at IS NULL));

-- CreateIndex
CREATE INDEX "idx_addresses_profile_default" ON "addresses"("profile_id", "is_default") WHERE (is_default = true);

-- CreateIndex
CREATE INDEX "idx_addresses_profile_id" ON "addresses"("profile_id");

-- CreateIndex
CREATE INDEX "idx_availability_schedules_date_range" ON "availability_schedules"("offering_id", "dtstart", "dtend") WHERE (is_active = true);

-- CreateIndex
CREATE INDEX "idx_availability_schedules_offering" ON "availability_schedules"("offering_id") WHERE (is_active = true);

-- CreateIndex
CREATE UNIQUE INDEX "booking_community_snapshots_booking_id_key" ON "booking_community_snapshots"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_customer_snapshots_booking_id_key" ON "booking_customer_snapshots"("booking_id");

-- CreateIndex
CREATE INDEX "idx_booking_customer_snapshots_customer" ON "booking_customer_snapshots"("original_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_delivery_snapshots_booking_id_key" ON "booking_delivery_snapshots"("booking_id");

-- CreateIndex
CREATE INDEX "idx_booking_items_booking" ON "booking_items"("booking_id");

-- CreateIndex
CREATE INDEX "idx_booking_items_offering" ON "booking_items"("offering_id");

-- CreateIndex
CREATE INDEX "idx_booking_items_schedule_instance" ON "booking_items"("schedule_id", "instance_date") WHERE (schedule_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "booking_provider_snapshots_booking_item_id_key" ON "booking_provider_snapshots"("booking_item_id");

-- CreateIndex
CREATE INDEX "idx_booking_provider_snapshots_provider" ON "booking_provider_snapshots"("original_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_schedule_snapshots_booking_item_id_key" ON "booking_schedule_snapshots"("booking_item_id");

-- CreateIndex
CREATE INDEX "idx_booking_status_history_booking" ON "booking_status_history"("booking_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_booking_status_history_changed_by" ON "booking_status_history"("changed_by_id") WHERE (changed_by_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotency_key_key" ON "bookings"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_bookings_cancelled_by" ON "bookings"("cancelled_by_id") WHERE (cancelled_by_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_bookings_community" ON "bookings"("community_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_bookings_community_status" ON "bookings"("community_id", "booking_status");

-- CreateIndex
CREATE INDEX "idx_bookings_customer" ON "bookings"("customer_id", "booking_status");

-- CreateIndex
CREATE INDEX "idx_bookings_delivery_address" ON "bookings"("delivery_address_id") WHERE (delivery_address_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_bookings_number" ON "bookings"("booking_number");

-- CreateIndex
CREATE INDEX "idx_bookings_payment_status" ON "bookings"("payment_status") WHERE (payment_status = 'pending'::payment_status);

-- CreateIndex
CREATE INDEX "idx_bookings_provider" ON "bookings"("provider_id", "booking_status");

-- CreateIndex
CREATE INDEX "idx_bookings_status" ON "bookings"("booking_status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "communities_invite_link_token_key" ON "communities"("invite_link_token");

-- CreateIndex
CREATE INDEX "idx_communities_access_type" ON "communities"("access_type") WHERE (is_active = true);

-- CreateIndex
CREATE INDEX "idx_communities_address" ON "communities"("address_id") WHERE (address_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_communities_created_by" ON "communities"("created_by_profile_id");

-- CreateIndex
CREATE INDEX "idx_communities_deleted_at" ON "communities"("deleted_at") WHERE (deleted_at IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_communities_is_active" ON "communities"("is_active") WHERE (is_active = true);

-- CreateIndex
CREATE UNIQUE INDEX "community_invitations_invitation_token_key" ON "community_invitations"("invitation_token");

-- CreateIndex
CREATE INDEX "idx_community_invitations_community" ON "community_invitations"("community_id");

-- CreateIndex
CREATE INDEX "idx_community_invitations_email" ON "community_invitations"("invited_email") WHERE ((invited_email IS NOT NULL) AND (invitation_status = 'pending'::invitation_status));

-- CreateIndex
CREATE INDEX "idx_community_invitations_expires" ON "community_invitations"("expires_at") WHERE (invitation_status = 'pending'::invitation_status);

-- CreateIndex
CREATE INDEX "idx_community_invitations_invited_profile" ON "community_invitations"("invited_profile_id") WHERE (invited_profile_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_community_invitations_token" ON "community_invitations"("invitation_token") WHERE (invitation_status = 'pending'::invitation_status);

-- CreateIndex
CREATE INDEX "idx_community_members_community" ON "community_members"("community_id", "membership_status");

-- CreateIndex
CREATE INDEX "idx_community_members_invited_by" ON "community_members"("invited_by_profile_id") WHERE (invited_by_profile_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_community_members_last_activity" ON "community_members"("last_activity_at" DESC) WHERE (membership_status = 'active'::membership_status);

-- CreateIndex
CREATE INDEX "idx_community_members_profile" ON "community_members"("profile_id", "membership_status");

-- CreateIndex
CREATE INDEX "idx_community_members_role" ON "community_members"("community_id", "member_role") WHERE (membership_status = 'active'::membership_status);

-- CreateIndex
CREATE UNIQUE INDEX "community_members_community_id_profile_id_key" ON "community_members"("community_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_pin_per_community" ON "community_pinned_items"("community_id");

-- CreateIndex
CREATE INDEX "idx_community_posts_community" ON "community_posts"("community_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_conversation_participants_active" ON "conversation_participants"("conversation_id") WHERE ((left_at IS NULL) AND (removed_at IS NULL));

-- CreateIndex
CREATE INDEX "idx_conversation_participants_profile" ON "conversation_participants"("profile_id");

-- CreateIndex
CREATE INDEX "idx_conversations_booking" ON "conversations"("booking_id") WHERE (booking_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_conversations_community" ON "conversations"("community_id") WHERE (community_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_conversations_created_by" ON "conversations"("created_by_profile_id") WHERE (created_by_profile_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_conversations_type_recent" ON "conversations"("conversation_type", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "idx_message_attachments_message" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "idx_message_attachments_expires_at" ON "message_attachments"("expires_at");

-- CreateIndex
CREATE INDEX "idx_messages_conversation" ON "messages"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_messages_expires" ON "messages"("expires_at") WHERE (expires_at IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_messages_reply_to" ON "messages"("reply_to_message_id") WHERE (reply_to_message_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_messages_sender" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "idx_price_offers_booking" ON "price_offers"("booking_id");

-- CreateIndex
CREATE INDEX "idx_price_offers_pending" ON "price_offers"("booking_id") WHERE (offer_status = 'pending');

-- CreateIndex
CREATE INDEX "idx_price_offers_message" ON "price_offers"("message_id");

-- CreateIndex
CREATE INDEX "idx_notifications_profile" ON "notifications"("profile_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_profile_unread" ON "notifications"("profile_id", "created_at" DESC) WHERE (is_read = false);

-- CreateIndex
CREATE INDEX "idx_notifications_type" ON "notifications"("notification_type");

-- CreateIndex
CREATE UNIQUE INDEX "idx_offering_images_one_primary_per_offering" ON "offering_images"("offering_id") WHERE (is_primary = true);

-- CreateIndex
CREATE INDEX "idx_offering_images_offering" ON "offering_images"("offering_id");

-- CreateIndex
CREATE INDEX "idx_offering_images_primary" ON "offering_images"("offering_id", "is_primary") WHERE (is_primary = true);

-- CreateIndex
CREATE INDEX "idx_offerings_category" ON "offerings"("category") WHERE (status = 'active'::text);

-- CreateIndex
CREATE INDEX "idx_offerings_community" ON "offerings"("community_id", "status");

-- CreateIndex
CREATE INDEX "idx_offerings_community_category" ON "offerings"("community_id", "category", "status");

-- CreateIndex
CREATE INDEX "idx_offerings_deleted_at" ON "offerings"("deleted_at") WHERE (deleted_at IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_offerings_featured" ON "offerings"("community_id", "is_featured") WHERE ((status = 'active'::text) AND (is_featured = true));

-- CreateIndex
CREATE INDEX "idx_offerings_pickup_address" ON "offerings"("pickup_address_id") WHERE (pickup_address_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_offerings_provider" ON "offerings"("provider_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_auth_user_id" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_deleted_at" ON "profiles"("deleted_at") WHERE (deleted_at IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_profiles_is_verified" ON "profiles"("is_verified") WHERE (is_verified = true);

-- CreateIndex
CREATE INDEX "idx_profiles_last_login" ON "profiles"("last_login_at" DESC) WHERE (last_login_at IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_push_tokens_token" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_push_tokens_active" ON "push_tokens"("profile_id") WHERE (is_active = true);

-- CreateIndex
CREATE INDEX "idx_push_tokens_profile_id" ON "push_tokens"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "idx_reviews_community" ON "reviews"("community_id", "is_visible") WHERE (is_visible = true);

-- CreateIndex
CREATE INDEX "idx_reviews_community_rating" ON "reviews"("community_id", "rating") WHERE (is_visible = true);

-- CreateIndex
CREATE INDEX "idx_reviews_created" ON "reviews"("created_at" DESC) WHERE (is_visible = true);

-- CreateIndex
CREATE INDEX "idx_reviews_reviewer" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "idx_schedule_exceptions_date" ON "schedule_exceptions"("exception_date");

-- CreateIndex
CREATE INDEX "idx_schedule_exceptions_schedule" ON "schedule_exceptions"("schedule_id");

-- CreateIndex
CREATE INDEX "idx_schedule_exceptions_schedule_date" ON "schedule_exceptions"("schedule_id", "exception_date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exceptions_schedule_id_exception_date_key" ON "schedule_exceptions"("schedule_id", "exception_date");

-- CreateIndex
CREATE INDEX "idx_schedule_instances_date" ON "schedule_instances"("instance_date");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_community_snapshots" ADD CONSTRAINT "booking_community_snapshots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_community_snapshots" ADD CONSTRAINT "booking_community_snapshots_original_community_id_fkey" FOREIGN KEY ("original_community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_customer_snapshots" ADD CONSTRAINT "booking_customer_snapshots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_customer_snapshots" ADD CONSTRAINT "booking_customer_snapshots_original_customer_id_fkey" FOREIGN KEY ("original_customer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_delivery_snapshots" ADD CONSTRAINT "booking_delivery_snapshots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_delivery_snapshots" ADD CONSTRAINT "booking_delivery_snapshots_snapshot_address_id_fkey" FOREIGN KEY ("snapshot_address_id") REFERENCES "snapshot_addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "availability_schedules"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_provider_snapshots" ADD CONSTRAINT "booking_provider_snapshots_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_provider_snapshots" ADD CONSTRAINT "booking_provider_snapshots_original_provider_id_fkey" FOREIGN KEY ("original_provider_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_provider_snapshots" ADD CONSTRAINT "booking_provider_snapshots_snapshot_address_id_fkey" FOREIGN KEY ("snapshot_address_id") REFERENCES "snapshot_addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_schedule_snapshots" ADD CONSTRAINT "booking_schedule_snapshots_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_schedule_snapshots" ADD CONSTRAINT "booking_schedule_snapshots_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "schedule_exceptions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_schedule_snapshots" ADD CONSTRAINT "booking_schedule_snapshots_original_schedule_id_fkey" FOREIGN KEY ("original_schedule_id") REFERENCES "availability_schedules"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_accepted_offer_id_fkey" FOREIGN KEY ("accepted_offer_id") REFERENCES "price_offers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_invited_profile_id_fkey" FOREIGN KEY ("invited_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_approved_by_profile_id_fkey" FOREIGN KEY ("approved_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_removed_by_profile_id_fkey" FOREIGN KEY ("removed_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_pinned_items" ADD CONSTRAINT "community_pinned_items_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_pinned_items" ADD CONSTRAINT "community_pinned_items_pinned_by_profile_id_fkey" FOREIGN KEY ("pinned_by_profile_id") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_pinned_items" ADD CONSTRAINT "community_pinned_items_pinned_offering_id_fkey" FOREIGN KEY ("pinned_offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_pinned_items" ADD CONSTRAINT "community_pinned_items_pinned_post_id_fkey" FOREIGN KEY ("pinned_post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_offered_by_fkey" FOREIGN KEY ("offered_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_booking_id_fkey" FOREIGN KEY ("related_booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_community_id_fkey" FOREIGN KEY ("related_community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_offering_id_fkey" FOREIGN KEY ("related_offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offering_images" ADD CONSTRAINT "offering_images_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_pickup_address_id_fkey" FOREIGN KEY ("pickup_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "availability_schedules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_instances" ADD CONSTRAINT "schedule_instances_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "availability_schedules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "snapshot_addresses" ADD CONSTRAINT "snapshot_addresses_original_address_id_fkey" FOREIGN KEY ("original_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

