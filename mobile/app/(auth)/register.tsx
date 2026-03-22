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
import {
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Mail,
  User,
  Phone,
} from 'lucide-react-native';
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

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme, isRTL } = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhoneNum] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = useCallback(
    (field: keyof FormErrors) => {
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!firstName.trim()) newErrors.firstName = t('auth.firstNameRequired');
    if (!lastName.trim()) newErrors.lastName = t('auth.lastNameRequired');
    if (!email || !emailRegex.test(email))
      newErrors.email = t('auth.invalidEmail');
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
  }, [firstName, lastName, email, password, confirmPassword, t]);

  const handleRegister = useCallback(async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    dispatch(setLoading(true));

    try {
      const response = await authService.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
        phone: phone || undefined,
      });
      if (response.success && response.data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(setCredentials(response.data));
        router.replace('/(patient)/(tabs)/home');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.registerError'));
    } finally {
      setIsLoading(false);
      dispatch(setLoading(false));
    }
  }, [
    validate,
    firstName,
    lastName,
    email,
    password,
    phone,
    dispatch,
    router,
    t,
  ]);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
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
            <BackIcon
              size={24}
              strokeWidth={1.5}
              color={theme.colors.textPrimary}
            />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#0037B0', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <User size={28} color="#FFF" strokeWidth={1.5} />
            </LinearGradient>

            <ThemedText variant="displaySm" align="center">
              {t('auth.createAccountTitle')}
            </ThemedText>
            <ThemedText
              variant="bodySm"
              align="center"
              color={theme.colors.textSecondary}
              style={styles.sub}
            >
              {t('auth.createAccountSub')}
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Row */}
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <ThemedInput
                  label={t('auth.firstName')}
                  labelAr={t('auth.firstName')}
                  placeholder={t('auth.firstNamePlaceholder')}
                  placeholderAr={t('auth.firstNamePlaceholder')}
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    clearError('firstName');
                  }}
                  error={errors.firstName}
                  suffixIcon={
                    <User
                      size={16}
                      strokeWidth={1.5}
                      color={theme.colors.textMuted}
                    />
                  }
                />
              </View>
              <View style={styles.halfInput}>
                <ThemedInput
                  label={t('auth.lastName')}
                  labelAr={t('auth.lastName')}
                  placeholder={t('auth.lastNamePlaceholder')}
                  placeholderAr={t('auth.lastNamePlaceholder')}
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(text);
                    clearError('lastName');
                  }}
                  error={errors.lastName}
                />
              </View>
            </View>

            <ThemedInput
              label={t('auth.email')}
              labelAr={t('auth.email')}
              placeholder={t('auth.emailPlaceholder')}
              placeholderAr={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError('email');
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
              label={t('auth.phone')}
              labelAr={t('auth.phone')}
              placeholder={t('auth.phonePlaceholder')}
              placeholderAr={t('auth.phonePlaceholder')}
              value={phone}
              onChangeText={setPhoneNum}
              keyboardType="phone-pad"
              suffixIcon={
                <Phone
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
                clearError('password');
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

            <ThemedInput
              label={t('auth.confirmPassword')}
              labelAr={t('auth.confirmPassword')}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              placeholderAr={t('auth.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearError('confirmPassword');
              }}
              secureTextEntry={!showPassword}
              error={errors.confirmPassword}
            />

            {/* Terms */}
            <ThemedText
              variant="caption"
              color={theme.colors.textMuted}
              align="center"
              style={styles.terms}
            >
              {t('auth.agreeTerms')}{' '}
              <ThemedText variant="caption" color="#1D4ED8" style={styles.link}>
                {t('auth.termsOfService')}
              </ThemedText>{' '}
              {t('auth.and')}{' '}
              <ThemedText variant="caption" color="#1D4ED8" style={styles.link}>
                {t('auth.privacyPolicy')}
              </ThemedText>
            </ThemedText>

            {/* Register Button */}
            <ThemedButton
              onPress={handleRegister}
              variant="primary"
              size="lg"
              full
              loading={loading}
              disabled={loading}
            >
              {t('auth.createAccount')}
            </ThemedButton>
          </View>

          {/* Login Link */}
          <View style={styles.bottomRow}>
            <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
              {t('auth.hasAccount')}{' '}
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <ThemedText variant="bodySm" color="#1D4ED8" style={styles.link}>
                {t('auth.loginNow')}
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sub: { marginTop: 8 },
  form: { gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  terms: { marginVertical: 4, lineHeight: 20 },
  link: { fontWeight: '600' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 8,
  },
});
