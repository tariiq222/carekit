import React from 'react';
import { View, Text } from 'react-native';
import type { BookingStatus } from '@/types/models';

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: '#F59E0B', bg: '#F59E0B1A' },
  confirmed: { color: '#059669', bg: '#0596691A' },
  completed: { color: '#1D4ED8', bg: '#1D4ED81A' },
  cancelled: { color: '#DC2626', bg: '#DC26261A' },
  pending_cancellation: { color: '#F97316', bg: '#F973161A' },
  available: { color: '#84CC16', bg: '#84CC161A' },
  paid: { color: '#059669', bg: '#0596691A' },
  refunded: { color: '#7C3AED', bg: '#7C3AED1A' },
  failed: { color: '#DC2626', bg: '#DC26261A' },
};

interface StatusPillProps {
  status: string;
  label: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <View
      style={{
        backgroundColor: config.bg,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: config.color,
          fontSize: 11,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
