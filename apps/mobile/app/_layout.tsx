import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';

import { store, persistor } from '@/stores/store';
import { queryClient } from '@/services/query-client';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DirContext, buildDirState } from '@/hooks/useDir';
import { loadCurrentOrgId } from '@/services/tenant';
import '@/i18n';

export default function RootLayout() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
    }
    void loadCurrentOrgId();
  }, []);

  const dirState = buildDirState('ar');

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <DirContext.Provider value={dirState}>
            <ThemeProvider language="ar">
              <SafeAreaProvider>
                <Slot />
                <StatusBar style="dark" />
              </SafeAreaProvider>
            </ThemeProvider>
          </DirContext.Provider>
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
