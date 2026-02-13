import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDrawer } from '@/contexts/drawer-context';
import { useAuthStore } from '@/lib/stores/auth-store';

export function HamburgerButton() {
  const { openDrawer } = useDrawer();
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  return (
    <Pressable className="p-2" onPress={openDrawer}>
      <Ionicons name="menu" size={26} color="#1F2937" />
    </Pressable>
  );
}
