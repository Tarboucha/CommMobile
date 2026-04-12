import type {
  OfferingCategory,
  TransactionType,
  FulfillmentMethod,
  RRuleWeekday,
} from '@/types/offering';

// ============================================================================
// State shape
// ============================================================================

export type ScheduleMode = 'one-time' | 'recurring';

export interface OfferingFormState {
  // Basic info
  title: string;
  description: string;

  // Category & transaction
  category: OfferingCategory;
  transactionType: TransactionType;

  // Pricing
  priceAmount: string;

  // Fulfillment
  fulfillmentMethod: FulfillmentMethod;

  // Loan-specific
  requiresDeposit: boolean;
  depositAmount: string;

  // Schedule toggle
  includeSchedule: boolean;
  scheduleMode: ScheduleMode;

  // One-time schedule
  oneTimeDate: string | null;
  oneTimeStartTime: string;
  oneTimeEndTime: string;
  oneTimeSlots: string;
  oneTimeSlotLabel: string;

  // Recurring schedule
  selectedDays: RRuleWeekday[];
  recurStartTime: string;
  recurEndTime: string;
  dtstart: string | null;
  dtend: string | null;
  recurSlots: string;
  recurSlotLabel: string;

  // Loan duration (inside schedule)
  loanDurationDays: string;
  loanMaxDurationDays: string;

  // Slot duration (service offerings with time slots)
  slotDurationMinutes: string;
}

// ============================================================================
// Initial state
// ============================================================================

function getTodayISO(): string {
  return new Date().toISOString();
}

export function createInitialState(): OfferingFormState {
  return {
    title: '',
    description: '',
    category: 'product',
    transactionType: 'purchase',
    priceAmount: '',
    fulfillmentMethod: 'pickup',
    requiresDeposit: false,
    depositAmount: '',
    includeSchedule: false,
    scheduleMode: 'one-time',
    oneTimeDate: getTodayISO(),
    oneTimeStartTime: '09:00',
    oneTimeEndTime: '17:00',
    oneTimeSlots: '10',
    oneTimeSlotLabel: '',
    selectedDays: ['MO', 'TU', 'WE', 'TH', 'FR'],
    recurStartTime: '09:00',
    recurEndTime: '17:00',
    dtstart: getTodayISO(),
    dtend: null,
    recurSlots: '10',
    recurSlotLabel: '',
    loanDurationDays: '7',
    loanMaxDurationDays: '14',
    slotDurationMinutes: '',
  };
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Generic field setter — covers ~80% of state updates.
 * Uses a typed key so the TypeScript compiler enforces field-value pairs.
 */
type FieldKey = keyof OfferingFormState;
type FieldValue<K extends FieldKey> = OfferingFormState[K];

export type OfferingFormAction =
  // Generic field update (for simple cases)
  | { type: 'SET_FIELD'; field: FieldKey; value: OfferingFormState[FieldKey] }
  // Specific actions with cross-field logic
  | { type: 'CHANGE_CATEGORY'; value: OfferingCategory }
  | { type: 'TOGGLE_DAY'; day: RRuleWeekday }
  | { type: 'SELECT_DAYS_PRESET'; preset: 'weekdays' | 'weekend' | 'all' };

/** Type-safe helper to dispatch a SET_FIELD action without losing type info. */
export function setField<K extends FieldKey>(
  field: K,
  value: FieldValue<K>
): OfferingFormAction {
  return { type: 'SET_FIELD', field, value };
}

// ============================================================================
// Reducer
// ============================================================================

const ALL_WEEKDAYS: RRuleWeekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function offeringFormReducer(
  state: OfferingFormState,
  action: OfferingFormAction
): OfferingFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'CHANGE_CATEGORY': {
      const next = action.value;
      // When leaving 'product', force transaction type back to purchase
      // (services/events use 'booking' which is set on submit)
      const transactionType: TransactionType =
        next === 'product' ? state.transactionType : 'purchase';
      return { ...state, category: next, transactionType };
    }

    case 'TOGGLE_DAY': {
      const day = action.day;
      const isSelected = state.selectedDays.includes(day);
      // Don't allow removing the last selected day
      if (isSelected && state.selectedDays.length === 1) return state;
      const next = isSelected
        ? state.selectedDays.filter((d) => d !== day)
        : [...state.selectedDays, day];
      return { ...state, selectedDays: next };
    }

    case 'SELECT_DAYS_PRESET': {
      const preset = action.preset;
      let days: RRuleWeekday[];
      if (preset === 'weekdays') days = ['MO', 'TU', 'WE', 'TH', 'FR'];
      else if (preset === 'weekend') days = ['SA', 'SU'];
      else days = [...ALL_WEEKDAYS];
      return { ...state, selectedDays: days };
    }

    default:
      return state;
  }
}

// ============================================================================
// Derived selectors (computed from state)
// ============================================================================

export function isLoanOffering(state: OfferingFormState): boolean {
  return state.category === 'product' && state.transactionType === 'loan';
}

export function isScheduleRequired(state: OfferingFormState): boolean {
  return state.category === 'service' || state.category === 'event' || isLoanOffering(state);
}

export function isServiceOffering(state: OfferingFormState): boolean {
  return state.category === 'service';
}

export function isWeekdaysPreset(days: RRuleWeekday[]): boolean {
  return (
    days.length === 5 &&
    ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => days.includes(d as RRuleWeekday)) &&
    !days.includes('SA') &&
    !days.includes('SU')
  );
}

export function isWeekendPreset(days: RRuleWeekday[]): boolean {
  return days.length === 2 && days.includes('SA') && days.includes('SU');
}

export function isAllPreset(days: RRuleWeekday[]): boolean {
  return days.length === 7;
}
