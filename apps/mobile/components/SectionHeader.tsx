import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';

import { C } from '@/theme/glass';

type SectionHeaderProps = {
  title: string;
  size?: 'screen' | 'section';
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({
  title,
  size = 'section',
  action,
  style,
}: SectionHeaderProps) {
  const titleStyle = size === 'screen' ? styles.titleScreen : styles.titleSection;
  const accentStyle = size === 'screen' ? styles.accentScreen : styles.accentSection;

  return (
    <View
      style={[
        styles.row,
        { flexDirection: 'row' },
        style,
      ]}
    >
      <View style={[styles.labelWrap, { flexDirection: 'row' }]}>
        <View style={accentStyle} />
        <Text
          style={[
            titleStyle,
            { textAlign: 'right', writingDirection: 'rtl' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  labelWrap: {
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  accentScreen: {
    width: 3,
    height: 26,
    borderRadius: 2,
    backgroundColor: C.deepTeal,
    opacity: 0.35,
  },
  accentSection: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: C.deepTeal,
    opacity: 0.35,
  },
  titleScreen: {
    fontSize: 26,
    fontWeight: '800',
    color: C.deepTeal,
    lineHeight: 32,
  },
  titleSection: {
    fontSize: 20,
    fontWeight: '800',
    color: C.deepTeal,
    lineHeight: 26,
  },
  action: {
    fontSize: 13,
    fontWeight: '700',
    color: C.deepTeal,
  },
});
