import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AlertCircle } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_SOFT } from '@/theme/glass';
import { AquaBackground, PrimaryButton, sawaaColors } from '@/theme/sawaa';
import { getFontName } from '@/theme/fonts';
import { useAppDispatch } from '@/hooks/use-redux';
import { setAuthSession, setUser } from '@/stores/slices/auth-slice';
import { useVerifyOtp, useRequestLoginOtp, useMe } from '@/hooks/queries';
import { registerForPushAsync } from '@/services/push';
import { setCurrentOrgId } from '@/services/tenant';
import { toAsciiDigits } from '@/utils/digits';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 60;

export default function OtpVerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    identifier: string;
    purpose: 'register' | 'login';
    maskedIdentifier: string;
  }>();
  const { identifier = '', purpose = 'register', maskedIdentifier = '' } = params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const f400 = getFontName('ar', '400');
  const f600 = getFontName('ar', '600');
  const f700 = getFontName('ar', '700');

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeX = useSharedValue(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const triggerError = useCallback((message: string) => {
    setErrorMessage(message);
    shakeX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 4000);
  }, [shakeX]);

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 350);
    return () => clearTimeout(focusTimer);
  }, []);

  const verifyOtp = useVerifyOtp();
  const requestLoginOtp = useRequestLoginOtp();
  const { refetch: refetchMe } = useMe();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      const ascii = toAsciiDigits(text);
      const digits = ascii.replace(/\D/g, '');

      if (digits.length > 1) {
        const pasted = digits.slice(0, OTP_LENGTH).split('');
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
      newOtp[index] = digits;
      setOtp(newOtp);

      if (digits && index < OTP_LENGTH - 1) {
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

  const navigateAfterVerify = useCallback(
    async (activeMembership: { id: string; organizationId: string; role: string } | null) => {
      if (activeMembership) {
        await setCurrentOrgId(activeMembership.organizationId);
        router.replace('/(employee)/(tabs)/today');
      } else {
        router.replace('/(client)/(tabs)/home');
      }
    },
    [router],
  );

  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH || loading) return;

    setIsLoading(true);

    try {
      const result = await verifyOtp.mutateAsync({ identifier, code, purpose });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      dispatch(setAuthSession({ tokens: result.tokens, activeMembership: result.activeMembership }));
      void registerForPushAsync();

      const meResult = await refetchMe();
      // /auth/me returns the User object directly (no {data} envelope).
      // Tolerate both shapes so older backends still work.
      const meData = (meResult.data as any)?.data ?? meResult.data;
      if (meData) {
        dispatch(setUser(meData as any));
      }

      await navigateAfterVerify(result.activeMembership);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerError(t('auth.otpError'));
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [otp, identifier, purpose, verifyOtp, dispatch, refetchMe, navigateAfterVerify, t, triggerError, loading]);

  const handleResend = useCallback(async () => {
    if (purpose !== 'login') return;
    setResendLoading(true);
    try {
      await requestLoginOtp.mutateAsync({ identifier });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(RESEND_COOLDOWN);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerError(t('error.generic'));
    } finally {
      setResendLoading(false);
    }
  }, [purpose, identifier, requestLoginOtp, t, triggerError]);

  const isComplete = otp.every((d) => d !== '');

  useEffect(() => {
    if (isComplete && !loading) {
      handleVerify();
    }
  }, [isComplete, loading, handleVerify]);

  const BackIcon = ChevronRight;

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={[styles.backBtn, { alignSelf: 'flex-start' }]}
            hitSlop={10}
          >
            <Glass variant="regular" radius={RADII.pill} style={[styles.backInner, SHADOW_SOFT]}>
              <BackIcon size={22} strokeWidth={1.8} color={C.deepTeal} />
            </Glass>
          </Pressable>

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

          <Animated.Text
            entering={FadeInDown.delay(150).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.title,
              { textAlign: 'center', writingDirection: 'rtl', fontFamily: f700 },
            ]}
          >
            {t('auth.otp.title')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.subtitle,
              { textAlign: 'center', writingDirection: 'rtl', fontFamily: f400 },
            ]}
          >
            {t('auth.otp.sentTo')} {maskedIdentifier}
          </Animated.Text>

          <Animated.View
            entering={FadeInUp.delay(400).duration(800).easing(Easing.out(Easing.cubic))}
            style={{ marginTop: 32, gap: 28 }}
          >
            <Animated.View style={[styles.otpRow, { direction: 'ltr' }, shakeStyle]}>
              {otp.map((digit, index) => (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    SHADOW_SOFT,
                  ]}
                >
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={({ nativeEvent: { key } }) =>
                      handleKeyPress(key, index)
                    }
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={1}
                    selectTextOnFocus
                    textAlign="center"
                    style={[styles.otpInput, { fontFamily: f700, writingDirection: 'ltr' }]}
                  />
                </View>
              ))}
            </Animated.View>

            {errorMessage ? (
              <Animated.View
                key={errorMessage}
                entering={FadeInDown.duration(220).easing(Easing.out(Easing.cubic))}
                exiting={FadeOut.duration(180)}
              >
                <View style={[styles.errorBanner, SHADOW_SOFT]}>
                  <Text
                    style={[
                      styles.errorText,
                      { fontFamily: f600 },
                    ]}
                  >
                    {errorMessage}
                  </Text>
                  <AlertCircle size={18} strokeWidth={2} color={C.notifDot} />
                </View>
              </Animated.View>
            ) : null}

            <PrimaryButton
              label={loading ? t('auth.otp.submitting') : t('auth.otp.submit')}
              onPress={handleVerify}
              fontFamily={f700}
              disabled={!isComplete || loading}
            />

            <View style={styles.resendRow}>
              {purpose === 'login' ? (
                countdown > 0 ? (
                  <Text style={[styles.resendText, { fontFamily: f400 }]}>
                    {t('auth.otp.resendIn', { seconds: countdown })}
                  </Text>
                ) : (
                  <Pressable onPress={handleResend} disabled={resendLoading}>
                    <Text style={[styles.resendLink, { fontFamily: f700 }]}>
                      {resendLoading ? t('common.loading') : t('auth.otp.resend')}
                    </Text>
                  </Pressable>
                )
              ) : (
                <Text style={[styles.resendText, { fontFamily: f400, textAlign: 'center' }]}>
                  {t('auth.otp.registerNoResend')}
                </Text>
              )}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 12 },
  backInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  logo: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, color: C.deepTeal, lineHeight: 38, marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  otpBox: {
    width: 60,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.image,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  otpBoxFilled: {
    borderColor: sawaaColors.teal[600],
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 26,
    color: C.deepTeal,
  },
  resendRow: { alignItems: 'center', marginTop: 4 },
  resendText: { fontSize: 14, color: C.subtle, lineHeight: 20 },
  resendLink: { fontSize: 14, color: C.deepTeal, lineHeight: 20 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.image,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.28)',
    backgroundColor: 'rgba(255,236,233,0.92)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#8A2B22',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
