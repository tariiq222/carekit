import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send } from 'react-native-gifted-chat';
import type { IMessage, BubbleProps, InputToolbarProps, SendProps } from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SendHorizonal, RotateCcw } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useChat } from '@/hooks/queries/useChat';
import { ChatQuickActions } from '@/components/chat/chat-quick-actions';
import { ChatTypingIndicator } from '@/components/chat/chat-typing-indicator';

export default function ChatScreen() {
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    messages,
    isTyping,
    quickReplies,
    botConfig,
    error,
    sendMessage,
    reset,
  } = useChat(isRTL ? 'ar' : 'en');

  const handleSend = useCallback(
    (newMessages: IMessage[] = []) => {
      if (newMessages.length === 0) return;
      sendMessage(newMessages[0]);
    },
    [sendMessage],
  );

  const handleQuickAction = useCallback(
    (_action: string, label: string) => {
      const msg: IMessage = {
        _id: `user-${Date.now()}`,
        text: label,
        createdAt: new Date(),
        user: { _id: 'user' },
      };
      handleSend([msg]);
    },
    [handleSend],
  );

  const renderBubble = (props: BubbleProps<IMessage>) => (
    <Bubble
      {...props}
      wrapperStyle={{
        left: { backgroundColor: theme.colors.surfaceHigh, borderRadius: 16 },
        right: { backgroundColor: theme.colors.primary, borderRadius: 16 },
      }}
      textStyle={{
        left: { color: theme.colors.textPrimary },
        right: { color: '#FFFFFF' },
      }}
    />
  );

  const renderInputToolbar = (props: InputToolbarProps<IMessage>) => (
    <InputToolbar
      {...props}
      containerStyle={[
        styles.inputToolbar,
        { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      ]}
      primaryStyle={{ alignItems: 'center' }}
    />
  );

  const renderSend = (props: SendProps<IMessage>) => (
    <Send {...props} containerStyle={styles.sendContainer}>
      <View style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}>
        <SendHorizonal size={18} color="#FFFFFF" />
      </View>
    </Send>
  );

  const renderFooter = () => {
    if (isTyping) return <ChatTypingIndicator />;
    if (quickReplies.length > 0) {
      return <ChatQuickActions quickReplies={quickReplies} onPress={handleQuickAction} />;
    }
    return null;
  };

  const botName = botConfig?.bot_name ?? t('tabs.assistant');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <ThemedText variant="heading">{botName}</ThemedText>
        <Pressable onPress={reset} hitSlop={8}>
          <RotateCcw size={20} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.error + '15' }]}>
          <ThemedText variant="caption" color={theme.colors.error}>{error}</ThemedText>
        </View>
      )}

      <GiftedChat
        messages={messages}
        onSend={handleSend}
        user={{ _id: 'user' }}
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
        renderFooter={renderFooter}
        isTyping={isTyping}
        isSendButtonAlwaysVisible
        textInputProps={{
          placeholder: t('chatbot.placeholder', 'Type your message...'),
          style: [styles.textInput, { color: theme.colors.textPrimary }],
          placeholderTextColor: theme.colors.textMuted,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  errorBanner: { paddingHorizontal: 16, paddingVertical: 8 },
  inputToolbar: { borderTopWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  sendContainer: { justifyContent: 'center', marginRight: 4 },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: { flex: 1, fontSize: 15, lineHeight: 20, paddingHorizontal: 12 },
});
