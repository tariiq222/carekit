import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ImageBackground, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { router } from 'expo-router';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_SOFT, SHADOW_RAISED } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { SectionHeader } from '@/components/SectionHeader';
import { bookingsService } from '@/services/bookings';
import type { Booking } from '@/types/models';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);

  const loadDay = useCallback(async (date: string) => {
    setSelectedDate(date);
    try {
      const res = await bookingsService.getAll({ status: ['confirmed', 'pending'], date });
      if (res.data) setDayBookings(res.data.items);
    } catch {
      setDayBookings([]);
    }
  }, []);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <View style={{ flex: 1, paddingTop: insets.top + 18, paddingHorizontal: 18 }}>
        <SectionHeader title={t('employee.calendar')} size="screen" style={styles.title} />

        <Glass
          variant="strong"
          radius={RADII.card}
          style={[styles.calCard, SHADOW_RAISED]}
        >
          <RNCalendar
            onDayPress={(day: { dateString: string }) => loadDay(day.dateString)}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: C.deepTeal },
            }}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: C.subtle,
              dayTextColor: C.deepTeal,
              monthTextColor: C.deepTeal,
              todayTextColor: C.softTeal,
              arrowColor: C.deepTeal,
              selectedDayTextColor: '#FFFFFF',
              textDayFontFamily: dir.isRTL ? 'IBM Plex Sans Arabic' : 'Inter',
              textMonthFontFamily: dir.isRTL ? 'IBM Plex Sans Arabic' : 'Inter',
              textDayHeaderFontFamily: dir.isRTL ? 'IBM Plex Sans Arabic' : 'Inter',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textMonthFontWeight: '700',
            }}
          />
        </Glass>

        <SectionHeader
          title={new Date(selectedDate).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        />

        <FlatList
          data={dayBookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Glass
              variant="regular"
              radius={RADII.card}
              style={[styles.apptCard, { flexDirection: dir.row }, SHADOW_SOFT]}
            >
              <View style={[styles.timeCol, { flexDirection: dir.row }]}>
                <Clock size={14} strokeWidth={1.6} color={C.subtle} />
                <Text style={styles.timeText}>{item.startTime}</Text>
              </View>
              <Text
                style={[
                  styles.clientName,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                ]}
                numberOfLines={1}
              >
                {item.client
                  ? `${item.client.firstName} ${item.client.lastName}`
                  : t('doctor.clientRecord')}
              </Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{t('appointments.confirmed')}</Text>
              </View>
            </Glass>
          )}
          ListEmptyComponent={
            <Text
              style={[
                styles.emptyText,
                { textAlign: 'center', writingDirection: dir.writingDirection },
              ]}
            >
              {t('doctor.noAppointmentsToday')}
            </Text>
          }
        />

        <Pressable
          onPress={() => router.push('/(employee)/availability')}
          style={[styles.ctaBtn, SHADOW]}
        >
          <Text style={styles.ctaText}>{t('doctor.manageAvailability')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { marginBottom: 16 },
  calCard: { padding: 8, marginBottom: 16, overflow: 'hidden' },
  list: { paddingBottom: 16 },
  apptCard: {
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  timeCol: { alignItems: 'center', gap: 4, minWidth: 60 },
  timeText: { fontSize: 13, fontWeight: '600', color: C.deepTeal },
  clientName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.deepTeal },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    backgroundColor: C.ratingGlass,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: C.deepTeal },
  emptyText: { fontSize: 13, color: C.subtle, marginTop: 20 },
  ctaBtn: {
    marginTop: 12,
    marginBottom: 90,
    paddingVertical: 14,
    borderRadius: RADII.pill,
    backgroundColor: C.deepTeal,
    alignItems: 'center',
  },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
