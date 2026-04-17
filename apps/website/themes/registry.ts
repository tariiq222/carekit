import type { WebsiteTheme } from '@carekit/shared';
import type { Theme } from './types';
import { SawaaLayout } from './sawaa/layout/layout';
import { SawaaHomePage } from './sawaa/pages/home';
import { PremiumLayout } from './premium/layout/layout';
import { PremiumHomePage } from './premium/pages/home';

export const themes: Record<WebsiteTheme, Theme> = {
  SAWAA: {
    name: 'SAWAA',
    Layout: SawaaLayout,
    pages: { home: SawaaHomePage },
  },
  PREMIUM: {
    name: 'PREMIUM',
    Layout: PremiumLayout,
    pages: { home: PremiumHomePage },
  },
};
