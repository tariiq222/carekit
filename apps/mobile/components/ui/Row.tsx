import { View, ViewProps, StyleSheet } from 'react-native';

type RowProps = ViewProps & {
  gap?: number;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'baseline' | 'stretch';
  justifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
};

export function Row({
  style,
  gap,
  alignItems = 'center',
  justifyContent,
  ...rest
}: RowProps) {
  return (
    <View
      style={[styles.row, { gap, alignItems, justifyContent }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
