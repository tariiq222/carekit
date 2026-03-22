import * as SecureStore from 'expo-secure-store';
import type { Storage } from 'redux-persist';

/**
 * Custom storage engine for redux-persist using expo-secure-store.
 * Stores sensitive auth data (tokens) securely instead of AsyncStorage.
 */
const secureStorage: Storage = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

export default secureStorage;
