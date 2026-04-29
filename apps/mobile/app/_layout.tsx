import { useEffect, useRef } from 'react';
import { I18nManager } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';

import { store, persistor } from '@/stores/store';
import { queryClient } from '@/services/query-client';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { loadCurrentOrgId } from '@/services/tenant';
import { useAppSelector } from '@/hooks/use-redux';
import { registerForPushAsync } from '@/services/push';
import '@/i18n';

function PushBootstrap() {
  const token = useAppSelector((s) => s.auth.token);
  useEffect(() => {
    if (!token) return;
    void registerForPushAsync();
  }, [token]);
  return null;
}

function AuthRouter() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  // Skip the very first effect run — that's the moment right after
  // rehydration where token may flip null→value as redux-persist replays
  // saved state. Without this, an initial transient null kicks an already-
  // logged-in user back to /(auth)/login on app cold-start.
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!token) {
      router.replace('/(auth)/login');
    }
  }, [token, router]);

  return null;
}

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function RootLayout() {
  useEffect(() => {
    void loadCurrentOrgId();
  }, []);

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <PushBootstrap />
          <AuthRouter />
          <ThemeProvider language="ar">
            <SafeAreaProvider>
              <Slot />
              <StatusBar style="dark" />
            </SafeAreaProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
