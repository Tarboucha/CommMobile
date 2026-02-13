import type { OrderStatus, FulfillmentMethod } from "@/types/order";
import type { WorkflowAction } from "@/types/order-status";

/**
 * Active order statuses (orders that are not yet finalized)
 * These orders are still in progress and require action
 */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
];

/**
 * Past order statuses (orders that are finalized)
 * These orders are completed, cancelled, or refunded
 */
export const PAST_ORDER_STATUSES: OrderStatus[] = [
  "delivered",
  "completed",
  "cancelled",
  "refunded",
];

/**
 * All possible order statuses
 */
export const ALL_ORDER_STATUSES: OrderStatus[] = [
  ...ACTIVE_ORDER_STATUSES,
  ...PAST_ORDER_STATUSES,
];

/**
 * Order Status Labels
 * Human-readable labels for each status
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: "Pending Confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_pickup: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/**
 * Order Status Colors
 * Theme-aware color mappings for status badges
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending_confirmation: "#F59E0B", // Amber
  confirmed: "#3B82F6", // Blue
  preparing: "#8B5CF6", // Purple
  ready_for_pickup: "#10B981", // Green
  out_for_delivery: "#06B6D4", // Cyan
  delivered: "#10B981", // Green
  completed: "#6B7280", // Gray
  cancelled: "#EF4444", // Red
  refunded: "#F97316", // Orange
};

/**
 * Order Status Icons
 * Ionicons names for each status
 */
export const ORDER_STATUS_ICONS: Record<OrderStatus, string> = {
  pending_confirmation: "time-outline",
  confirmed: "checkmark-circle-outline",
  preparing: "restaurant-outline",
  ready_for_pickup: "bag-check-outline",
  out_for_delivery: "bicycle-outline",
  delivered: "checkmark-done-outline",
  completed: "checkmark-done-circle-outline",
  cancelled: "close-circle-outline",
  refunded: "arrow-undo-outline",
};

/**
 * Check if an order status is active
 */
export function isActiveOrderStatus(status: OrderStatus | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_ORDER_STATUSES.includes(status);
}

/**
 * Check if an order status is past/finalized
 */
export function isPastOrderStatus(status: OrderStatus | null | undefined): boolean {
  if (!status) return false;
  return PAST_ORDER_STATUSES.includes(status);
}

/**
 * Get next workflow action for an order
 * Returns the next possible status transition based on current status and fulfillment method
 */
export function getNextWorkflowAction(
  currentStatus: OrderStatus,
  fulfillmentMethod: FulfillmentMethod
): WorkflowAction | null {
  switch (currentStatus) {
    case "pending_confirmation":
      return {
        label: "Confirm Order",
        nextStatus: "confirmed",
        icon: "checkmark-circle",
        color: "#3B82F6",
      };

    case "confirmed":
      return {
        label: "Start Preparing",
        nextStatus: "preparing",
        icon: "restaurant",
        color: "#8B5CF6",
      };

    case "preparing":
      if (fulfillmentMethod === "delivery") {
        return {
          label: "Out for Delivery",
          nextStatus: "out_for_delivery",
          icon: "bicycle",
          color: "#06B6D4",
        };
      } else {
        return {
          label: "Mark Ready for Pickup",
          nextStatus: "ready_for_pickup",
          icon: "bag-check",
          color: "#10B981",
        };
      }

    case "out_for_delivery":
      return {
        label: "Mark Delivered",
        nextStatus: "delivered",
        icon: "checkmark-done",
        color: "#10B981",
      };

    case "ready_for_pickup":
    case "delivered":
      return {
        label: "Complete Order",
        nextStatus: "completed",
        icon: "checkmark-done-circle",
        color: "#6B7280",
      };

    default:
      return null;
  }
}

/**
 * Check if order can be cancelled
 * Only pending orders can be cancelled
 */
export function canCancelOrder(status: OrderStatus): boolean {
  return status === "pending_confirmation";
}

/**
 * Check if status transition is valid
 * Validates workflow rules for status updates
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
  fulfillmentMethod: FulfillmentMethod
): boolean {
  // Can always cancel from pending_confirmation
  if (currentStatus === "pending_confirmation" && newStatus === "cancelled") {
    return true;
  }

  // Get next valid action
  const nextAction = getNextWorkflowAction(currentStatus, fulfillmentMethod);

  // Check if new status matches next action
  return nextAction?.nextStatus === newStatus;
}

