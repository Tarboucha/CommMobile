import { useState } from 'react';
import { View, Pressable, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

interface MultiSelectorProps<T> {
  label: string;
  placeholder?: string;
  availableItems: T[];
  selectedItems: T[];
  onAdd: (item: T) => void;
  onRemove: (item: T) => void;
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  getItemDescription?: (item: T) => string;
  getItemIcon?: (item: T) => string | null | undefined;
  maxItems?: number;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Multi-Selector Component
 * Generic component for selecting multiple items from a list
 * Used for Cuisines, Categories, Dietary Tags, Allergens, etc.
 */
export function MultiSelector<T>({
  label,
  placeholder = 'Add items',
  availableItems,
  selectedItems,
  onAdd,
  onRemove,
  getItemId,
  getItemLabel,
  getItemDescription,
  getItemIcon,
  maxItems,
  disabled = false,
  loading = false,
}: MultiSelectorProps<T>) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if item is selected
  const isSelected = (item: T) => {
    const itemId = getItemId(item);
    return selectedItems.some((selected) => getItemId(selected) === itemId);
  };

  // Filter available items by search query
  const filteredItems = (availableItems || []).filter((item) => {
    const itemLabel = getItemLabel(item);
    if (!itemLabel) return false;
    const query = searchQuery.toLowerCase();
    return itemLabel.toLowerCase().includes(query);
  });

  // Check if we can add more items
  const canAddMore = !maxItems || selectedItems.length < maxItems;

  // Handle item toggle
  const handleToggle = (item: T) => {
    if (isSelected(item)) {
      onRemove(item);
    } else {
      if (canAddMore) {
        onAdd(item);
      }
    }
  };

  // Open modal
  const handleOpenModal = () => {
    if (disabled || loading) return;
    setSearchQuery('');
    setModalVisible(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View className="mb-4">
      {/* Label */}
      <Text className="text-base font-semibold mb-2">
        {label}
        {maxItems && ` (${selectedItems.length}/${maxItems})`}
      </Text>

      {/* Selected Items Chips */}
      {selectedItems.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {selectedItems.map((item) => {
            const itemIcon = getItemIcon?.(item);
            return (
              <View
                key={getItemId(item)}
                className="flex-row items-center px-4 py-2 rounded-full border-[1.5px] border-primary gap-2 max-w-full bg-primary/20"
              >
                {itemIcon && itemIcon.trim() !== '' && (
                  <Text className="text-base">{itemIcon}</Text>
                )}
                <Text
                  className="text-base font-medium text-primary shrink"
                  numberOfLines={1}
                >
                  {getItemLabel(item) || 'Unknown'}
                </Text>
                <Pressable
                  onPress={() => onRemove(item)}
                  disabled={disabled}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color="#660000" />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <Text className="text-base italic mb-2 text-muted-foreground">
          No items selected
        </Text>
      )}

      {/* Add Button */}
      {(canAddMore || selectedItems.length === 0) && (
        <Pressable
          className={cn(
            'flex-row items-center justify-center py-4 px-4 rounded-lg border-[1.5px] border-dashed border-border gap-2 bg-secondary',
            (disabled || loading) && 'opacity-50'
          )}
          onPress={handleOpenModal}
          disabled={disabled || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#660000" />
          ) : (
            <>
              <Ionicons name="add" size={20} color="#1F2937" />
              <Text className="text-base font-medium">
                {placeholder}
              </Text>
            </>
          )}
        </Pressable>
      )}

      {maxItems && !canAddMore && (
        <Text className="text-xs italic mt-1 text-muted-foreground">
          Maximum of {maxItems} items reached
        </Text>
      )}

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 bg-background">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
            <Text className="text-xl font-bold">Select {label}</Text>
            <Pressable onPress={handleCloseModal} hitSlop={8}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </Pressable>
          </View>

          {/* Search Input */}
          <View className="flex-row items-center px-6 py-4 gap-2">
            <Ionicons
              name="search"
              size={20}
              color="#6B7280"
              style={{ marginLeft: 4 }}
            />
            <TextInput
              className="flex-1 h-12 px-4 rounded-xl text-base bg-muted"
              style={{ color: '#1F2937' }}
              placeholder={`Search ${label.toLowerCase()}...`}
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </Pressable>
            )}
          </View>

          {/* Items List */}
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
            {filteredItems.map((item) => {
              const selected = isSelected(item);
              const itemLabel = getItemLabel(item);
              const itemDescription = getItemDescription?.(item);
              const itemIcon = getItemIcon?.(item);

              return (
                <Pressable
                  key={getItemId(item)}
                  className={cn(
                    'flex-row items-center p-4 rounded-xl border-[1.5px] mb-2 gap-3',
                    selected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border'
                  )}
                  onPress={() => handleToggle(item)}
                  disabled={!selected && !canAddMore}
                >
                  {/* Checkbox */}
                  <View
                    className={cn(
                      'w-[22px] h-[22px] rounded-md border-2 justify-center items-center',
                      selected
                        ? 'border-primary bg-primary'
                        : 'border-border bg-transparent'
                    )}
                  >
                    {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </View>

                  {/* Icon */}
                  {itemIcon && itemIcon.trim() !== '' && (
                    <View className="w-10 h-10 rounded-xl bg-rose-light items-center justify-center">
                      <Text className="text-xl">{itemIcon}</Text>
                    </View>
                  )}

                  {/* Item Info */}
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'text-base font-medium mb-0.5',
                        selected ? 'text-primary' : ''
                      )}
                    >
                      {itemLabel || 'Unknown'}
                    </Text>
                    {itemDescription && (
                      <Text
                        className="text-xs text-muted-foreground"
                        numberOfLines={2}
                      >
                        {itemDescription}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {filteredItems.length === 0 && (
              <View className="items-center justify-center py-16 gap-4">
                <Ionicons name="search-outline" size={48} color="#6B7280" />
                <Text className="text-base text-muted-foreground">
                  No items found
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Done Button */}
          <View className="px-6 py-4 border-t border-border">
            <Pressable
              className="py-4 rounded-xl items-center bg-primary"
              onPress={handleCloseModal}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                Done ({selectedItems.length} selected)
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
