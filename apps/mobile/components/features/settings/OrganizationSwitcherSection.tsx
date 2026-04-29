import { useCallback } from 'react';
import { View, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Building2, Check } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { useAppSelector } from '@/hooks/use-redux';
import { useMemberships, useSwitchOrganization } from '@/hooks/queries/useMemberships';
import { applyTenantSwitch } from '@/services/tenant-switch';
import type { MembershipSummary } from '@/services/memberships';
// (tenant-locked builds: no `EXPO_PUBLIC_TENANT_LOCKED` flag exists today;
// the `<= 1 memberships` guard below is sufficient — see fix-round-2 spec.)

function pickOrgName(org: MembershipSummary['organization']): string {
  return org.nameAr || org.nameEn || org.slug;
}

function roleLabel(role: string, t: (k: string, opts?: { defaultValue: string }) => string): string {
  const upper = role.toUpperCase();
  // Falls back to the raw role string when no translation key is registered.
  return t(`settings.tenant.role.${upper}`, { defaultValue: role });
}

export function OrganizationSwitcherSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const activeOrgId = useAppSelector((s) => s.auth.organizationId);

  const { data: memberships, isLoading } = useMemberships();
  const switchMutation = useSwitchOrganization();

  const onSelect = useCallback(
    (m: MembershipSummary) => {
      if (m.organizationId === activeOrgId) return;
      const orgName = pickOrgName(m.organization);
      Alert.alert(
        t('settings.tenant.confirmTitle'),
        t('settings.tenant.confirmBody', { org: orgName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            onPress: () => {
              switchMutation.mutate(m.organizationId, {
                onSuccess: async (tokens) => {
                  await applyTenantSwitch(m.organizationId, tokens);
                  Alert.alert(t('settings.tenant.switchSuccess'), '');
                  // Route through root `/` — `app/index.tsx` rehydrates the
                  // auth profile (`/auth/me`) for the NEW tenant and then
                  // redirects to the right surface based on the fresh role.
                  // This avoids any pre-switch role staleness.
                  router.replace('/');
                },
                onError: (err: Error) => {
                  Alert.alert(t('settings.tenant.switchError'), err.message);
                },
              });
            },
          },
        ],
      );
    },
    [activeOrgId, router, switchMutation, t],
  );

  if (isLoading) {
    return (
      <ThemedCard padding={20} style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}14` }]}>
            <Building2 size={20} strokeWidth={1.5} color={theme.colors.primary} />
          </View>
          <ThemedText variant="subheading">{t('settings.tenant.title')}</ThemedText>
        </View>
        <ActivityIndicator color={theme.colors.primary} />
      </ThemedCard>
    );
  }

  if (!memberships || memberships.length <= 1) return null;

  return (
    <ThemedCard padding={20} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}14` }]}>
          <Building2 size={20} strokeWidth={1.5} color={theme.colors.primary} />
        </View>
        <ThemedText variant="subheading">{t('settings.tenant.title')}</ThemedText>
      </View>

      {memberships.map((m) => {
        const isCurrent = m.organizationId === activeOrgId;
        const switching = switchMutation.isPending && switchMutation.variables === m.organizationId;
        return (
          <Pressable
            key={m.id}
            disabled={isCurrent || switchMutation.isPending}
            onPress={() => onSelect(m)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: isCurrent ? `${theme.colors.primary}0D` : 'transparent', opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.rowMain}>
              <ThemedText variant="body">{pickOrgName(m.organization)}</ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {roleLabel(m.role, t)}
              </ThemedText>
            </View>
            {switching ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : isCurrent ? (
              <View style={[styles.badge, { backgroundColor: `${theme.colors.success}1A`, borderColor: `${theme.colors.success}4D` }]}>
                <Check size={12} strokeWidth={2} color={theme.colors.success} />
                <ThemedText variant="caption" color={theme.colors.success}>
                  {t('settings.tenant.current')}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  rowMain: { flex: 1, gap: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
