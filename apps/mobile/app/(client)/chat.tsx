import { useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, ImageBackground, Text } from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send } from 'react-native-gifted-chat';
import type { IMessage, BubbleProps, InputToolbarProps, SendProps } from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SendHorizonal, RotateCcw } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_RAISED } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { startSession, sendMessage, addUserMessage, clearChat } from '@/stores/slices/chat-slice';
import { ChatQuickActions } from '@/components/chat/chat-quick-actions';
import { ChatTypingIndicator } from '@/components/chat/chat-typing-indicator';

export default function ChatScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const dispatch = useAppDispatch();

  const {
    currentSessionId,
    messages,
    isTyping,
    quickReplies,
    botConfig,
    error,
  } = useAppSelector((state) => state.chat);

  useEffect(() => {
    if (!currentSessionId) {
      dispatch(startSession(dir.isRTL ? 'ar' : 'en'));
    }
  }, [currentSessionId, dispatch, dir.isRTL]);

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

  const handleNewChat = useCallback(() => {
    dispatch(clearChat());
    dispatch(startSession(dir.isRTL ? 'ar' : 'en'));
  }, [dispatch, dir.isRTL]);

  const renderBubble = (props: BubbleProps<IMessage>) => (
    <Bubble
      {...props}
      wrapperStyle={{
        left: { backgroundColor: C.ratingGlass, borderRadius: 20, padding: 2 },
        right: { backgroundColor: C.deepTeal, borderRadius: 20, padding: 2 },
      }}
      textStyle={{
        left: { color: C.deepTeal, writingDirection: dir.writingDirection },
        right: { color: '#FFFFFF', writingDirection: dir.writingDirection },
      }}
    />
  );

  const renderInputToolbar = (props: InputToolbarProps<IMessage>) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={{ alignItems: 'center' }}
    />
  );

  const renderSend = (props: SendProps<IMessage>) => (
    <Send {...props} containerStyle={styles.sendContainer}>
      <View style={[styles.sendButton, SHADOW]}>
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
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Glass header */}
        <Glass
          variant="strong"
          radius={RADII.floating}
          style={[
            styles.header,
            { flexDirection: dir.row },
            SHADOW_RAISED,
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {botName}
          </Text>
          <Pressable onPress={handleNewChat} hitSlop={12} style={styles.resetBtn}>
            <RotateCcw size={18} color={C.deepTeal} />
          </Pressable>
        </Glass>

        {error && (
          <Glass variant="regular" radius={RADII.card} style={styles.errorBanner}>
            <Text style={[styles.errorText, { textAlign: dir.textAlign }]}>{error}</Text>
          </Glass>
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
          showUserAvatar={false}
          alwaysShowSend
          scrollToBottom
          inverted
          bottomOffset={insets.bottom + 80}
          textInputProps={{
            style: [styles.textInput, { textAlign: dir.textAlign }],
            placeholder: t('chatbot.placeholder', 'Type your message...'),
            placeholderTextColor: C.subtle,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.deepTeal, flex: 1 },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.ratingGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    marginHorizontal: 14,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { fontSize: 12, color: '#B42318' },
  inputToolbar: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopColor: C.glassBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sendContainer: { justifyContent: 'center', marginRight: 4, marginLeft: 4 },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 12,
    color: C.deepTeal,
  },
});
