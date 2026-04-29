import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';

import { AquaBackground, sawaaColors } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { publicEmployeesService } from '@/services/client/employees';
import { branchesService } from '@/services/branches';
import { DaySelector } from '@/components/features/booking/DaySelector';
import { TimeSlotsGrid, type Slot } from '@/components/features/booking/TimeSlotsGrid';
import { BookingCta } from '@/components/features/booking/BookingCta';

function toLocalDateOnly(d: Date): string {
  // YYYY-MM-DD in the device's local timezone — the backend treats `date` as
  // a calendar day in the branch timezone, not a UTC instant.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function BookingScheduleScreen() {
  const params = useLocalSearchParams<{
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    type?: string;
    durationMins?: string;
    durationOptionId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const f400 = getFontName('ar', '400');
  const f500 = getFontName('ar', '500');
  const f600 = getFontName('ar', '600');
  const f700 = getFontName('ar', '700');
  const BackIcon = ChevronRight;

  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const [dayIdx, setDayIdx] = useState(0);
  const [branchId, setBranchId] = useState<string | null>(params.branchId ?? null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotIdx, setSlotIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve a branch if the previous screen didn't pass one — use the first
  // visible public branch as the default.
  useEffect(() => {
    if (branchId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await branchesService.getAll();
        if (cancelled) return;
        if (list.length > 0) setBranchId(list[0].id);
        else setError('لا توجد فروع متاحة');
      } catch {
        if (!cancelled) setError('تعذّر تحميل الفرع');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  // Fetch slots whenever the day, employee, or branch changes.
  useEffect(() => {
    const employeeId = params.employeeId;
    if (!employeeId || !branchId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlotIdx(null);
    (async () => {
      try {
        const data = await publicEmployeesService.getSlots({
          employeeId,
          branchId,
          date: toLocalDateOnly(days[dayIdx]),
          serviceId: params.serviceId,
          durationOptionId: params.durationOptionId,
          durationMins: params.durationMins ? Number(params.durationMins) : undefined,
        });
        if (cancelled) return;
        setSlots(data ?? []);
      } catch {
        if (!cancelled) setError('تعذّر تحميل الأوقات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    params.employeeId,
    branchId,
    dayIdx,
    days,
    params.serviceId,
    params.durationOptionId,
    params.durationMins,
  ]);

  const selectedSlot = slotIdx != null ? slots[slotIdx] : null;
  const selectedDay = days[dayIdx];

  const handleConfirm = () => {
    if (!selectedSlot || !branchId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(client)/booking/confirm',
      params: {
        serviceId: params.serviceId,
        employeeId: params.employeeId ?? '',
        branchId,
        type: params.type ?? 'in_person',
        scheduledAt: selectedSlot.startTime,
        durationOptionId: params.durationOptionId,
      },
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={[styles.topRow, { flexDirection: 'row' }]}>
            <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
              <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
            </Glass>
            <Text style={[styles.step, { fontFamily: f600 }]}>
              {'الخطوة ٢ من ٣'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '66%' }]} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: 'right' }]}>
            {'اختاري موعداً'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: 'right' }]}>
            {'الأوقات المتاحة بحسب جدول المختصة'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <DaySelector
            days={days}
            dayIdx={dayIdx}
            onSelect={setDayIdx}
            f500={f500}
            f700={f700}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(240).duration(600).easing(Easing.out(Easing.cubic))}
          style={[styles.slotsHead, { flexDirection: 'row' }]}
        >
          <Text style={[styles.slotsTitle, { fontFamily: f700 }]}>
            {'الأوقات المتاحة'}
          </Text>
          <Text style={[styles.tz, { fontFamily: f400 }]}>
            {'بتوقيت الرياض'}
          </Text>
        </Animated.View>

        <TimeSlotsGrid
          loading={loading}
          error={error}
          slots={slots}
          selectedIdx={slotIdx}
          onSelect={setSlotIdx}
          f500={f500}
          f600={f600}
        />
      </ScrollView>

      <BookingCta
        selectedDay={selectedDay}
        selectedSlot={selectedSlot}
        onConfirm={handleConfirm}
        bottomInset={insets.bottom}
        f400={f400}
        f700={f700}
      />
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  topRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  step: { fontSize: 12, color: sawaaColors.ink[500] },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: sawaaColors.teal[600] },
  title: { fontSize: 26, color: sawaaColors.ink[900], marginTop: 8, paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: sawaaColors.ink[500], marginTop: 4, paddingHorizontal: 4 },
  slotsHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  slotsTitle: { fontSize: 14, color: sawaaColors.ink[900] },
  tz: { fontSize: 11.5, color: sawaaColors.ink[500] },
});
