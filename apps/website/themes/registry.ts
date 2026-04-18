import type { WebsiteTheme } from '@carekit/shared';
import type { Theme } from './types';
import { SawaaLayout } from './sawaa/layout/layout';
import { SawaaHomePage } from './sawaa/pages/home';
import { SawaaTherapistsPage } from './sawaa/pages/therapists';
import { SawaaContactPage } from './sawaa/pages/contact';
import { SawaaBurnoutTestPage } from './sawaa/pages/burnout-test';
import { SawaaBookingPage } from './sawaa/pages/booking';
import { PremiumLayout } from './premium/layout/layout';
import { PremiumHomePage } from './premium/pages/home';
import { PremiumTherapistsPage } from './premium/pages/therapists';
import { PremiumContactPage } from './premium/pages/contact';
import { PremiumBurnoutTestPage } from './premium/pages/burnout-test';
import { PremiumBookingPage } from './premium/pages/booking';

export const themes: Record<WebsiteTheme, Theme> = {
  SAWAA: {
    name: 'SAWAA',
    Layout: SawaaLayout,
    pages: {
      home: SawaaHomePage,
      therapists: SawaaTherapistsPage,
      contact: SawaaContactPage,
      burnoutTest: SawaaBurnoutTestPage,
      booking: SawaaBookingPage,
    },
  },
  PREMIUM: {
    name: 'PREMIUM',
    Layout: PremiumLayout,
    pages: {
      home: PremiumHomePage,
      therapists: PremiumTherapistsPage,
      contact: PremiumContactPage,
      burnoutTest: PremiumBurnoutTestPage,
      booking: PremiumBookingPage,
    },
  },
};
