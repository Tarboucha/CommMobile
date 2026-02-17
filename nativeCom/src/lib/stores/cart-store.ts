import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/types/supabase';

// --- Types ---

type OfferingCategory = Database['public']['Enums']['offering_category'];
type FulfillmentMethod = Database['public']['Enums']['fulfillment_method'];

export interface BookingCartItem {
  /** Unique key: `${offeringId}-${scheduleId}-${instanceDate}` */
  cartItemKey: string;
  offeringId: string;
  offeringTitle: string;
  offeringCategory: OfferingCategory;
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
}

interface CartActions {
  addItem: (item: Omit<BookingCartItem, 'cartItemKey' | 'quantity'>) => void;
  removeItem: (cartItemKey: string) => void;
  updateQuantity: (cartItemKey: string, quantity: number) => void;
  clearCart: () => void;
  removeItems: (cartItemKeys: string[]) => void;
  getTotalAmount: () => number;
  getItemCount: () => number;
  getItem: (cartItemKey: string) => BookingCartItem | undefined;
}

type CartStore = CartState & CartActions;

// --- Store ---

const initialState: CartState = {
  items: [],
  communityId: null,
};

function makeCartItemKey(offeringId: string, scheduleId: string | null, instanceDate: string | null): string {
  return `${offeringId}-${scheduleId ?? 'none'}-${instanceDate ?? 'none'}`;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addItem: (itemData) => {
        const state = get();
        const cartItemKey = makeCartItemKey(itemData.offeringId, itemData.scheduleId, itemData.instanceDate);

        // If cart has items from a different community, clear first
        if (state.communityId && state.communityId !== itemData.communityId) {
          set({ items: [], communityId: itemData.communityId });
        }

        const existing = get().items.find((i) => i.cartItemKey === cartItemKey);

        if (existing) {
          set({
            items: get().items.map((i) =>
              i.cartItemKey === cartItemKey ? { ...i, quantity: i.quantity + 1 } : i
            ),
            communityId: itemData.communityId,
          });
        } else {
          const newItem: BookingCartItem = {
            ...itemData,
            cartItemKey,
            quantity: 1,
          };
          set({
            items: [...get().items, newItem],
            communityId: itemData.communityId,
          });
        }
      },

      removeItem: (cartItemKey) => {
        const newItems = get().items.filter((i) => i.cartItemKey !== cartItemKey);
        set({
          items: newItems,
          communityId: newItems.length === 0 ? null : get().communityId,
        });
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

      removeItems: (cartItemKeys) => {
        const newItems = get().items.filter((i) => !cartItemKeys.includes(i.cartItemKey));
        set({
          items: newItems,
          communityId: newItems.length === 0 ? null : get().communityId,
        });
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
      }),
    }
  )
);
