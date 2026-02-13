/**
 * Currency Utilities
 * Provides currency formatting, symbol mapping, and icon utilities for React Native
 */

import type { Ionicons } from "@expo/vector-icons";

// Type for Ionicons icon names
type IoniconsName = keyof typeof Ionicons.glyphMap;

/**
 * Currency symbol mapping
 * Maps currency codes to their respective symbols
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  // Add more currencies as needed
};

/**
 * Currency icon mapping
 * Maps currency codes to their respective Ionicons icon names
 */
export const CURRENCY_ICONS: Record<string, IoniconsName> = {
  EUR: "logo-euro",
  USD: "logo-usd",
  GBP: "cash-outline",
  CAD: "logo-usd",
  AUD: "logo-usd",
  JPY: "cash-outline",
  CHF: "cash-outline",
  SEK: "cash-outline",
  NOK: "cash-outline",
  DKK: "cash-outline",
  PLN: "cash-outline",
  CZK: "cash-outline",
  HUF: "cash-outline",
  // Fallback to cash-outline for other currencies
};

/**
 * Format currency amount with symbol
 * @param amount - The numeric amount to format
 * @param currencyCode - The currency code (defaults to EUR)
 * @returns Formatted currency string (e.g., "€25.99")
 */
export function formatCurrency(amount: number | null | undefined, currencyCode: string = "EUR"): string {
  // Handle undefined, null, or NaN values
  if (amount == null || isNaN(amount)) {
    amount = 0;
  }
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Get currency symbol for a given currency code
 * @param currencyCode - The currency code (defaults to EUR)
 * @returns Currency symbol (e.g., "€")
 */
export function getCurrencySymbol(currencyCode: string = "EUR"): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

/**
 * Get currency icon name for a given currency code
 * @param currencyCode - The currency code (defaults to EUR)
 * @returns Ionicons icon name
 */
export function getCurrencyIconName(currencyCode: string = "EUR"): IoniconsName {
  return CURRENCY_ICONS[currencyCode] || "cash-outline";
}

/**
 * Validate currency code format
 * @param currencyCode - The currency code to validate
 * @returns True if valid currency code format
 */
export function isValidCurrencyCode(currencyCode: string): boolean {
  return /^[A-Z]{3}$/.test(currencyCode);
}

/**
 * Get list of supported currencies
 * @returns Array of supported currency codes
 */
export function getSupportedCurrencies(): string[] {
  return Object.keys(CURRENCY_SYMBOLS);
}

/**
 * Check if currency is supported
 * @param currencyCode - The currency code to check
 * @returns True if currency is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return currencyCode in CURRENCY_SYMBOLS;
}

/**
 * Format currency for display in forms and inputs
 * @param amount - The numeric amount
 * @param currencyCode - The currency code (defaults to EUR)
 * @returns Formatted string for display (e.g., "25.99 EUR")
 */
export function formatCurrencyForInput(amount: number | null | undefined, currencyCode: string = "EUR"): string {
  // Handle undefined, null, or NaN values
  if (amount == null || isNaN(amount)) {
    amount = 0;
  }
  return `${amount.toFixed(2)} ${currencyCode}`;
}

/**
 * Parse currency input back to number and currency code
 * @param input - The formatted currency input (e.g., "25.99 EUR")
 * @returns Object with amount and currencyCode, or null if invalid
 */
export function parseCurrencyInput(input: string): { amount: number; currencyCode: string } | null {
  const match = input.match(/^(\d+\.?\d*)\s+([A-Z]{3})$/);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  const currencyCode = match[2];

  if (isNaN(amount) || !isValidCurrencyCode(currencyCode)) return null;

  return { amount, currencyCode };
}
