import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Video,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { employeeBookingsService as bookingsService } from '@/services/employee/bookings';
import type { Booking } from '@/types/models';

function getMinutesUntil(date: string, time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const meetingDate = new Date(date);
  meetingDate.setHours(hours, minutes, 0, 0);
  return Math.floor((meetingDate.getTime() - Date.now()) / 60000);
}

function formatCountdown(totalMinutes: number, isRTL: boolean): string {
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return isRTL ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
  }
  return isRTL ? `${mins} د` : `${mins}m`;
}

export function VideoCallScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [minutesLeft, setMinutesLeft] = useState(0);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    const res = await bookingsService.getById(bookingId);
    if (res.data) {
      const b = res.data as Booking;
      setBooking(b);
      setMinutesLeft(getMinutesUntil(b.date, b.startTime));
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    if (!booking) return;
    const interval = setInterval(() => {
      setMinutesLeft(getMinutesUntil(booking.date, booking.startTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [booking]);

  const isFuture = minutesLeft > 0;
  const hasZoomLink = Boolean(booking?.zoomLink);
  const canJoin = hasZoomLink && !isFuture;

  const handleJoin = async () => {
    if (!booking?.zoomLink) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Linking.openURL(booking.zoomLink);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchBooking();
  };

  const employeeName = booking
    ? `${booking.employee.user.firstName} ${booking.employee.user.lastName}`
    : '';

  const specialtyName = booking
    ? (isRTL ? booking.employee.specialtyAr : booking.employee.specialty) ?? ''
    : '';

  const formattedDate = booking
    ? new Date(booking.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

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
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
          >
            <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
          </Pressable>
          <ThemedText variant="subheading">{t('videoCall.title')}</ThemedText>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          </View>
        ) : booking ? (
          <>
            {/* Meeting Info Card */}
            <ThemedCard padding={20} style={{ marginBottom: 16 }}>
              <View style={styles.practRow}>
                <Avatar
                  size={48}
                  name={employeeName}
                  imageUrl={booking.employee.user.avatarUrl}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="subheading">{employeeName}</ThemedText>
                  <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
                    {specialtyName}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.surfaceHigh }]} />

              <InfoRow
                icon={Calendar}
                color="#1D4ED8"
                label={t('appointments.date')}
                value={formattedDate}
              />
              <InfoRow
                icon={Clock}
                color="#7C3AED"
                label={t('appointments.time')}
                value={booking.startTime}
              />
            </ThemedCard>

            {/* Status Section */}
            {isFuture && (
              <ThemedCard padding={20} style={{ marginBottom: 16 }}>
                <View style={styles.statusRow}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F59E0B24' }]}>
                    <Clock size={20} strokeWidth={1.5} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="body">{t('videoCall.meetingStartsIn')}</ThemedText>
                    <ThemedText variant="heading" color="#1D4ED8">
                      {formatCountdown(minutesLeft, isRTL)}
                    </ThemedText>
                  </View>
                </View>
              </ThemedCard>
            )}

            {!hasZoomLink && (
              <ThemedCard padding={20} style={{ marginBottom: 16 }}>
                <View style={styles.statusRow}>
                  <View style={[styles.iconCircle, { backgroundColor: '#DC262614' }]}>
                    <AlertCircle size={20} strokeWidth={1.5} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <ThemedText variant="body">{t('videoCall.meetingNotReady')}</ThemedText>
                    <ThemedButton
                      onPress={handleRefresh}
                      variant="outline"
                      size="sm"
                      icon={<RefreshCw size={16} strokeWidth={1.5} color="#1D4ED8" />}
                    >
                      {t('videoCall.refresh')}
                    </ThemedButton>
                  </View>
                </View>
              </ThemedCard>
            )}

            {/* Join Button */}
            <ThemedButton
              onPress={handleJoin}
              variant="primary"
              size="lg"
              full
              disabled={!canJoin}
              icon={<Video size={20} strokeWidth={1.5} color="#FFF" />}
            >
              {t('videoCall.joinMeeting')}
            </ThemedButton>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}14` }]}>
        <Icon size={20} strokeWidth={1.5} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText variant="caption" color="#64748B">
          {label}
        </ThemedText>
        <ThemedText variant="body">{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  practRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  divider: { height: 1, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
