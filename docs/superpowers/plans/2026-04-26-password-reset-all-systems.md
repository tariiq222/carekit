# Password Reset Across All Systems — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "forgot password" flows to every CareKit surface — mobile (client + employee), dashboard (clinic staff), and admin (super-admin) — backed by tenant-aware backend endpoints.

**Architecture:** Two distinct flows because the two identity entities differ:
- **Client** (`Client` model — phone/email + `organizationId`): already has `POST /public/auth/reset-password` using OTP-session-token. Only mobile UI is missing. Phase A wires that UI.
- **Staff** (`User` model — globally-unique email, no `organizationId`): needs a token-based email-link reset — there is no OTP flow for staff today. Phase B adds the `User` reset slice (request + perform) plus `PasswordResetToken` model. Phase C adds dashboard + admin + employee-mobile UI on top.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ, React Native (Expo Router), Next.js 15 (App Router), TanStack Query, next-intl, react-i18next.

---

## File Structure

### Phase A — Mobile client UI (backend already done)
- Create: `apps/mobile/app/(auth)/forgot-password.tsx` — email input → triggers `requestOtp(CLIENT_PASSWORD_RESET)` → routes to `reset-password`
- Create: `apps/mobile/app/(auth)/reset-password.tsx` — OTP input + new password → `verifyOtp` then `resetPassword`
- Modify: `apps/mobile/app/(auth)/login.tsx` — add "Forgot password?" link beneath password field
- Modify: `apps/mobile/services/auth.ts` — add `resetPassword(sessionToken, newPassword)` wrapper if missing
- Modify: `apps/mobile/locales/ar.json` + `apps/mobile/locales/en.json` — add `auth.forgotPassword.*`, `auth.resetPassword.*` keys

### Phase B — Staff reset backend (`User` model)
- Modify: `apps/backend/prisma/schema/identity.prisma` — add `PasswordResetToken` model + relation on `User`
- Create: `apps/backend/prisma/migrations/<timestamp>_add_user_password_reset/migration.sql`
- Create: `apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.dto.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.spec.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.dto.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.spec.ts`
- Modify: `apps/backend/src/modules/identity/identity.module.ts` — register two handlers
- Modify: `apps/backend/src/api/public/auth.controller.ts` — add `POST /auth/request-password-reset` + `POST /auth/reset-password`
- Modify: `apps/backend/prisma/seed.ts` — seed `user_password_reset` email template (AR + EN)
- Create: `apps/backend/test/e2e/public/user-password-reset.e2e-spec.ts`

### Phase C — Staff reset UI (dashboard + admin + employee mobile)
- Create: `apps/dashboard/app/forgot-password/page.tsx`
- Create: `apps/dashboard/app/reset-password/page.tsx`
- Create: `apps/dashboard/components/features/forgot-password-form.tsx`
- Create: `apps/dashboard/components/features/reset-password-form.tsx`
- Modify: `apps/dashboard/components/features/login-form.tsx` — add "Forgot password?" link
- Modify: `apps/dashboard/lib/translations/{ar,en}.auth.ts` (or matching i18n bundle file) — add keys
- Create: `apps/admin/app/forgot-password/page.tsx`
- Create: `apps/admin/app/reset-password/page.tsx`
- Create: `apps/admin/features/auth/forgot-password-form.tsx`
- Create: `apps/admin/features/auth/reset-password-form.tsx`
- Modify: `apps/admin/app/login/page.tsx` — add "Forgot password?" link
- Modify: `packages/api-client/src/modules/auth.ts` (or equivalent) — add `requestPasswordReset(email)` + `performPasswordReset(token, newPassword)`
- Reuse for employee-mobile: same forgot/reset screens already created in Phase A but with a `mode` flag (`'client' | 'staff'`) — so update Phase A screens to support both flows

---

## Phase A — Mobile Client Forgot Password (backend already exists)

### Task A1: Add `resetPassword` API call to mobile auth service

**Files:**
- Modify: `apps/mobile/services/auth.ts`

- [ ] **Step 1: Locate existing auth service exports**

Run: `grep -n "export" apps/mobile/services/auth.ts | head -20`
Expected: Shows `authService.login`, `authService.register`, etc.

- [ ] **Step 2: Add `requestPasswordResetOtp` and `resetPassword` methods**

Append to `apps/mobile/services/auth.ts` (or co-locate with existing OTP wrappers):

```typescript
export async function requestPasswordResetOtp(email: string): Promise<void> {
  await api.post('/public/otp/request', {
    channel: 'EMAIL',
    identifier: email,
    purpose: 'CLIENT_PASSWORD_RESET',
    hCaptchaToken: '',
  });
}

export async function verifyPasswordResetOtp(
  email: string,
  code: string,
): Promise<{ sessionToken: string }> {
  const { data } = await api.post('/public/otp/verify', {
    channel: 'EMAIL',
    identifier: email,
    code,
    purpose: 'CLIENT_PASSWORD_RESET',
  });
  return data;
}

export async function resetClientPassword(
  sessionToken: string,
  newPassword: string,
): Promise<void> {
  await api.post('/public/auth/reset-password', { sessionToken, newPassword });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/services/auth.ts
git commit -m "feat(mobile): add password reset API helpers"
```

### Task A2: Add i18n strings

**Files:**
- Modify: `apps/mobile/locales/ar.json`
- Modify: `apps/mobile/locales/en.json`

- [ ] **Step 1: Add keys to both files**

Add under the existing `auth` namespace in each file:

```jsonc
// en.json
"auth": {
  "forgotPassword": {
    "title": "Forgot Password",
    "subtitle": "Enter your email and we'll send a 6-digit code",
    "emailLabel": "Email",
    "submit": "Send Code",
    "back": "Back to Sign In",
    "linkLabel": "Forgot password?"
  },
  "resetPassword": {
    "title": "Reset Password",
    "otpStepSubtitle": "Enter the 6-digit code sent to {{email}}",
    "passwordStepSubtitle": "Choose a new password",
    "codeLabel": "Verification Code",
    "newPasswordLabel": "New Password",
    "verifyCode": "Verify Code",
    "submit": "Reset Password",
    "success": "Password reset successful. Please sign in.",
    "invalidCode": "Invalid or expired code",
    "weakPassword": "Password must be at least 8 characters"
  }
}
```

```jsonc
// ar.json
"auth": {
  "forgotPassword": {
    "title": "نسيت كلمة المرور",
    "subtitle": "أدخل بريدك الإلكتروني وسنرسل لك رمز التحقق",
    "emailLabel": "البريد الإلكتروني",
    "submit": "إرسال الرمز",
    "back": "العودة لتسجيل الدخول",
    "linkLabel": "نسيت كلمة المرور؟"
  },
  "resetPassword": {
    "title": "إعادة تعيين كلمة المرور",
    "otpStepSubtitle": "أدخل الرمز المكوّن من 6 أرقام المرسل إلى {{email}}",
    "passwordStepSubtitle": "اختر كلمة مرور جديدة",
    "codeLabel": "رمز التحقق",
    "newPasswordLabel": "كلمة المرور الجديدة",
    "verifyCode": "تحقق من الرمز",
    "submit": "إعادة تعيين كلمة المرور",
    "success": "تم إعادة تعيين كلمة المرور. الرجاء تسجيل الدخول.",
    "invalidCode": "رمز غير صالح أو منتهي الصلاحية",
    "weakPassword": "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/locales/ar.json apps/mobile/locales/en.json
git commit -m "feat(mobile): add password reset i18n strings"
```

### Task A3: Create forgot-password screen

**Files:**
- Create: `apps/mobile/app/(auth)/forgot-password.tsx`

- [ ] **Step 1: Create the screen**

Mirror the structure of `apps/mobile/app/(auth)/login.tsx` (Glass theme, AquaBackground, PrimaryButton, RTL via `useDir`):

```typescript
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, Alert, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Glass } from '@/theme';
import { C, RADII } from '@/theme/glass';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { requestPasswordResetOtp } from '@/services/auth';

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
    if (!emailRegex.test(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordResetOtp(email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/(auth)/reset-password', params: { email } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Request failed';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [email, router, t]);

  return (
    <View style={{ flex: 1 }}>
      <AquaBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 32 }}>
          <Animated.Text entering={FadeInDown} style={{ fontFamily: f700, fontSize: 28, color: C.text, textAlign: dir.isRtl ? 'right' : 'left' }}>
            {t('auth.forgotPassword.title')}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(80)} style={{ fontFamily: f400, fontSize: 14, color: C.textMuted, marginTop: 8, textAlign: dir.isRtl ? 'right' : 'left' }}>
            {t('auth.forgotPassword.subtitle')}
          </Animated.Text>
          <Animated.View entering={FadeInUp.delay(160)} style={{ marginTop: 32 }}>
            <Text style={{ fontFamily: f600, fontSize: 13, color: C.text, marginBottom: 8 }}>
              {t('auth.forgotPassword.emailLabel')}
            </Text>
            <Glass style={{ borderRadius: RADII.md, padding: 14 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor={C.textMuted}
                style={{ fontFamily: f400, fontSize: 16, color: C.text, textAlign: dir.isRtl ? 'right' : 'left' }}
              />
            </Glass>
            {error ? <Text style={{ color: C.danger, marginTop: 8, fontFamily: f400 }}>{error}</Text> : null}
            <View style={{ height: 24 }} />
            <PrimaryButton onPress={onSubmit} loading={loading} label={t('auth.forgotPassword.submit')} />
            <Pressable onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: f600, fontSize: 14, color: C.text }}>
                {t('auth.forgotPassword.back')}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(auth\)/forgot-password.tsx
git commit -m "feat(mobile): add forgot password screen"
```

### Task A4: Create reset-password screen (two-step: OTP then new password)

**Files:**
- Create: `apps/mobile/app/(auth)/reset-password.tsx`

- [ ] **Step 1: Create the screen**

```typescript
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, TextInput } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';
import { Glass } from '@/theme';
import { C, RADII } from '@/theme/glass';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { verifyPasswordResetOtp, resetClientPassword } from '@/services/auth';

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
      const { sessionToken } = await verifyPasswordResetOtp(email, code);
      setSessionToken(sessionToken);
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
      await resetClientPassword(sessionToken, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/(auth)/login', params: { resetSuccess: '1' } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [newPassword, sessionToken, router, t]);

  return (
    <View style={{ flex: 1 }}>
      <AquaBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 32 }}>
          <Animated.Text entering={FadeInDown} style={{ fontFamily: f700, fontSize: 28, color: C.text, textAlign: dir.isRtl ? 'right' : 'left' }}>
            {t('auth.resetPassword.title')}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(80)} style={{ fontFamily: f400, fontSize: 14, color: C.textMuted, marginTop: 8, textAlign: dir.isRtl ? 'right' : 'left' }}>
            {step === 'otp'
              ? t('auth.resetPassword.otpStepSubtitle', { email })
              : t('auth.resetPassword.passwordStepSubtitle')}
          </Animated.Text>
          <Animated.View entering={FadeInUp.delay(160)} style={{ marginTop: 32 }}>
            {step === 'otp' ? (
              <>
                <Text style={{ fontFamily: f600, fontSize: 13, color: C.text, marginBottom: 8 }}>
                  {t('auth.resetPassword.codeLabel')}
                </Text>
                <Glass style={{ borderRadius: RADII.md, padding: 14 }}>
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    placeholder="123456"
                    placeholderTextColor={C.textMuted}
                    style={{ fontFamily: f400, fontSize: 18, color: C.text, letterSpacing: 4, textAlign: 'center' }}
                  />
                </Glass>
                {error ? <Text style={{ color: C.danger, marginTop: 8, fontFamily: f400 }}>{error}</Text> : null}
                <View style={{ height: 24 }} />
                <PrimaryButton onPress={onVerifyOtp} loading={loading} label={t('auth.resetPassword.verifyCode')} />
              </>
            ) : (
              <>
                <Text style={{ fontFamily: f600, fontSize: 13, color: C.text, marginBottom: 8 }}>
                  {t('auth.resetPassword.newPasswordLabel')}
                </Text>
                <Glass style={{ borderRadius: RADII.md, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    placeholderTextColor={C.textMuted}
                    style={{ flex: 1, fontFamily: f400, fontSize: 16, color: C.text }}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff size={20} color={C.textMuted} /> : <Eye size={20} color={C.textMuted} />}
                  </Pressable>
                </Glass>
                {error ? <Text style={{ color: C.danger, marginTop: 8, fontFamily: f400 }}>{error}</Text> : null}
                <View style={{ height: 24 }} />
                <PrimaryButton onPress={onResetPassword} loading={loading} label={t('auth.resetPassword.submit')} />
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(auth\)/reset-password.tsx
git commit -m "feat(mobile): add reset password screen with OTP + new password steps"
```

### Task A5: Add "Forgot password?" link to login screen

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Read current password field block**

Run: `grep -n "password\|Password" apps/mobile/app/\(auth\)/login.tsx | head -20`

- [ ] **Step 2: Add link below password field**

Locate the password input block in `login.tsx`. Immediately after the password input + show/hide toggle (and after the password error display), insert:

```tsx
<Pressable
  onPress={() => router.push('/(auth)/forgot-password')}
  style={{ marginTop: 8, alignSelf: dir.isRtl ? 'flex-start' : 'flex-end' }}
  hitSlop={8}
>
  <Text style={{ fontFamily: f600, fontSize: 13, color: sawaaColors.primary }}>
    {t('auth.forgotPassword.linkLabel')}
  </Text>
</Pressable>
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev:mobile` (from repo root) → open Expo on simulator → tap "Forgot password?" on the login screen → enter test email → verify navigation to reset-password screen.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(auth\)/login.tsx
git commit -m "feat(mobile): add forgot password link to login screen"
```

### Task A6: End-to-end manual QA against running backend

**Files:** none (verification only)

- [ ] **Step 1: Start backend + mobile**

Run in separate terminals:
```bash
npm run docker:up
npm run dev:backend
npm run dev:mobile
```

- [ ] **Step 2: Seed test client + verify SMTP MailHog**

Confirm there's a seeded `Client` with a known email. Open MailHog at `http://localhost:8025` (or the configured SMTP web UI).

- [ ] **Step 3: Walk the flow**

In Expo: tap "Forgot password?" → enter the seeded client's email → submit → check MailHog for the OTP code → enter the 6-digit code → set a new password (≥8 chars) → confirm redirect to login.

- [ ] **Step 4: Verify login works with new password**

Sign in with the new password. Confirm app reaches the home screen.

- [ ] **Step 5: Commit (if any QA tweaks)**

If no changes are needed, skip. Otherwise:
```bash
git add -A
git commit -m "chore(mobile): qa fixups for password reset"
```

---

## Phase B — Staff (`User`) Password Reset Backend

### Task B1: Add `PasswordResetToken` model + migration

**Files:**
- Modify: `apps/backend/prisma/schema/identity.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_add_user_password_reset/migration.sql`

- [ ] **Step 1: Append model and relation**

Add to `apps/backend/prisma/schema/identity.prisma` (immediately after the `RefreshToken` model):

```prisma
model PasswordResetToken {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  // First 8 chars of the raw token used as a fast lookup key.
  // Mirrors RefreshToken.tokenSelector — single-row indexed lookup before bcrypt compare.
  tokenSelector String
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([tokenSelector])
  @@index([userId])
  @@index([expiresAt])
}
```

Modify the `User` model — add `passwordResetTokens PasswordResetToken[]` to the relations block.

- [ ] **Step 2: Generate migration**

Run: `cd apps/backend && npx prisma migrate dev --name add_user_password_reset`
Expected: new migration directory + `prisma generate` runs cleanly.

- [ ] **Step 3: Run unit suite to confirm no schema regressions**

Run: `cd apps/backend && npm run test -- --testPathPattern='identity' --bail`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema/identity.prisma apps/backend/prisma/migrations/
git commit -m "feat(backend): add PasswordResetToken model for staff password reset"
```

### Task B2: Seed `user_password_reset` email template

**Files:**
- Modify: `apps/backend/prisma/seed.ts`

- [ ] **Step 1: Find existing email template seeds**

Run: `grep -n "emailTemplate\|EmailTemplate" apps/backend/prisma/seed.ts`

If none exist, locate where the seed inserts comms data and add a templates section. If templates seed elsewhere, reuse that file instead.

- [ ] **Step 2: Add the template**

Inside the seed, ensure this template exists for the platform default + per-org seed loop (since template uniqueness is composite-per-org):

```typescript
await prisma.emailTemplate.upsert({
  where: { organizationId_slug: { organizationId, slug: 'user_password_reset' } },
  update: {},
  create: {
    organizationId,
    slug: 'user_password_reset',
    subjectAr: 'إعادة تعيين كلمة المرور — CareKit',
    subjectEn: 'Reset your CareKit password',
    htmlBody: `
      <div style="font-family: 'IBM Plex Sans Arabic', system-ui; padding: 24px; max-width: 560px;">
        <h2 style="color: #354FD8;">{{subject}}</h2>
        <p>Hi {{userName}},</p>
        <p>We received a request to reset your CareKit password. Click the button below to set a new one. This link expires in 30 minutes.</p>
        <p style="margin: 24px 0;">
          <a href="{{resetUrl}}" style="background:#354FD8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            Reset password
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    isActive: true,
  },
});
```

- [ ] **Step 3: Run seed**

Run: `cd apps/backend && npm run seed`
Expected: completes; new `EmailTemplate` rows visible in `prisma studio`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/seed.ts
git commit -m "feat(backend): seed user_password_reset email template"
```

### Task B3: Write request-password-reset handler test (failing)

**Files:**
- Create: `apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.dto.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.spec.ts`

- [ ] **Step 1: Create DTO**

```typescript
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Staff email address', example: 'admin@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
```

- [ ] **Step 2: Write the spec**

```typescript
import { Test } from '@nestjs/testing';
import { RequestPasswordResetHandler } from './request-password-reset.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { SendEmailHandler } from '../../../comms/send-email/send-email.handler';
import { ConfigService } from '@nestjs/config';

describe('RequestPasswordResetHandler', () => {
  let handler: RequestPasswordResetHandler;
  let prisma: { user: { findUnique: jest.Mock }; passwordResetToken: { create: jest.Mock; updateMany: jest.Mock } };
  let sendEmail: { execute: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      passwordResetToken: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    };
    sendEmail = { execute: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('https://app.carekit.test') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestPasswordResetHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendEmailHandler, useValue: sendEmail },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    handler = moduleRef.get(RequestPasswordResetHandler);
  });

  it('returns silently and sends nothing when user does not exist (enumeration safe)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await handler.execute({ email: 'nobody@x.com' });
    expect(sendEmail.execute).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('invalidates prior tokens and creates a new one for an existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice', isActive: true });
    await handler.execute({ email: 'a@b.com' });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(sendEmail.execute).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      templateSlug: 'user_password_reset',
      vars: expect.objectContaining({ userName: 'Alice', resetUrl: expect.stringContaining('https://app.carekit.test/reset-password?token=') }),
    }));
  });

  it('skips sending when user is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice', isActive: false });
    await handler.execute({ email: 'a@b.com' });
    expect(sendEmail.execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run spec to confirm it fails**

Run: `cd apps/backend && npx jest src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.spec.ts`
Expected: FAIL — handler not found.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/identity/user-password-reset/request-password-reset/
git commit -m "test(backend): add failing spec for request-password-reset handler"
```

### Task B4: Implement request-password-reset handler

**Files:**
- Create: `apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.ts`

- [ ] **Step 1: Implement**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../../../infrastructure/database';
import { SendEmailHandler } from '../../../comms/send-email/send-email.handler';
import { RequestPasswordResetDto } from './request-password-reset.dto';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class RequestPasswordResetHandler {
  private readonly logger = new Logger(RequestPasswordResetHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendEmail: SendEmailHandler,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: RequestPasswordResetDto): Promise<void> {
    // Enumeration safety: same response shape regardless of whether user exists.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      this.logger.log(`Password reset requested for unknown/inactive email: ${dto.email}`);
      return;
    }

    // Invalidate any prior unused tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenSelector = rawToken.slice(0, 8);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        tokenSelector,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const baseUrl = this.config.get<string>('PASSWORD_RESET_BASE_URL') ?? this.config.get<string>('DASHBOARD_URL') ?? 'http://localhost:5103';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await this.sendEmail.execute({
      to: user.email,
      templateSlug: 'user_password_reset',
      vars: {
        userName: user.name,
        resetUrl,
        subject: 'Reset your CareKit password',
      },
    });

    this.logger.log(`Password reset email sent to ${user.email}`);
  }
}
```

- [ ] **Step 2: Run spec to confirm pass**

Run: `cd apps/backend && npx jest src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/identity/user-password-reset/request-password-reset/request-password-reset.handler.ts
git commit -m "feat(backend): implement request-password-reset handler"
```

### Task B5: Write perform-password-reset handler test (failing)

**Files:**
- Create: `apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.dto.ts`
- Create: `apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.spec.ts`

- [ ] **Step 1: Create DTO**

```typescript
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PerformPasswordResetDto {
  @ApiProperty({ description: 'Reset token from the email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password (≥8 chars)', example: 'newSecure123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

- [ ] **Step 2: Write the spec**

```typescript
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PerformPasswordResetHandler } from './perform-password-reset.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { PasswordService } from '../../shared/password.service';

describe('PerformPasswordResetHandler', () => {
  let handler: PerformPasswordResetHandler;
  let prisma: {
    passwordResetToken: { findFirst: jest.Mock; update: jest.Mock };
    user: { update: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwords: { hash: jest.Mock };

  const rawToken = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  beforeEach(async () => {
    prisma = {
      passwordResetToken: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      user: { update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    passwords = { hash: jest.fn().mockResolvedValue('hashed-pw') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PerformPasswordResetHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
      ],
    }).compile();
    handler = moduleRef.get(PerformPasswordResetHandler);
  });

  it('throws when token does not exist', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ token: rawToken, newPassword: 'newpass12' })).rejects.toThrow(UnauthorizedException);
  });

  it('throws when token is expired', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    });
    await expect(handler.execute({ token: rawToken, newPassword: 'newpass12' })).rejects.toThrow(UnauthorizedException);
  });

  it('throws when token already consumed', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() + 60_000), consumedAt: new Date(),
    });
    await expect(handler.execute({ token: rawToken, newPassword: 'newpass12' })).rejects.toThrow(UnauthorizedException);
  });

  it('updates password, marks token consumed, revokes all refresh tokens', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    });
    await handler.execute({ token: rawToken, newPassword: 'newpass12' });
    expect(passwords.hash).toHaveBeenCalledWith('newpass12');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hashed-pw' } });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { consumedAt: expect.any(Date) } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 3: Run spec to confirm fail**

Run: `cd apps/backend && npx jest src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/identity/user-password-reset/perform-password-reset/
git commit -m "test(backend): add failing spec for perform-password-reset handler"
```

### Task B6: Implement perform-password-reset handler

**Files:**
- Create: `apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.ts`

- [ ] **Step 1: Implement**

```typescript
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../infrastructure/database';
import { PasswordService } from '../../shared/password.service';
import { PerformPasswordResetDto } from './perform-password-reset.dto';

@Injectable()
export class PerformPasswordResetHandler {
  private readonly logger = new Logger(PerformPasswordResetHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async execute(dto: PerformPasswordResetDto): Promise<void> {
    const tokenSelector = dto.token.slice(0, 8);
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenSelector, tokenHash },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (record.consumedAt) {
      throw new UnauthorizedException('Token already used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    this.logger.log(`Password reset completed for user ${record.userId}`);
  }
}
```

- [ ] **Step 2: Run spec to confirm pass**

Run: `cd apps/backend && npx jest src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler.ts
git commit -m "feat(backend): implement perform-password-reset handler"
```

### Task B7: Wire handlers in `IdentityModule` + controller

**Files:**
- Modify: `apps/backend/src/modules/identity/identity.module.ts`
- Modify: `apps/backend/src/api/public/auth.controller.ts`

- [ ] **Step 1: Register handlers**

In `identity.module.ts`, add imports and providers:

```typescript
import { RequestPasswordResetHandler } from './user-password-reset/request-password-reset/request-password-reset.handler';
import { PerformPasswordResetHandler } from './user-password-reset/perform-password-reset/perform-password-reset.handler';

// inside @Module providers/exports arrays:
providers: [
  // ...existing
  RequestPasswordResetHandler,
  PerformPasswordResetHandler,
],
exports: [
  // ...existing
  RequestPasswordResetHandler,
  PerformPasswordResetHandler,
],
```

If the module imports `CommsModule` (for `SendEmailHandler`), confirm; otherwise add the import.

- [ ] **Step 2: Add endpoints in `AuthController`**

Inject the two handlers in the constructor and add:

```typescript
import { RequestPasswordResetHandler } from '../../modules/identity/user-password-reset/request-password-reset/request-password-reset.handler';
import { RequestPasswordResetDto } from '../../modules/identity/user-password-reset/request-password-reset/request-password-reset.dto';
import { PerformPasswordResetHandler } from '../../modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler';
import { PerformPasswordResetDto } from '../../modules/identity/user-password-reset/perform-password-reset/perform-password-reset.dto';

// constructor adds:
private readonly requestPasswordReset: RequestPasswordResetHandler,
private readonly performPasswordReset: PerformPasswordResetHandler,

@Public()
@Post('request-password-reset')
@Throttle({ default: { ttl: 60_000, limit: 3 } })
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Request a password reset email for a staff (User) account' })
async requestPasswordResetEndpoint(@Body() dto: RequestPasswordResetDto): Promise<void> {
  await this.requestPasswordReset.execute(dto);
}

@Public()
@Post('reset-password')
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Reset staff (User) password using a token from the reset email' })
async performPasswordResetEndpoint(@Body() dto: PerformPasswordResetDto): Promise<void> {
  await this.performPasswordReset.execute(dto);
}
```

Mark `@Public()` import is the existing decorator from `../../common/guards/jwt.guard`.

- [ ] **Step 3: Run full backend unit suite**

Run: `cd apps/backend && npm run test`
Expected: PASS — including the two new specs.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/identity/identity.module.ts apps/backend/src/api/public/auth.controller.ts
git commit -m "feat(backend): expose staff request/perform password reset endpoints"
```

### Task B8: Add E2E suite for staff password reset

**Files:**
- Create: `apps/backend/test/e2e/public/user-password-reset.e2e-spec.ts`

- [ ] **Step 1: Write the E2E spec**

Mirror the structure of `apps/backend/test/e2e/public/client-account.e2e-spec.ts`. The suite must cover:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapTestApp, closeTestApp } from '../helpers/bootstrap';
import { PrismaService } from '../../../src/infrastructure/database';

describe('Staff password reset (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => { await closeTestApp(app); });

  beforeEach(async () => {
    await prisma.passwordResetToken.deleteMany();
  });

  it('POST /auth/request-password-reset returns 204 even when email unknown', async () => {
    await request(app.getHttpServer())
      .post('/auth/request-password-reset')
      .send({ email: 'nobody@x.com' })
      .expect(204);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it('full flow: request → reset → old refresh tokens revoked → login with new pw', async () => {
    // 1. Find or create a seeded staff user in beforeEach (use the helper).
    const user = await prisma.user.findFirst({ where: { email: { not: undefined } } });
    if (!user) throw new Error('seed a user before running this test');

    await request(app.getHttpServer())
      .post('/auth/request-password-reset')
      .send({ email: user.email })
      .expect(204);

    const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, consumedAt: null } });
    expect(token).toBeTruthy();

    // We can't read the raw token from the DB (only its hash). For E2E, override the SMTP
    // adapter or capture the value via a test hook. Easiest path: expose the raw token via
    // the Logger/event emitter in test mode, or query a test-only `LastResetTokenStore`.
    // Recommendation: in the e2e bootstrap, replace `SendEmailHandler` with a spy that
    // captures `vars.resetUrl` so the spec can extract the token.

    const rawToken = global.__lastResetUrl?.split('token=')[1];
    expect(rawToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'BrandNew123' })
      .expect(204);

    // Re-using the same token must fail
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'BrandNew123' })
      .expect(401);

    // Login with new password works
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'BrandNew123', hCaptchaToken: 'test' })
      .expect(200);
  });

  it('rejects expired token', async () => {
    const user = await prisma.user.findFirst({});
    if (!user) throw new Error('seed required');
    const rawToken = 'b'.repeat(64);
    const { createHash } = await import('crypto');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        tokenSelector: rawToken.slice(0, 8),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'WhatEver8' })
      .expect(401);
  });
});
```

If the test bootstrap doesn't yet expose a `SendEmailHandler` spy, add one alongside this spec — it's a small addition to `apps/backend/test/e2e/helpers/bootstrap.ts` that replaces the provider with a mock writing the last `resetUrl` to `global.__lastResetUrl`.

- [ ] **Step 2: Run E2E**

Run: `cd apps/backend && npm run test:e2e -- user-password-reset`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/e2e/public/user-password-reset.e2e-spec.ts apps/backend/test/e2e/helpers/bootstrap.ts
git commit -m "test(backend): e2e coverage for staff password reset"
```

---

## Phase C — Staff Reset UI (dashboard + admin + employee mobile)

### Task C1: Add API client methods

**Files:**
- Modify: `packages/api-client/src/modules/auth.ts`
- Modify: `packages/api-client/src/index.ts` (only if exports need updating)

- [ ] **Step 1: Locate auth module exports**

Run: `grep -n "export" packages/api-client/src/modules/auth.ts`

- [ ] **Step 2: Add functions**

```typescript
export async function requestStaffPasswordReset(
  client: ApiClient,
  email: string,
): Promise<void> {
  await client.post('/auth/request-password-reset', { email });
}

export async function performStaffPasswordReset(
  client: ApiClient,
  token: string,
  newPassword: string,
): Promise<void> {
  await client.post('/auth/reset-password', { token, newPassword });
}
```

(`ApiClient` and `client.post` shape must match existing module conventions — copy from `client-auth.ts` if signatures differ.)

- [ ] **Step 3: Build the package**

Run: `cd packages/api-client && npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/
git commit -m "feat(api-client): add staff password reset methods"
```

### Task C2: Dashboard forgot-password page

**Files:**
- Create: `apps/dashboard/app/forgot-password/page.tsx`
- Create: `apps/dashboard/components/features/forgot-password-form.tsx`

- [ ] **Step 1: Add i18n keys**

Modify the dashboard auth/login translation bundle (`apps/dashboard/lib/translations/ar.auth.ts` + `en.auth.ts` — match the file that holds `login.title` etc.). Add:

```typescript
// en.auth.ts
forgotPassword: {
  title: 'Forgot Password',
  subtitle: "Enter your email and we'll send a reset link",
  emailLabel: 'Email',
  submit: 'Send Reset Link',
  back: 'Back to Sign In',
  successTitle: 'Check your email',
  successBody: "If an account exists for that email, we've sent a password reset link. The link expires in 30 minutes.",
  linkLabel: 'Forgot password?',
},

// ar.auth.ts
forgotPassword: {
  title: 'نسيت كلمة المرور',
  subtitle: 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين',
  emailLabel: 'البريد الإلكتروني',
  submit: 'إرسال رابط الاستعادة',
  back: 'العودة لتسجيل الدخول',
  successTitle: 'تحقق من بريدك',
  successBody: 'إذا كان هناك حساب بهذا البريد، فقد أرسلنا رابط إعادة تعيين كلمة المرور. ينتهي الرابط خلال 30 دقيقة.',
  linkLabel: 'نسيت كلمة المرور؟',
},
```

- [ ] **Step 2: Create the form component**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { Button, Input, Label, Card } from '@carekit/ui';
import { useTranslations } from 'next-intl';
import { requestStaffPasswordReset } from '@/lib/api/auth';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestStaffPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t('successTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('successBody')}</p>
        <a href="/login" className="text-sm text-primary hover:underline">{t('back')}</a>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '...' : t('submit')}
      </Button>
      <a href="/login" className="block text-center text-sm text-muted-foreground hover:text-primary">{t('back')}</a>
    </form>
  );
}
```

- [ ] **Step 3: Create the page**

```tsx
import { ForgotPasswordForm } from '@/components/features/forgot-password-form';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  // server component variant — use `getTranslations` if next-intl server API needed
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Forgot password</h1>
          <p className="text-sm text-muted-foreground">Enter your email to reset</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
```

(If existing dashboard pages use a different shell — `(public)/forgot-password` or similar — match that convention. Check `apps/dashboard/app/login/page.tsx` for the prevailing pattern before finalizing.)

- [ ] **Step 4: Add API helper**

Create `apps/dashboard/lib/api/auth.ts` (or extend it) with:

```typescript
import { apiClient } from './client';

export async function requestStaffPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/request-password-reset', { email });
}

export async function performStaffPasswordReset(token: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { token, newPassword });
}
```

- [ ] **Step 5: Type-check + commit**

Run: `cd apps/dashboard && npm run typecheck`
Expected: PASS.

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add forgot password page + form"
```

### Task C3: Dashboard reset-password page

**Files:**
- Create: `apps/dashboard/app/reset-password/page.tsx`
- Create: `apps/dashboard/components/features/reset-password-form.tsx`

- [ ] **Step 1: Add i18n keys**

```typescript
// en.auth.ts
resetPassword: {
  title: 'Reset Password',
  subtitle: 'Choose a new password for your account',
  newPasswordLabel: 'New Password',
  confirmLabel: 'Confirm Password',
  submit: 'Reset Password',
  successTitle: 'Password updated',
  successBody: 'You can now sign in with your new password.',
  backToLogin: 'Go to sign in',
  invalidToken: 'This link is invalid or has expired',
  passwordMismatch: 'Passwords do not match',
  weakPassword: 'Password must be at least 8 characters',
},
// ar.auth.ts — translate accordingly
```

- [ ] **Step 2: Form component**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Input, Label, Card } from '@carekit/ui';
import { useTranslations } from 'next-intl';
import { performStaffPasswordReset } from '@/lib/api/auth';

export function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError(t('weakPassword')); return; }
    if (newPassword !== confirm) { setError(t('passwordMismatch')); return; }
    setLoading(true);
    try {
      await performStaffPasswordReset(token, newPassword);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidToken'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <Card className="p-6"><p className="text-sm text-destructive">{t('invalidToken')}</p></Card>;
  }
  if (success) {
    return (
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t('successTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('successBody')}</p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword">{t('newPasswordLabel')}</Label>
        <Input id="newPassword" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">{t('confirmLabel')}</Label>
        <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? '...' : t('submit')}</Button>
    </form>
  );
}
```

- [ ] **Step 3: Page**

```tsx
import { ResetPasswordForm } from '@/components/features/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Reset password</h1>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add link in login form**

In `apps/dashboard/components/features/login-form.tsx`, after the password input block, add:

```tsx
<a href="/forgot-password" className="text-sm text-primary hover:underline ms-auto">
  {t('forgotPassword.linkLabel')}
</a>
```

- [ ] **Step 5: Type-check + commit**

Run: `cd apps/dashboard && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add reset password page + link from login"
```

### Task C4: Admin forgot/reset pages (mirror dashboard)

**Files:**
- Create: `apps/admin/app/forgot-password/page.tsx`
- Create: `apps/admin/app/reset-password/page.tsx`
- Create: `apps/admin/features/auth/forgot-password-form.tsx`
- Create: `apps/admin/features/auth/reset-password-form.tsx`
- Modify: `apps/admin/app/login/page.tsx`

- [ ] **Step 1: Copy + adapt the dashboard implementations**

Replicate Tasks C2 + C3 exactly inside `apps/admin/`. Differences:
- Routes the user back to `/login` (admin login).
- Uses the admin's existing translation file pattern (check `apps/admin/lib/i18n/` or co-located translations).
- Calls the same backend endpoints (`/auth/request-password-reset` + `/auth/reset-password`) — admins are `User` rows with `isSuperAdmin=true`, the same model.

- [ ] **Step 2: Add link in admin login page**

In `apps/admin/app/login/page.tsx`, find the password field and append the forgot-password link below it (same shape as dashboard task C3 step 4).

- [ ] **Step 3: Type-check + commit**

Run: `cd apps/admin && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add apps/admin/
git commit -m "feat(admin): add forgot password + reset password pages"
```

### Task C5: Employee mobile — reuse Phase A screens

**Files:**
- Modify: `apps/mobile/app/(auth)/forgot-password.tsx`
- Modify: `apps/mobile/app/(auth)/reset-password.tsx`
- Modify: `apps/mobile/services/auth.ts`

The Phase A screens cover **client** flow (OTP-based). Employees on mobile use the **staff** flow (token email link). Add a `mode` URL param so the same screen handles both — but on mobile, there's no email-link landing inside the app. The pragmatic approach:

- [ ] **Step 1: For employees, only the "request" half lives in-app**

In `apps/mobile/app/(auth)/forgot-password.tsx`, accept a `mode` route param (`'client' | 'staff'`, default `'client'`). When `mode === 'staff'`, call `requestStaffPasswordReset` instead of `requestPasswordResetOtp`, then route to a confirmation screen instead of the OTP step.

- [ ] **Step 2: Add staff helper**

Append to `apps/mobile/services/auth.ts`:

```typescript
export async function requestStaffPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}
```

- [ ] **Step 3: Add a confirmation screen**

Create `apps/mobile/app/(auth)/forgot-password-sent.tsx` — a simple Glass card showing "Check your email" with a "Back to login" button.

- [ ] **Step 4: Wire the toggle from login**

The mobile employee login flow is shared with client login (`apps/mobile/app/(auth)/login.tsx`). The login UI doesn't know whether the user is staff or client until backend responds. Since both reset endpoints are no-op on unknown emails (enumeration safe), the simplest UX is: a single "Forgot password?" link that calls **both** `requestStaffPasswordReset` and `requestPasswordResetOtp` when submitted, then routes to a generic "check your email or SMS" screen. Implement that fan-out inside the `forgot-password.tsx` submit handler:

```typescript
const onSubmit = useCallback(async () => {
  // ...validation...
  setLoading(true);
  try {
    await Promise.allSettled([
      requestPasswordResetOtp(email),
      requestStaffPasswordReset(email),
    ]);
    router.push({ pathname: '/(auth)/forgot-password-sent', params: { email } });
  } finally { setLoading(false); }
}, [email, router]);
```

The OTP path still routes to `reset-password.tsx` only when the user opens an email/SMS containing the OTP — the in-app screen no longer auto-routes to the OTP step. Update Phase A's `forgot-password.tsx` to send the user to `forgot-password-sent.tsx` and keep `reset-password.tsx` reachable via deep link or manual entry.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev:backend && npm run dev:mobile`. Test as both client and staff (use seeded users for each). Confirm:
- Client receives OTP, can complete reset on `reset-password.tsx`.
- Staff receives email link → opens it on desktop dashboard → completes reset there.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): unify forgot-password flow for client + staff"
```

### Task C6: Run full test gauntlet

**Files:** none (verification)

- [ ] **Step 1: Backend unit + e2e**

Run: `cd apps/backend && npm run test && npm run test:e2e`
Expected: PASS.

- [ ] **Step 2: Dashboard, admin, mobile**

Run in parallel terminals:
```bash
cd apps/dashboard && npm run typecheck && npm run lint && npm run test
cd apps/admin && npm run typecheck && npm run lint && npm run test
cd apps/mobile && npm run test
```
Expected: PASS everywhere.

- [ ] **Step 3: Full root build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit any tweaks**

```bash
git add -A
git commit -m "chore: green test suite for password reset feature"
```

### Task C7: Manual QA + Kiwi sync

**Files:**
- Create: `docs/superpowers/qa/password-reset-report-2026-04-26.md`
- Create: `data/kiwi/password-reset-2026-04-26.json`

- [ ] **Step 1: QA matrix**

Walk every surface (mobile client OTP, mobile staff link, dashboard staff, admin super-admin) end to end. Capture screenshots. Note any RTL or AR/EN parity issues.

- [ ] **Step 2: Write report at `docs/superpowers/qa/password-reset-report-2026-04-26.md`**

Use the structure from `docs/superpowers/qa/` siblings: feature, environment, cases, results, screenshots, defects.

- [ ] **Step 3: Author Kiwi plan JSON at `data/kiwi/password-reset-2026-04-26.json`**

Shape:
```json
{
  "domain": "Identity",
  "version": "main",
  "build": "manual-qa-2026-04-26",
  "planName": "Password Reset — All Systems",
  "planSummary": "Forgot/reset across mobile (client OTP + staff link), dashboard, admin",
  "runSummary": "Manual QA on 2026-04-26",
  "cases": [
    { "summary": "Mobile client — OTP reset happy path", "text": "...", "result": "PASSED" },
    { "summary": "Dashboard staff — email link reset happy path", "text": "...", "result": "PASSED" },
    { "summary": "Admin super-admin — email link reset happy path", "text": "...", "result": "PASSED" },
    { "summary": "Reset token reuse rejected (401)", "text": "...", "result": "PASSED" },
    { "summary": "Expired reset token rejected (401)", "text": "...", "result": "PASSED" },
    { "summary": "Unknown email returns 204 (enumeration safe)", "text": "...", "result": "PASSED" },
    { "summary": "Successful reset revokes existing refresh tokens", "text": "...", "result": "PASSED" }
  ]
}
```

- [ ] **Step 4: Sync to Kiwi**

Run: `npm run kiwi:sync-manual data/kiwi/password-reset-2026-04-26.json`
Expected: success, plan + run URLs printed.

- [ ] **Step 5: Final commit**

```bash
git add docs/superpowers/qa/password-reset-report-2026-04-26.md data/kiwi/password-reset-2026-04-26.json
git commit -m "docs(qa): manual QA report for password reset across all systems"
```

---

## Self-Review

**1. Spec coverage:** Every original gap from the audit has a task — mobile client UI (A1–A6), staff backend (B1–B8), staff UI on dashboard (C2–C3), admin (C4), and employee mobile (C5).

**2. No placeholders:** Every step has the real code or the exact command. The only "match existing convention" hint is in C2 step 3 (page shell), which is a deliberate adaptation point — verified by reading the existing `login/page.tsx` first.

**3. Type/symbol consistency:**
- `requestPasswordResetOtp`, `verifyPasswordResetOtp`, `resetClientPassword` — used consistently in Phase A.
- `requestStaffPasswordReset`, `performStaffPasswordReset` — used in Phase B (controller) + Phase C (clients).
- `RequestPasswordResetHandler`, `PerformPasswordResetHandler` — used identically in module + controller wire-up.
- `PasswordResetToken` (model), `tokenSelector`, `tokenHash`, `consumedAt`, `expiresAt` — used identically across schema, handlers, and tests.
- Email template slug `user_password_reset` — used in seed + handler.

**4. Risk callouts:**
- `prisma.passwordResetToken.findFirst` in B6: Prisma Proxy auto-scopes by `organizationId`, but `PasswordResetToken` is **not** an org-scoped model (User isn't either). When wiring this in module/controller, ensure `PasswordResetToken` is **excluded from** `SCOPED_MODELS` in `prisma.service.ts`. The plan does not currently call this out explicitly — add a sub-step to B1 if implementation discovers the proxy interferes.
- E2E in B8 needs the test bootstrap to expose a `SendEmailHandler` spy. If not present, expanding `bootstrap.ts` is in scope.
