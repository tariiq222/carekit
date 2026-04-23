import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';

import secureStorage from './secure-storage';
import authReducer from './slices/auth-slice';
import chatReducer from './slices/chat-slice';
import brandingReducer from './slices/branding-slice';

const authPersistConfig = {
  key: 'auth',
  storage: secureStorage,
  whitelist: ['token', 'refreshToken', 'user'],
  // Bumped when AuthUser shape changed (added `kind`). Old blobs lack `kind`
  // and would otherwise leak into the new code path — redux-persist drops
  // state with an older version than the current one.
  version: 2,
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  chat: chatReducer,
  branding: brandingReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
