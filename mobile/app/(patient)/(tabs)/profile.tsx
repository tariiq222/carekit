import { useCallback } from 'react';
import { View, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  User,
  CreditCard,
  Bell,
  Globe,
  Info,
  HelpCircle,
  Shield,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { logout } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}

function MenuItem({ icon: Icon, label, value, danger, onPress }: MenuItemProps) {
  const { theme, isRTL } = useTheme();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: theme.colors.white, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.menuLeft}>
        <Icon
          size={20}
          strokeWidth={1.5}
          color={danger ? theme.colors.error : theme.colors.textSecondary}
        />
        <ThemedText
          variant="body"
          color={danger ? theme.colors.error : theme.colors.textPrimary}
        >
          {label}
        </ThemedText>
      </View>
      <View style={styles.menuRight}>
        {value && (
          <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
            {value}
          </ThemedText>
        )}
        {!danger && (
          <Chevron size={16} strokeWidth={1.5} color={theme.colors.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

export default function PatientProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const user = useAppSelector((s) => s.auth.user);

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  const handleLogout = useCallback(() => {
    Alert.alert(t('auth.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await authService.logout();
          dispatch(logout());
          router.replace('/(auth)/login');
        },
      },
    ]);
  }, [dispatch, router, t]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <ThemedText variant="displaySm" style={styles.title}>
          {t('profile.title')}
        </ThemedText>

        {/* Profile Header */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.white }]}>
          <Avatar size={64} name={fullName} imageUrl={user?.avatarUrl} />
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="heading">{fullName}</ThemedText>
            <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
              {user?.email}
            </ThemedText>
          </View>
        </View>

        {/* Menu Groups */}
        <View style={styles.menuGroup}>
          <MenuItem
            icon={User}
            label={t('profile.personalInfo')}
            onPress={() => {}}
          />
          <MenuItem
            icon={CreditCard}
            label={t('profile.payments')}
            onPress={() => {}}
          />
          <MenuItem
            icon={Bell}
            label={t('profile.notifications')}
            onPress={() => {}}
          />
          <MenuItem
            icon={Globe}
            label={t('profile.language')}
            value={t('profile.arabic')}
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuGroup}>
          <MenuItem
            icon={Info}
            label={t('profile.about')}
            onPress={() => {}}
          />
          <MenuItem
            icon={HelpCircle}
            label={t('profile.faq')}
            onPress={() => {}}
          />
          <MenuItem
            icon={Shield}
            label={t('profile.privacy')}
            onPress={() => {}}
          />
          <MenuItem
            icon={FileText}
            label={t('profile.terms')}
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuGroup}>
          <MenuItem
            icon={LogOut}
            label={t('auth.logout')}
            danger
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  menuGroup: { gap: 8, marginBottom: 20 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
