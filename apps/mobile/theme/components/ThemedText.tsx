import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { getFontName } from '../fonts';

type TextVariant =
  | 'display'
  | 'displaySm'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'label';

interface ThemedTextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'auto';
  style?: TextStyle;
  numberOfLines?: number;
}

/**
 * DS Typography Scale:
 * Display    — 36px Bold
 * Display SM — 28px Bold
 * Heading    — 20px Semibold
 * Subheading — 16px Semibold
 * Body       — 14px Regular
 * Body SM    — 13px Regular / Secondary color
 * Caption    — 12px Regular
 * Label      — 11px Semibold / Uppercase / +5% tracking
 *
 * Rule: Never stack bold on bold.
 */
export function ThemedText({
  children,
  variant = 'body',
  color,
  align,
  style,
  numberOfLines,
}: ThemedTextProps) {
  const { theme, isRTL, language } = useTheme();

  const variantStyles: Record<TextVariant, TextStyle & { _weight: string }> = {
    display:    { fontSize: 36, lineHeight: 45, _weight: '700' },
    displaySm:  { fontSize: 28, lineHeight: 35, _weight: '700' },
    heading:    { fontSize: 20, lineHeight: 26, _weight: '600' },
    subheading: { fontSize: 16, lineHeight: 22, _weight: '600' },
    body:       { fontSize: 14, lineHeight: 21, _weight: '400' },
    bodySm:     { fontSize: 13, lineHeight: 20, _weight: '400', color: theme.colors.textSecondary },
    caption:    { fontSize: 12, lineHeight: 18, _weight: '400' },
    label:      { fontSize: 11, lineHeight: 16, _weight: '600', textTransform: 'uppercase', letterSpacing: 0.6, color: theme.colors.textSecondary },
  };

  const { _weight, ...variantStyle } = variantStyles[variant];
  const fontFamily = getFontName(language, _weight);

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily,
          textAlign: align ?? (isRTL ? 'right' : 'left'),
          color: color ?? theme.colors.textPrimary,
        },
        variantStyle,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
