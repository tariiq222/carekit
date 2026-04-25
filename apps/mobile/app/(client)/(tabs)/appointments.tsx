import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useClientBookings, clientBookingsKeys } from '@/hooks/queries';
import { type ClientBookingStatus } from '@/services/client';

type TabKey = 'upcoming' | 'past' | 'cancelled';

const TABS: { key: TabKey; ar: string; en: string }[] = [
  { key: 'upcoming', ar: 'قادمة', en: 'Upcoming' },
  { key: 'past', ar: 'منتهية', en: 'Completed' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
];

const GRADIENTS: Array<readonly [string, string]> = [
  ['#f7cbb7', '#e88f6c'],
  ['#c9e4ff', '#7aa8e0'],
  ['#d4c8f0', '#8c78d0'],
  ['#ffd5a8', '#e09b5a'],
  ['#b8e4d6', '#5aa893'],
];

function hashGradient(id: string) {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % GRADIENTS.length;
  return GRADIENTS[h];
}

function tabOf(status: ClientBookingStatus): TabKey {
  if (status === 'CANCELLED' || status === 'CANCEL_REQUESTED' || status === 'EXPIRED') {
    return 'cancelled';
  }
  if (status === 'COMPLETED' || status === 'NO_SHOW') return 'past';
  return 'upcoming';
}

function formatDate(iso: string, isRTL: boolean) {
  const d = new Date(iso);
  return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatTime(iso: string, isRTL: boolean) {
  return new Date(iso).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const router = useRouter();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [tab, setTab] = useState<TabKey>('upcoming');
  const queryClient = useQueryClient();
  const { data, isLoading, isRefetching, refetch } = useClientBookings({ limit: 50 });
  const bookings = data?.items ?? [];
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const items = useMemo(
    () => bookings.filter((b) => tabOf(b.status) === tab),
    [bookings, tab],
  );

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: clientBookingsKeys.all });
    refetch();
  };

  const statusConfig: Record<TabKey, { icon: React.ReactNode; color: string }> = {
    upcoming: { icon: <Clock size={12} color={sawaaColors.teal[700]} strokeWidth={2} />, color: sawaaColors.teal[700] },
    past: { icon: <CheckCircle2 size={12} color={sawaaColors.teal[600]} strokeWidth={2} />, color: sawaaColors.teal[600] },
    cancelled: { icon: <XCircle size={12} color={sawaaColors.accent.coral} strokeWidth={2} />, color: sawaaColors.accent.coral },
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={sawaaColors.teal[600]}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'مواعيدي' : 'Appointments'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f500, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'جلساتك الحالية والسابقة' : 'Your upcoming and past sessions'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <Glass variant="regular" radius={sawaaRadius.pill} style={styles.tabsWrap}>
            <View style={[styles.tabsRow, { flexDirection: dir.row }]}>
              {TABS.map((t) => {
                const isActive = t.key === tab;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text style={[
                      styles.tabBtnText,
                      { fontFamily: f600, color: isActive ? '#fff' : sawaaColors.ink[700] },
                    ]}>
                      {dir.isRTL ? t.ar : t.en}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Glass>
        </Animated.View>

        {isLoading ? (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.empty}>
            <Text style={[styles.emptyText, { fontFamily: f400 }]}>
              {dir.isRTL ? 'جاري التحميل…' : 'Loading…'}
            </Text>
          </Animated.View>
        ) : items.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.empty}>
            <Calendar size={40} color={sawaaColors.ink[400]} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { fontFamily: f600 }]}>
              {dir.isRTL ? 'لا توجد مواعيد' : 'No appointments'}
            </Text>
          </Animated.View>
        ) : (
          items.map((b, i) => {
            const status: TabKey = tabOf(b.status);
            const gradient = hashGradient(b.id);
            const therapistName = (dir.isRTL
              ? b.employee?.nameAr ?? b.employee?.nameEn
              : b.employee?.nameEn ?? b.employee?.nameAr) ?? '—';
            const initial = therapistName.charAt(0);
            const isVideo = b.bookingType === 'ONLINE';
            const location = isVideo
              ? (dir.isRTL ? 'جلسة فيديو' : 'Video call')
              : (dir.isRTL ? b.branch?.nameAr ?? b.branch?.nameEn ?? '' : b.branch?.nameEn ?? b.branch?.nameAr ?? '');
            return (
              <Animated.View
                key={b.id}
                entering={FadeInDown.delay(180 + i * 70).duration(600).easing(Easing.out(Easing.cubic))}
              >
                <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
                  <Pressable
                    onPress={() => router.push(`/(client)/appointment/${b.id}`)}
                    style={styles.cardInner}
                  >
                    <View style={[styles.cardTop, { flexDirection: dir.row }]}>
                      <LinearGradient
                        colors={gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatar}
                      >
                        <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
                      </LinearGradient>
                      <View style={styles.cardMid}>
                        <Text style={[styles.therapist, { fontFamily: f700, textAlign: dir.textAlign }]}>
                          {therapistName}
                        </Text>
                        <View style={[styles.metaRow, { flexDirection: dir.row }]}>
                          {isVideo ? (
                            <Video size={12} color={sawaaColors.teal[600]} strokeWidth={2} />
                          ) : (
                            <MapPin size={12} color={sawaaColors.accent.violet} strokeWidth={2} />
                          )}
                          <Text style={[styles.metaText, { fontFamily: f500 }]}>{location}</Text>
                        </View>
                      </View>
                      <Chevron size={16} color={sawaaColors.ink[400]} strokeWidth={2} />
                    </View>

                    <View style={styles.divider} />

                    <View style={[styles.cardBottom, { flexDirection: dir.row }]}>
                      <View style={[styles.dateCol, { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' }]}>
                        <Text style={[styles.dateLabel, { fontFamily: f400 }]}>
                          {dir.isRTL ? 'التاريخ' : 'Date'}
                        </Text>
                        <Text style={[styles.dateValue, { fontFamily: f600 }]}>
                          {formatDate(b.scheduledAt, dir.isRTL)}
                        </Text>
                      </View>
                      <View style={[styles.dateCol, { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' }]}>
                        <Text style={[styles.dateLabel, { fontFamily: f400 }]}>
                          {dir.isRTL ? 'الوقت' : 'Time'}
                        </Text>
                        <Text style={[styles.dateValue, { fontFamily: f600 }]}>
                          {formatTime(b.scheduledAt, dir.isRTL)}
                        </Text>
                      </View>
                      <View style={[styles.statusChip, { backgroundColor: `${statusConfig[status].color}1e` }]}>
                        {statusConfig[status].icon}
                        <Text style={[
                          styles.statusChipText,
                          { fontFamily: f600, color: statusConfig[status].color },
                        ]}>
                          {dir.isRTL ? TABS.find((t) => t.key === status)!.ar : TABS.find((t) => t.key === status)!.en}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Glass>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  title: { fontSize: 26, color: sawaaColors.ink[900], paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: sawaaColors.ink[500], marginTop: 2, paddingHorizontal: 4 },
  tabsWrap: { padding: 4 },
  tabsRow: { gap: 4 },
  tabBtn: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  tabBtnActive: {
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  tabBtnText: { fontSize: 12.5 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 14, color: sawaaColors.ink[500] },
  card: { padding: 0 },
  cardInner: { padding: 14, gap: 12 },
  cardTop: { alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: 'rgba(255,255,255,0.95)' },
  cardMid: { flex: 1 },
  therapist: { fontSize: 14, color: sawaaColors.ink[900] },
  metaRow: { alignItems: 'center', gap: 6, marginTop: 3 },
  metaText: { fontSize: 11.5, color: sawaaColors.ink[500] },
  divider: { height: 0.5, backgroundColor: 'rgba(10,60,60,0.1)' },
  cardBottom: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateCol: { gap: 2 },
  dateLabel: { fontSize: 10.5, color: sawaaColors.ink[400] },
  dateValue: { fontSize: 12.5, color: sawaaColors.ink[900] },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  statusChipText: { fontSize: 10.5 },
});
