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
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials, setLoading } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { getPrimaryRole } from '@/types/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();

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
    (user: { roles: Array<{ slug: string }> }) => {
      const role = getPrimaryRole(user as Parameters<typeof getPrimaryRole>[0]);
      if (role === 'employee') {
        router.replace('/(employee)/(tabs)/today');
      } else {
        router.replace('/(client)/(tabs)/home');
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
        navigateByRole(response.data.user);
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
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

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
          <View style={styles.logoContainer}>
            <Glass variant="strong" radius={RADII.floating} style={[styles.logo, SHADOW]}>
              <Text style={styles.logoText}>🏥</Text>
            </Glass>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
            ]}
          >
            {t('auth.welcomeBack')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
            ]}
          >
            {t('auth.welcomeBackSub')}
          </Text>

          {/* Form */}
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
                    { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                  ]}
                >
                  {t('auth.email')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={styles.input}>
                  <TextInput
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                    }}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={C.subtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    style={[
                      styles.inputText,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                    ]}
                  />
                </Glass>
                {errors.email ? (
                  <Text
                    style={[
                      styles.error,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
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
                    { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                  ]}
                >
                  {t('auth.password')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={styles.input}>
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
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                    ]}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </Pressable>
                </Glass>
                {errors.password ? (
                  <Text
                    style={[
                      styles.error,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                    ]}
                  >
                    {errors.password}
                  </Text>
                ) : null}
              </View>

              {/* Login Button */}
              <Glass
                variant="regular"
                radius={RADII.image}
                onPress={handleLogin}
                interactive
                style={[styles.btn, { backgroundColor: C.deepTeal }]}
              >
                <Text style={styles.btnText}>
                  {loading ? t('common.loading') : t('auth.login')}
                </Text>
              </Glass>

              {/* Register Link */}
              <View style={[styles.registerRow, { flexDirection: dir.row }]}>
                <Text style={styles.registerText}>{t('auth.noAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(auth)/register');
                  }}
                >
                  <Text style={styles.registerLink}>{t('auth.createAccount')}</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 40 },
  title: { fontSize: 32, fontWeight: '800', color: C.deepTeal, lineHeight: 42, marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20, marginBottom: 32 },
  form: { padding: 24 },
  formInner: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
  input: { padding: 14, flexDirection: 'row', alignItems: 'center' },
  inputText: { flex: 1, fontSize: 14, color: C.deepTeal },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 18 },
  error: { fontSize: 12, color: '#E74C3C' },
  btn: { padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  registerRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  registerText: { fontSize: 14, color: C.subtle },
  registerLink: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
});
