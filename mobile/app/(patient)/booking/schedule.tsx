import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'react-native-calendars';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { practitionersService } from '@/services/practitioners';

export default function BookingScheduleScreen() {
  const { practitionerId, type, serviceId, duration } = useLocalSearchParams<{
    practitionerId: string;
    type: string;
    serviceId?: string;
    duration?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slots, setSlots] = useState<string[]>([]);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const today = new Date().toISOString().split('T')[0];
  const gradientColors: [string, string] = [theme.colors.primaryDark ?? '#0037B0', theme.colors.primary ?? '#1D4ED8'];

  useEffect(() => {
    if (selectedDate && practitionerId) {
      practitionersService
        .getAvailability(practitionerId, selectedDate, {
          duration: duration ? parseInt(duration, 10) : undefined,
          serviceId: serviceId ?? undefined,
          bookingType: type ?? undefined,
        })
        .then((res) => {
          const available = res.data?.slots?.filter((s: { startTime: string; available: boolean }) => s.available).map((s: { startTime: string }) => s.startTime) ?? [];
          setSlots(available);
        })
        .catch(() => setSlots([]));
    }
  }, [selectedDate, practitionerId, duration, serviceId, type]);

  const handleNext = () => {
    if (!selectedDate || !selectedSlot) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(patient)/booking/confirm',
      params: { practitionerId, type, date: selectedDate, time: selectedSlot },
    });
  };

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
            {t('booking.step')} 2 {t('booking.of')} 3
          </ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceHigh }]}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: '66%' }]}
            />
          </View>
        </View>

        <ThemedText variant="heading" style={styles.title}>
          {t('booking.selectDate')}
        </ThemedText>

        {/* Calendar */}
        <ThemedCard style={styles.calCard}>
          <Calendar
            minDate={today}
            onDayPress={(day: { dateString: string }) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedDate(day.dateString);
              setSelectedSlot('');
            }}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: theme.colors.primary },
            }}
            theme={{
              todayTextColor: theme.colors.primary,
              arrowColor: theme.colors.primary,
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textMonthFontWeight: '600',
            }}
          />
        </ThemedCard>

        {/* Time Slots */}
        {selectedDate && (
          <View style={styles.slotsSection}>
            <ThemedText variant="subheading" style={{ marginBottom: 12 }}>
              {t('appointments.time')}
            </ThemedText>
            <View style={styles.slotsGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedSlot(slot);
                    }}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.slotBtn}
                      >
                        <ThemedText variant="body" color="#FFF" style={{ fontWeight: '600' }}>
                          {slot}
                        </ThemedText>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.slotBtn, { backgroundColor: theme.colors.white }]}>
                        <ThemedText variant="body" color={theme.colors.textPrimary}>
                          {slot}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <ThemedButton
          onPress={handleNext}
          variant="primary"
          size="lg"
          full
          disabled={!selectedDate || !selectedSlot}
          style={{ marginTop: 24 }}
        >
          {t('common.next')}
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
  title: { marginBottom: 16 },
  calCard: { padding: 8, marginBottom: 20 },
  slotsSection: {},
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
});
