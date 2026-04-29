import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AquaBackground, sawaaColors } from '@/theme/sawaa';
import { useTerminology } from '@/hooks/useTerminology';
import { VERTICAL_SLUG } from '@/constants/config';
import { useAppSelector } from '@/hooks/use-redux';
import { getFontName } from '@/theme/fonts';
import { useHome, useTherapists } from '@/hooks/queries';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { FeaturedClinics } from '@/components/features/home/FeaturedClinics';
import { SupportSessions } from '@/components/features/home/SupportSessions';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t: termT } = useTerminology(VERTICAL_SLUG);
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName('ar', '400');
  const f600 = getFontName('ar', '600');
  const f700 = getFontName('ar', '700');
  const firstName = user?.firstName ?? 'سارة';
  const today = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const homeQuery = useHome();
  const therapistsQuery = useTherapists();
  const [refreshing, setRefreshing] = useState(false);

  const nextBooking = homeQuery.data?.upcomingBookings?.[0] ?? null;
  const unreadCount = homeQuery.data?.unreadNotifications?.length ?? 0;
  const therapists = (therapistsQuery.data ?? []).slice(0, 6);
  const loading = homeQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([homeQuery.refetch(), therapistsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
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
          <Text style={[styles.dateLabel, { fontFamily: f600, textAlign: 'right' }]}>
            {today}
          </Text>
          <Text style={[styles.greeting, { fontFamily: f700, textAlign: 'right' }]}>
            {`صباح الخير، ${firstName}`}
          </Text>
        </Animated.View>

        {(loading || nextBooking) ? (
          <>
            <Animated.View
              entering={FadeInDown.delay(220).duration(700).easing(Easing.out(Easing.cubic))}
              style={[styles.sectionHead, { flexDirection: 'row' }]}
            >
              <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
                {'القادم'}
              </Text>
              {unreadCount > 0 ? (
                <Pressable onPress={() => router.push('/(client)/(tabs)/notifications')}>
                  <Text style={[styles.sectionMeta, { fontFamily: f600, color: sawaaColors.teal[700] }]}>
                    {`${unreadCount.toLocaleString('ar-SA')} تنبيه جديد`}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(700).easing(Easing.out(Easing.cubic))}>
              <UpNextCard loading={loading} booking={nextBooking} f600={f600} f700={f700} />
            </Animated.View>
          </>
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(380).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: 'row' }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {'العيادات المميزة'}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(440).duration(700).easing(Easing.out(Easing.cubic))}>
          <FeaturedClinics f600={f600} f700={f700} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(520).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: 'row' }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {'جلسات الدعم'}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(580).duration(700).easing(Easing.out(Easing.cubic))}>
          <SupportSessions f400={f400} f700={f700} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(640).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: 'row' }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {termT('employee.plural', 'المعالجون')}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(700).duration(800).easing(Easing.out(Easing.cubic))}>
          <TherapistsRow therapists={therapists} f400={f400} f600={f600} f700={f700} />
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
