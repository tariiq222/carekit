import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import ar from './ar.json';
import en from './en.json';
import { DEFAULT_LANGUAGE } from '@/constants/config';

// Set RTL direction before any component renders.
// forceRTL takes effect on the NEXT full app launch —
// after calling it once, subsequent launches will have I18nManager.isRTL = true.
const initialIsRTL = DEFAULT_LANGUAGE === 'ar';
I18nManager.allowRTL(initialIsRTL);
if (I18nManager.isRTL !== initialIsRTL) {
  I18nManager.forceRTL(initialIsRTL);
}

const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Sync RTL on subsequent language changes (e.g. user switches to EN)
i18n.on('languageChanged', (lng) => {
  const isRTL = lng === 'ar';
  I18nManager.allowRTL(isRTL);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
  }
});

export default i18n;
