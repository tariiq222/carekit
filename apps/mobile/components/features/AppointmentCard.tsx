import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Building2, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/theme/components/ThemedText';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { Glass } from '@/theme/components/Glass';
import { RADII, SHADOW } from '@/theme/glass';
import type { Booking, BookingType } from '@/types/models';

const TYPE_ICON = {
  in_person: Building2,
  online: Video,
  walk_in: Building2,
};

const TYPE_COLOR = {
  in_person: '#1D4ED8',
  online: '#7C3AED',
  walk_in: '#059669',
};

interface AppointmentCardProps {
  booking: Booking;
  onPress: (id: string) => void;
}

export function AppointmentCard({ booking, onPress }: AppointmentCardProps) {
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();
  const Icon = TYPE_ICON[booking.type];
  const color = TYPE_COLOR[booking.type];

  const statusLabels: Record<string, string> = {
    pending: t('appointments.pending'),
    confirmed: t('appointments.confirmed'),
    completed: t('appointments.completed'),
    cancelled: t('appointments.cancelledStatus'),
    pending_cancellation: t('appointments.pendingCancellation'),
  };

  const practName = `${booking.employee.user.firstName} ${booking.employee.user.lastName}`;
  const date = new Date(booking.date);
  const formattedDate = date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Glass
      variant="regular"
      radius={RADII.card}
      interactive
      onPress={() => onPress(booking.id)}
      style={[styles.card, SHADOW]}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: `${color}18` }]}>
          <Icon size={18} strokeWidth={1.5} color={color} />
        </View>
        <View style={styles.info}>
          <ThemedText variant="subheading" numberOfLines={1}>
            {practName}
          </ThemedText>
          <ThemedText variant="bodySm" numberOfLines={1}>
            {isRTL ? booking.employee.specialtyAr : booking.employee.specialty}
          </ThemedText>
        </View>
        <StatusPill
          status={booking.status}
          label={statusLabels[booking.status] ?? booking.status}
        />
      </View>
      <View style={styles.footer}>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {formattedDate} • {booking.startTime}
        </ThemedText>
        <ThemedText variant="caption" color="#1D4ED8" style={{ fontWeight: '600' }}>
          {booking.totalAmount} {t('home.sar')}
        </ThemedText>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
    paddingTop: 10,
  },
});
