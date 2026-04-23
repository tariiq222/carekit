import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, Calendar, Users, User } from 'lucide-react-native';

import { GlassTabBar } from '@/components/GlassTabBar';

const ICONS = {
  today: Home,
  calendar: Calendar,
  clients: Users,
  profile: User,
};

export default function EmployeeTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      tabBar={(props) => <GlassTabBar {...props} icons={ICONS} />}
    >
      <Tabs.Screen name="today" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar') }} />
      <Tabs.Screen name="clients" options={{ title: t('tabs.clients') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
