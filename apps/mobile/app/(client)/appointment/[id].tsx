import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  Video,
  Calendar,
  Clock,
  CreditCard,
  Star,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { bookingsService } from '@/services/bookings';
import type { Booking } from '@/types/models';

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  in_person: { icon: Building2, color: '#1D4ED8' },
  online: { icon: Video, color: '#7C3AED' },
  walk_in: { icon: Building2, color: '#059669' },
};

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    bookingsService
      .getById(id)
      .then((res) => { if (res.data) setBooking(res.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (!booking) return null;

  const meta = TYPE_META[booking.type] ?? TYPE_META.in_person;
  const TypeIcon = meta.icon;
  const practName = `${booking.employee.user.firstName} ${booking.employee.user.lastName}`;
  const statusLabels: Record<string, string> = {
    pending: t('appointments.pending'),
    confirmed: t('appointments.confirmed'),
    completed: t('appointments.completed'),
    cancelled: t('appointments.cancelledStatus'),
    pending_cancellation: t('appointments.pendingCancellation'),
  };
  const formattedDate = new Date(booking.date).toLocaleDateString(
    isRTL ? 'ar-SA' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  );

  const handleCancel = () => {
    Alert.alert(t('appointments.requestCancel'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingsService.requestCancellation(booking.id, '');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        <View style={styles.headerRow}>
          <ThemedText variant="heading">{t('appointments.details')}</ThemedText>
          <StatusPill status={booking.status} label={statusLabels[booking.status] ?? booking.status} />
        </View>

        {/* Employee */}
        <ThemedCard style={styles.practCard}>
          <View style={styles.practRow}>
            <Avatar size={48} name={practName} imageUrl={booking.employee.user.avatarUrl} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="subheading">{practName}</ThemedText>
              <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
                {booking.employee.specialtyAr}
              </ThemedText>
            </View>
          </View>
        </ThemedCard>

        {/* Details */}
        <ThemedCard style={styles.detailCard}>
          <DetailRow icon={TypeIcon} color={meta.color} label={t('appointments.type')} value={t(`booking.${booking.type === 'in_person' ? 'inPerson' : booking.type === 'walk_in' ? 'walkIn' : 'online'}`)} />
          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceLow }]} />
          <DetailRow icon={Calendar} color="#1D4ED8" label={t('appointments.date')} value={formattedDate} />
          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceLow }]} />
          <DetailRow icon={Clock} color="#F59E0B" label={t('appointments.time')} value={`${booking.startTime} — ${booking.endTime}`} />
          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceLow }]} />
          <DetailRow icon={CreditCard} color="#059669" label={t('appointments.total')} value={`${booking.totalAmount} ${t('home.sar')}`} />
        </ThemedCard>

        {/* Actions */}
        <View style={styles.actions}>
          {booking.type === 'online' && booking.zoomLink && booking.status === 'confirmed' && (
            <ThemedButton onPress={() => Linking.openURL(booking.zoomLink!)} variant="primary" size="lg" full>
              {t('appointments.joinZoom')}
            </ThemedButton>
          )}
          {booking.status === 'completed' && (
            <ThemedButton
              onPress={() => router.push(`/(client)/rate/${booking.id}`)}
              variant="secondary"
              size="lg"
              full
              icon={<Star size={16} color="#FFF" />}
            >
              {t('appointments.rate')}
            </ThemedButton>
          )}
          {(booking.status === 'pending' || booking.status === 'confirmed') && (
            <ThemedButton onPress={handleCancel} variant="danger" size="md" full icon={<X size={16} color="#DC2626" />}>
              {t('appointments.requestCancel')}
            </ThemedButton>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: `${color}14` }]}>
        <Icon size={16} strokeWidth={1.5} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>{label}</ThemedText>
        <ThemedText variant="body" style={{ fontWeight: '500' }}>{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  practCard: { marginBottom: 16, padding: 16 },
  practRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailCard: { padding: 16, gap: 0, marginBottom: 24 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  detailIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: 2 },
  actions: { gap: 12 },
});
