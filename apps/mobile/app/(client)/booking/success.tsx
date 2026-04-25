import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

export default function BookingSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Success icon */}
        <Animated.View entering={ZoomIn.duration(900).easing(Easing.bezier(0.22, 1, 0.36, 1))}>
          <LinearGradient
            colors={[sawaaColors.teal[400], sawaaColors.teal[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Check size={56} color="#fff" strokeWidth={3} />
          </LinearGradient>
        </Animated.View>

        {/* Text */}
        <Animated.View entering={FadeInDown.delay(200).duration(700).easing(Easing.out(Easing.cubic))} style={styles.textBlock}>
          <Text style={[styles.title, { fontFamily: f700 }]}>
            {dir.isRTL ? 'تم تأكيد حجزك' : 'Booking confirmed'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400 }]}>
            {dir.isRTL
              ? 'أرسلنا تفاصيل الجلسة إلى بريدك الإلكتروني'
              : 'Session details sent to your email'}
          </Text>
        </Animated.View>

        {/* Summary card */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(800).easing(Easing.out(Easing.cubic))}
          style={styles.summaryWrap}
        >
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                {dir.isRTL ? 'المعالج' : 'Therapist'}
              </Text>
              <Text style={[styles.summaryValue, { fontFamily: f700 }]}>
                {dir.isRTL ? 'د. فاطمة العمران' : 'Dr. Fatima Al-Omran'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                {dir.isRTL ? 'التاريخ والوقت' : 'Date & time'}
              </Text>
              <Text style={[styles.summaryValue, { fontFamily: f700 }]}>
                {dir.isRTL ? 'الخميس ١٦ نوفمبر · ٦:٣٠ م' : 'Thu Nov 16 · 6:30 PM'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                {dir.isRTL ? 'رقم الحجز' : 'Booking #'}
              </Text>
              <Text style={[styles.summaryValue, { fontFamily: f700, color: sawaaColors.teal[700] }]}>
                #SW-2842
              </Text>
            </View>
          </Glass>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(600).duration(800).easing(Easing.out(Easing.cubic))} style={styles.actions}>
          <Pressable onPress={() => router.replace('/(client)/(tabs)/appointments')}>
            <LinearGradient
              colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={[styles.primaryBtnText, { fontFamily: f700 }]}>
                {dir.isRTL ? 'عرض مواعيدي' : 'View my appointments'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(client)/(tabs)/home')}
            style={styles.secondaryBtn}
          >
            <Text style={[styles.secondaryBtnText, { fontFamily: f600 }]}>
              {dir.isRTL ? 'العودة إلى الرئيسية' : 'Back to home'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 24 },
  iconCircle: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  textBlock: { alignItems: 'center', gap: 6 },
  title: { fontSize: 26, color: sawaaColors.ink[900], textAlign: 'center' },
  subtitle: { fontSize: 14, color: sawaaColors.ink[500], textAlign: 'center', lineHeight: 22 },
  summaryWrap: { width: '100%' },
  summaryCard: { padding: 0 },
  summaryRow: { padding: 14, gap: 2 },
  summaryLabel: { fontSize: 11.5, color: sawaaColors.ink[500] },
  summaryValue: { fontSize: 13.5, color: sawaaColors.ink[900] },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  actions: { width: '100%', gap: 10 },
  primaryBtn: {
    borderRadius: 999, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { color: '#fff', fontSize: 14 },
  secondaryBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: sawaaColors.teal[700], fontSize: 13 },
});
