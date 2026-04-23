import { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Star, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';
import { getFontName } from '@/theme/fonts';
import api from '@/services/api';

export default function RatingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL, language } = useTheme();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const handleSubmit = useCallback(async () => {
    if (stars === 0) return;
    setLoading(true);
    try {
      await api.post('/ratings', {
        bookingId,
        stars,
        comment: comment || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [stars, comment, bookingId, router, t]);

  const fontFamily = getFontName(language, '400');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <ThemedText variant="heading" align="center">
          {t('appointments.rate')}
        </ThemedText>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStars(i);
              }}
            >
              <Star
                size={44}
                strokeWidth={1.5}
                fill={i <= stars ? '#F59E0B' : 'none'}
                color={i <= stars ? '#F59E0B' : theme.colors.surfaceHigh}
              />
            </Pressable>
          ))}
        </View>

        {/* Comment */}
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={t('appointments.commentPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          textAlign={isRTL ? 'right' : 'left'}
          writingDirection={isRTL ? 'rtl' : 'ltr'}
          style={[
            styles.commentInput,
            {
              backgroundColor: theme.colors.surfaceHigh,
              color: theme.colors.textPrimary,
              fontFamily,
            },
          ]}
        />
      </View>

      <ThemedButton
        onPress={handleSubmit}
        variant="primary"
        size="lg"
        full
        loading={loading}
        disabled={stars === 0 || loading}
      >
        {t('common.confirm')}
      </ThemedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 28 },
  starsRow: { flexDirection: 'row', gap: 10 },
  commentInput: {
    width: '100%',
    minHeight: 100,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});
