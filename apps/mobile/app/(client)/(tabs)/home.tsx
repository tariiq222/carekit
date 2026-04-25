import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AquaBackground, sawaaColors } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getFontName } from '@/theme/fonts';
import { clientPortalService, type PortalBookingRow } from '@/services/client/portal';
import { publicEmployeesService, type PublicEmployeeItem } from '@/services/client/employees';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { FeaturedClinics } from '@/components/features/home/FeaturedClinics';
import { SupportSessions } from '@/components/features/home/SupportSessions';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const firstName = user?.firstName ?? (dir.isRTL ? 'سارة' : 'Sara');
  const today = new Date().toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const [nextBooking, setNextBooking] = useState<PortalBookingRow | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [therapists, setTherapists] = useState<PublicEmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHome = React.useCallback(async () => {
    try {
      const [home, therapistList] = await Promise.all([
        clientPortalService.getHome(),
        publicEmployeesService.list().catch(() => [] as PublicEmployeeItem[]),
      ]);
      setNextBooking(home.upcomingBookings?.[0] ?? null);
      setUnreadCount(home.unreadNotifications?.length ?? 0);
      setTherapists(therapistList.slice(0, 6));
    } catch {
      // Network/auth errors leave the screen in its empty state — better
      // than masking with stale mock data.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadHome();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHome]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={sawaaColors.teal[600]}
          />
        }
      >
        <HomeTopBar f600={f600} />

        <Animated.View
          entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.greetingBlock}
        >
          <Text style={[styles.dateLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>
            {today}
          </Text>
          <Text style={[styles.greeting, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? `صباح الخير، ${firstName}` : `Good morning, ${firstName}`}
          </Text>
        </Animated.View>

        {(loading || nextBooking) ? (
          <>
            <Animated.View
              entering={FadeInDown.delay(220).duration(700).easing(Easing.out(Easing.cubic))}
              style={[styles.sectionHead, { flexDirection: dir.row }]}
            >
              <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
                {dir.isRTL ? 'القادم' : 'Up next'}
              </Text>
              {unreadCount > 0 ? (
                <Pressable onPress={() => router.push('/(client)/(tabs)/notifications')}>
                  <Text style={[styles.sectionMeta, { fontFamily: f600, color: sawaaColors.teal[700] }]}>
                    {dir.isRTL
                      ? `${unreadCount.toLocaleString('ar-SA')} تنبيه جديد`
                      : `${unreadCount} new alert${unreadCount === 1 ? '' : 's'}`}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(700).easing(Easing.out(Easing.cubic))}>
              <UpNextCard loading={loading} booking={nextBooking} dir={dir} f600={f600} f700={f700} />
            </Animated.View>
          </>
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(380).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'العيادات المميزة' : 'Featured Clinics'}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(440).duration(700).easing(Easing.out(Easing.cubic))}>
          <FeaturedClinics dir={dir} f600={f600} f700={f700} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(520).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'جلسات الدعم' : 'Support sessions'}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(580).duration(700).easing(Easing.out(Easing.cubic))}>
          <SupportSessions dir={dir} f400={f400} f700={f700} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(640).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'المعالجون' : 'Therapists'}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(700).duration(800).easing(Easing.out(Easing.cubic))}>
          <TherapistsRow therapists={therapists} dir={dir} f400={f400} f600={f600} f700={f700} />
        </Animated.View>
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  greetingBlock: { paddingHorizontal: 4, marginTop: 4 },
  dateLabel: { fontSize: 12, color: sawaaColors.teal[700], opacity: 0.75 },
  greeting: { fontSize: 26, lineHeight: 34, color: sawaaColors.ink[900], marginTop: 2 },
  sectionHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, color: sawaaColors.ink[900] },
  sectionMeta: { fontSize: 12 },
});
