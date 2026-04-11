import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';

export default function BookingSuccessScreen() {
  const { bookingId, pendingApproval } = useLocalSearchParams<{
    bookingId: string;
    pendingApproval: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const isPending = pendingApproval === 'true';
  const StatusIcon = isPending ? Clock : Check;
  const gradientColors: [string, string] = isPending
    ? ['#F59E0B', '#F97316']
    : ['#047857', '#059669'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Status Icon */}
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successCircle}
          >
            <StatusIcon size={36} strokeWidth={2.5} color="#FFF" />
          </LinearGradient>
        </View>

        <ThemedText variant="displaySm" align="center">
          {isPending
            ? t('payment.pendingApproval')
            : t('appointments.confirmed')}
        </ThemedText>
        <ThemedText
          variant="bodySm"
          color={theme.colors.textSecondary}
          align="center"
          style={styles.sub}
        >
          {isPending
            ? t('payment.pendingApprovalDesc')
            : bookingId
              ? `#${bookingId}`
              : ''}
        </ThemedText>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <ThemedButton
          onPress={() => router.replace('/(patient)/(tabs)/appointments')}
          variant="primary"
          size="lg"
          full
        >
          {t('patient.appointments')}
        </ThemedButton>
        <ThemedButton
          onPress={() => router.replace('/(patient)/(tabs)/home')}
          variant="ghost"
          size="lg"
          full
        >
          {t('tabs.home')}
        </ThemedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  iconWrap: { marginBottom: 12 },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sub: { marginTop: 4 },
  actions: { gap: 12 },
});
