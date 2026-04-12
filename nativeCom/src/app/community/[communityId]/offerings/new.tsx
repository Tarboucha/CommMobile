import { useReducer, useState } from 'react';
import { ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';

import { offeringFormReducer, createInitialState } from '@/components/pages/offerings/form/form-state';
import { validateForm, submitOfferingForm } from '@/components/pages/offerings/form/submit-handler';
import { BasicInfoSection } from '@/components/pages/offerings/form/basic-info-section';
import { CategorySection } from '@/components/pages/offerings/form/category-section';
import { TransactionTypeSection } from '@/components/pages/offerings/form/transaction-type-section';
import { PricingSection } from '@/components/pages/offerings/form/pricing-section';
import { DepositSection } from '@/components/pages/offerings/form/deposit-section';
import { FulfillmentSection } from '@/components/pages/offerings/form/fulfillment-section';
import { ScheduleSection } from '@/components/pages/offerings/form/schedule-section';

export default function NewOfferingScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();
  const [state, dispatch] = useReducer(offeringFormReducer, undefined, createInitialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const error = validateForm(state);
    if (error) {
      Alert.alert('Validation', error);
      return;
    }

    setIsSubmitting(true);
    try {
      const { offeringId } = await submitOfferingForm({ state, communityId: communityId! });

      Alert.alert('Success', 'Offering created!', [
        {
          text: 'View Offering',
          onPress: () => {
            router.replace({
              pathname: '/community/[communityId]/offerings/[offeringId]',
              params: { communityId: communityId!, offeringId },
            });
          },
        },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create offering');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'New Offering' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <BasicInfoSection state={state} dispatch={dispatch} />
        <CategorySection state={state} dispatch={dispatch} />
        <TransactionTypeSection state={state} dispatch={dispatch} />
        <PricingSection state={state} dispatch={dispatch} />
        <DepositSection state={state} dispatch={dispatch} />
        <FulfillmentSection state={state} dispatch={dispatch} />
        <ScheduleSection state={state} dispatch={dispatch} />

        {/* Submit */}
        <Pressable
          className={`rounded-xl py-4 items-center mt-2 ${
            isSubmitting ? 'bg-muted' : 'bg-primary'
          }`}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              Create Offering
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}
