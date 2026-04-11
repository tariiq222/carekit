import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Stethoscope, Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { EmployeeCard } from '@/components/features/EmployeeCard';
import { SpecialtyCard } from '@/components/features/SpecialtyCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { useAppSelector } from '@/hooks/use-redux';
import { EmailVerificationBanner } from '@/components/ui/EmailVerificationBanner';
import { specialtiesService } from '@/services/specialties';
import { employeesService } from '@/services/employees';
import { bookingsService } from '@/services/bookings';
import type { Specialty, Employee, Booking } from '@/types/models';

export default function ClientHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();
  const user = useAppSelector((s) => s.auth.user);

  const [refreshing, setRefreshing] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [featured, setFeatured] = useState<Employee[]>([]);
  const [upcoming, setUpcoming] = useState<Booking | null>(null);

  const loadData = useCallback(async () => {
    const [specRes, featRes, upRes] = await Promise.allSettled([
      specialtiesService.getAll(),
      employeesService.getFeatured(),
      bookingsService.getUpcoming(),
    ]);
    if (specRes.status === 'fulfilled' && specRes.value.data)
      setSpecialties(specRes.value.data as Specialty[]);
    if (featRes.status === 'fulfilled' && featRes.value.data)
      setFeatured(featRes.value.data as Employee[]);
    if (upRes.status === 'fulfilled' && upRes.value.data) {
      const list = upRes.value.data as Booking[];
      setUpcoming(list[0] ?? null);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const greeting = user?.firstName
    ? `${t('home.greeting')}، ${user.firstName}`
    : t('home.greeting');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={['#0037B0', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.brandRow}>
                <Stethoscope size={20} strokeWidth={1.5} color="#FFF" />
                <ThemedText variant="subheading" color="#FFF">
                  {t('common.appName')}
                </ThemedText>
              </View>
              <ThemedText variant="heading" color="#FFF">
                {greeting}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.push('/(client)/(tabs)/notifications')}
              style={styles.bellBtn}
            >
              <Bell size={22} strokeWidth={1.5} color="#FFF" />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Email Verification Banner */}
          <EmailVerificationBanner />

          {/* Upcoming Appointment */}
          {upcoming ? (
            <View style={styles.section}>
              <ThemedText variant="subheading">{t('home.upcomingAppointment')}</ThemedText>
              <ThemedCard onPress={() => {}}>
                <View style={styles.upRow}>
                  <Avatar
                    size={44}
                    name={`${upcoming.employee.user.firstName} ${upcoming.employee.user.lastName}`}
                    imageUrl={upcoming.employee.user.avatarUrl}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="subheading" numberOfLines={1}>
                      {upcoming.employee.user.firstName} {upcoming.employee.user.lastName}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {new Date(upcoming.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })} • {upcoming.startTime}
                    </ThemedText>
                  </View>
                  <StatusPill status={upcoming.status} label={t('appointments.confirmed')} />
                </View>
              </ThemedCard>
            </View>
          ) : (
            <ThemedCard style={{ alignItems: 'center', gap: 12, padding: 24 }}>
              <ThemedText variant="body" color={theme.colors.textSecondary} align="center">
                {t('home.noUpcoming')}
              </ThemedText>
              <ThemedButton onPress={() => {}} variant="primary" size="sm">
                {t('home.bookNow')}
              </ThemedButton>
            </ThemedCard>
          )}

          {/* Specialties Carousel */}
          <View style={styles.section}>
            <SectionHeader title={t('home.specialties')} action={t('common.viewAll')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {specialties.slice(0, 8).map((spec, i) => (
                <SpecialtyCard key={spec.id} specialty={spec} index={i} onPress={() => {}} />
              ))}
            </ScrollView>
          </View>

          {/* Featured Employees */}
          <View style={styles.section}>
            <SectionHeader title={t('home.featured')} action={t('common.viewAll')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {featured.map((p) => (
                <EmployeeCard
                  key={p.id}
                  employee={p}
                  compact
                  onPress={(id) => router.push(`/(client)/employee/${id}`)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Promo Banner */}
          <LinearGradient
            colors={['#0037B0', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promo}
          >
            <ThemedText variant="subheading" color="#FFF" style={{ flex: 1 }}>
              {t('home.bookAppointment')}
            </ThemedText>
            <ThemedButton onPress={() => {}} variant="secondary" size="sm">
              {t('home.bookNow')}
            </ThemedButton>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action: string }) {
  return (
    <View style={styles.sectionHead}>
      <ThemedText variant="subheading">{title}</ThemedText>
      <Pressable>
        <ThemedText variant="bodySm" color="#1D4ED8" style={{ fontWeight: '600' }}>
          {action}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promo: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center' },
});
