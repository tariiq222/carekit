// Import from shared and adapt for React Native
import { colors, typography, spacing, radius, rnShadows, animations } from '@carekit/shared/tokens';

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows: rnShadows,
  animations,
} as const;

export type AppTheme = typeof theme;
