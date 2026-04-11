import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { AppointmentCard } from '@/components/features/AppointmentCard';
import { useTheme } from '@/theme/useTheme';
import { bookingsService } from '@/services/bookings';
import type { Booking, BookingStatus } from '@/types/models';

type TabKey = 'upcoming' | 'past' | 'cancelled';

const TAB_STATUSES: Record<TabKey, BookingStatus[]> = {
  upcoming: ['pending', 'confirmed'],
  past: ['completed'],
  cancelled: ['cancelled', 'pending_cancellation'],
};

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'upcoming', label: t('appointments.upcoming') },
    { key: 'past', label: t('appointments.past') },
    { key: 'cancelled', label: t('appointments.cancelled') },
  ];

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingsService.getAll({
        status: TAB_STATUSES[activeTab],
      });
      if (res.data) setBookings(res.data.items);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  const emptyMessages: Record<TabKey, string> = {
    upcoming: t('appointments.noUpcoming'),
    past: t('appointments.noPast'),
    cancelled: t('appointments.noCancelled'),
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 }]}>
      <ThemedText variant="displaySm" style={styles.title}>
        {t('appointments.title')}
      </ThemedText>

      {/* Segmented Tabs */}
      <View style={[styles.segmented, { backgroundColor: theme.colors.surfaceLow }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.segTab,
                isActive && {
                  backgroundColor: theme.colors.white,
                  shadowColor: '#001551',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                },
              ]}
            >
              <ThemedText
                variant="bodySm"
                color={isActive ? '#1D4ED8' : theme.colors.textSecondary}
                style={{ fontWeight: isActive ? '600' : '400' }}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AppointmentCard
            booking={item}
            onPress={(id) => router.push(`/(client)/appointment/${id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Calendar size={48} strokeWidth={1} color={theme.colors.textMuted} />
            <ThemedText variant="body" color={theme.colors.textMuted} align="center">
              {emptyMessages[activeTab]}
            </ThemedText>
            {activeTab === 'upcoming' && (
              <ThemedButton onPress={() => {}} variant="primary" size="sm">
                {t('appointments.bookNew')}
              </ThemedButton>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 16 },
  segmented: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 2,
    marginBottom: 16,
  },
  segTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
  },
  list: { paddingBottom: 100, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 80,
  },
});
