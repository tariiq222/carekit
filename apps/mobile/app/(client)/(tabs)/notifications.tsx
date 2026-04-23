import { useCallback } from 'react';
import {
  View,
  SectionList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  ImageBackground,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  Bell,
  Calendar,
  CalendarX,
  CreditCard,
  Star,
  AlertTriangle,
  LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_SOFT } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { SectionHeader } from '@/components/SectionHeader';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification } from '@/types/models';

const BOOKING_TYPES: Notification['type'][] = [
  'booking_confirmed',
  'booking_cancelled',
  'booking_completed',
  'booking_rescheduled',
  'booking_reminder',
  'reminder',
  'payment_received',
];

const DEFAULT_CFG = { icon: Bell, tint: C.tealTint, color: C.tealIcon } as const;
const TYPE_MAP: Partial<Record<Notification['type'], { icon: LucideIcon; tint: string; color: string }>> = {
  booking_confirmed: { icon: Calendar, tint: C.greenTint, color: C.greenIcon },
  booking_completed: { icon: Calendar, tint: C.greenTint, color: C.greenIcon },
  booking_cancelled: { icon: CalendarX, tint: C.peachTint, color: C.peachIcon },
  booking_rescheduled: { icon: Calendar, tint: C.tealTint, color: C.tealIcon },
  booking_reminder: { icon: Bell, tint: C.peachTint, color: C.peachIcon },
  booking_reminder_urgent: { icon: Bell, tint: C.peachTint, color: C.peachIcon },
  reminder: { icon: Bell, tint: C.peachTint, color: C.peachIcon },
  payment_received: { icon: CreditCard, tint: C.tealTint, color: C.tealIcon },
  new_rating: { icon: Star, tint: 'rgba(255,179,0,0.2)', color: C.goldText },
  problem_report: { icon: AlertTriangle, tint: C.peachTint, color: C.peachIcon },
  system_alert: { icon: AlertTriangle, tint: C.peachTint, color: C.peachIcon },
};

function relTime(dateStr: string, t: (k: string, o?: Record<string, number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(1, Math.floor(diff / 60_000));
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return t('notifications.minutesAgo', { count: mins });
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  return t('notifications.daysAgo', { count: days });
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const dir = useDir();
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
      const notification = sections.flatMap((s) => s.data).find((n) => n.id === id);
      if (!notification) return;
      if (!notification.isRead) markAsRead(id);
      if (BOOKING_TYPES.includes(notification.type)) {
        router.push('/(client)/(tabs)/appointments');
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
      <Text
        style={[
          styles.sectionHeader,
          { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
        ]}
      >
        {section.title}
      </Text>
    ),
    [dir.textAlign, dir.writingDirection],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => {
      const cfg = TYPE_MAP[item.type] ?? DEFAULT_CFG;
      const Icon = cfg.icon;
      const title = dir.isRTL ? item.titleAr : item.titleEn;
      const message = dir.isRTL ? item.bodyAr : item.bodyEn;
      return (
        <Glass
          variant="regular"
          radius={RADII.card}
          onPress={() => handleNotificationPress(item.id)}
          interactive
          style={[
            styles.itemCard,
            { flexDirection: dir.row },
            !item.isRead && styles.unreadCard,
            SHADOW_SOFT,
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: cfg.tint }]}>
            <Icon size={18} strokeWidth={1.5} color={cfg.color} />
          </View>
          <View style={[styles.itemBody, { alignItems: dir.alignStart }]}>
            <Text
              style={[
                styles.itemTitle,
                { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {!!message && (
              <Text
                style={[
                  styles.itemMsg,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                ]}
                numberOfLines={2}
              >
                {message}
              </Text>
            )}
            <Text
              style={[
                styles.itemTime,
                { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
              ]}
            >
              {relTime(item.createdAt, t)}
            </Text>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </Glass>
      );
    },
    [dir, handleNotificationPress, t],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ImageBackground
          source={require('@/assets/bg.jpg')}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.deepTeal} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <View style={{ flex: 1, paddingTop: insets.top + 18 }}>
        <SectionHeader
          title={t('notifications.title')}
          size="screen"
          action={
            unreadCount > 0
              ? { label: t('notifications.markAllRead'), onPress: handleMarkAllRead }
              : undefined
          }
          style={styles.headerInset}
        />

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.deepTeal} />
          }
          ListEmptyComponent={
            <Glass variant="regular" radius={RADII.card} style={[styles.emptyCard, SHADOW]}>
              <View style={styles.emptyIconCircle}>
                <Bell size={28} strokeWidth={1.2} color={C.deepTeal} />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  { textAlign: 'center', writingDirection: dir.writingDirection },
                ]}
              >
                {t('notifications.noNotifications')}
              </Text>
              <Text
                style={[
                  styles.emptyDesc,
                  { textAlign: 'center', writingDirection: dir.writingDirection },
                ]}
              >
                {t('notifications.noNotificationsDesc')}
              </Text>
            </Glass>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerInset: { paddingHorizontal: 18, marginBottom: 14 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: C.subtle,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  listContent: { paddingHorizontal: 18, paddingBottom: 120 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18 },
  itemCard: {
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  unreadCard: {
    borderWidth: 1,
    borderColor: 'rgba(21,79,87,0.12)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
  itemMsg: { fontSize: 13, color: C.subtle, lineHeight: 18 },
  itemTime: { fontSize: 11, color: C.subtle, marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.notifDot,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 28,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.ratingGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.deepTeal },
  emptyDesc: { fontSize: 13, color: C.subtle },
});
