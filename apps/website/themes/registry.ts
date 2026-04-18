import type { WebsiteTheme } from '@carekit/shared';
import type { Theme } from './types';
import { SawaaLayout } from './sawaa/layout/layout';
import { SawaaHomePage } from './sawaa/pages/home';
import { SawaaTherapistsPage } from './sawaa/pages/therapists';
import { SawaaContactPage } from './sawaa/pages/contact';
import { SawaaBurnoutTestPage } from './sawaa/pages/burnout-test';
import { SawaaBookingPage } from './sawaa/pages/booking';
import { SawaaLoginPage } from './sawaa/pages/login';
import { SawaaRegisterPage } from './sawaa/pages/register';
import { SawaaAccountPage } from './sawaa/pages/account';
import { SawaaAccountBookingsPage } from './sawaa/pages/account-bookings';
import { SawaaAccountBookingDetailPage } from './sawaa/pages/account-booking-detail';
import { PremiumLayout } from './premium/layout/layout';
import { PremiumHomePage } from './premium/pages/home';
import { PremiumTherapistsPage } from './premium/pages/therapists';
import { PremiumContactPage } from './premium/pages/contact';
import { PremiumBurnoutTestPage } from './premium/pages/burnout-test';
import { PremiumBookingPage } from './premium/pages/booking';
import { PremiumLoginPage } from './premium/pages/login';
import { PremiumRegisterPage } from './premium/pages/register';
import { PremiumAccountPage } from './premium/pages/account';
import { PremiumAccountBookingsPage } from './premium/pages/account-bookings';
import { PremiumAccountBookingDetailPage } from './premium/pages/account-booking-detail';

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
      login: SawaaLoginPage,
      register: SawaaRegisterPage,
      account: SawaaAccountPage,
      accountBookings: SawaaAccountBookingsPage,
      accountBookingDetail: SawaaAccountBookingDetailPage,
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
      login: PremiumLoginPage,
      register: PremiumRegisterPage,
      account: PremiumAccountPage,
      accountBookings: PremiumAccountBookingsPage,
      accountBookingDetail: PremiumAccountBookingDetailPage,
    },
  },
};
