import { Text, TextProps, StyleSheet } from 'react-native';
import { f400, f500, f600, f700 } from '@/theme/fonts';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
type Align = 'start' | 'center' | 'end';

type RTextProps = TextProps & {
  weight?: Weight;
  align?: Align;
};

const fontFor: Record<Weight, () => string> = {
  regular: () => f400(),
  medium: () => f500(),
  semibold: () => f600(),
  bold: () => f700(),
};

const alignStyle: Record<Align, { textAlign: 'right' | 'center' | 'left' }> = {
  start: { textAlign: 'right' },
  center: { textAlign: 'center' },
  end: { textAlign: 'left' },
};

export function RText({
  style,
  weight = 'regular',
  align = 'start',
  ...rest
}: RTextProps) {
  return (
    <Text
      style={[styles.base, { fontFamily: fontFor[weight]() }, alignStyle[align], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { writingDirection: 'rtl' },
});
