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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { authService } from '@/services/auth';
import { getFontName } from '@/theme/fonts';

type Step = 'otp' | 'password';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [step, setStep] = useState<Step>('otp');
  const [code, setCode] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onVerifyOtp = useCallback(async () => {
    setError(null);
    if (code.length !== 6) {
      setError(t('auth.resetPassword.invalidCode'));
      return;
    }
    setLoading(true);
    try {
      const result = await authService.verifyPasswordResetOtp(email, code);
      setSessionToken(result.sessionToken);
      setStep('password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('auth.resetPassword.invalidCode'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [code, email, t]);

  const onResetPassword = useCallback(async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError(t('auth.resetPassword.weakPassword'));
      return;
    }
    if (!sessionToken) return;
    setLoading(true);
    try {
      await authService.resetClientPassword(sessionToken, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/(auth)/login', params: { resetSuccess: '1' } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [newPassword, sessionToken, router, t]);

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
            {t('auth.resetPassword.title')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 },
            ]}
          >
            {step === 'otp'
              ? t('auth.resetPassword.otpStepSubtitle', { email })
              : t('auth.resetPassword.passwordStepSubtitle')}
          </Animated.Text>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(400).duration(800).easing(Easing.out(Easing.cubic))}>
            <Glass
              variant="regular"
              radius={RADII.card}
              style={[styles.form, SHADOW, { marginTop: 32 }]}
            >
              <View style={styles.formInner}>
                {step === 'otp' ? (
                  /* OTP Step */
                  <View style={styles.field}>
                    <Text
                      style={[
                        styles.label,
                        { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 },
                      ]}
                    >
                      {t('auth.resetPassword.codeLabel')}
                    </Text>
                    <Glass variant="clear" radius={RADII.image} style={styles.input}>
                      <TextInput
                        value={code}
                        onChangeText={(v) => {
                          setCode(v.replace(/\D/g, '').slice(0, 6));
                          if (error) setError(null);
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        style={[
                          styles.codeInput,
                          { fontFamily: f700 },
                        ]}
                        placeholderTextColor={C.subtle}
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
                ) : (
                  /* Password Step */
                  <View style={styles.field}>
                    <Text
                      style={[
                        styles.label,
                        { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 },
                      ]}
                    >
                      {t('auth.resetPassword.newPasswordLabel')}
                    </Text>
                    <Glass variant="clear" radius={RADII.image} style={styles.input}>
                      <View style={[styles.inputRow, { flexDirection: dir.row }]}>
                        <TextInput
                          value={newPassword}
                          onChangeText={(text) => {
                            setNewPassword(text);
                            if (error) setError(null);
                          }}
                          placeholder="••••••••"
                          placeholderTextColor={C.subtle}
                          secureTextEntry={!showPassword}
                          style={[
                            styles.inputText,
                            { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 },
                          ]}
                        />
                        <Pressable
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeBtn}
                          hitSlop={8}
                        >
                          {showPassword
                            ? <Eye size={20} color={C.subtle} strokeWidth={1.75} />
                            : <EyeOff size={20} color={C.subtle} strokeWidth={1.75} />
                          }
                        </Pressable>
                      </View>
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
                )}

                {/* Submit Button */}
                <PrimaryButton
                  label={
                    loading
                      ? t('common.loading')
                      : step === 'otp'
                        ? t('auth.resetPassword.verifyCode')
                        : t('auth.resetPassword.submit')
                  }
                  onPress={step === 'otp' ? onVerifyOtp : onResetPassword}
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
  inputRow: { alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  codeInput: { fontSize: 28, color: C.deepTeal, textAlign: 'center', letterSpacing: 8, alignSelf: 'stretch' },
  inputText: { flex: 1, fontSize: 14, color: C.deepTeal },
  eyeBtn: { padding: 4 },
  error: { fontSize: 12, color: '#E74C3C' },
  backRow: { alignItems: 'center', marginTop: 8 },
  backLink: { fontSize: 14, color: C.deepTeal },
});
