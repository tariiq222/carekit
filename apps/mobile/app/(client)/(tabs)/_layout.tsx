import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, Calendar, Bell, User } from 'lucide-react-native';

import { GlassTabBar } from '@/components/GlassTabBar';
import { notificationsService } from '@/services/notifications';

const ICONS = {
  home: Home,
  appointments: Calendar,
  notifications: Bell,
  profile: User,
};

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationsService
      .getUnreadCount()
      .then((res) => setUnreadCount(res.data?.count ?? 0))
      .catch(() => {});
  }, []);

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      tabBar={(props) => (
        <GlassTabBar
          {...props}
          icons={ICONS}
          badges={{ notifications: unreadCount }}
        />
      )}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="appointments" options={{ title: t('tabs.appointments') }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabs.notifications') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
