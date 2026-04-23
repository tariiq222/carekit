import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW_SOFT } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';

type IconMap = Record<string, LucideIcon>;

type GlassTabBarProps = BottomTabBarProps & {
  icons: IconMap;
  badges?: Record<string, number | undefined>;
};

export function GlassTabBar({ state, descriptors, navigation, icons, badges }: GlassTabBarProps) {
  const dir = useDir();
  const insets = useSafeAreaInsets();

  return (
    <Glass
      variant="clear"
      radius={RADII.pill}
      style={[
        styles.tabBar,
        SHADOW_SOFT,
        { bottom: insets.bottom + 14, left: 14, right: 14 },
      ]}
    >
      <View style={[styles.tabBarInner, { flexDirection: dir.row }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              Icon={icons[route.name]}
              focused={isFocused}
              onPress={onPress}
              badge={badges?.[route.name]}
            />
          );
        })}
      </View>
    </Glass>
  );
}

function TabItem({
  label,
  Icon,
  focused,
  onPress,
  badge,
}: {
  label: string;
  Icon?: LucideIcon;
  focused: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const dir = useDir();
  const iconColor = focused ? C.deepTeal : C.subtle;
  const iconFill = focused ? C.deepTeal : 'transparent';
  const hasBadge = !!badge && badge > 0;

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={styles.tabItemInner}>
        <View style={styles.iconContainer}>
          {Icon ? (
            <Icon
              size={24}
              color={iconColor}
              fill={iconFill}
              strokeWidth={focused ? 2 : 1.6}
            />
          ) : null}
          {hasBadge ? <View style={styles.badgeDot} /> : null}
        </View>
        <Text
          style={[
            styles.label,
            focused && styles.labelActive,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabBarInner: {
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabItemInner: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  iconContainer: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '500', color: C.subtle },
  labelActive: { fontSize: 12, fontWeight: '800', color: C.deepTeal },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.notifDot,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
