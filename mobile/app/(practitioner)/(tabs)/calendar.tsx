import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar as RNCalendar } from 'react-native-calendars';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/theme/useTheme';
import { bookingsService } from '@/services/bookings';
import type { Booking } from '@/types/models';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);

  const loadDay = useCallback(async (date: string) => {
    setSelectedDate(date);
    try {
      const res = await bookingsService.getAll({ status: ['confirmed', 'pending'], date });
      if (res.data) {
        setDayBookings(res.data.items);
      }
    } catch {
      setDayBookings([]);
    }
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 },
      ]}
    >
      <ThemedText variant="displaySm" style={styles.title}>
        {t('practitioner.calendar')}
      </ThemedText>

      <ThemedCard style={styles.calCard}>
        <RNCalendar
          onDayPress={(day: { dateString: string }) => loadDay(day.dateString)}
          markedDates={{
            [selectedDate]: {
              selected: true,
              selectedColor: '#1D4ED8',
            },
          }}
          theme={{
            todayTextColor: '#1D4ED8',
            arrowColor: '#1D4ED8',
            textDayFontFamily: isRTL ? 'IBM Plex Sans Arabic' : 'Inter',
            textMonthFontFamily: isRTL ? 'IBM Plex Sans Arabic' : 'Inter',
            textDayHeaderFontFamily: isRTL ? 'IBM Plex Sans Arabic' : 'Inter',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textMonthFontWeight: '600',
          }}
        />
      </ThemedCard>

      {/* Day Appointments */}
      <ThemedText variant="subheading" style={styles.dayTitle}>
        {new Date(selectedDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </ThemedText>

      <FlatList
        data={dayBookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <ThemedCard style={styles.apptCard}>
            <View style={styles.apptRow}>
              <View style={styles.timeCol}>
                <Clock size={14} strokeWidth={1.5} color={theme.colors.textMuted} />
                <ThemedText variant="bodySm">{item.startTime}</ThemedText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="body" style={{ fontWeight: '500' }}>
                  {item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : t('doctor.patientRecord')}
                </ThemedText>
              </View>
              <StatusPill status={item.status} label={t('appointments.confirmed')} />
            </View>
          </ThemedCard>
        )}
        ListEmptyComponent={
          <ThemedText variant="bodySm" color={theme.colors.textMuted} align="center" style={{ marginTop: 20 }}>
            {t('doctor.noAppointmentsToday')}
          </ThemedText>
        }
      />

      <View style={styles.ctaWrap}>
        <ThemedButton onPress={() => {}} variant="outline" size="md" full>
          {t('doctor.manageAvailability')}
        </ThemedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 16 },
  calCard: { padding: 8, marginBottom: 16 },
  dayTitle: { marginBottom: 12 },
  list: { paddingBottom: 120 },
  apptCard: { padding: 12 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeCol: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  ctaWrap: { paddingVertical: 12 },
});
