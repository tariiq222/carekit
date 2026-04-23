import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { useFonts } from 'expo-font';
import { useTranslation } from 'react-i18next';

import { store, persistor } from '@/stores/store';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DirContext, buildDirState, type Locale } from '@/hooks/useDir';
import { fontAssets } from '@/theme/fonts';
import { DEFAULT_LANGUAGE } from '@/constants/config';
import '@/i18n'; // initialises i18n + calls forceRTL at module level

function normalizeLocale(raw: string | undefined): Locale {
  if (!raw) return DEFAULT_LANGUAGE as Locale;
  if (raw.startsWith('ar')) return 'ar';
  if (raw.startsWith('en')) return 'en';
  return DEFAULT_LANGUAGE as Locale;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const { i18n } = useTranslation();

  const language = normalizeLocale(i18n.language);
  const dirState = buildDirState(language);

  // Re-render when language changes so DirContext stays in sync
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <DirContext.Provider value={dirState}>
          <ThemeProvider language={language}>
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
