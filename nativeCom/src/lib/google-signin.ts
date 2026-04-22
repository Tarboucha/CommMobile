import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Configure Google Sign-In once on app startup.
 *
 * `webClientId` must be the **Web** OAuth client ID from Google Cloud
 * Console — even on Android. Google uses this value as the `aud` claim
 * embedded in the returned ID token, which is what auth-service verifies.
 *
 * Safe to call multiple times; Google SDK treats it as idempotent.
 */
export function configureGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    console.warn(
      '[GoogleSignIn] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — Google sign-in will fail'
    );
    return;
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    scopes: ['email', 'profile'],
  });
}
