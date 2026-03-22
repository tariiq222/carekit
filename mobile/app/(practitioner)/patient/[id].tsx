import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Phone,
  Mail,
  Star,
  Calendar,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/theme/useTheme';

interface Visit {
  id: string;
  date: string;
  service: string;
  status: string;
  rating?: number;
}

export default function DoctorPatientRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  // Placeholder data — will come from API
  const patient = {
    firstName: 'أحمد',
    lastName: 'الشمري',
    phone: '+966500000000',
    email: 'ahmed@email.com',
    avatarUrl: null,
  };
  const visits: Visit[] = [];

  const fullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        <ThemedText variant="heading" style={styles.title}>
          {t('doctor.patientRecord')}
        </ThemedText>

        {/* Patient Header */}
        <ThemedCard style={styles.profileCard}>
          <Avatar size={56} name={fullName} imageUrl={patient.avatarUrl} />
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText variant="heading">{fullName}</ThemedText>
            <Pressable
              onPress={() => Linking.openURL(`tel:${patient.phone}`)}
              style={styles.contactRow}
            >
              <Phone size={14} strokeWidth={1.5} color="#1D4ED8" />
              <ThemedText variant="bodySm" color="#1D4ED8">{patient.phone}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(`mailto:${patient.email}`)}
              style={styles.contactRow}
            >
              <Mail size={14} strokeWidth={1.5} color="#1D4ED8" />
              <ThemedText variant="bodySm" color="#1D4ED8">{patient.email}</ThemedText>
            </Pressable>
          </View>
        </ThemedCard>

        {/* Visit History */}
        <ThemedText variant="subheading" style={styles.sectionTitle}>
          {t('doctor.visitHistory')}
        </ThemedText>

        {visits.length === 0 ? (
          <View style={styles.empty}>
            <Calendar size={40} strokeWidth={1} color={theme.colors.textMuted} />
            <ThemedText variant="bodySm" color={theme.colors.textMuted} align="center">
              {t('common.noResults')}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.visitList}>
            {visits.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/(practitioner)/appointment/${v.id}`)}
              >
                <ThemedCard style={styles.visitCard}>
                  <View style={styles.visitRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="body" style={{ fontWeight: '500' }}>
                        {v.service}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {new Date(v.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                      </ThemedText>
                    </View>
                    {v.rating && (
                      <View style={styles.ratingBadge}>
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        <ThemedText variant="caption" style={{ fontWeight: '600' }}>
                          {v.rating}
                        </ThemedText>
                      </View>
                    )}
                    <StatusPill status={v.status} label={v.status} />
                  </View>
                </ThemedCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { marginBottom: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, marginBottom: 24 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { marginBottom: 12 },
  visitList: { gap: 8 },
  visitCard: { padding: 14 },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 40 },
});
