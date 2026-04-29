import type { ViewStyle } from 'react-native';

import { sawaaColors, sawaaRadius } from './sawaa/tokens';

export const C = {
  deepTeal: sawaaColors.teal[700],
  subtle: sawaaColors.ink[500],
  text: sawaaColors.ink[900],
  border: sawaaColors.glass.border,
  notifDot: sawaaColors.accent.coral,
} as const;

export const RADII = {
  card: sawaaRadius.xl,
  floating: sawaaRadius.xl,
  image: sawaaRadius.md,
  pill: sawaaRadius.pill,
} as const;

export const SHADOW: ViewStyle = {
  shadowColor: sawaaColors.teal[700],
  shadowOpacity: 0.18,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
};

export const SHADOW_SOFT: ViewStyle = {
  shadowColor: sawaaColors.teal[700],
  shadowOpacity: 0.10,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};
