import type { ComponentType, ReactNode } from 'react';
import type { WebsiteTheme } from '@carekit/shared';

export interface ThemeLayoutProps {
  children: ReactNode;
}

export interface Theme {
  name: WebsiteTheme;
  Layout: ComponentType<ThemeLayoutProps>;
  pages: {
    home: ComponentType;
  };
}
