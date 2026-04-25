import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, ChevronLeft, ChevronRight, Heart, Star } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

const SPECIALTIES = [
  { ar: 'القلق', en: 'Anxiety', color: sawaaColors.teal[600] },
  { ar: 'الاكتئاب', en: 'Depression', color: sawaaColors.accent.violet },
  { ar: 'العلاقات', en: 'Relationships', color: sawaaColors.accent.rose },
  { ar: 'الصدمات', en: 'Trauma', color: sawaaColors.accent.amber },
  { ar: 'اضطرابات النوم', en: 'Sleep', color: sawaaColors.accent.sky },
];

export default function ClinicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  const stats = [
    { nAr: '١٢', nEn: '12', ar: 'معالج', en: 'Therapists' },
    { nAr: '٦', nEn: '6', ar: 'تخصصات', en: 'Specialties' },
    { nAr: '٢٤/٧', nEn: '24/7', ar: 'دعم', en: 'Support' },
  ];

  return (
    <AquaBackground>
      {/* Hero region */}
      <LinearGradient
        colors={['#9ad6cd', '#5fbcae', '#2b8f82']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <Building2 size={200} color="rgba(255,255,255,0.28)" strokeWidth={1} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button over hero */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        {/* Spacer so content starts below the hero */}
        <View style={{ height: 200 }} />

        {/* Info card floating over hero */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.infoCard}>
            <View style={[styles.infoTop, { flexDirection: dir.row }]}>
              <View style={styles.infoName}>
                <Text style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? 'عيادة النفسية' : 'Wellness Clinic'}
                </Text>
                <Text style={[styles.clinicMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? 'الرياض · حي العليا · ٢.٤ كم' : 'Riyadh · Al-Olaya · 2.4 km'}
                </Text>
              </View>
              <Glass variant="regular" radius={14} style={styles.ratingChip}>
                <View style={[styles.ratingRow, { flexDirection: dir.row }]}>
                  <Star size={12} color={sawaaColors.accent.amber} strokeWidth={2} fill={sawaaColors.accent.amber} />
                  <Text style={[styles.ratingText, { fontFamily: f700 }]}>4.7</Text>
                  <Text style={[styles.ratingCount, { fontFamily: f400 }]}>
                    {dir.isRTL ? '(٢٨٤)' : '(284)'}
                  </Text>
                </View>
              </Glass>
            </View>

            <View style={[styles.statsRow, { flexDirection: dir.row }]}>
              {stats.map((s, i) => (
                <View key={i} style={styles.statBox}>
                  <Text style={[styles.statN, { fontFamily: f700 }]}>
                    {dir.isRTL ? s.nAr : s.nEn}
                  </Text>
                  <Text style={[styles.statL, { fontFamily: f400 }]}>
                    {dir.isRTL ? s.ar : s.en}
                  </Text>
                </View>
              ))}
            </View>
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'نبذة' : 'About'}
          </Text>
          <Text style={[styles.aboutText, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL
              ? 'عيادة متخصصة في العلاج النفسي والمعرفي السلوكي، تضم نخبة من أمهر المعالجين في المملكة. نقدّم جلسات فردية وجماعية بسرّية تامة.'
              : "Specialized clinic in psychotherapy and CBT, home to top therapists in the kingdom. Confidential individual and group sessions."}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'التخصصات' : 'Specialties'}
          </Text>
          <View style={[styles.tagRow, { flexDirection: dir.row }]}>
            {SPECIALTIES.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.tag,
                  { backgroundColor: `${s.color}1e`, borderColor: `${s.color}33` },
                ]}
              >
                <Text style={[styles.tagText, { fontFamily: f600, color: s.color }]}>
                  {dir.isRTL ? s.ar : s.en}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA bar */}
      <Animated.View
        entering={FadeInDown.delay(360).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
          <View style={[styles.ctaRow, { flexDirection: dir.row }]}>
            <Pressable style={styles.favBtn}>
              <Heart size={16} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(client)/therapists')}
              style={styles.ctaBtnPress}
            >
              <LinearGradient
                colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                  {dir.isRTL ? 'اختر معالجاً' : 'Choose therapist'}
                </Text>
                <GoIcon size={14} color="#fff" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>
        </Glass>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 340, overflow: 'hidden' },
  heroIcon: { position: 'absolute', bottom: -40, left: 0, right: 0, alignItems: 'center' },
  scroll: { paddingHorizontal: 16, gap: 16 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  infoCard: { padding: 18 },
  infoTop: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  infoName: { flex: 1 },
  clinicName: { fontSize: 20, color: sawaaColors.ink[900] },
  clinicMeta: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 3 },
  ratingChip: { paddingHorizontal: 12, paddingVertical: 6 },
  ratingRow: { alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: sawaaColors.ink[900] },
  ratingCount: { fontSize: 10.5, color: sawaaColors.ink[500] },
  statsRow: { marginTop: 14, gap: 8 },
  statBox: {
    flex: 1, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
  },
  statN: { fontSize: 16, color: sawaaColors.teal[700] },
  statL: { fontSize: 10, color: sawaaColors.ink[500], marginTop: 1 },
  sectionTitle: { fontSize: 15, color: sawaaColors.ink[900], marginBottom: 8, paddingHorizontal: 4 },
  aboutText: { fontSize: 12.5, color: sawaaColors.ink[700], lineHeight: 22, paddingHorizontal: 4 },
  tagRow: { flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 0.5 },
  tagText: { fontSize: 11.5 },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 6, height: 46 },
  favBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnPress: { flex: 1, height: 46 },
  ctaBtn: {
    flex: 1, borderRadius: 999, height: 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 13 },
});
