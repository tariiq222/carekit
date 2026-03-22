import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { IMessage } from 'react-native-gifted-chat';
import { chatbotService } from '@/services/chatbot';
import type { QuickReply, BotConfig, ActionCard } from '@/types/chat';

interface ChatState {
  currentSessionId: string | null;
  messages: IMessage[];
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;
  quickReplies: QuickReply[];
  botConfig: BotConfig | null;
}

const initialState: ChatState = {
  currentSessionId: null,
  messages: [],
  isTyping: false,
  isLoading: false,
  error: null,
  quickReplies: [],
  botConfig: null,
};

export const startSession = createAsyncThunk(
  'chat/startSession',
  async (language: string | undefined) => {
    const res = await chatbotService.createSession(language);
    return res.data;
  },
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { sessionId, content }: { sessionId: string; content: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await chatbotService.sendMessage(sessionId, content);
      return res.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      return rejectWithValue(message);
    }
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addUserMessage(state, action: { payload: IMessage }) {
      state.messages = [action.payload, ...state.messages];
    },
    clearChat(state) {
      state.currentSessionId = null;
      state.messages = [];
      state.isTyping = false;
      state.error = null;
    },
    setTyping(state, action: { payload: boolean }) {
      state.isTyping = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(startSession.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.currentSessionId = action.payload.session.id;
          state.quickReplies = action.payload.quickReplies;
          state.botConfig = action.payload.botConfig;
          // Add welcome message
          state.messages = [
            {
              _id: `welcome-${Date.now()}`,
              text: action.payload.welcomeMessage,
              createdAt: new Date(),
              user: { _id: 'bot', name: action.payload.botConfig.bot_name },
            },
          ];
        }
      })
      .addCase(startSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to start session';
      })
      .addCase(sendMessage.pending, (state) => {
        state.isTyping = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isTyping = false;
        if (action.payload) {
          const botMsg: IMessage = {
            _id: `bot-${Date.now()}`,
            text: action.payload.message,
            createdAt: new Date(),
            user: {
              _id: 'bot',
              name: state.botConfig?.bot_name ?? 'Assistant',
            },
          };
          state.messages = [botMsg, ...state.messages];
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isTyping = false;
        state.error = (action.payload as string) ?? 'Failed to send message';
      });
  },
});

export const { addUserMessage, clearChat, setTyping } = chatSlice.actions;
export default chatSlice.reducer;
