import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { publicEmployeesService } from '@/services/client/employees';
import { branchesService } from '@/services/branches';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_AR_SHORT = ['أحد', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const DAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Slot {
  startTime: string;
  endTime: string;
}

function toLocalDateOnly(d: Date): string {
  // YYYY-MM-DD in the device's local timezone — the backend treats `date` as
  // a calendar day in the branch timezone, not a UTC instant.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime(iso: string, isRTL: boolean): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${suffix}`;
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
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

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
        else setError(dir.isRTL ? 'لا توجد فروع متاحة' : 'No branches available');
      } catch {
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الفرع' : 'Failed to load branch');
      }
    })();
    return () => { cancelled = true; };
  }, [branchId, dir.isRTL]);

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
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الأوقات' : 'Failed to load times');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.employeeId, branchId, dayIdx, days, params.serviceId, params.durationOptionId, params.durationMins, dir.isRTL]);

  const selectedSlot = slotIdx != null ? slots[slotIdx] : null;
  const selectedDay = days[dayIdx];
  const monthLabel = dir.isRTL
    ? `${MONTHS_AR[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
    : `${MONTHS_EN[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={[styles.topRow, { flexDirection: dir.row }]}>
            <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
              <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
            </Glass>
            <Text style={[styles.step, { fontFamily: f600 }]}>
              {dir.isRTL ? 'الخطوة ٢ من ٣' : 'Step 2 of 3'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '66%' }]} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'اختاري موعداً' : 'Pick a time'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'الأوقات المتاحة بحسب جدول المختصة' : 'Available times based on the therapist\'s schedule'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.monthCard}>
            <View style={[styles.monthHead, { flexDirection: dir.row }]}>
              <View />
              <Text style={[styles.monthTitle, { fontFamily: f700 }]}>{monthLabel}</Text>
              <View />
            </View>
            <View style={[styles.daysRow, { flexDirection: dir.row }]}>
              {days.map((d, i) => {
                const isActive = i === dayIdx;
                const dow = d.getDay();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDayIdx(i);
                    }}
                    style={[styles.dayCell, !isActive && styles.dayCellInactive]}
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
                      styles.dayName,
                      { fontFamily: f500, color: isActive ? 'rgba(255,255,255,0.9)' : sawaaColors.ink[700] },
                    ]}>
                      {dir.isRTL ? DAYS_AR_SHORT[dow] : DAYS_EN_SHORT[dow]}
                    </Text>
                    <Text style={[
                      styles.dayNum,
                      { fontFamily: f700, color: isActive ? '#fff' : sawaaColors.ink[900] },
                    ]}>
                      {dir.isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Glass>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(240).duration(600).easing(Easing.out(Easing.cubic))}
          style={[styles.slotsHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.slotsTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'الأوقات المتاحة' : 'Available times'}
          </Text>
          <Text style={[styles.tz, { fontFamily: f400 }]}>
            {dir.isRTL ? 'بتوقيت الرياض' : 'Riyadh time'}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.statusBlock}>
            <ActivityIndicator color={sawaaColors.teal[600]} />
          </View>
        ) : error ? (
          <View style={styles.statusBlock}>
            <Text style={[styles.statusText, { fontFamily: f500 }]}>{error}</Text>
          </View>
        ) : slots.length === 0 ? (
          <View style={styles.statusBlock}>
            <Text style={[styles.statusText, { fontFamily: f500 }]}>
              {dir.isRTL ? 'لا توجد أوقات متاحة في هذا اليوم' : 'No available times on this day'}
            </Text>
          </View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(80).duration(500).easing(Easing.out(Easing.cubic))}
            style={[styles.slotsGrid, { flexDirection: dir.row }]}
          >
            {slots.map((s, i) => {
              const isSelected = slotIdx === i;
              return (
                <Pressable
                  key={s.startTime}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSlotIdx(i);
                  }}
                  style={styles.slotWrap}
                >
                  <Glass variant={isSelected ? 'strong' : 'regular'} radius={16} style={styles.slot}>
                    {isSelected ? (
                      <LinearGradient
                        colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text style={[
                      styles.slotText,
                      { fontFamily: f600, color: isSelected ? '#fff' : sawaaColors.ink[900] },
                    ]}>
                      {formatTime(s.startTime, dir.isRTL)}
                    </Text>
                  </Glass>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(420).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
          <View style={[styles.ctaRow, { flexDirection: dir.row }]}>
            <View style={styles.ctaSummary}>
              <Text style={[styles.ctaSummaryTop, { fontFamily: f400 }]}>
                {selectedSlot
                  ? `${dir.isRTL ? DAYS_AR[selectedDay.getDay()] : DAYS_EN_SHORT[selectedDay.getDay()]} ${dir.isRTL ? selectedDay.getDate().toLocaleString('ar-SA') : selectedDay.getDate()} · ${formatTime(selectedSlot.startTime, dir.isRTL)}`
                  : (dir.isRTL ? 'اختاري وقتاً' : 'Pick a time')}
              </Text>
              <Text style={[styles.ctaSummaryBot, { fontFamily: f700 }]}>
                {dir.isRTL ? 'تأمين مقبول' : 'Insurance accepted'}
              </Text>
            </View>
            <Pressable onPress={handleConfirm} disabled={!selectedSlot} style={styles.ctaBtnPress}>
              <LinearGradient
                colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ctaBtn, !selectedSlot && { opacity: 0.55 }]}
              >
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                  {dir.isRTL ? 'تأكيد' : 'Confirm'}
                </Text>
                <GoIcon size={14} color="#fff" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>
        </Glass>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  topRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  step: { fontSize: 12, color: sawaaColors.ink[500] },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.4)' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: sawaaColors.teal[600] },
  title: { fontSize: 26, color: sawaaColors.ink[900], marginTop: 8, paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: sawaaColors.ink[500], marginTop: 4, paddingHorizontal: 4 },
  monthCard: { padding: 12 },
  monthHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 10 },
  monthTitle: { fontSize: 13.5, color: sawaaColors.ink[900] },
  daysRow: { justifyContent: 'space-between', gap: 6 },
  dayCell: {
    flex: 1, paddingVertical: 10, borderRadius: 16,
    alignItems: 'center', overflow: 'hidden',
  },
  dayCellInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.55)',
  },
  dayName: { fontSize: 10.5, opacity: 0.85 },
  dayNum: { fontSize: 17, marginTop: 2 },
  slotsHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  slotsTitle: { fontSize: 14, color: sawaaColors.ink[900] },
  tz: { fontSize: 11.5, color: sawaaColors.ink[500] },
  slotsGrid: { flexWrap: 'wrap', gap: 8 },
  slotWrap: { width: '48.5%' },
  slot: { paddingVertical: 14, alignItems: 'center', overflow: 'hidden' },
  slotText: { fontSize: 13.5 },
  statusBlock: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 13, color: sawaaColors.ink[500] },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 8, height: 46 },
  ctaSummary: { flex: 1, paddingHorizontal: 10 },
  ctaSummaryTop: { fontSize: 10, color: sawaaColors.ink[500] },
  ctaSummaryBot: { fontSize: 12, color: sawaaColors.ink[900], marginTop: 2 },
  ctaBtnPress: { height: 46 },
  ctaBtn: {
    paddingHorizontal: 18, borderRadius: 999, height: 46,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 13 },
});
