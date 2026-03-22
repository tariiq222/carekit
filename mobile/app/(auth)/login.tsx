import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Stethoscope, Eye, EyeOff, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedInput } from '@/theme/components/ThemedInput';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials, setLoading } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme, isRTL } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validate = useCallback((): boolean => {
    const newErrors: typeof errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    if (!password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (password.length < 8) {
      newErrors.password = t('auth.passwordMinLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password, t]);

  const handleLogin = useCallback(async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    dispatch(setLoading(true));

    try {
      const response = await authService.login({ email, password });
      if (response.success && response.data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(setCredentials(response.data));
        if (response.data.user.role === 'practitioner') {
          router.replace('/(practitioner)/(tabs)/today');
        } else {
          router.replace('/(patient)/(tabs)/home');
        }
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.loginError'));
    } finally {
      setIsLoading(false);
      dispatch(setLoading(false));
    }
  }, [email, password, validate, dispatch, router, t]);

  const handleOtpLogin = useCallback(() => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: t('auth.invalidEmail') });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(auth)/otp-verify', params: { email } });
  }, [email, router, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#0037B0', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoContainer}
            >
              <Stethoscope size={32} color="#FFF" strokeWidth={1.5} />
            </LinearGradient>

            <ThemedText variant="displaySm" align="center" style={styles.title}>
              {t('auth.welcomeBack')}
            </ThemedText>
            <ThemedText
              variant="bodySm"
              align="center"
              color={theme.colors.textSecondary}
            >
              {t('auth.welcomeBackSub')}
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <ThemedInput
              label={t('auth.email')}
              labelAr={t('auth.email')}
              placeholder={t('auth.emailPlaceholder')}
              placeholderAr={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              suffixIcon={
                <Mail
                  size={18}
                  strokeWidth={1.5}
                  color={theme.colors.textMuted}
                />
              }
            />

            <ThemedInput
              label={t('auth.password')}
              labelAr={t('auth.password')}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderAr={t('auth.passwordPlaceholder')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password)
                  setErrors((e) => ({ ...e, password: undefined }));
              }}
              secureTextEntry={!showPassword}
              error={errors.password}
              suffixIcon={
                showPassword ? (
                  <Eye
                    size={18}
                    strokeWidth={1.5}
                    color={theme.colors.textMuted}
                  />
                ) : (
                  <EyeOff
                    size={18}
                    strokeWidth={1.5}
                    color={theme.colors.textMuted}
                  />
                )
              }
              onSuffixPress={() => setShowPassword(!showPassword)}
            />

            {/* Forgot Password */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.forgotRow,
                { alignSelf: isRTL ? 'flex-start' : 'flex-end' },
              ]}
            >
              <ThemedText variant="bodySm" color="#1D4ED8" style={styles.link}>
                {t('auth.forgotPassword')}
              </ThemedText>
            </Pressable>

            {/* Login Button */}
            <ThemedButton
              onPress={handleLogin}
              variant="primary"
              size="lg"
              full
              loading={loading}
              disabled={loading}
            >
              {t('auth.login')}
            </ThemedButton>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View
                style={[styles.divider, { backgroundColor: theme.colors.surfaceHigh }]}
              />
              <ThemedText
                variant="caption"
                color={theme.colors.textMuted}
                style={styles.dividerText}
              >
                {t('auth.orContinueWith')}
              </ThemedText>
              <View
                style={[styles.divider, { backgroundColor: theme.colors.surfaceHigh }]}
              />
            </View>

            {/* OTP Login */}
            <ThemedButton
              onPress={handleOtpLogin}
              variant="outline"
              size="lg"
              full
              icon={
                <Mail size={16} strokeWidth={1.5} color="#1D4ED8" />
              }
            >
              {t('auth.loginWithOtp')}
            </ThemedButton>
          </View>

          {/* Register Link */}
          <View style={styles.bottomRow}>
            <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
              {t('auth.noAccount')}{' '}
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(auth)/register');
              }}
            >
              <ThemedText variant="bodySm" color="#1D4ED8" style={styles.link}>
                {t('auth.createAccount')}
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 32 },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { marginBottom: 8 },
  form: { gap: 16 },
  forgotRow: { paddingVertical: 4 },
  link: { fontWeight: '600' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 4 },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
});
