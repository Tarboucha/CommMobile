import { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { createInvitation, generateInviteLink } from '@/lib/api/communities';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  communityId: string;
}

export function InviteModal({ visible, onClose, communityId }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  function resetState() {
    setEmail('');
    setMessage('');
    setIsSending(false);
    setInviteLink(null);
    setLinkExpiresAt(null);
    setIsGenerating(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleSendEmail() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Error', 'Please enter an email address.');
      return;
    }

    try {
      setIsSending(true);
      await createInvitation(communityId, {
        invited_email: trimmedEmail,
        invitation_message: message.trim() || undefined,
      });
      Alert.alert('Invitation Sent', `An invitation has been sent to ${trimmedEmail}.`);
      setEmail('');
      setMessage('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send invitation.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleGenerateLink() {
    try {
      setIsGenerating(true);
      const result = await generateInviteLink(communityId);
      const link = `kodo://invite/${result.token}`;
      setInviteLink(link);
      setLinkExpiresAt(result.expires_at);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate invite link.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('Copied', 'Invite link copied to clipboard.');
  }

  async function handleShareLink() {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join my community on KoDo! ${inviteLink}`,
      });
    } catch {
      // User cancelled share
    }
  }

  function formatExpiry(dateStr: string): string {
    const date = new Date(dateStr);
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border">
          <Text className="text-lg font-bold text-foreground">Invite Members</Text>
          <Pressable onPress={handleClose} className="p-2">
            <Ionicons name="close" size={24} color="#78716C" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Email Invite Section */}
          <View className="mb-8">
            <View className="flex-row items-center mb-3">
              <Ionicons name="mail-outline" size={20} color="#78716C" />
              <Text className="text-base font-semibold text-foreground ml-2">Invite by Email</Text>
            </View>

            <TextInput
              className="border border-border rounded-xl px-4 py-3 text-foreground bg-card mb-3"
              placeholder="Email address"
              placeholderTextColor="#78716C"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              className="border border-border rounded-xl px-4 py-3 text-foreground bg-card mb-4"
              placeholder="Optional message"
              placeholderTextColor="#78716C"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />

            <Pressable
              className="p-4 rounded-xl bg-primary active:bg-primary/80"
              onPress={handleSendEmail}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-sm font-semibold text-primary-foreground text-center">
                  Send Invitation
                </Text>
              )}
            </Pressable>
          </View>

          {/* Divider */}
          <View className="flex-row items-center mb-8">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-xs text-muted-foreground mx-4">OR</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Share Link Section */}
          <View>
            <View className="flex-row items-center mb-3">
              <Ionicons name="link-outline" size={20} color="#78716C" />
              <Text className="text-base font-semibold text-foreground ml-2">Share Invite Link</Text>
            </View>

            {!inviteLink ? (
              <Pressable
                className="p-4 rounded-xl border border-border bg-card active:bg-muted/50"
                onPress={handleGenerateLink}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-sm font-medium text-foreground text-center">
                    Generate Invite Link
                  </Text>
                )}
              </Pressable>
            ) : (
              <View>
                {/* Link Display */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <Text className="text-sm text-foreground font-mono" selectable>
                    {inviteLink}
                  </Text>
                  {linkExpiresAt && (
                    <Text className="text-xs text-muted-foreground mt-2">
                      {formatExpiry(linkExpiresAt)}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <Pressable
                    className="flex-1 flex-row items-center justify-center p-3 rounded-xl border border-border bg-card active:bg-muted/50"
                    onPress={handleCopyLink}
                  >
                    <Ionicons name="copy-outline" size={18} color="#78716C" />
                    <Text className="text-sm font-medium text-foreground ml-2">Copy</Text>
                  </Pressable>

                  <Pressable
                    className="flex-1 flex-row items-center justify-center p-3 rounded-xl bg-primary active:bg-primary/80"
                    onPress={handleShareLink}
                  >
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text className="text-sm font-medium text-primary-foreground ml-2">Share</Text>
                  </Pressable>
                </View>

                {/* Regenerate */}
                <Pressable
                  className="mt-3 p-3 rounded-xl active:bg-muted/50"
                  onPress={handleGenerateLink}
                  disabled={isGenerating}
                >
                  <Text className="text-xs text-muted-foreground text-center">
                    Generate new link
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
