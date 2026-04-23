import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials, setLoading } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { getMobileRole } from '@/types/auth';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OtpVerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email, mode, name, password } = useLocalSearchParams<{
    email: string;
    mode?: 'login' | 'register';
    name?: string;
    password?: string;
  }>();
  const isRegister = mode === 'register';
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme, isRTL } = useTheme();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [otpSent, setOtpSent] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Send OTP on mount
  useEffect(() => {
    if (email && !otpSent) {
      sendOtp();
    }
  }, [email, otpSent]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendOtp = useCallback(async () => {
    if (!email) return;
    try {
      await authService.sendOtp({
        channel: 'EMAIL',
        identifier: email,
        purpose: 'CLIENT_LOGIN',
      });
      setOtpSent(true);
      setCountdown(RESEND_COOLDOWN);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('auth.otpError'));
    }
  }, [email, t]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      if (text.length > 1) {
        // Handle paste
        const pasted = text.slice(0, OTP_LENGTH).split('');
        const newOtp = [...otp];
        pasted.forEach((char, i) => {
          if (index + i < OTP_LENGTH) {
            newOtp[index + i] = char;
          }
        });
        setOtp(newOtp);
        const nextIndex = Math.min(index + pasted.length, OTP_LENGTH - 1);
        inputRefs.current[nextIndex]?.focus();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);

      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [otp],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    },
    [otp],
  );

  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;

    setIsLoading(true);
    dispatch(setLoading(true));

    try {
      const { sessionToken } = await authService.verifyOtp({
        channel: 'EMAIL',
        identifier: email ?? '',
        code,
        purpose: 'CLIENT_LOGIN',
      });

      if (isRegister) {
        if (!password) throw new Error('Missing pending password for register flow');
        const result = await authService.register({
          name: name ?? '',
          password,
          otpSessionToken: sessionToken,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(setCredentials(result));
        const role = getMobileRole(result.user);
        router.replace(role === 'employee' ? '/(employee)/(tabs)/today' : '/(client)/(tabs)/home');
        return;
      }

      // Login-via-OTP escape hatch is not yet implemented on the public-auth
      // controller — surface a clear error until then.
      Alert.alert(t('common.error'), t('auth.otpError'));
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.otpError'));
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
      dispatch(setLoading(false));
    }
  }, [otp, email, isRegister, name, password, dispatch, router, t]);

  const isComplete = otp.every((d) => d !== '');
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
          ]}
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
              <ThemedText
                variant="displaySm"
                color="#FFF"
                align="center"
                style={{ fontSize: 28 }}
              >
                {'#'}
              </ThemedText>
            </LinearGradient>

            <ThemedText variant="displaySm" align="center">
              {t('auth.otpTitle')}
            </ThemedText>
            <ThemedText
              variant="bodySm"
              align="center"
              color={theme.colors.textSecondary}
              style={styles.sub}
            >
              {t('auth.otpSub')}
            </ThemedText>
            {email && (
              <ThemedText
                variant="body"
                align="center"
                color="#1D4ED8"
                style={styles.email}
              >
                {email}
              </ThemedText>
            )}
          </View>

          {/* OTP Boxes */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={({ nativeEvent: { key } }) =>
                  handleKeyPress(key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: theme.colors.surfaceHigh,
                    borderColor: digit
                      ? '#1D4ED866'
                      : 'transparent',
                    color: theme.colors.textPrimary,
                  },
                ]}
              />
            ))}
          </View>

          {/* Verify Button */}
          <View style={styles.actions}>
            <ThemedButton
              onPress={handleVerify}
              variant="primary"
              size="lg"
              full
              loading={loading}
              disabled={!isComplete || loading}
            >
              {t('auth.verify')}
            </ThemedButton>

            {/* Resend */}
            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <ThemedText
                  variant="bodySm"
                  color={theme.colors.textMuted}
                  align="center"
                >
                  {t('auth.resendIn')} {countdown} {t('auth.seconds')}
                </ThemedText>
              ) : (
                <Pressable onPress={sendOtp}>
                  <ThemedText
                    variant="bodySm"
                    color="#1D4ED8"
                    align="center"
                    style={styles.link}
                  >
                    {t('auth.resendOtp')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  header: { alignItems: 'center', marginBottom: 40 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sub: { marginTop: 8 },
  email: { marginTop: 4, fontWeight: '600' },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  actions: { gap: 20 },
  resendRow: { alignItems: 'center' },
  link: { fontWeight: '600' },
});
