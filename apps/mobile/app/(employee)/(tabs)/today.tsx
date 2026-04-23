import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  ImageBackground,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Building2, Video, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_RAISED, SHADOW_SOFT } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppSelector } from '@/hooks/use-redux';
import { bookingsService } from '@/services/bookings';
import type { Booking } from '@/types/models';

const TYPE_ICON = {
  in_person: Building2,
  online: Video,
  walk_in: Building2,
};

const TYPE_ACCENT: Record<Booking['type'], { tint: string; color: string }> = {
  in_person: { tint: C.tealTint, color: C.tealIcon },
  online: { tint: 'rgba(163,205,160,0.42)', color: C.greenIcon },
  walk_in: { tint: C.peachTint, color: C.peachIcon },
};

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const user = useAppSelector((s) => s.auth.user);
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await bookingsService.getTodayBookings();
      if (res.data) setBookings(res.data.items);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;

  const stats = [
    { label: t('doctor.totalToday'), value: bookings.length, tint: C.tealTint, color: C.tealIcon },
    { label: t('doctor.remaining'), value: confirmed, tint: C.peachTint, color: C.peachIcon },
    { label: t('doctor.completedToday'), value: completed, tint: 'rgba(163,205,160,0.42)', color: C.greenIcon },
  ];

  const greeting = user?.firstName
    ? `${t('doctor.greeting')} ${user.firstName}`
    : t('doctor.greeting');

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.deepTeal} />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 18,
          paddingBottom: 120,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.headerBlock}>
              <Text
                style={[
                  styles.greeting,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                ]}
              >
                {greeting}
              </Text>
            </View>

            <View style={[styles.statsRow, { flexDirection: dir.row }]}>
              {stats.map((s) => (
                <Glass
                  key={s.label}
                  variant="regular"
                  radius={RADII.card}
                  style={[styles.statCard, SHADOW_SOFT]}
                >
                  <View style={[styles.statDot, { backgroundColor: s.tint }]}>
                    <View style={[styles.statDotInner, { backgroundColor: s.color }]} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { textAlign: 'center', writingDirection: dir.writingDirection },
                    ]}
                    numberOfLines={2}
                  >
                    {s.label}
                  </Text>
                </Glass>
              ))}
            </View>

            <SectionHeader title={t('doctor.todaySchedule')} />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const Icon = TYPE_ICON[item.type];
          const accent = TYPE_ACCENT[item.type];
          const clientName = item.client
            ? `${item.client.firstName} ${item.client.lastName}`
            : t('doctor.clientRecord');
          const statusLabel =
            item.status === 'confirmed' ? t('appointments.confirmed') : t('appointments.completed');
          return (
            <Glass
              variant="regular"
              radius={RADII.card}
              interactive
              onPress={() => router.push(`/(employee)/appointment/${item.id}`)}
              style={[styles.timelineCard, { flexDirection: dir.row }, SHADOW]}
            >
              <View style={[styles.typeIcon, { backgroundColor: accent.tint }]}>
                <Icon size={18} strokeWidth={1.6} color={accent.color} />
              </View>
              <View style={[styles.timelineBody, { alignItems: dir.alignStart }]}>
                <Text
                  style={[
                    styles.clientName,
                    { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                  ]}
                  numberOfLines={1}
                >
                  {clientName}
                </Text>
                <View style={[styles.timeRow, { flexDirection: dir.row }]}>
                  <Clock size={12} strokeWidth={1.6} color={C.subtle} />
                  <Text style={styles.timeText}>
                    {item.startTime} — {item.endTime}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: C.ratingGlass }]}>
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
            </Glass>
          );
        }}
        ListEmptyComponent={
          <Glass variant="regular" radius={RADII.card} style={[styles.emptyCard, SHADOW]}>
            <View style={styles.emptyIcon}>
              <Clock size={28} strokeWidth={1.5} color={C.deepTeal} />
            </View>
            <Text
              style={[
                styles.emptyText,
                { textAlign: 'center', writingDirection: dir.writingDirection },
              ]}
            >
              {t('doctor.noAppointmentsToday')}
            </Text>
          </Glass>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: { marginBottom: 18 },
  greeting: { fontSize: 26, fontWeight: '800', color: C.deepTeal, lineHeight: 32 },
  statsRow: { gap: 10, marginBottom: 22 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 14,
  },
  statDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statDotInner: { width: 10, height: 10, borderRadius: 5 },
  statValue: { fontSize: 22, fontWeight: '800', color: C.deepTeal },
  statLabel: { fontSize: 11, color: C.subtle, fontWeight: '500' },
  timelineCard: {
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: { flex: 1, gap: 2 },
  clientName: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
  timeRow: { alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: C.subtle },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: C.deepTeal },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    marginTop: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ratingGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, color: C.subtle },
});
