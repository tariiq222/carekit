import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { AquaBackground, PrimaryButton, sawaaColors } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials, setLoading } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { registerForPushAsync } from '@/services/push';
import { getPrimaryRole } from '@/types/auth';
import { getFontName } from '@/theme/fonts';
import { hasSeenOnboarding } from '@/lib/onboarding';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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

  const navigateByRole = useCallback(
    async (user: Parameters<typeof getPrimaryRole>[0]) => {
      const role = getPrimaryRole(user);
      if (role === 'employee') {
        router.replace('/(employee)/(tabs)/today');
        return;
      }
      const seen = await hasSeenOnboarding();
      if (seen) {
        router.replace('/(client)/(tabs)/home');
      } else {
        router.replace('/(auth)/onboarding');
      }
    },
    [router],
  );

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
        void registerForPushAsync();
        await navigateByRole(response.data.user);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.loginError'));
    } finally {
      setIsLoading(false);
      dispatch(setLoading(false));
    }
  }, [email, password, validate, dispatch, navigateByRole, t]);

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View
            entering={FadeIn.duration(700).easing(Easing.out(Easing.cubic))}
            style={styles.logoContainer}
          >
            <Glass variant="strong" radius={RADII.floating} style={[styles.logo, SHADOW]}>
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2C7 6 4 10 4 14a8 8 0 0 0 16 0c0-4-3-8-8-12Z"
                  stroke={sawaaColors.teal[700]}
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                />
                <Path
                  d="M12 22V10"
                  stroke={sawaaColors.teal[700]}
                  strokeWidth={1.7}
                  strokeLinecap="round"
                />
              </Svg>
            </Glass>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(150).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f700 }
            ]}
          >
            {t('auth.welcomeBack')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
            ]}
          >
            {t('auth.welcomeBackSub')}
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
                    { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }
                  ]}
                >
                  {t('auth.email')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={styles.input}>
                  <TextInput
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text.trim());
                      if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                    }}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={C.subtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    style={[
                      styles.inputText,
                      { textAlign: 'left', writingDirection: 'ltr', fontFamily: f400 }
                    ]}
                  />
                </Glass>
                {errors.email ? (
                  <Text
                    style={[
                      styles.error,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
                    ]}
                  >
                    {errors.email}
                  </Text>
                ) : null}
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text
                  style={[
                    styles.label,
                    { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }
                  ]}
                >
                  {t('auth.password')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={styles.input}>
                  <View style={[styles.inputRow, { flexDirection: dir.row }]}>
                    <TextInput
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                      }}
                      placeholder={t('auth.passwordPlaceholder')}
                      placeholderTextColor={C.subtle}
                      secureTextEntry={!showPassword}
                      style={[
                        styles.inputText,
                        { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
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
                {errors.password ? (
                  <Text
                    style={[
                      styles.error,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
                    ]}
                  >
                    {errors.password}
                  </Text>
                ) : null}
              </View>

              {/* Forgot Password Link */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(auth)/reset-password');
                }}
                style={{ marginTop: 8, alignItems: 'center' }}
              >
                <Text
                  style={[
                    styles.forgotPasswordLink,
                    { fontFamily: f600 }
                  ]}
                >
                  {t('auth.forgotPassword')}
                </Text>
              </Pressable>

              {/* Login Button */}
              <PrimaryButton
                label={loading ? t('common.loading') : t('auth.login')}
                onPress={handleLogin}
                fontFamily={f700}
                disabled={loading}
                style={{ marginTop: 8 }}
              />

              {/* Register Link */}
              <View style={[styles.registerRow, { flexDirection: dir.row }]}>
                <Text style={[styles.registerText, { fontFamily: f400 }]}>{t('auth.noAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(auth)/register');
                  }}
                >
                  <Text style={[styles.registerLink, { fontFamily: f700 }]}>{t('auth.createAccount')}</Text>
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
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, color: C.deepTeal, lineHeight: 42, marginBottom: 8, alignSelf: 'stretch' },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20, marginBottom: 32, alignSelf: 'stretch' },
  form: { padding: 24 },
  formInner: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, color: C.deepTeal },
  input: { padding: 14, flexDirection: 'row', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  inputText: { flex: 1, fontSize: 14, color: C.deepTeal },
  eyeBtn: { padding: 4 },
  error: { fontSize: 12, color: '#E74C3C' },
  btn: { padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { fontSize: 16, color: '#FFF' },
  registerRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  registerText: { fontSize: 14, color: C.subtle },
  registerLink: { fontSize: 14, color: C.deepTeal },
  forgotPasswordLink: { fontSize: 13, color: C.deepTeal },
});
