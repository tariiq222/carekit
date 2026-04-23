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
import { Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch } from '@/hooks/use-redux';
import { setLoading } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { getFontName } from '@/theme/fonts';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!firstName.trim()) newErrors.firstName = t('auth.firstNameRequired');
    if (!lastName.trim()) newErrors.lastName = t('auth.lastNameRequired');
    if (!email || !emailRegex.test(email)) newErrors.email = t('auth.invalidEmail');
    if (!phone.trim()) newErrors.phone = t('auth.phoneRequired');
    if (!password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (password.length < 8) {
      newErrors.password = t('auth.passwordMinLength');
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }

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
      // Phase 1 of client registration: request OTP. OtpVerifyScreen completes it.
      await authService.sendOtp({
        channel: 'EMAIL',
        identifier: email.trim(),
        purpose: 'CLIENT_LOGIN',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(auth)/otp-verify',
        params: {
          email: email.trim(),
          mode: 'register',
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          password,
          phone: phone || '',
        },
      });
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
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
          >
            <BackIcon size={24} strokeWidth={1.75} color={C.deepTeal} />
          </Pressable>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f700 }
            ]}
          >
            {t('auth.createAccountTitle')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
            ]}
          >
            {t('auth.createAccountSub')}
          </Text>

          {/* Form */}
          <Glass
            variant="regular"
            radius={RADII.card}
            style={[styles.form, SHADOW, { marginTop: 24 }]}
          >
            <View style={styles.formInner}>
              {/* Name Row */}
              <View style={[styles.row, { flexDirection: dir.row }]}>
                <View style={styles.half}>
                  <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }]}>
                    {t('auth.firstName')}
                  </Text>
                  <Glass variant="clear" radius={RADII.image} style={styles.input}>
                    <TextInput
                      value={firstName}
                      onChangeText={(text) => {
                        setFirstName(text);
                        if (errors.firstName) setErrors((e) => ({ ...e, firstName: undefined }));
                      }}
                      placeholder={t('auth.firstNamePlaceholder')}
                      placeholderTextColor={C.subtle}
                      style={[styles.inputText, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }]}
                    />
                  </Glass>
                  {errors.firstName ? <Text style={[styles.error, { fontFamily: f400 }]}>{errors.firstName}</Text> : null}
                </View>

                <View style={styles.half}>
                  <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }]}>
                    {t('auth.lastName')}
                  </Text>
                  <Glass variant="clear" radius={RADII.image} style={styles.input}>
                    <TextInput
                      value={lastName}
                      onChangeText={(text) => {
                        setLastName(text);
                        if (errors.lastName) setErrors((e) => ({ ...e, lastName: undefined }));
                      }}
                      placeholder={t('auth.lastNamePlaceholder')}
                      placeholderTextColor={C.subtle}
                      style={[styles.inputText, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }]}
                    />
                  </Glass>
                  {errors.lastName ? <Text style={[styles.error, { fontFamily: f400 }]}>{errors.lastName}</Text> : null}
                </View>
              </View>

              {/* Email — always LTR */}
              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }]}>
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
                    textContentType="emailAddress"
                    style={[styles.inputText, { textAlign: 'left', writingDirection: 'ltr', fontFamily: f400 }]}
                  />
                </Glass>
                {errors.email ? <Text style={[styles.error, { fontFamily: f400 }]}>{errors.email}</Text> : null}
              </View>

              {/* Phone — always LTR */}
              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }]}>
                  {t('auth.phone')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={styles.input}>
                  <TextInput
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
                    }}
                    placeholder={t('auth.phonePlaceholder')}
                    placeholderTextColor={C.subtle}
                    keyboardType="phone-pad"
                    style={[styles.inputText, { textAlign: 'left', writingDirection: 'ltr', fontFamily: f400 }]}
                  />
                </Glass>
                {errors.phone ? <Text style={[styles.error, { fontFamily: f400 }]}>{errors.phone}</Text> : null}
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }]}>
                  {t('auth.password')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={[styles.input, { flexDirection: dir.row }]}>
                  <TextInput
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                    }}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={C.subtle}
                    secureTextEntry={!showPassword}
                    style={[styles.inputText, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }]}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    {showPassword
                      ? <Eye size={20} color={C.subtle} strokeWidth={1.75} />
                      : <EyeOff size={20} color={C.subtle} strokeWidth={1.75} />
                    }
                  </Pressable>
                </Glass>
                {errors.password ? <Text style={[styles.error, { fontFamily: f400 }]}>{errors.password}</Text> : null}
              </View>

              {/* Confirm Password */}
              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }]}>
                  {t('auth.confirmPassword')}
                </Text>
                <Glass variant="clear" radius={RADII.image} style={[styles.input, { flexDirection: dir.row }]}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined }));
                    }}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    placeholderTextColor={C.subtle}
                    secureTextEntry={!showPassword}
                    style={[styles.inputText, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }]}
                  />
                </Glass>
                {errors.confirmPassword ? <Text style={[styles.error, { fontFamily: f400 }]}>{errors.confirmPassword}</Text> : null}
              </View>

              {/* Register Button */}
              <Glass
                variant="regular"
                radius={RADII.image}
                onPress={handleRegister}
                interactive
                style={[styles.btn, { backgroundColor: C.deepTeal, marginTop: 8 }]}
              >
                <Text style={[styles.btnText, { fontFamily: f700 }]}>
                  {loading ? t('common.loading') : t('auth.register')}
                </Text>
              </Glass>

              {/* Login Link */}
              <View style={[styles.loginRow, { flexDirection: dir.row }]}>
                <Text style={[styles.loginText, { fontFamily: f400 }]}>{t('auth.haveAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                  }}
                >
                  <Text style={[styles.loginLink, { fontFamily: f700 }]}>{t('auth.login')}</Text>
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 32, color: C.deepTeal, lineHeight: 42, marginBottom: 8, width: '100%' },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20, width: '100%' },
  form: { padding: 24 },
  formInner: { gap: 16 },
  row: { gap: 12 },
  half: { flex: 1, gap: 8 },
  field: { gap: 8 },
  label: { fontSize: 14, color: C.deepTeal, width: '100%' },
  input: { padding: 14, alignItems: 'center' },
  inputText: { flex: 1, fontSize: 14, color: C.deepTeal },
  eyeBtn: { padding: 4 },
  error: { fontSize: 12, color: '#E74C3C', width: '100%' },
  btn: { padding: 16, alignItems: 'center' },
  btnText: { fontSize: 16, color: '#FFF' },
  loginRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  loginText: { fontSize: 14, color: C.subtle },
  loginLink: { fontSize: 14, color: C.deepTeal },
});
