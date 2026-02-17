import { NextRequest } from "next/server";
import { withAuth, withSecureAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { bookingCreateSchema, type BookingCreateInput } from "@/lib/validations/booking";
import type { Json } from "@/types/supabase";

/**
 * POST /api/bookings
 * Create a new booking with atomic slot reservation.
 * Uses withSecureAuth (server-verified session) for financial operations.
 */
export const POST = withSecureAuth(async (user, request: NextRequest) => {
  console.log("[bookings] POST handler entered, user:", user.id);

  // Parse request body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }
  console.log("[bookings] Body parsed, community:", (rawData as any).community_id);

  // Validate with Zod
  const validation = bookingCreateSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return ApiErrors.badRequest(firstError.message);
  }

  const input: BookingCreateInput = validation.data;
  const supabase = await createClient();

  // ============================================================================
  // Step 1: Idempotency check
  // ============================================================================
  const { data: existingBooking, error: idempotencyError } = await supabase
    .from("bookings")
    .select("id, booking_number, booking_status, total_amount, currency_code, created_at")
    .eq("idempotency_key", input.idempotency_key)
    .eq("customer_id", user.id)
    .maybeSingle();

  console.log("[bookings] Step 1 done - idempotency check:", { error: idempotencyError?.message, exists: !!existingBooking });

  if (idempotencyError) {
    console.error("Error checking idempotency:", idempotencyError);
    return ApiErrors.serverError();
  }

  if (existingBooking) {
    return successResponse({ booking: existingBooking });
  }

  // ============================================================================
  // Step 2: Verify community membership
  // ============================================================================
  const { data: membership, error: memberError } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", input.community_id)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .maybeSingle();

  if (memberError) {
    console.error("Error checking membership:", memberError);
    return ApiErrors.serverError();
  }

  if (!membership) {
    return ApiErrors.notCommunityMember();
  }

  // ============================================================================
  // Step 3: Fetch offerings with provider profiles
  // ============================================================================
  const offeringIds = input.items.map((item) => item.offering_id);

  const { data: offerings, error: offeringsError } = await supabase
    .from("offerings")
    .select(`
      id,
      community_id,
      provider_id,
      category,
      title,
      description,
      price_amount,
      currency_code,
      fulfillment_method,
      is_delivery_available,
      delivery_fee_amount,
      pickup_address_id,
      version,
      status,
      offering_images (
        image_url,
        is_primary
      ),
      profiles!provider_id (
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url
      )
    `)
    .in("id", offeringIds)
    .is("deleted_at", null);

  if (offeringsError) {
    console.error("Error fetching offerings:", offeringsError);
    return ApiErrors.serverError();
  }

  if (!offerings || offerings.length !== offeringIds.length) {
    return ApiErrors.badRequest("One or more offerings are no longer available");
  }

  const offeringsMap = new Map(offerings.map((o) => [o.id, o]));

  // ============================================================================
  // Step 4: Pre-validate each item (fail fast before RPC)
  // ============================================================================
  for (const item of input.items) {
    const offering = offeringsMap.get(item.offering_id);
    if (!offering) {
      return ApiErrors.badRequest(`Offering ${item.offering_id} not found`);
    }

    if (offering.status !== "active") {
      return ApiErrors.offeringUnavailable(`"${offering.title}" is no longer available`);
    }

    if (offering.community_id !== input.community_id) {
      return ApiErrors.badRequest(`"${offering.title}" does not belong to this community`);
    }

    if (offering.version !== item.offering_version) {
      return ApiErrors.conflict(
        `"${offering.title}" has been updated. Please refresh your cart and try again.`
      );
    }

    if (offering.provider_id === user.id) {
      return ApiErrors.bookingNotAllowed("You cannot book your own offering");
    }
  }

  // Validate single provider (split-at-checkout: frontend groups by provider)
  const providerIds = [...new Set(offerings.map((o) => o.provider_id))];
  if (providerIds.length !== 1) {
    return ApiErrors.badRequest(
      "All items in a booking must be from the same provider. Please split your cart."
    );
  }
  const providerId = providerIds[0];

  // ============================================================================
  // Step 5: Calculate amounts
  // ============================================================================
  const currencyCode = offerings[0]?.currency_code || "EUR";
  let subtotalAmount = 0;
  let totalDeliveryFees = 0;

  const itemsForRpc: Array<Record<string, unknown>> = [];

  for (const item of input.items) {
    const offering = offeringsMap.get(item.offering_id)!;
    const unitPrice = offering.price_amount || 0;
    const itemTotal = unitPrice * item.quantity;
    subtotalAmount += itemTotal;

    // Delivery fee
    let deliveryFee = 0;
    if (
      item.fulfillment_method === "delivery" &&
      offering.is_delivery_available &&
      offering.delivery_fee_amount
    ) {
      deliveryFee = offering.delivery_fee_amount;
      totalDeliveryFees += deliveryFee;
    }

    // Build provider name for snapshot
    const provider = offering.profiles as any;
    const providerName = provider
      ? [provider.first_name, provider.last_name].filter(Boolean).join(" ") || "Unknown"
      : "Unknown";

    itemsForRpc.push({
      offering_id: item.offering_id,
      offering_version: item.offering_version,
      quantity: item.quantity,
      fulfillment_method: item.fulfillment_method,
      schedule_id: item.schedule_id || null,
      instance_date: item.instance_date || null,
      unit_price_amount: unitPrice,
      total_amount: itemTotal,
      delivery_fee_amount: deliveryFee,
      currency_code: currencyCode,
      snapshot_title: offering.title,
      snapshot_description: offering.description || null,
      snapshot_image_url:
        offering.offering_images?.find((img) => img.is_primary)?.image_url ||
        offering.offering_images?.[0]?.image_url ||
        null,
      snapshot_category: offering.category,
      special_instructions: item.special_instructions || null,
      // Extra fields for post-RPC snapshot creation
      _provider_id: offering.provider_id,
      _provider_name: providerName,
      _provider_email: provider?.email || null,
      _provider_phone: provider?.phone || null,
      _provider_avatar_url: provider?.avatar_url || null,
      _pickup_address_id: offering.pickup_address_id || null,
    });
  }

  const totalAmount = subtotalAmount + totalDeliveryFees;

  // ============================================================================
  // Step 6: Build booking data and call RPC
  // ============================================================================
  const bookingData = {
    customer_id: user.id,
    provider_id: providerId,
    community_id: input.community_id,
    idempotency_key: input.idempotency_key,
    payment_method: input.payment_method,
    delivery_address_id: input.delivery_address_id || null,
    special_instructions: input.special_instructions || null,
    currency_code: currencyCode,
    subtotal_amount: subtotalAmount,
    service_fee_amount: 0,
    total_amount: totalAmount,
  };

  // Strip internal fields before sending to RPC
  const rpcItems = itemsForRpc.map(({ _provider_id, _provider_name, _provider_email, _provider_phone, _provider_avatar_url, _pickup_address_id, ...rest }) => rest);

  const { data: newBookingId, error: rpcError } = await supabase.rpc(
    "create_booking_with_items",
    {
      p_booking: bookingData as unknown as Json,
      p_items: rpcItems as unknown as Json,
    }
  );

  if (rpcError || !newBookingId) {
    console.error("Error creating booking:", rpcError);

    if (rpcError) {
      const msg = rpcError.message || "";

      if (msg.includes("Not enough slots")) {
        return ApiErrors.slotsUnavailable(
          "One or more items are fully booked for the selected date. Please update your cart."
        );
      }
      if (msg.includes("cancelled")) {
        return ApiErrors.offeringUnavailable(
          "One or more items are no longer available for the selected date."
        );
      }
      if (msg.includes("not found or inactive")) {
        return ApiErrors.offeringUnavailable(
          "One or more schedules are no longer available."
        );
      }
      if (msg.includes("version mismatch")) {
        return ApiErrors.conflict(
          "One or more offerings have been updated. Please refresh your cart."
        );
      }
      if (msg.includes("Cannot book your own offering")) {
        return ApiErrors.bookingNotAllowed("You cannot book your own offering");
      }
    }

    return ApiErrors.serverError("Failed to create booking");
  }

  // ============================================================================
  // Step 7: Fetch created booking + items
  // ============================================================================
  const { data: newBooking, error: fetchBookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", newBookingId)
    .single();

  if (fetchBookingError || !newBooking) {
    console.error("Error fetching created booking:", fetchBookingError);
    return ApiErrors.serverError("Booking created but failed to retrieve details");
  }

  const { data: bookingItems, error: fetchItemsError } = await supabase
    .from("booking_items")
    .select("*")
    .eq("booking_id", newBookingId);

  if (fetchItemsError) {
    console.error("Error fetching booking items:", fetchItemsError);
  }

  // ============================================================================
  // Step 8: Create snapshots (non-atomic — failures logged, don't rollback)
  // ============================================================================

  // 8a. Customer snapshot
  try {
    await supabase.from("booking_customer_snapshots").insert({
      booking_id: newBookingId,
      original_customer_id: user.id,
      snapshot_display_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
      snapshot_first_name: user.first_name || null,
      snapshot_last_name: user.last_name || null,
      snapshot_email: user.email || null,
      snapshot_phone: input.contact_phone || user.phone || null,
      snapshot_avatar_url: user.avatar_url || null,
    });
  } catch (err) {
    console.error("Failed to create customer snapshot:", err);
  }

  // 8b. Provider snapshots (per item)
  const createdItems = bookingItems || [];
  for (let i = 0; i < createdItems.length; i++) {
    const bookingItem = createdItems[i];
    const rpcItem = itemsForRpc[i];
    if (!rpcItem) continue;

    try {
      // Create pickup address snapshot if available
      let snapshotAddressId: string | null = null;
      const pickupAddressId = rpcItem._pickup_address_id as string | null;

      if (pickupAddressId) {
        const { data: pickupAddr } = await supabase
          .from("addresses")
          .select("*")
          .eq("id", pickupAddressId)
          .is("deleted_at", null)
          .single();

        if (pickupAddr) {
          const { data: snapAddr } = await supabase
            .from("snapshot_addresses")
            .insert({
              original_address_id: pickupAddr.id,
              street_name: pickupAddr.street_name,
              street_number: pickupAddr.street_number,
              apartment_unit: pickupAddr.apartment_unit,
              city: pickupAddr.city,
              postal_code: pickupAddr.postal_code,
              country: pickupAddr.country,
              latitude: pickupAddr.latitude,
              longitude: pickupAddr.longitude,
              instructions: pickupAddr.delivery_instructions,
            })
            .select("id")
            .single();

          snapshotAddressId = snapAddr?.id || null;
        }
      }

      await supabase.from("booking_provider_snapshots").insert({
        booking_item_id: bookingItem.id,
        original_provider_id: rpcItem._provider_id as string,
        snapshot_display_name: rpcItem._provider_name as string,
        snapshot_avatar_url: rpcItem._provider_avatar_url as string | null,
        snapshot_email: rpcItem._provider_email as string | null,
        snapshot_phone: rpcItem._provider_phone as string | null,
        snapshot_address_id: snapshotAddressId,
      });
    } catch (err) {
      console.error("Failed to create provider snapshot for item:", bookingItem.id, err);
    }
  }

  // 8c. Delivery snapshot (if delivery address)
  if (input.delivery_address_id) {
    try {
      const { data: deliveryAddr } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", input.delivery_address_id)
        .eq("profile_id", user.id)
        .is("deleted_at", null)
        .single();

      if (deliveryAddr) {
        const { data: snapAddr } = await supabase
          .from("snapshot_addresses")
          .insert({
            original_address_id: deliveryAddr.id,
            street_name: deliveryAddr.street_name,
            street_number: deliveryAddr.street_number,
            apartment_unit: deliveryAddr.apartment_unit,
            city: deliveryAddr.city,
            postal_code: deliveryAddr.postal_code,
            country: deliveryAddr.country,
            latitude: deliveryAddr.latitude,
            longitude: deliveryAddr.longitude,
            instructions: deliveryAddr.delivery_instructions,
          })
          .select("id")
          .single();

        if (snapAddr) {
          await supabase.from("booking_delivery_snapshots").insert({
            booking_id: newBookingId,
            snapshot_address_id: snapAddr.id,
          });
        }
      }
    } catch (err) {
      console.error("Failed to create delivery snapshot:", err);
    }
  }

  // 8d. Community snapshot
  try {
    const { data: community } = await supabase
      .from("communities")
      .select("community_name, community_description, community_image_url")
      .eq("id", input.community_id)
      .single();

    if (community) {
      await supabase.from("booking_community_snapshots").insert({
        booking_id: newBookingId,
        original_community_id: input.community_id,
        snapshot_community_name: community.community_name,
        snapshot_community_description: community.community_description,
        snapshot_community_image_url: community.community_image_url,
      });
    }
  } catch (err) {
    console.error("Failed to create community snapshot:", err);
  }

  // Note: Status history (NULL → pending) and provider notification are now
  // handled by the tr_booking_status_change trigger on INSERT.

  // ============================================================================
  // Step 9: Return booking
  // ============================================================================
  return successResponse(
    {
      booking: {
        id: newBooking.id,
        booking_number: newBooking.booking_number,
        booking_status: newBooking.booking_status,
        community_id: newBooking.community_id,
        subtotal_amount: newBooking.subtotal_amount,
        total_amount: newBooking.total_amount,
        currency_code: newBooking.currency_code,
        payment_method: newBooking.payment_method,
        created_at: newBooking.created_at,
      },
    },
    "Booking created successfully",
    201
  );
});

// ============================================================================
// GET /api/bookings
// List bookings for the current user (as customer and/or provider).
// Query params: ?role=customer|provider (optional, defaults to both)
// ============================================================================

export const GET = withAuth(async (user, request: NextRequest) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role"); // "customer" | "provider" | null (both)

  // Build query — select booking + first item snapshot for preview
  let query = supabase
    .from("bookings")
    .select(`
      id,
      booking_number,
      booking_status,
      customer_id,
      provider_id,
      community_id,
      total_amount,
      currency_code,
      payment_method,
      created_at,
      confirmed_at,
      ready_at,
      completed_at,
      cancelled_at,
      booking_items (
        id,
        snapshot_title,
        snapshot_image_url,
        quantity
      ),
      booking_community_snapshots (
        snapshot_community_name
      )
    `)
    .order("created_at", { ascending: false });

  // Filter by role
  if (role === "customer") {
    query = query.eq("customer_id", user.id);
  } else if (role === "provider") {
    query = query.eq("provider_id", user.id);
  } else {
    // Both — bookings where user is customer OR provider
    query = query.or(`customer_id.eq.${user.id},provider_id.eq.${user.id}`);
  }

  const { data: bookings, error } = await query;

  if (error) {
    console.error("Error fetching bookings:", error);
    return ApiErrors.serverError("Failed to fetch bookings");
  }

  return successResponse({ bookings: bookings || [] });
});

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
