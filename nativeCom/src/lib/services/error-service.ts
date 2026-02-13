import Toast from 'react-native-toast-message';
import { Alert } from 'react-native';
import { ApiClientError } from '@/lib/api/client';

export type ErrorSeverity = 'silent' | 'toast' | 'alert';

export interface ErrorContext {
  severity?: ErrorSeverity;
  userMessage?: string;
  screen?: string;
}

/**
 * Central error handler for the entire app.
 * Logs errors in dev, shows appropriate UI feedback based on severity.
 * Future: Sentry integration point.
 */
export function handleError(error: unknown, context?: ErrorContext): void {
  const severity = context?.severity ?? inferSeverity(error);
  const message = context?.userMessage ?? extractMessage(error);

  // Always log in development (future: Sentry.captureException here)
  if (__DEV__) {
    console.error(`[${context?.screen ?? 'app'}]`, error);
  }

  switch (severity) {
    case 'silent':
      break;
    case 'toast':
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: message,
        position: 'top',
        visibilityTime: 4000,
      });
      break;
    case 'alert':
      Alert.alert('Fehler', message);
      break;
  }
}

/**
 * Infer error severity from error type.
 * ApiClientError 401/403 → alert (auth issue)
 * ApiClientError 5xx → toast
 * Other → toast
 */
function inferSeverity(error: unknown): ErrorSeverity {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) return 'alert';
    if (error.status >= 500) return 'toast';
    return 'toast';
  }
  return 'toast';
}

/**
 * Extract a user-friendly message from an error.
 */
function extractMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Ein unerwarteter Fehler ist aufgetreten';
}
