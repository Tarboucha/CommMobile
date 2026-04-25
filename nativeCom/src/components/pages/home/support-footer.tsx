import { View, Linking, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';

const SUPPORT_EMAIL = 'support@comchefs.cloud';

export function SupportFooter() {
  const openMail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <View className="px-6 pb-12 pt-4 items-center gap-1">
      <Text className="font-sans text-[13px] text-muted-foreground">
        Need help?
      </Text>
      <Pressable onPress={openMail} hitSlop={8}>
        <Text className="font-semibold text-[13px] text-primary underline">
          {SUPPORT_EMAIL}
        </Text>
      </Pressable>
    </View>
  );
}
