import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';

interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

/**
 * Reusable Error Boundary UI for Expo Router routes.
 *
 * Usage in route files:
 * ```
 * export { RouteErrorBoundary as ErrorBoundary } from '@/components/error/route-error-boundary';
 * ```
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-background">
      <Ionicons name="alert-circle" size={64} color="#DC2626" />
      <Text className="text-xl font-bold mt-4 text-destructive">
        Etwas ist schiefgelaufen
      </Text>
      <Text className="text-sm text-center mt-2 text-muted-foreground">
        {__DEV__ ? error.message : 'Die App ist auf einen Fehler gestoßen.'}
      </Text>
      <Pressable
        onPress={retry}
        className="mt-6 rounded-lg bg-primary px-6 py-3"
      >
        <Text className="text-base font-semibold text-primary-foreground">
          Erneut versuchen
        </Text>
      </Pressable>
    </View>
  );
}
