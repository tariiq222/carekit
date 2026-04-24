import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const DAYS_AR = ['ثل', 'أر', 'خم', 'جم', 'سب', 'أح', 'إث'];
const DAYS_EN = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
const DAY_NUMS = [14, 15, 16, 17, 18, 19, 20];

type Slot = { t: string; taken?: boolean };
const SLOTS: Slot[] = [
  { t: '10:00' },
  { t: '11:30', taken: true },
  { t: '1:00' },
  { t: '2:30' },
  { t: '4:00', taken: true },
  { t: '5:30' },
  { t: '6:30' },
  { t: '8:00' },
];

export default function BookingScheduleScreen() {
  const { serviceId, employeeId, type } = useLocalSearchParams<{ serviceId?: string; employeeId?: string; type?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [dayIdx, setDayIdx] = useState(2);
  const [slotIdx, setSlotIdx] = useState<number | null>(6);
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  const selectedSlot = slotIdx != null ? SLOTS[slotIdx] : null;
  const selectedDay = DAY_NUMS[dayIdx];
  const monthAr = `نوفمبر ٢٠٢٥`;
  const monthEn = `November 2025`;

  const handleConfirm = () => {
    if (slotIdx == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(client)/booking/confirm',
      params: {
        serviceId,
        employeeId: employeeId ?? '',
        type: type ?? 'in_person',
        day: String(selectedDay),
        time: SLOTS[slotIdx].t,
      },
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back + progress */}
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

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'اختاري موعداً' : 'Pick a time'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'مع د. فاطمة العمران · جلسة ٥٠ دقيقة' : 'With Dr. Fatima · 50-min session'}
          </Text>
        </Animated.View>

        {/* Month + days */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.monthCard}>
            <View style={[styles.monthHead, { flexDirection: dir.row }]}>
              <Pressable hitSlop={10}>
                <ChevronLeft size={16} color={sawaaColors.ink[700]} strokeWidth={2} />
              </Pressable>
              <Text style={[styles.monthTitle, { fontFamily: f700 }]}>
                {dir.isRTL ? monthAr : monthEn}
              </Text>
              <Pressable hitSlop={10}>
                <ChevronRight size={16} color={sawaaColors.ink[700]} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={[styles.daysRow, { flexDirection: dir.row }]}>
              {DAY_NUMS.map((d, i) => {
                const isActive = i === dayIdx;
                return (
                  <Pressable
                    key={i}
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
                      {dir.isRTL ? DAYS_AR[i] : DAYS_EN[i]}
                    </Text>
                    <Text style={[
                      styles.dayNum,
                      { fontFamily: f700, color: isActive ? '#fff' : sawaaColors.ink[900] },
                    ]}>
                      {dir.isRTL ? d.toLocaleString('ar-SA') : d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Glass>
        </Animated.View>

        {/* Slots header */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(600).easing(Easing.out(Easing.cubic))}
          style={[styles.slotsHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.slotsTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'الأوقات المتاحة' : 'Available times'}
          </Text>
          <Text style={[styles.tz, { fontFamily: f400 }]}>
            {dir.isRTL ? 'التوقيت · بتوقيت الرياض' : 'Riyadh time'}
          </Text>
        </Animated.View>

        {/* Slots grid */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.slotsGrid, { flexDirection: dir.row }]}
        >
          {SLOTS.map((s, i) => {
            const isSelected = slotIdx === i;
            const suffix = Number(s.t.split(':')[0]) < 12 ? (dir.isRTL ? 'ص' : 'AM') : (dir.isRTL ? 'م' : 'PM');
            return (
              <Pressable
                key={i}
                disabled={s.taken}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSlotIdx(i);
                }}
                style={styles.slotWrap}
              >
                <Glass
                  variant={isSelected ? 'strong' : s.taken ? 'clear' : 'regular'}
                  radius={16}
                  style={[styles.slot, s.taken && styles.slotTaken]}
                >
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
                    {
                      fontFamily: f600,
                      color: isSelected ? '#fff' : s.taken ? sawaaColors.ink[400] : sawaaColors.ink[900],
                      textDecorationLine: s.taken ? 'line-through' : 'none',
                    },
                  ]}>
                    {s.t} {suffix}
                  </Text>
                </Glass>
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>

      {/* Confirm CTA */}
      <Animated.View
        entering={FadeInDown.delay(420).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
          <View style={[styles.ctaRow, { flexDirection: dir.row }]}>
            <View style={styles.ctaSummary}>
              <Text style={[styles.ctaSummaryTop, { fontFamily: f400 }]}>
                {dir.isRTL
                  ? `${DAYS_AR[dayIdx]} ${selectedDay.toLocaleString('ar-SA')} نوفمبر · ${selectedSlot?.t ?? ''} م`
                  : `${DAYS_EN[dayIdx]} ${selectedDay} Nov · ${selectedSlot?.t ?? ''} PM`}
              </Text>
              <Text style={[styles.ctaSummaryBot, { fontFamily: f700 }]}>
                {dir.isRTL ? '٢٥٠ ر.س · تأمين مقبول' : 'SAR 250 · Insurance accepted'}
              </Text>
            </View>
            <Pressable onPress={handleConfirm} disabled={slotIdx == null} style={styles.ctaBtnPress}>
              <LinearGradient
                colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ctaBtn, slotIdx == null && { opacity: 0.55 }]}
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
  slotTaken: { opacity: 0.7 },
  slotText: { fontSize: 13.5 },
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
