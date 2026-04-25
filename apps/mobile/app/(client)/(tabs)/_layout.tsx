import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Bell, Calendar, FileText, Home } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW_RAISED } from '@/theme/glass';
import { sawaaColors } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { getFontName } from '@/theme/fonts';

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const { count: unreadCount } = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => <GlassTabBar {...props} unreadCount={unreadCount} />}
    >
      {/* In RTL with row-reverse, routes[0] renders at the right edge. */}
      <Tabs.Screen name="home" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="records" options={{ title: t('tabs.records') }} />
      <Tabs.Screen name="appointments" options={{ title: t('tabs.appointments') }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabs.notifications') }} />
      {/* Hidden — still routable, absent from the bar. */}
      <Tabs.Screen name="chat" options={{ title: t('tabs.assistant'), href: null }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), href: null }} />
    </Tabs>
  );
}

type TabBarProps = BottomTabBarProps & { unreadCount: number };

function GlassTabBar({ state, descriptors, navigation, unreadCount }: TabBarProps) {
  const dir = useDir();
  const insets = useSafeAreaInsets();

  return (
    <Glass
      variant="strong"
      radius={RADII.pill}
      style={[
        styles.tabBar,
        SHADOW_RAISED,
        { bottom: insets.bottom + 14, left: 14, right: 14 },
      ]}
    >
      <View style={[styles.tabBarInner, { flexDirection: dir.row }]}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const label = descriptor.options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              routeName={route.name}
              focused={isFocused}
              onPress={onPress}
              badge={route.name === 'notifications' ? unreadCount : undefined}
            />
          );
        })}
      </View>
    </Glass>
  );
}

function TabItem({
  label,
  routeName,
  focused,
  onPress,
  badge,
}: {
  label: string;
  routeName: string;
  focused: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const dir = useDir();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const color = focused ? sawaaColors.teal[700] : sawaaColors.ink[700];
  const Icon = getIcon(routeName);
  const hasBadge = !!badge && badge > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tabItem}
    >
      <View style={styles.tabItemInner}>
        {focused ? <View style={styles.activePill} pointerEvents="none" /> : null}
        <View style={styles.iconRow}>
          <Icon size={22} color={color} strokeWidth={1.7} />
          {hasBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.label,
            { fontFamily: focused ? f700 : f600, color },
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

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  home: Home,
  records: FileText,
  appointments: Calendar,
  notifications: Bell,
};

function getIcon(routeName: string) {
  return ICONS[routeName] ?? Home;
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
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabItemInner: {
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -10,
    right: -10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  iconRow: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10.5,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.notifDot,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
});
