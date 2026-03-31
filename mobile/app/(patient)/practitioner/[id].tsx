import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Star,
  Building2,
  Phone,
  Video,
  Clock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/theme/useTheme';
import { practitionersService } from '@/services/practitioners';
import type { Practitioner, Rating } from '@/types/models';

export default function PractitionerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, rRes] = await Promise.allSettled([
          practitionersService.getById(id ?? ''),
          practitionersService.getRatings(id ?? '', 1, 3),
        ]);
        if (pRes.status === 'fulfilled' && pRes.value.data)
          setPractitioner(pRes.value.data);
        if (rRes.status === 'fulfilled' && rRes.value.data)
          setRatings(rRes.value.data.items);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (!practitioner) return null;

  const name = `${practitioner.user.firstName} ${practitioner.user.lastName}`;
  const specialtyName = isRTL
    ? practitioner.specialty?.nameAr
    : practitioner.specialty?.nameEn;

  const prices = [
    { icon: Building2, label: t('home.clinicVisit'), price: practitioner.clinicPrice, color: '#1D4ED8' },
    { icon: Phone, label: t('home.phoneConsult'), price: practitioner.phonePrice, color: '#059669' },
    { icon: Video, label: t('home.videoConsult'), price: practitioner.videoPrice, color: '#7C3AED' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={styles.backBtn}
        >
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        {/* Header */}
        <View style={styles.profileHeader}>
          <Avatar size={80} name={name} imageUrl={practitioner.user.avatarUrl} />
          <ThemedText variant="heading" align="center">{name}</ThemedText>
          <ThemedText variant="bodySm" color={theme.colors.textSecondary} align="center">
            {specialtyName}
          </ThemedText>
          <View style={styles.ratingRow}>
            <Star size={16} fill="#F59E0B" color="#F59E0B" />
            <ThemedText variant="body" style={{ fontWeight: '600' }}>
              {practitioner.averageRating}
            </ThemedText>
            <ThemedText variant="bodySm" color={theme.colors.textMuted}>
              ({practitioner.totalRatings} {t('home.rating')})
            </ThemedText>
          </View>
          <StatusPill
            status={practitioner.isAvailableToday ? 'available' : 'pending'}
            label={practitioner.isAvailableToday ? t('home.availableToday') : t('home.nextAvailable')}
          />
        </View>

        {/* About */}
        {practitioner.bio && (
          <View style={styles.section}>
            <ThemedText variant="subheading">{t('practitioner.about')}</ThemedText>
            <ThemedText variant="body" color={theme.colors.textSecondary}>
              {isRTL ? (practitioner.bioAr ?? practitioner.bio) : practitioner.bio}
            </ThemedText>
          </View>
        )}

        {/* Prices */}
        <View style={styles.section}>
          <ThemedText variant="subheading">{t('practitioner.prices')}</ThemedText>
          <View style={styles.pricesGrid}>
            {prices.map((p) => (
              <ThemedCard key={p.label} style={styles.priceCard}>
                <View style={[styles.priceIcon, { backgroundColor: `${p.color}14` }]}>
                  <p.icon size={18} strokeWidth={1.5} color={p.color} />
                </View>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {p.label}
                </ThemedText>
                <ThemedText variant="subheading" color="#1D4ED8">
                  {p.price} {t('home.sar')}
                </ThemedText>
              </ThemedCard>
            ))}
          </View>
        </View>

        {/* Reviews */}
        {ratings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText variant="subheading">{t('practitioner.reviews')}</ThemedText>
              <Pressable>
                <ThemedText variant="bodySm" color="#1D4ED8" style={{ fontWeight: '600' }}>
                  {t('practitioner.allReviews')}
                </ThemedText>
              </Pressable>
            </View>
            {ratings.map((r) => (
              <ThemedCard key={r.id} style={{ gap: 8 }}>
                <View style={styles.reviewHeader}>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14} fill={s <= r.stars ? '#F59E0B' : 'none'} color={s <= r.stars ? '#F59E0B' : '#E6E8EA'} />
                    ))}
                  </View>
                  <ThemedText variant="caption" color={theme.colors.textMuted}>
                    {new Date(r.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                  </ThemedText>
                </View>
                {r.comment && (
                  <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
                    {r.comment}
                  </ThemedText>
                )}
              </ThemedCard>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface }]}>
        <ThemedButton
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/(patient)/booking/[serviceId]',
              params: { serviceId: 'select', practitionerId: practitioner.id },
            });
          }}
          variant="primary"
          size="lg"
          full
        >
          {t('practitioner.bookWith')} {practitioner.user.firstName}
        </ThemedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  profileHeader: { alignItems: 'center', gap: 8, marginBottom: 28 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  section: { gap: 12, marginBottom: 24 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pricesGrid: { flexDirection: 'row', gap: 10 },
  priceCard: { flex: 1, alignItems: 'center', gap: 6, padding: 14 },
  priceIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stars: { flexDirection: 'row', gap: 2 },
  ctaBar: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 0 },
});
