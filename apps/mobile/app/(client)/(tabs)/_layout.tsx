import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { C, RADII, SHADOW_RAISED } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { notificationsService } from '@/services/notifications';

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
              icon={getIcon(route.name)}
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
  icon,
  focused,
  onPress,
  badge,
}: {
  label: string;
  icon: string;
  focused: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const dir = useDir();

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={styles.tabItemInner}>
        {focused ? (
          <Glass
            variant="clear"
            radius={20}
            style={[styles.activeCapsule, { backgroundColor: C.activeTab }]}
          >
            <Text style={styles.icon}>{icon}</Text>
          </Glass>
        ) : (
          <View style={styles.iconContainer}>
            <Text style={[styles.icon, { opacity: 0.6 }]}>{icon}</Text>
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
            focused && styles.labelActive,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
        >
          {label}
        </Text>
        {focused ? <View style={styles.pip} /> : null}
      </View>
    </Pressable>
  );
}

function getIcon(routeName: string): string {
  const icons: Record<string, string> = {
    home: '🏠',
    appointments: '📅',
    chat: '💬',
    notifications: '🔔',
    profile: '👤',
  };
  return icons[routeName] || '•';
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    gap: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCapsule: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: C.subtle,
  },
  labelActive: {
    fontSize: 12,
    fontWeight: '800',
    color: C.deepTeal,
  },
  pip: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.deepTeal,
    marginTop: 2,
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
