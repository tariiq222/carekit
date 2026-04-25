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
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials, setLoading } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { registerForPushAsync } from '@/services/push';
import { LabeledInput } from '@/components/ui/LabeledInput';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const clearError = (field: string) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!firstName.trim()) newErrors.firstName = t('auth.firstNameRequired');
    if (!lastName.trim()) newErrors.lastName = t('auth.lastNameRequired');
    if (!email || !emailRegex.test(email)) newErrors.email = t('auth.invalidEmail');
    if (!phone.trim()) newErrors.phone = t('auth.phoneRequired');
    if (!password) newErrors.password = t('auth.passwordRequired');
    else if (password.length < 8) newErrors.password = t('auth.passwordMinLength');
    if (password !== confirmPassword) newErrors.confirmPassword = t('auth.passwordMismatch');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [firstName, lastName, email, phone, password, confirmPassword, t]);

  const handleRegister = useCallback(async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsLoading(true);
    dispatch(setLoading(true));
    try {
      const response = await authService.register({ firstName, lastName, email, phone, password });
      if (response.success && response.data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(setCredentials(response.data));
        void registerForPushAsync();
        router.replace('/(client)/(tabs)/home');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.registerError'));
    } finally {
      setIsLoading(false);
      dispatch(setLoading(false));
    }
  }, [firstName, lastName, email, phone, password, validate, dispatch, router, t]);

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
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Glass
            variant="strong"
            radius={22}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            interactive
            style={styles.backBtn}
          >
            {dir.isRTL ? (
              <ChevronRight size={22} color={C.deepTeal} strokeWidth={1.75} />
            ) : (
              <ChevronLeft size={22} color={C.deepTeal} strokeWidth={1.75} />
            )}
          </Glass>

          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {t('auth.createAccountTitle')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {t('auth.createAccountSub')}
          </Text>

          <Glass variant="regular" radius={RADII.card} style={[styles.form, SHADOW, { marginTop: 24 }]}>
            <View style={styles.formInner}>
              <View style={[styles.row, { flexDirection: dir.row }]}>
                <View style={styles.half}>
                  <LabeledInput
                    label={t('auth.firstName')}
                    value={firstName}
                    onChangeText={(v) => {
                      setFirstName(v);
                      clearError('firstName');
                    }}
                    placeholder={t('auth.firstNamePlaceholder')}
                    error={errors.firstName}
                    dir={dir}
                  />
                </View>
                <View style={styles.half}>
                  <LabeledInput
                    label={t('auth.lastName')}
                    value={lastName}
                    onChangeText={(v) => {
                      setLastName(v);
                      clearError('lastName');
                    }}
                    placeholder={t('auth.lastNamePlaceholder')}
                    error={errors.lastName}
                    dir={dir}
                  />
                </View>
              </View>

              <LabeledInput
                label={t('auth.email')}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clearError('email');
                }}
                placeholder={t('auth.emailPlaceholder')}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                dir={dir}
              />

              <LabeledInput
                label={t('auth.phone')}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  clearError('phone');
                }}
                placeholder={t('auth.phonePlaceholder')}
                error={errors.phone}
                keyboardType="phone-pad"
                dir={dir}
              />

              <LabeledInput
                label={t('auth.password')}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
                placeholder={t('auth.passwordPlaceholder')}
                error={errors.password}
                secureTextEntry
                showVisibilityToggle
                isVisible={showPassword}
                onToggleVisibility={() => setShowPassword((s) => !s)}
                dir={dir}
              />

              <LabeledInput
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  clearError('confirmPassword');
                }}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                error={errors.confirmPassword}
                secureTextEntry
                isVisible={showPassword}
                dir={dir}
              />

              <PrimaryButton
                label={loading ? t('common.loading') : t('auth.register')}
                onPress={handleRegister}
                disabled={loading}
                style={{ marginTop: 8 }}
              />

              <View style={[styles.loginRow, { flexDirection: dir.row }]}>
                <Text style={styles.loginText}>{t('auth.haveAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                  }}
                >
                  <Text style={styles.loginLink}>{t('auth.login')}</Text>
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  title: { fontSize: 32, fontWeight: '800', color: C.deepTeal, lineHeight: 42, marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20 },
  form: { padding: 24 },
  formInner: { gap: 16 },
  row: { gap: 12 },
  half: { flex: 1 },
  loginRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  loginText: { fontSize: 14, color: C.subtle },
  loginLink: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
});
