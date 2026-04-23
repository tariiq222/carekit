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
import { Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_RAISED } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { SectionHeader } from '@/components/SectionHeader';
import { AppointmentCard } from '@/components/features/AppointmentCard';
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
  const dir = useDir();

  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'upcoming', label: t('appointments.upcoming') },
    { key: 'past', label: t('appointments.past') },
    { key: 'cancelled', label: t('appointments.cancelled') },
  ];

  const loadBookings = useCallback(async () => {
    try {
      const res = await bookingsService.getAll({ status: TAB_STATUSES[activeTab] });
      if (res.data) setBookings(res.data.items);
    } catch {
      setBookings([]);
    }
  }, [activeTab]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <View style={{ flex: 1, paddingTop: insets.top + 18, paddingHorizontal: 18 }}>
        <SectionHeader title={t('appointments.title')} size="screen" style={styles.title} />

        {/* Glass segmented control */}
        <Glass
          variant="strong"
          radius={RADII.pill}
          style={[styles.segmented, { flexDirection: dir.row }, SHADOW_RAISED]}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.segTab,
                  isActive && { backgroundColor: C.activeTab },
                ]}
              >
                <Text
                  style={[
                    styles.segLabel,
                    {
                      color: isActive ? C.deepTeal : C.subtle,
                      fontWeight: isActive ? '800' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </Glass>

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.deepTeal} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Glass variant="regular" radius={RADII.card} style={[styles.emptyCard, SHADOW]}>
              <View style={styles.emptyIcon}>
                <Calendar size={28} strokeWidth={1.5} color={C.deepTeal} />
              </View>
              <Text
                style={[
                  styles.emptyText,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                ]}
              >
                {emptyMessages[activeTab]}
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
  title: { marginBottom: 16 },
  segmented: {
    padding: 4,
    gap: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  segTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADII.pill,
    alignItems: 'center',
  },
  segLabel: { fontSize: 13 },
  list: { paddingBottom: 120, flexGrow: 1 },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    marginTop: 32,
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
