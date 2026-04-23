import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW_SOFT } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';

// Critically-damped spring — snappy but never bouncy, exactly like iOS tab bars.
const INDICATOR_SPRING = { damping: 28, stiffness: 320, mass: 0.85 };
const ICON_SPRING      = { damping: 20, stiffness: 280, mass: 0.7 };

const TAB_H  = 60; // total container height
const PILL_H = 52; // indicator pill — 4px breathing room top + bottom
const PILL_V = (TAB_H - PILL_H) / 2; // vertical offset to center the pill

type IconMap = Record<string, LucideIcon>;

type GlassTabBarProps = BottomTabBarProps & {
  icons: IconMap;
  badges?: Record<string, number | undefined>;
};

export function GlassTabBar({ state, descriptors, navigation, icons, badges }: GlassTabBarProps) {
  const dir = useDir();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  const numTabs = state.routes.length;
  const tabW = containerWidth > 0 ? containerWidth / numTabs : 0;
  const pillW = tabW > 0 ? tabW - 8 : 0;

  // When using row-reverse (web RTL), map logical index to visual left position.
  // In native auto-mirror mode dir.row === 'row' and RN flips transforms itself.
  const toX = (index: number) => {
    const vi = dir.row === 'row-reverse' ? numTabs - 1 - index : index;
    return vi * tabW + 4;
  };

  const indicatorX  = useSharedValue(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (tabW <= 0) return;
    const target = toX(state.index);
    if (!initialized.current) {
      // Snap to position on first measure — no animation.
      indicatorX.value = target;
      initialized.current = true;
    } else {
      indicatorX.value = withSpring(target, INDICATOR_SPRING);
    }
  }, [state.index, tabW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

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
      <View
        style={styles.container}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {/* Glass pill indicator — renders behind tabs */}
        {pillW > 0 && (
          <Animated.View
            style={[styles.indicator, { width: pillW, height: PILL_H, top: PILL_V }, indicatorStyle]}
          />
        )}

        {/* Tab items — rendered on top of indicator */}
        <View style={[styles.tabsRow, { flexDirection: dir.row }]}>
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
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, ICON_SPRING);
  }, [focused]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.1]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -1.5]) },
    ],
  }));

  const labelWrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1]) }],
  }));

  const iconColor = focused ? C.deepTeal : C.subtle;
  const hasBadge = !!badge && badge > 0;

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={styles.tabItemInner}>
        <Animated.View style={[styles.iconContainer, iconWrapStyle]}>
          {Icon && (
            <Icon
              size={24}
              color={iconColor}
              fill={focused ? C.deepTeal : 'transparent'}
              strokeWidth={focused ? 2 : 1.6}
            />
          )}
          {hasBadge && <View style={styles.badgeDot} />}
        </Animated.View>

        <Animated.Text
          style={[
            styles.label,
            focused && styles.labelActive,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            labelWrapStyle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  container: {
    position: 'relative',
    height: TAB_H,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    borderRadius: RADII.pill,
    backgroundColor: C.activeTab,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
  },
  tabsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabItemInner: { alignItems: 'center', gap: 3, paddingVertical: 6 },
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
