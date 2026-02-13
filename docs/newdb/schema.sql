-- ==========================================
-- Community Platform Database Schema
-- "Dein Dorf in der Stadt"
-- PostgreSQL / Supabase
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE address_type AS ENUM ('home', 'work', 'other');

CREATE TYPE community_access_type AS ENUM ('open', 'request_to_join', 'invite_only');

CREATE TYPE membership_status AS ENUM ('pending', 'active', 'removed', 'left');

CREATE TYPE member_role AS ENUM ('owner', 'admin', 'moderator', 'member');

CREATE TYPE join_method AS ENUM ('invite_link', 'direct_invite', 'request');

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TYPE offering_category AS ENUM ('food', 'product', 'service', 'share', 'event');

CREATE TYPE price_type AS ENUM ('fixed', 'negotiable', 'free', 'donation');

CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'in_progress',
  'ready',
  'completed',
  'cancelled',
  'refunded'
);

CREATE TYPE fulfillment_method AS ENUM ('pickup', 'delivery', 'online', 'at_location');

CREATE TYPE payment_method AS ENUM ('in_app', 'cash', 'external');

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'cancelled');

CREATE TYPE conversation_type AS ENUM ('direct', 'community', 'booking');

-- ==========================================
-- PROFILES (References Supabase auth.users)
-- ==========================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  bio TEXT,

  -- Contact
  phone TEXT,
  email TEXT,

  -- Preferences
  preferred_language TEXT DEFAULT 'de',

  -- Subscription
  subscription_type TEXT DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium')),
  subscription_expires_at TIMESTAMPTZ,

  -- Verification (for providers)
  is_verified BOOLEAN DEFAULT FALSE,
  business_type TEXT CHECK (business_type IN ('individual', 'registered_business')),
  verification_documents_json JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for profiles
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_profiles_is_verified ON profiles(is_verified) WHERE is_verified = TRUE;

-- ==========================================
-- ADDRESSES
-- ==========================================

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Type & Label
  address_type address_type DEFAULT 'home',
  label TEXT,

  -- Address Details
  street_name TEXT NOT NULL,
  street_number TEXT,
  apartment_unit TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'Germany',

  -- Geolocation
  latitude DECIMAL(10, 8) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DECIMAL(11, 8) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location GEOGRAPHY(POINT, 4326),

  -- Instructions
  delivery_instructions TEXT,

  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Visibility: controls who can see this address
  -- 'private': only owner can see (default)
  -- 'offering_pickup': can be used for offerings, approximate location shown to community members
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'offering_pickup')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for addresses
CREATE INDEX idx_addresses_location ON addresses USING GIST(location);
CREATE INDEX idx_addresses_profile_id ON addresses(profile_id);
CREATE INDEX idx_addresses_profile_default ON addresses(profile_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_addresses_deleted_at ON addresses(deleted_at) WHERE deleted_at IS NOT NULL;

-- Unique partial index: only one default address per profile
CREATE UNIQUE INDEX idx_addresses_one_default_per_profile
  ON addresses(profile_id) WHERE is_default = TRUE AND deleted_at IS NULL;

-- Index for offering pickup addresses
CREATE INDEX idx_addresses_offering_pickup ON addresses(id)
  WHERE visibility = 'offering_pickup' AND is_active = TRUE AND deleted_at IS NULL;

-- ==========================================
-- COMMUNITIES
-- ==========================================

CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Creator
  created_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Basics
  community_name TEXT NOT NULL,
  community_description TEXT,
  community_image_url TEXT,

  -- Type & Access
  access_type community_access_type DEFAULT 'invite_only',
  auto_approve_join_requests BOOLEAN DEFAULT FALSE,
  allow_member_invites BOOLEAN DEFAULT TRUE,

  -- Location (optional)
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,

  -- Invite Link
  invite_link_token TEXT UNIQUE,
  invite_link_expires_at TIMESTAMPTZ,

  -- Limits
  max_members INT DEFAULT 100 CHECK (max_members > 0),
  current_members_count INT DEFAULT 0 CHECK (current_members_count >= 0),

  -- Subscription
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraint: member count cannot exceed max
  CONSTRAINT valid_member_count CHECK (current_members_count <= max_members)
);

-- Indexes for communities
CREATE INDEX idx_communities_created_by ON communities(created_by_profile_id);
CREATE INDEX idx_communities_access_type ON communities(access_type) WHERE is_active = TRUE;
CREATE INDEX idx_communities_address ON communities(address_id) WHERE address_id IS NOT NULL;
CREATE INDEX idx_communities_deleted_at ON communities(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_communities_is_active ON communities(is_active) WHERE is_active = TRUE;

-- ==========================================
-- COMMUNITY MEMBERS
-- ==========================================

CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- How they joined
  join_method join_method NOT NULL,
  invited_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Status & Role
  membership_status membership_status DEFAULT 'pending',
  member_role member_role DEFAULT 'member',

  -- Permission overrides
  can_post_offerings BOOLEAN DEFAULT FALSE,
  can_invite_members BOOLEAN DEFAULT FALSE,

  -- Notes
  admin_notes TEXT,
  removal_reason TEXT,
  removed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timestamps
  join_requested_at TIMESTAMPTZ,
  membership_approved_at TIMESTAMPTZ,
  membership_removed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(community_id, profile_id)
);

-- Indexes for community_members
CREATE INDEX idx_community_members_community ON community_members(community_id, membership_status);
CREATE INDEX idx_community_members_profile ON community_members(profile_id, membership_status);
CREATE INDEX idx_community_members_role ON community_members(community_id, member_role) WHERE membership_status = 'active';
CREATE INDEX idx_community_members_invited_by ON community_members(invited_by_profile_id) WHERE invited_by_profile_id IS NOT NULL;
CREATE INDEX idx_community_members_last_activity ON community_members(last_activity_at DESC) WHERE membership_status = 'active';

-- ==========================================
-- COMMUNITY INVITATIONS
-- ==========================================

CREATE TABLE community_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  invited_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Invitee (at least one required)
  invited_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_email TEXT,

  -- Invitation Details
  invitation_token TEXT UNIQUE NOT NULL,
  invitation_message TEXT,
  invitation_status invitation_status DEFAULT 'pending',

  -- Limits
  max_uses INT DEFAULT 1 CHECK (max_uses > 0),
  current_uses INT DEFAULT 0 CHECK (current_uses >= 0),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Response
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT invitee_required CHECK (invited_profile_id IS NOT NULL OR invited_email IS NOT NULL),
  CONSTRAINT uses_within_limit CHECK (current_uses <= max_uses)
);

-- Indexes for community_invitations
CREATE INDEX idx_community_invitations_token ON community_invitations(invitation_token) WHERE invitation_status = 'pending';
CREATE INDEX idx_community_invitations_community ON community_invitations(community_id);
CREATE INDEX idx_community_invitations_invited_profile ON community_invitations(invited_profile_id) WHERE invited_profile_id IS NOT NULL;
CREATE INDEX idx_community_invitations_expires ON community_invitations(expires_at) WHERE invitation_status = 'pending';
CREATE INDEX idx_community_invitations_email ON community_invitations(invited_email) WHERE invited_email IS NOT NULL AND invitation_status = 'pending';

-- ==========================================
-- OFFERINGS
-- ==========================================

CREATE TABLE offerings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Category
  category offering_category NOT NULL,

  -- Basics
  title TEXT NOT NULL CHECK (LENGTH(title) >= 3),
  description TEXT,

  -- Pricing
  price_amount DECIMAL(10, 2) CHECK (price_amount >= 0),
  currency_code TEXT DEFAULT 'EUR',
  price_type price_type DEFAULT 'fixed',

  -- Fulfillment & Delivery
  fulfillment_method fulfillment_method DEFAULT 'pickup',
  is_delivery_available BOOLEAN DEFAULT FALSE,
  delivery_radius_km DECIMAL(5, 2) CHECK (delivery_radius_km IS NULL OR delivery_radius_km > 0),
  delivery_fee_amount DECIMAL(10, 2) DEFAULT 0 CHECK (delivery_fee_amount >= 0),
  pickup_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,

  -- Status Flags
  is_featured BOOLEAN DEFAULT FALSE,

  -- Version for optimistic locking
  version INT DEFAULT 1 CHECK (version > 0),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraint: delivery fee only if delivery available
  CONSTRAINT delivery_fee_requires_delivery CHECK (
    delivery_fee_amount = 0 OR is_delivery_available = TRUE
  ),
  -- Constraint: price required for fixed/negotiable
  CONSTRAINT price_required_for_paid CHECK (
    price_type IN ('free', 'donation') OR price_amount IS NOT NULL
  )
);

-- Indexes for offerings
CREATE INDEX idx_offerings_community ON offerings(community_id, status);
CREATE INDEX idx_offerings_provider ON offerings(provider_id, status);
CREATE INDEX idx_offerings_category ON offerings(category) WHERE status = 'active';
CREATE INDEX idx_offerings_community_category ON offerings(community_id, category, status);
CREATE INDEX idx_offerings_featured ON offerings(community_id, is_featured) WHERE status = 'active' AND is_featured = TRUE;
CREATE INDEX idx_offerings_pickup_address ON offerings(pickup_address_id) WHERE pickup_address_id IS NOT NULL;
CREATE INDEX idx_offerings_deleted_at ON offerings(deleted_at) WHERE deleted_at IS NOT NULL;

-- ==========================================
-- OFFERING IMAGES
-- ==========================================

CREATE TABLE offering_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offering_id UUID NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,

  image_url TEXT NOT NULL,
  display_order INT DEFAULT 0 CHECK (display_order >= 0),
  is_primary BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for offering_images
CREATE INDEX idx_offering_images_offering ON offering_images(offering_id);
CREATE INDEX idx_offering_images_primary ON offering_images(offering_id, is_primary) WHERE is_primary = TRUE;

-- Unique partial index: only one primary image per offering
CREATE UNIQUE INDEX idx_offering_images_one_primary_per_offering
  ON offering_images(offering_id) WHERE is_primary = TRUE;

-- ==========================================
-- AVAILABILITY SCHEDULE SYSTEM
-- ==========================================

CREATE TABLE availability_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Offering relation
  offering_id UUID NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,

  -- RRULE components
  dtstart DATE NOT NULL,
  dtend DATE,
  rrule TEXT NOT NULL,

  -- Time window
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Capacity
  slots_available INT NOT NULL DEFAULT 10 CHECK (slots_available > 0),
  slot_unit TEXT,
  slot_label TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_date_range CHECK (dtend IS NULL OR dtend >= dtstart)
);

-- Indexes for availability_schedules
CREATE INDEX idx_availability_schedules_offering ON availability_schedules(offering_id) WHERE is_active = TRUE;
CREATE INDEX idx_availability_schedules_date_range ON availability_schedules(offering_id, dtstart, dtend) WHERE is_active = TRUE;

-- ==========================================
-- SCHEDULE EXCEPTIONS
-- ==========================================

CREATE TABLE schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  schedule_id UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,

  -- Which date
  exception_date DATE NOT NULL,

  -- Cancellation
  is_cancelled BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,

  -- Override values
  override_start_time TIME,
  override_end_time TIME,
  override_slots INT CHECK (override_slots IS NULL OR override_slots >= 0),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(schedule_id, exception_date),

  -- Constraints
  CONSTRAINT valid_override_time_range CHECK (
    override_start_time IS NULL OR override_end_time IS NULL
    OR override_end_time > override_start_time
  )
);

-- Indexes for schedule_exceptions
CREATE INDEX idx_schedule_exceptions_schedule ON schedule_exceptions(schedule_id);
CREATE INDEX idx_schedule_exceptions_date ON schedule_exceptions(exception_date);
CREATE INDEX idx_schedule_exceptions_schedule_date ON schedule_exceptions(schedule_id, exception_date);

-- ==========================================
-- SCHEDULE INSTANCES
-- ==========================================

CREATE TABLE schedule_instances (
  -- Composite PK
  schedule_id UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,
  instance_date DATE NOT NULL,

  -- Booking count
  slots_booked INT DEFAULT 0 CHECK (slots_booked >= 0),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (schedule_id, instance_date)
);

-- Index for date lookups
CREATE INDEX idx_schedule_instances_date ON schedule_instances(instance_date);

-- ==========================================
-- BOOKINGS
-- ==========================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Reference
  booking_number TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE,

  -- Status
  booking_status booking_status DEFAULT 'pending',

  -- Delivery
  delivery_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  special_instructions TEXT,

  -- Pricing
  currency_code TEXT DEFAULT 'EUR',
  subtotal_amount DECIMAL(10, 2) NOT NULL CHECK (subtotal_amount >= 0),
  service_fee_amount DECIMAL(10, 2) DEFAULT 0 CHECK (service_fee_amount >= 0),
  tip_amount DECIMAL(10, 2) CHECK (tip_amount IS NULL OR tip_amount >= 0),
  discount_amount DECIMAL(10, 2) CHECK (discount_amount IS NULL OR discount_amount >= 0),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),

  -- Platform Fees
  platform_fee_amount DECIMAL(10, 2) DEFAULT 0 CHECK (platform_fee_amount >= 0),

  -- Payment
  payment_method payment_method DEFAULT 'cash',
  payment_status payment_status DEFAULT 'pending',
  payment_reference TEXT,

  -- Timeline
  confirmed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancellation_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: cancellation requires cancelled status
  CONSTRAINT cancellation_consistency CHECK (
    (booking_status = 'cancelled' AND cancelled_at IS NOT NULL) OR
    (booking_status != 'cancelled' AND cancelled_at IS NULL)
  )
);

-- Indexes for bookings
CREATE INDEX idx_bookings_customer ON bookings(customer_id, booking_status);
CREATE INDEX idx_bookings_community ON bookings(community_id, created_at DESC);
CREATE INDEX idx_bookings_status ON bookings(booking_status, created_at DESC);
CREATE INDEX idx_bookings_community_status ON bookings(community_id, booking_status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status) WHERE payment_status = 'pending';
CREATE INDEX idx_bookings_delivery_address ON bookings(delivery_address_id) WHERE delivery_address_id IS NOT NULL;
CREATE INDEX idx_bookings_cancelled_by ON bookings(cancelled_by_id) WHERE cancelled_by_id IS NOT NULL;
CREATE INDEX idx_bookings_number ON bookings(booking_number);

-- ==========================================
-- BOOKING ITEMS
-- ==========================================

CREATE TABLE booking_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES offerings(id) ON DELETE RESTRICT,
  schedule_id UUID REFERENCES availability_schedules(id) ON DELETE SET NULL,
  instance_date DATE,

  -- Fulfillment
  fulfillment_method fulfillment_method NOT NULL,
  delivery_fee_amount DECIMAL(10, 2) DEFAULT 0 CHECK (delivery_fee_amount >= 0),

  -- Quantity & Pricing
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_amount DECIMAL(10, 2) NOT NULL CHECK (unit_price_amount >= 0),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  currency_code TEXT DEFAULT 'EUR',

  -- Version for conflict detection
  offering_version INT NOT NULL CHECK (offering_version > 0),

  -- Snapshot of offering at booking time
  snapshot_title TEXT NOT NULL,
  snapshot_description TEXT,
  snapshot_image_url TEXT,
  snapshot_category offering_category NOT NULL,

  -- Special requests
  special_instructions TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: schedule_id and instance_date must be both set or both null
  CONSTRAINT schedule_instance_consistency CHECK (
    (schedule_id IS NULL AND instance_date IS NULL) OR
    (schedule_id IS NOT NULL AND instance_date IS NOT NULL)
  )
);

-- Indexes for booking_items
CREATE INDEX idx_booking_items_booking ON booking_items(booking_id);
CREATE INDEX idx_booking_items_offering ON booking_items(offering_id);
CREATE INDEX idx_booking_items_schedule_instance ON booking_items(schedule_id, instance_date) WHERE schedule_id IS NOT NULL;

-- ==========================================
-- BOOKING SNAPSHOTS
-- ==========================================

CREATE TABLE snapshot_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Original reference
  original_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,

  -- Address fields
  street_name TEXT,
  street_number TEXT,
  apartment_unit TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  latitude DECIMAL(10, 8) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DECIMAL(11, 8) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  instructions TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE booking_provider_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Per booking_item
  booking_item_id UUID UNIQUE NOT NULL REFERENCES booking_items(id) ON DELETE CASCADE,
  original_provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Snapshot (from profile)
  snapshot_display_name TEXT NOT NULL,
  snapshot_avatar_url TEXT,
  snapshot_email TEXT,
  snapshot_phone TEXT,

  -- Snapshot (from offering's pickup address)
  snapshot_address_id UUID REFERENCES snapshot_addresses(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for provider lookups
CREATE INDEX idx_booking_provider_snapshots_provider ON booking_provider_snapshots(original_provider_id);

CREATE TABLE booking_customer_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  original_customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Snapshot
  snapshot_display_name TEXT,
  snapshot_first_name TEXT,
  snapshot_last_name TEXT,
  snapshot_email TEXT,
  snapshot_phone TEXT,
  snapshot_avatar_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for customer lookups
CREATE INDEX idx_booking_customer_snapshots_customer ON booking_customer_snapshots(original_customer_id);

CREATE TABLE booking_delivery_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  snapshot_address_id UUID REFERENCES snapshot_addresses(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE booking_schedule_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_item_id UUID UNIQUE NOT NULL REFERENCES booking_items(id) ON DELETE CASCADE,
  original_schedule_id UUID REFERENCES availability_schedules(id) ON DELETE SET NULL,

  -- Schedule snapshot
  snapshot_dtstart DATE NOT NULL,
  snapshot_dtend DATE,
  snapshot_rrule TEXT NOT NULL,
  snapshot_start_time TIME NOT NULL,
  snapshot_end_time TIME NOT NULL,
  snapshot_slots_available INT NOT NULL CHECK (snapshot_slots_available > 0),
  snapshot_slot_unit TEXT,
  snapshot_slot_label TEXT,

  -- Exception data
  had_exception BOOLEAN DEFAULT FALSE,
  exception_id UUID REFERENCES schedule_exceptions(id) ON DELETE SET NULL,
  exception_override_start_time TIME,
  exception_override_end_time TIME,
  exception_override_slots INT,
  exception_reason TEXT,

  -- Inventory state
  slots_booked_at_booking INT CHECK (slots_booked_at_booking >= 0),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE booking_community_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  original_community_id UUID REFERENCES communities(id) ON DELETE SET NULL,

  -- Community snapshot
  snapshot_community_name TEXT NOT NULL,
  snapshot_community_description TEXT,
  snapshot_community_image_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- BOOKING STATUS HISTORY
-- ==========================================

CREATE TABLE booking_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  from_status booking_status,
  to_status booking_status NOT NULL,

  changed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for booking_status_history
CREATE INDEX idx_booking_status_history_booking ON booking_status_history(booking_id, created_at DESC);
CREATE INDEX idx_booking_status_history_changed_by ON booking_status_history(changed_by_id) WHERE changed_by_id IS NOT NULL;

-- ==========================================
-- REVIEWS & RATINGS
-- ==========================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,

  -- Rating
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,

  -- Moderation
  is_visible BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reviews
CREATE INDEX idx_reviews_community ON reviews(community_id, is_visible) WHERE is_visible = TRUE;
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_community_rating ON reviews(community_id, rating) WHERE is_visible = TRUE;
CREATE INDEX idx_reviews_created ON reviews(created_at DESC) WHERE is_visible = TRUE;

-- ==========================================
-- NOTIFICATIONS
-- ==========================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Type
  notification_type TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  body TEXT,
  data_json JSONB,

  -- Related entities
  related_booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  related_offering_id UUID REFERENCES offerings(id) ON DELETE CASCADE,
  related_community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: read_at consistency
  CONSTRAINT read_at_consistency CHECK (
    (is_read = FALSE AND read_at IS NULL) OR
    (is_read = TRUE AND read_at IS NOT NULL)
  )
);

-- Indexes for notifications
CREATE INDEX idx_notifications_profile ON notifications(profile_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_profile_unread ON notifications(profile_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- ==========================================
-- MESSAGING
-- ==========================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_type conversation_type NOT NULL,

  -- Creator (for direct conversations)
  created_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- For community chats
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

  -- For booking threads
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,

  -- Metadata
  title TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: type-specific fields
  CONSTRAINT valid_conversation_refs CHECK (
    (conversation_type = 'community' AND community_id IS NOT NULL AND booking_id IS NULL) OR
    (conversation_type = 'booking' AND booking_id IS NOT NULL AND community_id IS NULL) OR
    (conversation_type = 'direct' AND community_id IS NULL AND booking_id IS NULL)
  )
);

-- Indexes for conversations
CREATE INDEX idx_conversations_community ON conversations(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_conversations_booking ON conversations(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_conversations_type_recent ON conversations(conversation_type, last_message_at DESC);
CREATE INDEX idx_conversations_created_by ON conversations(created_by_profile_id) WHERE created_by_profile_id IS NOT NULL;

-- ==========================================
-- CONVERSATION PARTICIPANTS
-- ==========================================

CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Per-user state
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMPTZ,

  -- Membership
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  PRIMARY KEY (conversation_id, profile_id),

  -- Constraint: can't be both left and removed
  CONSTRAINT left_or_removed CHECK (
    left_at IS NULL OR removed_at IS NULL
  )
);

-- Indexes for conversation_participants
CREATE INDEX idx_conversation_participants_profile ON conversation_participants(profile_id);
CREATE INDEX idx_conversation_participants_active ON conversation_participants(conversation_id)
  WHERE left_at IS NULL AND removed_at IS NULL;

-- ==========================================
-- MESSAGES
-- ==========================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Content
  content TEXT,

  -- Reply threading
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Attachments flag
  has_attachments BOOLEAN DEFAULT FALSE,

  -- Edit/Delete state
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Retention (GDPR compliance)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: edited_at only if is_edited
  CONSTRAINT edit_consistency CHECK (
    (is_edited = FALSE AND edited_at IS NULL) OR
    (is_edited = TRUE AND edited_at IS NOT NULL)
  ),
  -- Constraint: deleted_at only if is_deleted
  CONSTRAINT delete_consistency CHECK (
    (is_deleted = FALSE AND deleted_at IS NULL) OR
    (is_deleted = TRUE AND deleted_at IS NOT NULL)
  ),
  -- Constraint: must have content or attachments (unless deleted)
  CONSTRAINT content_required CHECK (
    is_deleted = TRUE OR content IS NOT NULL OR has_attachments = TRUE
  )
);

-- Indexes for messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_messages_reply_to ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- ==========================================
-- MESSAGE ATTACHMENTS
-- ==========================================

CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  file_url TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('image', 'video', 'document', 'audio')),
  file_name TEXT,
  file_size_bytes INT CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  mime_type TEXT,

  -- Image dimensions
  width INT CHECK (width IS NULL OR width > 0),
  height INT CHECK (height IS NULL OR height > 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: dimensions only for images/videos
  CONSTRAINT dimensions_for_media CHECK (
    (width IS NULL AND height IS NULL) OR
    file_type IN ('image', 'video')
  )
);

-- Indexes for message_attachments
CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);

-- ==========================================
-- TRIGGERS FOR updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_members_updated_at BEFORE UPDATE ON community_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_invitations_updated_at BEFORE UPDATE ON community_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offerings_updated_at BEFORE UPDATE ON offerings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_schedules_updated_at BEFORE UPDATE ON availability_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_exceptions_updated_at BEFORE UPDATE ON schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_instances_updated_at BEFORE UPDATE ON schedule_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ==========================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    -- Format: BK-YYYYMMDD-XXXX (random 4 chars)
    new_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_number = new_number) INTO exists_already;

    IF NOT exists_already THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE communities
    SET current_members_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = NEW.community_id
      AND membership_status = 'active'
    )
    WHERE id = NEW.community_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE communities
    SET current_members_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = COALESCE(OLD.community_id, NEW.community_id)
      AND membership_status = 'active'
    )
    WHERE id = COALESCE(OLD.community_id, NEW.community_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_member_count_on_change
  AFTER INSERT OR UPDATE OR DELETE ON community_members
  FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Function to auto-populate location from lat/long
CREATE OR REPLACE FUNCTION update_address_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_address_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_address_location();

-- Function to increment offering version on update
CREATE OR REPLACE FUNCTION increment_offering_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_offering_version_on_update
  BEFORE UPDATE ON offerings
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION increment_offering_version();

-- Function to auto-add creator as owner when community is created
CREATE OR REPLACE FUNCTION add_community_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_members (
    community_id,
    profile_id,
    join_method,
    membership_status,
    member_role,
    can_post_offerings,
    can_invite_members,
    membership_approved_at
  ) VALUES (
    NEW.id,
    NEW.created_by_profile_id,
    'direct_invite',
    'active',
    'owner',
    TRUE,
    TRUE,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER add_creator_as_owner_on_community_create
  AFTER INSERT ON communities
  FOR EACH ROW EXECUTE FUNCTION add_community_creator_as_owner();

-- Function to validate booking doesn't include provider's own offerings
CREATE OR REPLACE FUNCTION validate_booking_not_own_offering()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM offerings o
    JOIN bookings b ON b.id = NEW.booking_id
    WHERE o.id = NEW.offering_id
    AND o.provider_id = b.customer_id
  ) THEN
    RAISE EXCEPTION 'Cannot book your own offering';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_booking_own_offering
  BEFORE INSERT ON booking_items
  FOR EACH ROW EXECUTE FUNCTION validate_booking_not_own_offering();

-- Function to set message expiration based on conversation type
CREATE OR REPLACE FUNCTION set_message_expiration()
RETURNS TRIGGER AS $$
DECLARE
  conv_type conversation_type;
BEGIN
  SELECT conversation_type INTO conv_type
  FROM conversations WHERE id = NEW.conversation_id;

  NEW.expires_at := CASE conv_type
    WHEN 'direct' THEN NOW() + INTERVAL '90 days'
    WHEN 'community' THEN NOW() + INTERVAL '1 year'
    WHEN 'booking' THEN NOW() + INTERVAL '7 years'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_message_expiration_on_insert
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION set_message_expiration();

-- ==========================================
-- FUNCTION: Get Approximate Offering Location
-- Returns city/area and randomized lat/long for privacy
-- SECURITY DEFINER allows it to bypass RLS to read addresses
-- ==========================================

CREATE TYPE approximate_location AS (
  city TEXT,
  state TEXT,
  country TEXT,
  approximate_latitude DECIMAL(10, 8),
  approximate_longitude DECIMAL(11, 8)
);

CREATE OR REPLACE FUNCTION get_offering_approximate_location(p_offering_id UUID)
RETURNS approximate_location AS $$
DECLARE
  result approximate_location;
  addr RECORD;
BEGIN
  -- Get the offering's pickup address
  SELECT a.city, a.state, a.country, a.latitude, a.longitude, o.id AS offering_id
  INTO addr
  FROM offerings o
  JOIN addresses a ON o.pickup_address_id = a.id
  WHERE o.id = p_offering_id
    AND o.status = 'active'
    AND a.visibility = 'offering_pickup'
    AND a.is_active = TRUE
    AND a.deleted_at IS NULL;

  IF addr IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build result with randomized coordinates (~200m offset for privacy)
  -- Uses offering_id as seed for consistent randomization
  result.city := addr.city;
  result.state := addr.state;
  result.country := addr.country;
  result.approximate_latitude := addr.latitude +
    (('x' || SUBSTR(MD5(addr.offering_id::TEXT), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004;
  result.approximate_longitude := addr.longitude +
    (('x' || SUBSTR(MD5(addr.offering_id::TEXT || 'lng'), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_offering_approximate_location IS 'Returns approximate location for an offering. Bypasses RLS to protect full address privacy.';

-- Function to get multiple offerings locations at once (for listing pages)
CREATE OR REPLACE FUNCTION get_offerings_approximate_locations(p_offering_ids UUID[])
RETURNS TABLE (
  offering_id UUID,
  city TEXT,
  state TEXT,
  country TEXT,
  approximate_latitude DECIMAL(10, 8),
  approximate_longitude DECIMAL(11, 8)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS offering_id,
    a.city,
    a.state,
    a.country,
    a.latitude + (('x' || SUBSTR(MD5(o.id::TEXT), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004 AS approximate_latitude,
    a.longitude + (('x' || SUBSTR(MD5(o.id::TEXT || 'lng'), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004 AS approximate_longitude
  FROM offerings o
  JOIN addresses a ON o.pickup_address_id = a.id
  WHERE o.id = ANY(p_offering_ids)
    AND o.status = 'active'
    AND a.visibility = 'offering_pickup'
    AND a.is_active = TRUE
    AND a.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_offerings_approximate_locations IS 'Batch function to get approximate locations for multiple offerings.';

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_provider_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_customer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_delivery_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_schedule_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_community_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Helper function to get current user's profile_id
CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is member of community
CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND profile_id = get_current_profile_id()
    AND membership_status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin/owner of community
CREATE OR REPLACE FUNCTION is_community_admin(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND profile_id = get_current_profile_id()
    AND membership_status = 'active'
    AND member_role IN ('owner', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if current user shares a community with a given profile
CREATE OR REPLACE FUNCTION shares_community_with_current_user(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.profile_id = p_profile_id
    AND cm2.profile_id = get_current_profile_id()
    AND cm1.membership_status = 'active'
    AND cm2.membership_status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if current user is an active conversation participant
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND profile_id = get_current_profile_id()
    AND left_at IS NULL
    AND removed_at IS NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can view profiles of community members"
  ON profiles FOR SELECT
  USING (shares_community_with_current_user(id));

CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth_user_id = auth.uid() AND
    -- Ensure user doesn't already have a profile
    NOT EXISTS (
      SELECT 1 FROM profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth_user_id = auth.uid());

-- ADDRESSES policies
-- Users have full control over their own addresses (and ONLY their own)
CREATE POLICY "Users can manage own addresses"
  ON addresses FOR ALL
  USING (profile_id = get_current_profile_id());

-- NOTE: Community members access approximate offering locations via
-- the get_offering_approximate_location() function, NOT direct table access.
-- This ensures full addresses are never exposed.

-- COMMUNITIES policies
CREATE POLICY "Anyone can view active open communities"
  ON communities FOR SELECT
  USING (is_active = TRUE AND access_type = 'open');

CREATE POLICY "Members can view their communities"
  ON communities FOR SELECT
  USING (is_community_member(id));

CREATE POLICY "Admins can update their communities"
  ON communities FOR UPDATE
  USING (is_community_admin(id));

CREATE POLICY "Authenticated users can create communities"
  ON communities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Note: COMMUNITY_MEMBERS policies are defined at the end of the RLS section
-- after snapshot table policies (to avoid forward reference issues)

-- OFFERINGS policies
CREATE POLICY "Members can view community offerings"
  ON offerings FOR SELECT
  USING (is_community_member(community_id) AND status = 'active');

CREATE POLICY "Providers can manage own offerings"
  ON offerings FOR ALL
  USING (provider_id = get_current_profile_id());

-- BOOKINGS policies
CREATE POLICY "Customers can view own bookings"
  ON bookings FOR SELECT
  USING (customer_id = get_current_profile_id());

CREATE POLICY "Providers can view bookings for their offerings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN offerings o ON bi.offering_id = o.id
      WHERE bi.booking_id = bookings.id
      AND o.provider_id = get_current_profile_id()
    )
  );

CREATE POLICY "Members can create bookings in their communities"
  ON bookings FOR INSERT
  WITH CHECK (
    customer_id = get_current_profile_id() AND
    is_community_member(community_id)
  );

-- Bookings UPDATE policies for status changes
CREATE POLICY "Customers can cancel their bookings"
  ON bookings FOR UPDATE
  USING (customer_id = get_current_profile_id())
  WITH CHECK (
    customer_id = get_current_profile_id() AND
    -- Customers can only cancel (set status to cancelled)
    booking_status IN ('pending', 'confirmed', 'cancelled')
  );

CREATE POLICY "Providers can update booking status"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN offerings o ON bi.offering_id = o.id
      WHERE bi.booking_id = bookings.id
      AND o.provider_id = get_current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN offerings o ON bi.offering_id = o.id
      WHERE bi.booking_id = bookings.id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- BOOKING_ITEMS policies
CREATE POLICY "Customers can view their booking items"
  ON booking_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_items.booking_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view booking items for their offerings"
  ON booking_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offerings o
      WHERE o.id = booking_items.offering_id
      AND o.provider_id = get_current_profile_id()
    )
  );

CREATE POLICY "Customers can create booking items with their bookings"
  ON booking_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_items.booking_id
      AND b.customer_id = get_current_profile_id()
    )
  );

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (profile_id = get_current_profile_id());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (profile_id = get_current_profile_id());

-- CONVERSATIONS policies
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (is_conversation_participant(id));

-- Note: Conversation creation is typically handled by a SECURITY DEFINER function
-- that creates the conversation and adds initial participants atomically.
-- The policy below allows direct creation for simple cases.
CREATE POLICY "Users can create direct conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    conversation_type = 'direct' AND
    created_by_profile_id = get_current_profile_id()
  );

-- MESSAGES policies
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (is_conversation_participant(conversation_id));

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = get_current_profile_id()
    AND is_conversation_participant(conversation_id)
  );

CREATE POLICY "Senders can edit own messages"
  ON messages FOR UPDATE
  USING (sender_id = get_current_profile_id());

-- REVIEWS policies
CREATE POLICY "Anyone can view visible reviews"
  ON reviews FOR SELECT
  USING (is_visible = TRUE);

CREATE POLICY "Customers can create reviews for their bookings"
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = get_current_profile_id() AND
    EXISTS (
      SELECT 1 FROM bookings
      WHERE id = reviews.booking_id
      AND customer_id = get_current_profile_id()
      AND booking_status = 'completed'
    )
  );

CREATE POLICY "Reviewers can update own reviews"
  ON reviews FOR UPDATE
  USING (reviewer_id = get_current_profile_id());

-- OFFERING_IMAGES policies (inherit from offerings)
CREATE POLICY "Members can view offering images"
  ON offering_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offerings o
      WHERE o.id = offering_images.offering_id
      AND is_community_member(o.community_id)
      AND o.status = 'active'
    )
  );

CREATE POLICY "Providers can manage own offering images"
  ON offering_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM offerings o
      WHERE o.id = offering_images.offering_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- AVAILABILITY_SCHEDULES policies
CREATE POLICY "Members can view schedules for community offerings"
  ON availability_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offerings o
      WHERE o.id = availability_schedules.offering_id
      AND is_community_member(o.community_id)
      AND o.status = 'active'
    )
  );

CREATE POLICY "Providers can manage own schedules"
  ON availability_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM offerings o
      WHERE o.id = availability_schedules.offering_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- SCHEDULE_EXCEPTIONS policies
CREATE POLICY "Members can view schedule exceptions"
  ON schedule_exceptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM availability_schedules s
      JOIN offerings o ON o.id = s.offering_id
      WHERE s.id = schedule_exceptions.schedule_id
      AND is_community_member(o.community_id)
    )
  );

CREATE POLICY "Providers can manage own schedule exceptions"
  ON schedule_exceptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM availability_schedules s
      JOIN offerings o ON o.id = s.offering_id
      WHERE s.id = schedule_exceptions.schedule_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- SCHEDULE_INSTANCES policies
CREATE POLICY "Members can view schedule instances"
  ON schedule_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM availability_schedules s
      JOIN offerings o ON o.id = s.offering_id
      WHERE s.id = schedule_instances.schedule_id
      AND is_community_member(o.community_id)
    )
  );

CREATE POLICY "Providers can manage own schedule instances"
  ON schedule_instances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM availability_schedules s
      JOIN offerings o ON o.id = s.offering_id
      WHERE s.id = schedule_instances.schedule_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- BOOKING_STATUS_HISTORY policies
CREATE POLICY "Customers can view own booking history"
  ON booking_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_status_history.booking_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view history for their bookings"
  ON booking_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN offerings o ON o.id = bi.offering_id
      WHERE bi.booking_id = booking_status_history.booking_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- ==========================================
-- SNAPSHOT TABLES POLICIES
-- Snapshots are created by the system during booking
-- Both customers AND providers need access
-- ==========================================

-- SNAPSHOT_ADDRESSES - accessed via booking snapshots
CREATE POLICY "Users can view snapshot addresses for their bookings"
  ON snapshot_addresses FOR SELECT
  USING (
    -- Customer can see delivery snapshot address
    EXISTS (
      SELECT 1 FROM booking_delivery_snapshots bds
      JOIN bookings b ON b.id = bds.booking_id
      WHERE bds.snapshot_address_id = snapshot_addresses.id
      AND b.customer_id = get_current_profile_id()
    )
    OR
    -- Customer can see provider pickup address snapshot
    EXISTS (
      SELECT 1 FROM booking_provider_snapshots bps
      JOIN booking_items bi ON bi.id = bps.booking_item_id
      JOIN bookings b ON b.id = bi.booking_id
      WHERE bps.snapshot_address_id = snapshot_addresses.id
      AND b.customer_id = get_current_profile_id()
    )
    OR
    -- Provider can see their own pickup address snapshot
    EXISTS (
      SELECT 1 FROM booking_provider_snapshots bps
      WHERE bps.snapshot_address_id = snapshot_addresses.id
      AND bps.original_provider_id = get_current_profile_id()
    )
    OR
    -- Provider can see delivery address for orders they fulfill
    EXISTS (
      SELECT 1 FROM booking_delivery_snapshots bds
      JOIN bookings b ON b.id = bds.booking_id
      JOIN booking_items bi ON bi.booking_id = b.id
      JOIN offerings o ON o.id = bi.offering_id
      WHERE bds.snapshot_address_id = snapshot_addresses.id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- BOOKING_CUSTOMER_SNAPSHOTS
CREATE POLICY "Customers can view own booking snapshots"
  ON booking_customer_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_customer_snapshots.booking_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view customer snapshots for their orders"
  ON booking_customer_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN booking_items bi ON bi.booking_id = b.id
      JOIN offerings o ON o.id = bi.offering_id
      WHERE b.id = booking_customer_snapshots.booking_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- BOOKING_DELIVERY_SNAPSHOTS
CREATE POLICY "Customers can view own delivery snapshots"
  ON booking_delivery_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_delivery_snapshots.booking_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view delivery snapshots for their orders"
  ON booking_delivery_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN booking_items bi ON bi.booking_id = b.id
      JOIN offerings o ON o.id = bi.offering_id
      WHERE b.id = booking_delivery_snapshots.booking_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- BOOKING_COMMUNITY_SNAPSHOTS
CREATE POLICY "Customers can view own community snapshots"
  ON booking_community_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_community_snapshots.booking_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view community snapshots for their orders"
  ON booking_community_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN booking_items bi ON bi.booking_id = b.id
      JOIN offerings o ON o.id = bi.offering_id
      WHERE b.id = booking_community_snapshots.booking_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- BOOKING_PROVIDER_SNAPSHOTS
CREATE POLICY "Customers can view provider snapshots for their bookings"
  ON booking_provider_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN bookings b ON b.id = bi.booking_id
      WHERE bi.id = booking_provider_snapshots.booking_item_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view their own snapshots"
  ON booking_provider_snapshots FOR SELECT
  USING (original_provider_id = get_current_profile_id());

-- BOOKING_SCHEDULE_SNAPSHOTS
CREATE POLICY "Customers can view schedule snapshots for their bookings"
  ON booking_schedule_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN bookings b ON b.id = bi.booking_id
      WHERE bi.id = booking_schedule_snapshots.booking_item_id
      AND b.customer_id = get_current_profile_id()
    )
  );

CREATE POLICY "Providers can view schedule snapshots for their offerings"
  ON booking_schedule_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      JOIN offerings o ON o.id = bi.offering_id
      WHERE bi.id = booking_schedule_snapshots.booking_item_id
      AND o.provider_id = get_current_profile_id()
    )
  );

-- COMMUNITY_MEMBERS policies
CREATE POLICY "Members can view other members in their communities"
  ON community_members FOR SELECT
  USING (
    is_community_member(community_id)
    OR
    profile_id = get_current_profile_id()
  );

CREATE POLICY "Users can request to join communities"
  ON community_members FOR INSERT
  WITH CHECK (
    profile_id = get_current_profile_id() AND
    membership_status = 'pending' AND
    -- Community allows join requests
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_members.community_id
      AND c.access_type IN ('open', 'request_to_join')
      AND c.is_active = TRUE
      AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "Admins can manage community members"
  ON community_members FOR ALL
  USING (is_community_admin(community_id));

CREATE POLICY "Users can leave communities"
  ON community_members FOR UPDATE
  USING (profile_id = get_current_profile_id())
  WITH CHECK (
    profile_id = get_current_profile_id() AND
    -- Can only update to 'left' status
    membership_status = 'left'
  );

-- COMMUNITY_INVITATIONS policies
CREATE POLICY "Invitees can view their invitations"
  ON community_invitations FOR SELECT
  USING (
    invited_profile_id = get_current_profile_id() OR
    invited_email = (SELECT email FROM profiles WHERE id = get_current_profile_id())
  );

CREATE POLICY "Admins can manage community invitations"
  ON community_invitations FOR ALL
  USING (is_community_admin(community_id));

CREATE POLICY "Members with invite permission can create invitations"
  ON community_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_invitations.community_id
      AND cm.profile_id = get_current_profile_id()
      AND cm.membership_status = 'active'
      AND (cm.can_invite_members = TRUE OR cm.member_role IN ('owner', 'admin', 'moderator'))
    )
  );

CREATE POLICY "Invitees can accept or decline their invitations"
  ON community_invitations FOR UPDATE
  USING (
    invited_profile_id = get_current_profile_id() OR
    invited_email = (SELECT email FROM profiles WHERE id = get_current_profile_id())
  )
  WITH CHECK (
    -- Can only update invitation_status to accepted or declined
    invitation_status IN ('accepted', 'declined') AND
    (
      invited_profile_id = get_current_profile_id() OR
      invited_email = (SELECT email FROM profiles WHERE id = get_current_profile_id())
    )
  );

-- CONVERSATION_PARTICIPANTS policies
CREATE POLICY "Participants can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id));

CREATE POLICY "Conversation creators can add initial participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
      AND c.created_by_profile_id = get_current_profile_id()
    )
  );

CREATE POLICY "Users can leave conversations"
  ON conversation_participants FOR UPDATE
  USING (profile_id = get_current_profile_id())
  WITH CHECK (
    profile_id = get_current_profile_id() AND
    left_at IS NOT NULL
  );

-- MESSAGE_ATTACHMENTS policies
CREATE POLICY "Participants can view message attachments"
  ON message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
      AND is_conversation_participant(m.conversation_id)
    )
  );

CREATE POLICY "Senders can add attachments to own messages"
  ON message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
      AND m.sender_id = get_current_profile_id()
    )
  );

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase auth.users';
COMMENT ON TABLE addresses IS 'User addresses with geolocation (PostGIS)';
COMMENT ON TABLE communities IS 'Community groups with membership management';
COMMENT ON TABLE community_members IS 'Community membership with roles and permissions';
COMMENT ON TABLE community_invitations IS 'Invitations to join communities';
COMMENT ON TABLE offerings IS 'Products, services, food, etc. offered by providers';
COMMENT ON TABLE availability_schedules IS 'RRULE-based recurring availability';
COMMENT ON TABLE schedule_exceptions IS 'Date-specific cancellations or overrides';
COMMENT ON TABLE schedule_instances IS 'Tracks slots booked per schedule per date';
COMMENT ON TABLE bookings IS 'Community-scoped bookings (multi-provider cart)';
COMMENT ON TABLE booking_items IS 'Individual items within a booking';
COMMENT ON TABLE snapshot_addresses IS 'Immutable address snapshots for bookings';
COMMENT ON TABLE booking_provider_snapshots IS 'Immutable provider snapshot at booking time';
COMMENT ON TABLE booking_customer_snapshots IS 'Immutable customer snapshot at booking time';
COMMENT ON TABLE booking_delivery_snapshots IS 'Delivery address snapshot for booking';
COMMENT ON TABLE booking_schedule_snapshots IS 'Schedule state snapshot at booking time';
COMMENT ON TABLE booking_community_snapshots IS 'Community snapshot at booking time';
COMMENT ON TABLE reviews IS 'Booking reviews (1-5 stars)';
COMMENT ON TABLE conversations IS 'Message containers (DM, community, booking)';
COMMENT ON TABLE messages IS 'Chat messages with GDPR retention';

COMMENT ON COLUMN profiles.auth_user_id IS 'References Supabase auth.users(id)';
COMMENT ON COLUMN profiles.subscription_type IS 'free | premium';
COMMENT ON COLUMN profiles.business_type IS 'individual | registered_business';
COMMENT ON COLUMN communities.plan IS 'free | pro';
COMMENT ON COLUMN offerings.version IS 'Optimistic locking - auto-incremented on update';
COMMENT ON COLUMN messages.expires_at IS 'GDPR retention: DMs 90d, Community 1y, Booking 7y';
