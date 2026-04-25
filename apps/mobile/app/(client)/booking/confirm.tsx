import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronLeft, ChevronRight, Clock, Video } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

export default function BookingConfirmScreen() {
  const { serviceId, employeeId, type, day, time } = useLocalSearchParams<{
    serviceId?: string; employeeId?: string; type?: string; day?: string; time?: string;
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

  const isOnline = type === 'online';
  const kindAr = isOnline ? 'استشارة عن بُعد' : 'موعد عيادة';
  const kindEn = isOnline ? 'Remote consultation' : 'In-clinic visit';
  const dayAr = day ? `${day} نوفمبر ٢٠٢٥` : 'الخميس ١٦ نوفمبر ٢٠٢٥';
  const dayEn = day ? `Nov ${day}, 2025` : 'Thu Nov 16, 2025';
  const timeAr = time ? `${time} م` : '٦:٣٠ م';
  const timeEn = time ? `${time} PM` : '6:30 PM';

  const PRICE = 250;
  const VAT = Math.round(PRICE * 0.15);
  const TOTAL = PRICE + VAT;

  const rows = [
    { icon: <Video size={18} color={sawaaColors.accent.violet} strokeWidth={1.75} />, labelAr: 'نوع الزيارة', labelEn: 'Visit type', valueAr: kindAr, valueEn: kindEn, color: sawaaColors.accent.violet },
    { icon: <Calendar size={18} color={sawaaColors.teal[600]} strokeWidth={1.75} />, labelAr: 'التاريخ', labelEn: 'Date', valueAr: dayAr, valueEn: dayEn, color: sawaaColors.teal[600] },
    { icon: <Clock size={18} color={sawaaColors.accent.amber} strokeWidth={1.75} />, labelAr: 'الوقت', labelEn: 'Time', valueAr: timeAr, valueEn: timeEn, color: sawaaColors.accent.amber },
  ];

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: '/(client)/booking/payment',
      params: { serviceId, employeeId, type, day, time },
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
              {dir.isRTL ? 'الخطوة ٣ من ٣' : 'Step 3 of 3'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'تأكيد الحجز' : 'Confirm booking'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'راجعي التفاصيل قبل التأكيد' : 'Review your details before confirming'}
          </Text>
        </Animated.View>

        {/* Summary card */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            {rows.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.row,
                  { flexDirection: dir.row },
                  i < rows.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: `${r.color}1e` }]}>{r.icon}</View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? r.labelAr : r.labelEn}
                  </Text>
                  <Text style={[styles.rowValue, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? r.valueAr : r.valueEn}
                  </Text>
                </View>
              </View>
            ))}
          </Glass>
        </Animated.View>

        {/* Price breakdown */}
        <Animated.View entering={FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            <View style={[styles.priceRow, { flexDirection: dir.row }]}>
              <Text style={[styles.priceLabel, { fontFamily: f500 }]}>
                {dir.isRTL ? 'المبلغ' : 'Subtotal'}
              </Text>
              <Text style={[styles.priceValue, { fontFamily: f600 }]}>
                {dir.isRTL ? `${PRICE.toLocaleString('ar-SA')} ر.س` : `SAR ${PRICE}`}
              </Text>
            </View>
            <View style={[styles.priceRow, { flexDirection: dir.row }]}>
              <Text style={[styles.priceLabel, { fontFamily: f500 }]}>
                {dir.isRTL ? 'ضريبة القيمة المضافة' : 'VAT (15%)'}
              </Text>
              <Text style={[styles.priceValue, { fontFamily: f600 }]}>
                {dir.isRTL ? `${VAT.toLocaleString('ar-SA')} ر.س` : `SAR ${VAT}`}
              </Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={[styles.priceRow, { flexDirection: dir.row }]}>
              <Text style={[styles.priceLabelBold, { fontFamily: f700 }]}>
                {dir.isRTL ? 'الإجمالي' : 'Total'}
              </Text>
              <Text style={[styles.priceTotal, { fontFamily: f700 }]}>
                {dir.isRTL ? `${TOTAL.toLocaleString('ar-SA')} ر.س` : `SAR ${TOTAL}`}
              </Text>
            </View>
          </Glass>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(360).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Pressable onPress={handleConfirm} style={styles.ctaBtnPress}>
          <LinearGradient
            colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaBtn}
          >
            <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
              {dir.isRTL ? 'متابعة الدفع' : 'Continue to payment'}
            </Text>
            <GoIcon size={16} color="#fff" strokeWidth={2} />
          </LinearGradient>
        </Pressable>
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
  title: { fontSize: 24, color: sawaaColors.ink[900], marginTop: 8, paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: sawaaColors.ink[500], marginTop: 4, paddingHorizontal: 4 },
  card: { padding: 0 },
  row: { alignItems: 'center', gap: 14, padding: 14 },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: 11, color: sawaaColors.ink[500] },
  rowValue: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2 },
  priceRow: { justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  priceLabel: { fontSize: 13, color: sawaaColors.ink[700] },
  priceLabelBold: { fontSize: 14, color: sawaaColors.ink[900] },
  priceValue: { fontSize: 13, color: sawaaColors.ink[900] },
  priceTotal: { fontSize: 16, color: sawaaColors.teal[700] },
  priceDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.5)', marginHorizontal: 16 },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaBtnPress: {},
  ctaBtn: {
    borderRadius: 999, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 14 },
});
