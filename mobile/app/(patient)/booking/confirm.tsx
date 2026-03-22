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
  Building2,
  Phone,
  Video,
  Calendar,
  Clock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { bookingsService } from '@/services/bookings';
import type { BookingType } from '@/types/models';

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  clinic_visit: { icon: Building2, color: '#1D4ED8' },
  phone_consultation: { icon: Phone, color: '#059669' },
  video_consultation: { icon: Video, color: '#7C3AED' },
};

export default function BookingConfirmScreen() {
  const params = useLocalSearchParams<{
    practitionerId: string;
    type: string;
    date: string;
    time: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const meta = TYPE_META[params.type ?? 'clinic_visit'];
  const TypeIcon = meta.icon;

  // Price calculation (placeholder — real prices come from API)
  const basePrice = params.type === 'phone_consultation' ? 180 : params.type === 'video_consultation' ? 220 : 250;
  const vat = Math.round(basePrice * 0.15);
  const total = basePrice + vat;

  const formattedDate = params.date
    ? new Date(params.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const typeLabel = t(`booking.${params.type === 'clinic_visit' ? 'clinicVisit' : params.type === 'phone_consultation' ? 'phoneConsultation' : 'videoConsultation'}`);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingsService.create({
        practitionerId: params.practitionerId ?? '',
        type: (params.type ?? 'clinic_visit') as BookingType,
        date: params.date ?? '',
        startTime: params.time ?? '',
        notes: notes || undefined,
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({
          pathname: '/(patient)/booking/payment',
          params: {
            bookingId: res.data?.id ?? '',
            total: String(total),
            type: params.type ?? 'clinic_visit',
          },
        });
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [params, notes, router, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        {/* Progress */}
        <View style={styles.progressRow}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('booking.step')} 3 {t('booking.of')} 4
          </ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceHigh }]}>
            <LinearGradient
              colors={['#0037B0', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: '75%' }]}
            />
          </View>
        </View>

        <ThemedText variant="heading" style={styles.title}>
          {t('booking.confirmBooking')}
        </ThemedText>

        {/* Summary Card */}
        <ThemedCard style={styles.summaryCard}>
          {/* Type */}
          <View style={styles.summaryRow}>
            <View style={[styles.iconCircle, { backgroundColor: `${meta.color}14` }]}>
              <TypeIcon size={18} strokeWidth={1.5} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="label" color={theme.colors.textSecondary}>
                {t('appointments.type')}
              </ThemedText>
              <ThemedText variant="body" style={{ fontWeight: '500' }}>
                {typeLabel}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceLow }]} />

          {/* Date */}
          <View style={styles.summaryRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#1D4ED814' }]}>
              <Calendar size={18} strokeWidth={1.5} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="label" color={theme.colors.textSecondary}>
                {t('appointments.date')}
              </ThemedText>
              <ThemedText variant="body" style={{ fontWeight: '500' }}>
                {formattedDate}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceLow }]} />

          {/* Time */}
          <View style={styles.summaryRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#F59E0B14' }]}>
              <Clock size={18} strokeWidth={1.5} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="label" color={theme.colors.textSecondary}>
                {t('appointments.time')}
              </ThemedText>
              <ThemedText variant="body" style={{ fontWeight: '500' }}>
                {params.time}
              </ThemedText>
            </View>
          </View>
        </ThemedCard>

        {/* Price Breakdown */}
        <ThemedCard style={styles.priceCard}>
          <View style={styles.priceRow}>
            <ThemedText variant="body" color={theme.colors.textSecondary}>
              {t('appointments.amount')}
            </ThemedText>
            <ThemedText variant="body">{basePrice} {t('home.sar')}</ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText variant="body" color={theme.colors.textSecondary}>
              {t('appointments.vat')}
            </ThemedText>
            <ThemedText variant="body">{vat} {t('home.sar')}</ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceLow }]} />
          <View style={styles.priceRow}>
            <ThemedText variant="subheading">{t('appointments.total')}</ThemedText>
            <ThemedText variant="subheading" color="#1D4ED8">
              {total} {t('home.sar')}
            </ThemedText>
          </View>
        </ThemedCard>

        {/* CTA */}
        <ThemedButton
          onPress={handleConfirm}
          variant="primary"
          size="lg"
          full
          loading={loading}
          disabled={loading}
          style={{ marginTop: 24 }}
        >
          {t('booking.confirmBooking')}
        </ThemedButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  progressRow: { gap: 8, marginBottom: 24 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  title: { marginBottom: 20 },
  summaryCard: { gap: 0, padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: 2 },
  priceCard: { gap: 10, padding: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
