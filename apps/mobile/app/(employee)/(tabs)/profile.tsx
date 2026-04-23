import { useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  ImageBackground,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  User,
  Star,
  Globe,
  Bell,
  Info,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_SOFT } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';
import { SectionHeader } from '@/components/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
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
  const dir = useDir();
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const fg = danger ? '#B42318' : C.deepTeal;
  const subtle = danger ? '#B42318' : C.subtle;
  return (
    <Glass
      variant="regular"
      radius={RADII.card}
      interactive
      onPress={onPress}
      style={[styles.menuItem, { flexDirection: dir.row }, SHADOW_SOFT]}
    >
      <View style={[styles.menuLeft, { flexDirection: dir.row }]}>
        <View style={[styles.menuIcon, { backgroundColor: danger ? 'rgba(180,35,24,0.12)' : C.tealTint }]}>
          <Icon size={18} strokeWidth={1.6} color={fg} />
        </View>
        <Text
          style={[
            styles.menuLabel,
            { color: fg, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={[styles.menuRight, { flexDirection: dir.row }]}>
        {!!value && <Text style={[styles.menuValue, { color: subtle }]}>{value}</Text>}
        {!danger && <Chevron size={16} strokeWidth={1.8} color={C.subtle} />}
      </View>
    </Glass>
  );
}

export default function EmployeeProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();
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
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 120,
          paddingHorizontal: 18,
        }}
      >
        <SectionHeader title={t('employee.profile')} size="screen" style={styles.title} />

        <Glass
          variant="strong"
          radius={RADII.card}
          style={[styles.profileCard, { flexDirection: dir.row }, SHADOW]}
        >
          <Avatar size={64} name={fullName} imageUrl={user?.avatarUrl} />
          <View style={{ flex: 1, gap: 4, alignItems: dir.alignStart }}>
            <Text
              style={[
                styles.profileName,
                { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
              ]}
            >
              {fullName}
            </Text>
            <Text
              style={[
                styles.profileEmail,
                { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
              ]}
            >
              {user?.email}
            </Text>
            <View style={[styles.ratingRow, { flexDirection: dir.row }]}>
              <Star size={14} fill={C.goldText} color={C.goldText} strokeWidth={0} />
              <Text style={styles.ratingValue}>4.8</Text>
              <Text style={styles.ratingCount}>(120 {t('home.rating')})</Text>
            </View>
          </View>
        </Glass>

        <View style={styles.menuGroup}>
          <MenuItem icon={User} label={t('profile.personalInfo')} onPress={() => {}} />
          <MenuItem icon={Star} label={t('doctor.ratingsReviews')} onPress={() => {}} />
          <MenuItem
            icon={Globe}
            label={t('profile.language')}
            value={t('profile.arabic')}
            onPress={() => {}}
          />
          <MenuItem icon={Bell} label={t('profile.notifications')} onPress={() => {}} />
        </View>

        <View style={styles.menuGroup}>
          <MenuItem icon={Info} label={t('profile.about')} onPress={() => {}} />
          <MenuItem icon={Shield} label={t('profile.privacy')} onPress={() => {}} />
        </View>

        <View style={styles.menuGroup}>
          <MenuItem icon={LogOut} label={t('auth.logout')} danger onPress={handleLogout} />
        </View>

        <Text
          style={[styles.versionText, { textAlign: 'center', writingDirection: dir.writingDirection }]}
        >
          {t('doctor.appVersion')} 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { marginBottom: 18 },
  profileCard: {
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 22,
  },
  profileName: { fontSize: 18, fontWeight: '800', color: C.deepTeal },
  profileEmail: { fontSize: 13, color: C.subtle },
  ratingRow: { alignItems: 'center', gap: 4, marginTop: 2 },
  ratingValue: { fontSize: 13, fontWeight: '700', color: C.deepTeal },
  ratingCount: { fontSize: 11, color: C.subtle },
  menuGroup: { gap: 10, marginBottom: 20 },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 14,
  },
  menuLeft: { alignItems: 'center', gap: 12, flex: 1 },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  menuRight: { alignItems: 'center', gap: 6 },
  menuValue: { fontSize: 13 },
  versionText: { fontSize: 11, color: C.subtle, marginTop: 8 },
});
