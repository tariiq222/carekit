import React, { useCallback } from 'react';
import {
  View,
  SectionList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { NotificationItem } from '@/components/features/NotificationItem';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification } from '@/types/models';

const BOOKING_TYPES: Notification['type'][] = [
  'booking_confirmed',
  'booking_cancelled',
  'reminder',
  'payment_received',
];

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { theme, language } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    sections,
    unreadCount,
    loading,
    refreshing,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const handleNotificationPress = useCallback(
    (id: string) => {
      const notification = sections
        .flatMap((s) => s.data)
        .find((n) => n.id === id);
      if (!notification) return;

      if (!notification.isRead) {
        markAsRead(id);
      }

      if (BOOKING_TYPES.includes(notification.type)) {
        router.push('/(patient)/(tabs)/appointments');
      }
    },
    [sections, markAsRead, router],
  );

  const handleMarkAllRead = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllAsRead();
  }, [markAllAsRead]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: theme.colors.surfaceLow },
        ]}
      >
        <ThemedText variant="label">{section.title}</ThemedText>
      </View>
    ),
    [theme.colors.surfaceLow],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem
        notification={item}
        onPress={handleNotificationPress}
        language={language}
      />
    ),
    [handleNotificationPress, language],
  );

  const keyExtractor = useCallback(
    (item: Notification) => item.id,
    [],
  );

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: theme.colors.surface, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText variant="heading">
          {t('notifications.title')}
        </ThemedText>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <ThemedText
              variant="bodySm"
              color={theme.colors.primary[500]}
              style={styles.markAllText}
            >
              {t('notifications.markAllRead')}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* Notifications List */}
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={
          sections.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.primary[500]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: `${theme.colors.textMuted}14` },
              ]}
            >
              <Bell
                size={32}
                strokeWidth={1.2}
                color={theme.colors.textMuted}
              />
            </View>
            <ThemedText
              variant="subheading"
              color={theme.colors.textSecondary}
              align="center"
            >
              {t('notifications.noNotifications')}
            </ThemedText>
            <ThemedText
              variant="bodySm"
              color={theme.colors.textMuted}
              align="center"
            >
              {t('notifications.noNotificationsDesc')}
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  markAllText: {
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
    marginBottom: 100,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
