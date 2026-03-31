import { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  Video,
  Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { useAppSelector } from '@/hooks/use-redux';
import { requireEmailVerification } from '@/components/ui/EmailVerificationBanner';
import type { BookingType } from '@/types/models';

/**
 * Booking Flow — Step 1: Select Visit Type
 * Route: /(patient)/booking/[serviceId]
 *
 * 2 booking types: in_person, online
 * Each shown as a selectable card with icon, name, and description.
 */

interface TypeOption {
  type: BookingType;
  icon: React.ElementType;
  color: string;
  labelKey: string;
  descKey: string;
}

export default function BookingTypeScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [selected, setSelected] = useState<BookingType | null>(null);
  const user = useAppSelector((s) => s.auth.user);

  const types: TypeOption[] = [
    {
      type: 'in_person',
      icon: Building2,
      color: '#1D4ED8',
      labelKey: 'booking.inPerson',
      descKey: 'booking.inPersonDesc',
    },
    {
      type: 'online',
      icon: Video,
      color: '#7C3AED',
      labelKey: 'booking.online',
      descKey: 'booking.onlineDesc',
    },
  ];

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const handleNext = () => {
    if (!selected) return;
    if (!requireEmailVerification(user, t)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(patient)/booking/schedule',
      params: { practitionerId: serviceId, type: selected },
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
        {/* Back */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={styles.backBtn}
        >
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        {/* Progress */}
        <View style={styles.progressRow}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('booking.step')} 1 {t('booking.of')} 3
          </ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceHigh }]}>
            <LinearGradient
              colors={['#0037B0', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: '33%' }]}
            />
          </View>
        </View>

        {/* Title */}
        <ThemedText variant="heading" style={styles.title}>
          {t('booking.selectType')}
        </ThemedText>

        {/* Type Cards */}
        <View style={styles.typeList}>
          {types.map((item) => {
            const isSelected = selected === item.type;
            return (
              <ThemedCard
                key={item.type}
                selected={isSelected}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelected(item.type);
                }}
                padding={18}
              >
                <View style={styles.typeRow}>
                  <View style={[styles.typeIcon, { backgroundColor: `${item.color}14` }]}>
                    <item.icon size={20} strokeWidth={1.5} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="subheading">{t(item.labelKey)}</ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t(item.descKey)}
                    </ThemedText>
                  </View>
                </View>
              </ThemedCard>
            );
          })}
        </View>

        {/* Next Button */}
        <ThemedButton
          onPress={handleNext}
          variant="primary"
          size="lg"
          full
          disabled={!selected}
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
  title: { marginBottom: 20 },
  typeList: { gap: 12, marginBottom: 32 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
