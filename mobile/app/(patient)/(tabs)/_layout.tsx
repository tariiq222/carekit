import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, Calendar, Bell, User, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/theme/components/ThemedText';
import { notificationsService } from '@/services/notifications';

export default function PatientTabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor:
            Platform.OS === 'ios'
              ? 'transparent'
              : 'rgba(255,255,255,0.95)',
          height: 65 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <Home
              size={22}
              strokeWidth={focused ? 2 : 1.5}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t('tabs.appointments'),
          tabBarIcon: ({ color, focused }) => (
            <Calendar
              size={22}
              strokeWidth={focused ? 2 : 1.5}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.assistant'),
          tabBarButton: (props) => (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(patient)/(tabs)/chat');
              }}
              style={styles.aiButton}
            >
              <LinearGradient
                colors={['#0037B0', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.aiGradient}
              >
                <Sparkles
                  size={20}
                  strokeWidth={1.8}
                  color="#FFF"
                />
              </LinearGradient>
              <ThemedText
                variant="caption"
                color="#1D4ED8"
                style={styles.aiLabel}
              >
                {t('tabs.assistant')}
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Bell
                size={22}
                strokeWidth={focused ? 2 : 1.5}
                color={color}
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <User
              size={22}
              strokeWidth={focused ? 2 : 1.5}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  aiButton: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
    gap: 3,
  },
  aiGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  aiLabel: { fontSize: 9, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
