import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { authService } from '@/services/auth';
import { getFontName } from '@/theme/fonts';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setLoading(true);
    try {
      await authService.requestPasswordResetOtp(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/(auth)/reset-password', params: { email: email.trim() } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.error');
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [email, router, t]);

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(150).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f700 },
            ]}
          >
            {t('auth.forgotPassword.title')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 },
            ]}
          >
            {t('auth.forgotPassword.subtitle')}
          </Animated.Text>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(400).duration(800).easing(Easing.out(Easing.cubic))}>
            <Glass
              variant="regular"
              radius={RADII.card}
              style={[styles.form, SHADOW, { marginTop: 32 }]}
            >
              <View style={styles.formInner}>
                {/* Email */}
                <View style={styles.field}>
                  <Text
                    style={[
                      styles.label,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 },
                    ]}
                  >
                    {t('auth.forgotPassword.emailLabel')}
                  </Text>
                  <Glass variant="clear" radius={RADII.image} style={styles.input}>
                    <TextInput
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text.trim());
                        if (error) setError(null);
                      }}
                      placeholder="you@example.com"
                      placeholderTextColor={C.subtle}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      style={[
                        styles.inputText,
                        { textAlign: 'left', writingDirection: 'ltr', fontFamily: f400 },
                      ]}
                    />
                  </Glass>
                  {error ? (
                    <Text
                      style={[
                        styles.error,
                        { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 },
                      ]}
                    >
                      {error}
                    </Text>
                  ) : null}
                </View>

                {/* Submit Button */}
                <PrimaryButton
                  label={loading ? t('common.loading') : t('auth.forgotPassword.submit')}
                  onPress={onSubmit}
                  fontFamily={f700}
                  disabled={loading}
                  style={{ marginTop: 8 }}
                />

                {/* Back Link */}
                <View style={styles.backRow}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.back();
                    }}
                  >
                    <Text style={[styles.backLink, { fontFamily: f600 }]}>
                      {t('auth.forgotPassword.back')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Glass>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  title: { fontSize: 32, color: C.deepTeal, lineHeight: 42, marginBottom: 8, alignSelf: 'stretch' },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20, marginBottom: 32, alignSelf: 'stretch' },
  form: { padding: 24 },
  formInner: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, color: C.deepTeal },
  input: { padding: 14 },
  inputText: { flex: 1, fontSize: 14, color: C.deepTeal },
  error: { fontSize: 12, color: '#E74C3C' },
  backRow: { alignItems: 'center', marginTop: 8 },
  backLink: { fontSize: 14, color: C.deepTeal },
});
