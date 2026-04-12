import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/types/supabase';

// --- Types ---

type FulfillmentMethod = Database['public']['Enums']['fulfillment_method'];

/**
 * The cart is **products-only**. Loans, services, and events use direct
 * booking flows that bypass the cart entirely. The category field is
 * narrowed to the literal `'product'` to enforce this at the type level.
 */
export interface BookingCartItem {
  /** Unique key: `${offeringId}-${scheduleId}-${instanceDate}` */
  cartItemKey: string;
  offeringId: string;
  offeringTitle: string;
  offeringCategory: 'product';
  priceAmount: number;
  currencyCode: string;
  quantity: number;
  providerId: string;
  providerName: string;
  communityId: string;
  imageUrl: string | null;
  offeringVersion: number;
  scheduleId: string | null;
  instanceDate: string | null;
  fulfillmentMethod: FulfillmentMethod;
  deliveryFeeAmount: number | null;
}

interface CartState {
  items: BookingCartItem[];
  communityId: string | null;
  providerId: string | null;
  providerName: string | null;
}

/**
 * Result of attempting to add an item:
 * - 'added': item was added successfully
 * - 'provider_conflict': cart already has items from a different provider in this community
 *   (caller should prompt user to confirm replace)
 */
export type AddItemResult =
  | { status: 'added' }
  | { status: 'provider_conflict'; existingProviderName: string };

interface CartActions {
  /**
   * Try to add an item. If the cart has items from a different provider in the
   * same community, returns a conflict result so the UI can prompt the user.
   * Use `replaceWithItem` after the user confirms.
   */
  addItem: (item: Omit<BookingCartItem, 'cartItemKey' | 'quantity'>) => AddItemResult;
  /**
   * Clear the cart and add this single item. Used after a provider conflict
   * is resolved by the user choosing to replace.
   */
  replaceWithItem: (item: Omit<BookingCartItem, 'cartItemKey' | 'quantity'>) => void;
  removeItem: (cartItemKey: string) => void;
  updateQuantity: (cartItemKey: string, quantity: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getItemCount: () => number;
  getItem: (cartItemKey: string) => BookingCartItem | undefined;
}

type CartStore = CartState & CartActions;

// --- Helpers ---

const initialState: CartState = {
  items: [],
  communityId: null,
  providerId: null,
  providerName: null,
};

function makeCartItemKey(
  offeringId: string,
  scheduleId: string | null,
  instanceDate: string | null
): string {
  return `${offeringId}-${scheduleId ?? 'none'}-${instanceDate ?? 'none'}`;
}

function ensureProduct(category: string): asserts category is 'product' {
  if (category !== 'product') {
    throw new Error(
      `Cart only accepts products. Tried to add an item with category "${category}".`
    );
  }
}

// --- Store ---

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addItem: (itemData) => {
        ensureProduct(itemData.offeringCategory);

        const state = get();

        // Different community → auto-clear and start fresh
        if (state.communityId && state.communityId !== itemData.communityId) {
          const cartItemKey = makeCartItemKey(
            itemData.offeringId,
            itemData.scheduleId,
            itemData.instanceDate
          );
          set({
            items: [{ ...itemData, cartItemKey, quantity: 1 }],
            communityId: itemData.communityId,
            providerId: itemData.providerId,
            providerName: itemData.providerName,
          });
          return { status: 'added' };
        }

        // Same community, different provider → conflict (caller should prompt)
        if (state.providerId && state.providerId !== itemData.providerId) {
          return {
            status: 'provider_conflict',
            existingProviderName: state.providerName ?? 'another provider',
          };
        }

        // Same provider (or empty cart) → add or increment
        const cartItemKey = makeCartItemKey(
          itemData.offeringId,
          itemData.scheduleId,
          itemData.instanceDate
        );
        const existing = state.items.find((i) => i.cartItemKey === cartItemKey);

        if (existing) {
          set({
            items: state.items.map((i) =>
              i.cartItemKey === cartItemKey ? { ...i, quantity: i.quantity + 1 } : i
            ),
            communityId: itemData.communityId,
            providerId: itemData.providerId,
            providerName: itemData.providerName,
          });
        } else {
          set({
            items: [...state.items, { ...itemData, cartItemKey, quantity: 1 }],
            communityId: itemData.communityId,
            providerId: itemData.providerId,
            providerName: itemData.providerName,
          });
        }

        return { status: 'added' };
      },

      replaceWithItem: (itemData) => {
        ensureProduct(itemData.offeringCategory);
        const cartItemKey = makeCartItemKey(
          itemData.offeringId,
          itemData.scheduleId,
          itemData.instanceDate
        );
        set({
          items: [{ ...itemData, cartItemKey, quantity: 1 }],
          communityId: itemData.communityId,
          providerId: itemData.providerId,
          providerName: itemData.providerName,
        });
      },

      removeItem: (cartItemKey) => {
        const newItems = get().items.filter((i) => i.cartItemKey !== cartItemKey);
        if (newItems.length === 0) {
          set(initialState);
        } else {
          set({ items: newItems });
        }
      },

      updateQuantity: (cartItemKey, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemKey);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.cartItemKey === cartItemKey ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => {
        set(initialState);
      },

      getTotalAmount: () => {
        return get().items.reduce((total, item) => total + item.priceAmount * item.quantity, 0);
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },

      getItem: (cartItemKey) => {
        return get().items.find((i) => i.cartItemKey === cartItemKey);
      },
    }),
    {
      name: 'kodo-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        communityId: state.communityId,
        providerId: state.providerId,
        providerName: state.providerName,
      }),
    }
  )
);
