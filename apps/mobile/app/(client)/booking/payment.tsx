import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  CreditCard,
  Building2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { paymentsService } from '@/services/payments';

type PaymentMethod = 'moyasar' | 'bank_transfer';

export default function PaymentScreen() {
  const params = useLocalSearchParams<{
    bookingId: string;
    total: string;
    type: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const totalAmount = Number(params.total) || 0;
  const vatRate = 0.15;
  const baseAmount = Math.round(totalAmount / (1 + vatRate));
  const vatAmount = totalAmount - baseAmount;

  const handleSelectMethod = useCallback((method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(method);
  }, []);

  const handlePay = useCallback(async () => {
    if (!selectedMethod || !params.bookingId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (selectedMethod === 'bank_transfer') {
      router.push({
        pathname: '/(patient)/booking/bank-transfer',
        params: { bookingId: params.bookingId, total: params.total },
      });
      return;
    }

    setLoading(true);
    try {
      const res = await paymentsService.createMoyasarPayment({
        bookingId: params.bookingId,
        source: { type: 'creditcard' },
      });

      if (res.success && res.data?.redirectUrl) {
        const result = await WebBrowser.openAuthSessionAsync(
          res.data.redirectUrl,
          'carekit://payment-callback',
        );

        if (result.type === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: '/(patient)/booking/success',
            params: { bookingId: params.bookingId },
          });
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('common.error'), t('payment.paymentError'));
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('payment.paymentError'));
    } finally {
      setLoading(false);
    }
  }, [selectedMethod, params.bookingId, params.total, router, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon
            size={24}
            strokeWidth={1.5}
            color={theme.colors.textPrimary}
          />
        </Pressable>

        {/* Progress */}
        <View style={styles.progressRow}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('booking.step')} 4 {t('booking.of')} 4
          </ThemedText>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.colors.surfaceHigh },
            ]}
          >
            <LinearGradient
              colors={['#0037B0', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: '100%' }]}
            />
          </View>
        </View>

        <ThemedText variant="heading" style={styles.title}>
          {t('payment.title')}
        </ThemedText>

        {/* Price Summary */}
        <ThemedCard style={styles.summaryCard}>
          <ThemedText variant="label" style={styles.summaryTitle}>
            {t('payment.summary')}
          </ThemedText>
          <View style={styles.priceRow}>
            <ThemedText variant="body" color={theme.colors.textSecondary}>
              {t('payment.amount')}
            </ThemedText>
            <ThemedText variant="body">
              {baseAmount} {t('home.sar')}
            </ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText variant="body" color={theme.colors.textSecondary}>
              {t('payment.vat')}
            </ThemedText>
            <ThemedText variant="body">
              {vatAmount} {t('home.sar')}
            </ThemedText>
          </View>
          <View
            style={[
              styles.divider,
              { backgroundColor: theme.colors.surfaceLow },
            ]}
          />
          <View style={styles.priceRow}>
            <ThemedText variant="subheading">
              {t('payment.total')}
            </ThemedText>
            <ThemedText variant="subheading" color="#1D4ED8">
              {totalAmount} {t('home.sar')}
            </ThemedText>
          </View>
        </ThemedCard>

        {/* Select Payment Method */}
        <ThemedText variant="subheading" style={styles.sectionTitle}>
          {t('payment.selectMethod')}
        </ThemedText>

        {/* Card Payment Option */}
        <ThemedCard
          style={styles.methodCard}
          selected={selectedMethod === 'moyasar'}
          onPress={() => handleSelectMethod('moyasar')}
        >
          <View style={styles.methodRow}>
            <View
              style={[styles.iconCircle, { backgroundColor: '#1D4ED814' }]}
            >
              <CreditCard size={20} strokeWidth={1.5} color="#1D4ED8" />
            </View>
            <View style={styles.methodContent}>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>
                {t('payment.cardPayment')}
              </ThemedText>
              <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
                {t('payment.cardPaymentDesc')}
              </ThemedText>
            </View>
            <View
              style={[
                styles.radio,
                {
                  borderColor:
                    selectedMethod === 'moyasar'
                      ? '#1D4ED8'
                      : theme.colors.textSecondary,
                },
              ]}
            >
              {selectedMethod === 'moyasar' && (
                <View style={styles.radioInner} />
              )}
            </View>
          </View>
        </ThemedCard>

        {/* Bank Transfer Option */}
        <ThemedCard
          style={styles.methodCard}
          selected={selectedMethod === 'bank_transfer'}
          onPress={() => handleSelectMethod('bank_transfer')}
        >
          <View style={styles.methodRow}>
            <View
              style={[styles.iconCircle, { backgroundColor: '#05966914' }]}
            >
              <Building2 size={20} strokeWidth={1.5} color="#059669" />
            </View>
            <View style={styles.methodContent}>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>
                {t('payment.bankTransfer')}
              </ThemedText>
              <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
                {t('payment.bankTransferDesc')}
              </ThemedText>
            </View>
            <View
              style={[
                styles.radio,
                {
                  borderColor:
                    selectedMethod === 'bank_transfer'
                      ? '#1D4ED8'
                      : theme.colors.textSecondary,
                },
              ]}
            >
              {selectedMethod === 'bank_transfer' && (
                <View style={styles.radioInner} />
              )}
            </View>
          </View>
        </ThemedCard>

        {/* Pay Now Button */}
        <ThemedButton
          onPress={handlePay}
          variant="primary"
          size="lg"
          full
          loading={loading}
          disabled={!selectedMethod || loading}
          style={{ marginTop: 24 }}
        >
          {t('payment.payNow')}
        </ThemedButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressRow: { gap: 8, marginBottom: 24 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  title: { marginBottom: 20 },
  summaryCard: { gap: 10, padding: 16, marginBottom: 20 },
  summaryTitle: { marginBottom: 4 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: { height: 1, marginVertical: 4 },
  sectionTitle: { marginBottom: 14 },
  methodCard: { padding: 16, marginBottom: 12 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  methodContent: { flex: 1, gap: 2 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1D4ED8',
  },
});
