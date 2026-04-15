import { colors, typography, spacing, radius, rnShadows, animations } from '@carekit/shared/tokens';
import type { BrandingConfig } from '@carekit/shared/types';

export function buildTheme(overrides?: Partial<BrandingConfig>) {
  return {
    colors: {
      ...colors,
      primary: overrides?.colorPrimary ?? colors.primary[600],
      accent: overrides?.colorAccent ?? colors.secondary[500],
      background: overrides?.colorBackground ?? colors.gray[50],
    },
    typography,
    spacing,
    radius,
    shadows: rnShadows,
    animations,
  } as const;
}

export const theme = buildTheme();
export type AppTheme = ReturnType<typeof buildTheme>;
