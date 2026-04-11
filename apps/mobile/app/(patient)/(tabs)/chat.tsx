import { useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send } from 'react-native-gifted-chat';
import type { IMessage, BubbleProps, InputToolbarProps, SendProps } from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SendHorizonal, RotateCcw } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { startSession, sendMessage, addUserMessage, clearChat } from '@/stores/slices/chat-slice';
import { ChatQuickActions } from '@/components/chat/chat-quick-actions';
import { ChatTypingIndicator } from '@/components/chat/chat-typing-indicator';

const BOT_USER = { _id: 'bot', name: 'Assistant' };

export default function ChatScreen() {
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const {
    currentSessionId,
    messages,
    isTyping,
    isLoading,
    quickReplies,
    botConfig,
    error,
  } = useAppSelector((state) => state.chat);

  useEffect(() => {
    if (!currentSessionId) {
      dispatch(startSession(isRTL ? 'ar' : 'en'));
    }
  }, [currentSessionId, dispatch, isRTL]);

  const handleSend = useCallback(
    (newMessages: IMessage[] = []) => {
      if (!currentSessionId || newMessages.length === 0) return;
      const msg = newMessages[0];

      dispatch(addUserMessage(msg));
      dispatch(sendMessage({ sessionId: currentSessionId, content: msg.text }));
    },
    [currentSessionId, dispatch],
  );

  const handleQuickAction = useCallback(
    (action: string, label: string) => {
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

  const handleNewChat = useCallback(() => {
    dispatch(clearChat());
    dispatch(startSession(isRTL ? 'ar' : 'en'));
  }, [dispatch, isRTL]);

  const renderBubble = (props: BubbleProps<IMessage>) => (
    <Bubble
      {...props}
      wrapperStyle={{
        left: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 16 },
        right: { backgroundColor: theme.colors.primary, borderRadius: 16 },
      }}
      textStyle={{
        left: { color: theme.colors.text },
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
        <Pressable onPress={handleNewChat} hitSlop={8}>
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
        placeholder={t('chatbot.placeholder', 'Type your message...')}
        isTyping={isTyping}
        showUserAvatar={false}
        alwaysShowSend
        scrollToBottom
        inverted
        bottomOffset={insets.bottom}
        textInputProps={{
          style: [styles.textInput, { color: theme.colors.text }],
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
