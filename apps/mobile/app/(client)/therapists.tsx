import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useTherapists } from '@/hooks/queries';

const GRADIENTS: Array<readonly [string, string]> = [
  ['#f7cbb7', '#e88f6c'],
  ['#bed7f0', '#7fa8d9'],
  ['#e8c4dd', '#c47db0'],
  ['#c4e8d7', '#7ac4a0'],
  ['#ffd5a8', '#e09b5a'],
];

function gradientFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % GRADIENTS.length;
  return GRADIENTS[h];
}

const CHIPS = [
  { key: 'available', ar: 'متاح الآن', en: 'Available' },
  { key: 'women', ar: 'النساء', en: 'Women' },
  { key: 'remote', ar: 'عن بُعد', en: 'Remote' },
  { key: 'under300', ar: '< ٣٠٠ ر.س', en: '< 300 SAR' },
];

export default function TherapistsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const [activeChip, setActiveChip] = useState('available');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useTherapists();
  const list = useMemo(() => data ?? [], [data]);
  const loading = isLoading;

  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (e) =>
        e.nameAr?.toLowerCase().includes(q) ||
        e.nameEn?.toLowerCase().includes(q) ||
        e.specialty?.toLowerCase().includes(q) ||
        e.specialtyAr?.toLowerCase().includes(q),
    );
  }, [list, query]);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'اختاري معالجاً' : 'Choose a therapist'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL
              ? `${list.length} معالج متاحين الآن`
              : `${list.length} therapists available`}
          </Text>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.searchCard}>
            <View style={[styles.searchRow, { flexDirection: dir.row }]}>
              <Search size={17} color={sawaaColors.ink[500]} strokeWidth={1.75} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={dir.isRTL ? 'اكتبي اسم المعالج أو التخصص' : 'Search by name or specialty'}
                placeholderTextColor={sawaaColors.ink[400]}
                style={[
                  styles.searchInput,
                  { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection, color: sawaaColors.ink[900] },
                ]}
              />
            </View>
          </Glass>
        </Animated.View>

        {/* Chips */}
        <Animated.View entering={FadeInDown.delay(220).duration(600).easing(Easing.out(Easing.cubic))}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chipsRow, { flexDirection: dir.row }]}
          >
            {CHIPS.map((c) => {
              const isActive = c.key === activeChip;
              return (
                <Pressable key={c.key} onPress={() => setActiveChip(c.key)}>
                  <Glass
                    variant={isActive ? 'strong' : 'regular'}
                    radius={14}
                    style={[
                      styles.chip,
                      isActive && { backgroundColor: sawaaColors.teal[700] },
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      { fontFamily: f600, color: isActive ? '#fff' : sawaaColors.ink[700] },
                    ]}>
                      {dir.isRTL ? c.ar : c.en}
                    </Text>
                  </Glass>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {loading ? (
          <Text style={[styles.subtitle, { fontFamily: f400, paddingHorizontal: 4 }]}>
            {dir.isRTL ? 'جاري التحميل…' : 'Loading…'}
          </Text>
        ) : filtered.length === 0 ? (
          <Text style={[styles.subtitle, { fontFamily: f400, paddingHorizontal: 4 }]}>
            {dir.isRTL ? 'لا يوجد معالجون بعد' : 'No therapists yet'}
          </Text>
        ) : (
          filtered.map((t, i) => {
            const name = (dir.isRTL ? t.nameAr : t.nameEn) ?? t.nameEn ?? t.nameAr ?? '—';
            const spec = (dir.isRTL ? t.specialtyAr : t.specialty) ?? t.specialty ?? t.specialtyAr ?? '';
            const gradient = gradientFor(t.id);
            const initial = name.charAt(0);
            const navKey = t.slug ?? t.id;
            return (
              <Animated.View
                key={t.id}
                entering={FadeInDown.delay(280 + i * 80).duration(700).easing(Easing.out(Easing.cubic))}
              >
                <Glass variant="strong" radius={sawaaRadius.xl} style={styles.therapistCard}>
                  <Pressable
                    onPress={() => router.push(`/(client)/employee/${navKey}`)}
                    style={[styles.therapistRow, { flexDirection: dir.row }]}
                  >
                    <LinearGradient
                      colors={gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.avatar}
                    >
                      <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
                    </LinearGradient>
                    <View style={styles.therapistBody}>
                      <View style={[styles.therapistTop, { flexDirection: dir.row }]}>
                        <Text style={[styles.therapistName, { fontFamily: f700, textAlign: dir.textAlign, flex: 1 }]}>
                          {name}
                        </Text>
                      </View>
                      <Text style={[styles.therapistSpec, { fontFamily: f400, textAlign: dir.textAlign }]}>
                        {spec}
                      </Text>
                      {t.title ? (
                        <View style={[styles.therapistMeta, { flexDirection: dir.row }]}>
                          <Star size={11} color={sawaaColors.accent.amber} strokeWidth={2} fill={sawaaColors.accent.amber} />
                          <Text style={[styles.therapistExp, { fontFamily: f500 }]}>
                            {t.title}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </Glass>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 22, color: sawaaColors.ink[900], paddingHorizontal: 4 },
  subtitle: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 2, paddingHorizontal: 4 },
  searchCard: { padding: 0 },
  searchRow: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 13, height: 22 },
  chipsRow: { gap: 6, paddingHorizontal: 2, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 11.5 },
  therapistCard: { padding: 0, overflow: 'hidden' },
  therapistRow: { alignItems: 'stretch' },
  avatar: {
    width: 84, alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 8, position: 'relative',
  },
  avatarText: { fontSize: 36, color: 'rgba(255,255,255,0.95)' },
  onlineDot: {
    position: 'absolute', top: 8, right: 8,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#4bd67a', borderWidth: 1.5, borderColor: '#fff',
  },
  therapistBody: { flex: 1, padding: 12 },
  therapistTop: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  therapistName: { fontSize: 14, color: sawaaColors.ink[900] },
  priceChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(20,168,154,0.14)',
  },
  priceText: { fontSize: 10.5, color: sawaaColors.teal[700] },
  therapistSpec: { fontSize: 11.5, color: sawaaColors.ink[500], marginTop: 3 },
  therapistMeta: { alignItems: 'center', gap: 6, marginTop: 8 },
  therapistRating: { fontSize: 11, color: sawaaColors.ink[900] },
  dot: { fontSize: 11, color: sawaaColors.ink[400] },
  therapistExp: { fontSize: 11, color: sawaaColors.ink[500] },
  availableChip: {
    marginLeft: 'auto',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(75,214,122,0.18)',
  },
  availableText: { fontSize: 10, color: '#1f8f3e' },
});
