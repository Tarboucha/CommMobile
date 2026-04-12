import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Calls `refetch` when the screen gains focus, but **skips the initial mount**.
 *
 * TanStack Query already fetches on mount via `useQuery`, so firing
 * `refetch()` inside `useFocusEffect` during the first focus event causes
 * a duplicate request. This hook uses a ref flag to detect the initial
 * focus and no-ops the first call, only refetching on subsequent focuses
 * (e.g. when the user navigates back to the screen).
 */
export function useRefreshOnFocus(refetch: () => void) {
  const hasMountedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      refetch();
    }, [refetch])
  );
}
