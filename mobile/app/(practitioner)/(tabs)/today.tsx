import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Stethoscope,
  Building2,
  Phone,
  Video,
  Clock,
  Check,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { useAppSelector } from '@/hooks/use-redux';
import { bookingsService } from '@/services/bookings';
import type { Booking } from '@/types/models';

const TYPE_ICON = {
  clinic_visit: Building2,
  phone_consultation: Phone,
  video_consultation: Video,
};

const TYPE_COLOR = {
  clinic_visit: '#1D4ED8',
  phone_consultation: '#059669',
  video_consultation: '#7C3AED',
};

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();
  const user = useAppSelector((s) => s.auth.user);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await bookingsService.getAll({ status: ['pending', 'confirmed', 'completed'] });
      if (res.data) setBookings(res.data.items);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const remaining = confirmed;

  const stats = [
    { label: t('doctor.totalToday'), value: bookings.length, color: '#1D4ED8' },
    { label: t('doctor.remaining'), value: remaining, color: '#F59E0B' },
    { label: t('doctor.completedToday'), value: completed, color: '#059669' },
  ];

  const greeting = user?.firstName
    ? `${t('doctor.greeting')} ${user.firstName}`
    : t('doctor.greeting');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <LinearGradient
        colors={['#0037B0', '#1D4ED8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <Stethoscope size={20} strokeWidth={1.5} color="#FFF" />
          <ThemedText variant="subheading" color="#FFF">
            {t('common.appName')}
          </ThemedText>
        </View>
        <ThemedText variant="heading" color="#FFF">
          {greeting}
        </ThemedText>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <ThemedCard key={s.label} style={styles.statCard}>
            <ThemedText variant="displaySm" color={s.color} align="center">
              {s.value}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary} align="center">
              {s.label}
            </ThemedText>
          </ThemedCard>
        ))}
      </View>

      {/* Timeline */}
      <ThemedText variant="subheading" style={styles.sectionTitle}>
        {t('doctor.todaySchedule')}
      </ThemedText>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const Icon = TYPE_ICON[item.type];
          const color = TYPE_COLOR[item.type];
          const patientName = item.patient
            ? `${item.patient.firstName} ${item.patient.lastName}`
            : t('doctor.patientRecord');
          return (
            <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <ThemedCard style={styles.timelineCard}>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: `${color}14` }]}>
                    <Icon size={16} strokeWidth={1.5} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="subheading" numberOfLines={1}>
                      {patientName || t('doctor.patientRecord')}
                    </ThemedText>
                    <View style={styles.timeRow}>
                      <Clock size={12} strokeWidth={1.5} color={theme.colors.textMuted} />
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {item.startTime} — {item.endTime}
                      </ThemedText>
                    </View>
                  </View>
                  <StatusPill
                    status={item.status}
                    label={item.status === 'confirmed' ? t('appointments.confirmed') : t('appointments.completed')}
                  />
                </View>
              </ThemedCard>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Clock size={48} strokeWidth={1} color={theme.colors.textMuted} />
            <ThemedText variant="body" color={theme.colors.textMuted} align="center">
              {t('doctor.noAppointmentsToday')}
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: -12 },
  statCard: { flex: 1, alignItems: 'center', gap: 4, padding: 14 },
  sectionTitle: { paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  timelineCard: { padding: 14 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', gap: 16, paddingTop: 60 },
});
