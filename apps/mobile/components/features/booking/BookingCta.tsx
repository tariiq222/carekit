import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { formatTime, type Slot } from './TimeSlotsGrid';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

interface BookingCtaProps {
  selectedDay: Date;
  selectedSlot: Slot | null;
  onConfirm: () => void;
  /** kept for API compat, no longer rendered */
  f400?: string;
  bottomInset: number;
  f700: string;
}

export function BookingCta({
  selectedDay,
  selectedSlot,
  onConfirm,
  bottomInset,
  f700,
}: BookingCtaProps) {
  const GoIcon = ChevronLeft;
  const dayLabel = DAYS_AR[selectedDay.getDay()];
  const dayNum = selectedDay.getDate().toLocaleString('ar-SA');

  return (
    <Animated.View
      entering={FadeInDown.delay(420).duration(800).easing(Easing.out(Easing.cubic))}
      style={[styles.ctaWrap, { bottom: bottomInset + 20 }]}
    >
      <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
        <View style={[styles.ctaRow, { flexDirection: 'row' }]}>
          <View style={styles.ctaSummary}>
            <Text style={[styles.ctaSummaryBot, { fontFamily: f700 }]}>
              {selectedSlot
                ? `${dayLabel} ${dayNum} · ${formatTime(selectedSlot.startTime, true)}`
                : 'اختاري وقتاً'}
            </Text>
          </View>
          <Pressable onPress={onConfirm} disabled={!selectedSlot} style={styles.ctaBtnPress}>
            <LinearGradient
              colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.ctaBtn, !selectedSlot && { opacity: 0.55 }]}
            >
              <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                {'تأكيد'}
              </Text>
              <GoIcon size={14} color="#fff" strokeWidth={2} />
            </LinearGradient>
          </Pressable>
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 8, height: 46 },
  ctaSummary: { flex: 1, paddingHorizontal: 10 },
  ctaSummaryTop: { fontSize: 10, color: sawaaColors.ink[500] },
  ctaSummaryBot: { fontSize: 12, color: sawaaColors.ink[900], marginTop: 2 },
  ctaBtnPress: { height: 46 },
  ctaBtn: {
    paddingHorizontal: 18,
    borderRadius: 999,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: sawaaColors.teal[600],
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 13 },
});
