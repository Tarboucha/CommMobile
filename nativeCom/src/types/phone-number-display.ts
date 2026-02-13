/**
 * PhoneNumberDisplay Component Types
 */

export interface PhoneNumberDisplayProps {
  /** Optional style override for the card container */
  style?: object;
  /** Callback when phone number changes (for order creation) */
  onPhoneChange?: (phone: string | null) => void;
}
