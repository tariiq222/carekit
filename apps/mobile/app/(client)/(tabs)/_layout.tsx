import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Bell, Calendar, Home, MessageCircle, User } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW_RAISED } from '@/theme/glass';
import { sawaaColors } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { notificationsService } from '@/services/notifications';
import { getFontName } from '@/theme/fonts';

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationsService
      .getUnreadCount()
      .then((res) => setUnreadCount(res.data?.count ?? 0))
      .catch(() => {});
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => <GlassTabBar {...props} unreadCount={unreadCount} />}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="appointments" options={{ title: t('tabs.appointments') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.assistant') }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabs.notifications') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}

function GlassTabBar({ state, descriptors, navigation, unreadCount }: any) {
  const dir = useDir();
  const insets = useSafeAreaInsets();

  return (
    <Glass
      variant="strong"
      radius={RADII.floating}
      style={[
        styles.tabBar,
        SHADOW_RAISED,
        {
          bottom: insets.bottom + 14,
          left: 14,
          right: 14,
        },
      ]}
    >
      <View style={[styles.tabBarInner, { flexDirection: dir.row }]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title || route.name;
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
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const color = focused ? sawaaColors.teal[700] : sawaaColors.ink[500];
  const Icon = getIcon(routeName);

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={styles.tabItemInner}>
        {focused ? (
          <Glass
            variant="clear"
            radius={20}
            style={[styles.activeCapsule, { backgroundColor: C.activeTab }]}
          >
            <Icon size={20} color={color} strokeWidth={1.9} />
          </Glass>
        ) : (
          <View style={styles.iconContainer}>
            <Icon size={20} color={color} strokeWidth={1.75} />
            {badge && badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
              </View>
            ) : null}
          </View>
        )}
        <Text
          style={[
            styles.label,
            { fontFamily: focused ? f700 : f500, color },
            focused && styles.labelActive,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  home: Home,
  appointments: Calendar,
  chat: MessageCircle,
  notifications: Bell,
  profile: User,
};

function getIcon(routeName: string) {
  return ICONS[routeName] ?? Home;
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tabBarInner: {
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    gap: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCapsule: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10.5,
  },
  labelActive: {
    fontSize: 11,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
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
