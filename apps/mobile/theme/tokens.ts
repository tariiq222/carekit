import { colors, typography, spacing, radius, rnShadows, animations } from '@carekit/shared/tokens';

export function buildTheme() {
  return {
    colors: {
      ...colors,
      primary: colors.primary[600],
      accent: colors.secondary[500],
      background: colors.gray[50],
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
