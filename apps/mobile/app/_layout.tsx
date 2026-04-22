import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { store, persistor } from '@/stores/store';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DirContext, buildDirState } from '@/hooks/useDir';
import '@/i18n';

export default function RootLayout() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
    }
  }, []);

  const dirState = buildDirState('ar');

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <DirContext.Provider value={dirState}>
          <ThemeProvider language="ar">
            <SafeAreaProvider>
              <Slot />
              <StatusBar style="dark" />
            </SafeAreaProvider>
          </ThemeProvider>
        </DirContext.Provider>
      </PersistGate>
    </ReduxProvider>
  );
}
