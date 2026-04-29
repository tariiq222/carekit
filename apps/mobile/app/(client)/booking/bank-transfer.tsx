import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Banknote, ChevronRight, Copy, Upload } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { clientPaymentsService } from '@/services/client';

export default function BankTransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoiceId, amount, bookingId } = useLocalSearchParams<{
    invoiceId?: string;
    amount?: string;
    bookingId?: string;
  }>();
  const f400 = getFontName('ar', '400');
  const f500 = getFontName('ar', '500');
  const f600 = getFontName('ar', '600');
  const f700 = getFontName('ar', '700');
  const BackIcon = ChevronRight;
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const uploaded = !!receiptUri;
  const numericAmount = amount ? Number(amount) : 0;
  const amountLabel = `${numericAmount.toLocaleString('ar-SA')} ر.س`;

  const pickReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('يلزم إذن المعرض');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const submitReceipt = async () => {
    if (!receiptUri || !invoiceId || submitting) return;
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('مبلغ غير صالح');
      return;
    }
    setSubmitting(true);
    try {
      const payment = await clientPaymentsService.uploadBankTransfer(invoiceId, numericAmount, receiptUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const successParams = bookingId
        ? { bookingId, invoiceId, paymentId: payment.id }
        : { invoiceId, paymentId: payment.id };
      router.replace({
        pathname: '/(client)/booking/success',
        params: successParams,
      });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'تعذّر رفع الإيصال',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const details = [
    { labelAr: 'البنك', labelEn: 'Bank', value: 'البنك الأهلي السعودي' },
    { labelAr: 'اسم المستفيد', labelEn: 'Beneficiary', value: 'سَواء للرعاية النفسية' },
    { labelAr: 'IBAN', labelEn: 'IBAN', value: 'SA03 8000 0000 6080 1016 7519' },
    { labelAr: 'المبلغ', labelEn: 'Amount', value: amountLabel },
  ];

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <View style={[styles.titleRow, { flexDirection: 'row' }]}>
            <View style={styles.titleIcon}>
              <Banknote size={22} color={sawaaColors.accent.amber} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: f700, textAlign: 'right' }]}>
                {'التحويل البنكي'}
              </Text>
              <Text style={[styles.subtitle, { fontFamily: f400, textAlign: 'right' }]}>
                {'حوّل المبلغ ثم ارفع الإيصال'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Bank details */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            {details.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.row,
                  { flexDirection: 'row' },
                  i < details.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, { fontFamily: f500, textAlign: 'right' }]}>
                    {d.labelAr}
                  </Text>
                  <Text style={[styles.rowValue, { fontFamily: f700, textAlign: 'right' }]}>
                    {d.value}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => Haptics.selectionAsync()}
                  style={styles.copyBtn}
                >
                  <Copy size={14} color={sawaaColors.teal[700]} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </Glass>
        </Animated.View>

        {/* Upload receipt */}
        <Animated.View entering={FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: 'right' }]}>
            {'إيصال التحويل'}
          </Text>
          <Glass
            variant={uploaded ? 'strong' : 'regular'}
            radius={sawaaRadius.xl}
            onPress={pickReceipt}
            interactive
            style={styles.uploadCard}
          >
            <View style={styles.uploadInner}>
              <View style={[
                styles.uploadIcon,
                { backgroundColor: uploaded ? 'rgba(20,168,154,0.18)' : 'rgba(255,255,255,0.45)' },
              ]}>
                <Upload size={24} color={uploaded ? sawaaColors.teal[600] : sawaaColors.ink[500]} strokeWidth={1.75} />
              </View>
              <Text style={[styles.uploadTitle, { fontFamily: f700 }]}>
                {uploaded
                  ? 'تم رفع الإيصال'
                  : 'انقر لرفع صورة الإيصال'}
              </Text>
              <Text style={[styles.uploadSub, { fontFamily: f400 }]}>
                {'PNG, JPG, PDF · حتى ٥ ميجا'}
              </Text>
            </View>
          </Glass>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(360).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Pressable disabled={!uploaded || submitting} onPress={submitReceipt}>
          <LinearGradient
            colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, (!uploaded || submitting) && { opacity: 0.55 }]}
          >
            <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
              {submitting
                ? 'جاري الإرسال…'
                : 'إرسال للمراجعة'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  titleRow: { alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  titleIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(232,168,74,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, color: sawaaColors.ink[900] },
  subtitle: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 2 },
  card: { padding: 0 },
  row: { padding: 14, alignItems: 'center', gap: 10 },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)' },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: 11, color: sawaaColors.ink[500] },
  rowValue: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2 },
  copyBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(20,168,154,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, color: sawaaColors.ink[900], marginBottom: 8, paddingHorizontal: 4 },
  uploadCard: { padding: 24 },
  uploadInner: { alignItems: 'center', gap: 10 },
  uploadIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: 14, color: sawaaColors.ink[900] },
  uploadSub: { fontSize: 11.5, color: sawaaColors.ink[500] },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaBtn: {
    borderRadius: 999, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 14 },
});
