import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Building2, ChevronLeft, ChevronRight, Heart, Search, Star, Users, Video } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getFontName } from '@/theme/fonts';
import { clientPortalService, type PortalBookingRow } from '@/services/client/portal';
import { publicEmployeesService, type PublicEmployeeItem } from '@/services/client/employees';

const MOODS = [
  { emo: '😔', ar: 'متعبة', en: 'Tired', color: '#8ca8c4' },
  { emo: '😐', ar: 'محايدة', en: 'Okay', color: '#a9b5a8' },
  { emo: '🙂', ar: 'بخير', en: 'Good', color: '#7fc9a8' },
  { emo: '😊', ar: 'سعيدة', en: 'Happy', color: '#f0b869' },
  { emo: '🤩', ar: 'رائعة', en: 'Great', color: '#e88aa6' },
];

function TopBar({ f600 }: { f600: string }) {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const initial = (user?.firstName ?? 'س').charAt(0);

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <Glass variant="regular" radius={21} style={styles.iconBtn}>
          <Pressable onPress={() => {}} style={styles.iconBtnInner}>
            <Search size={19} color={sawaaColors.teal[700]} strokeWidth={1.75} />
          </Pressable>
        </Glass>
        <Glass variant="regular" radius={21} style={styles.iconBtn}>
          <Pressable onPress={() => router.push('/(client)/(tabs)/notifications')} style={styles.iconBtnInner}>
            <Bell size={19} color={sawaaColors.teal[700]} strokeWidth={1.75} />
          </Pressable>
        </Glass>
      </View>
      <Glass variant="regular" radius={21} style={styles.avatarBtn}>
        <Pressable onPress={() => router.push('/(client)/(tabs)/profile')} style={styles.avatarInner}>
          <Text style={[styles.avatarText, { fontFamily: f600 }]}>{initial}</Text>
        </Pressable>
      </Glass>
    </View>
  );
}

function formatRelativeTime(when: Date, now: Date, isRTL: boolean): string {
  const diffMs = when.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMin / 60);
  const h = when.getHours();
  const m = String(when.getMinutes()).padStart(2, '0');
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const time = `${h12}:${m} ${suffix}`;
  if (diffMin < 0) return time;
  if (diffMin < 60) {
    return isRTL ? `بعد ${diffMin} دقيقة · ${time}` : `In ${diffMin}m · ${time}`;
  }
  if (diffH < 24) {
    return isRTL ? `بعد ${diffH} ساعة · ${time}` : `In ${diffH}h · ${time}`;
  }
  const days = Math.round(diffH / 24);
  return isRTL ? `بعد ${days} يوم · ${time}` : `In ${days}d · ${time}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [mood, setMood] = useState<number>(2);
  const ArrowIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const firstName = user?.firstName ?? (dir.isRTL ? 'سارة' : 'Sara');
  const today = new Date().toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const [nextBooking, setNextBooking] = useState<PortalBookingRow | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [therapists, setTherapists] = useState<PublicEmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHome = React.useCallback(async () => {
    try {
      const [home, therapistList] = await Promise.all([
        clientPortalService.getHome(),
        publicEmployeesService.list().catch(() => [] as PublicEmployeeItem[]),
      ]);
      setNextBooking(home.upcomingBookings?.[0] ?? null);
      setUnreadCount(home.unreadNotifications?.length ?? 0);
      setTherapists(therapistList.slice(0, 6));
    } catch {
      // Network/auth errors leave the screen in its empty state — better
      // than masking with stale mock data.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadHome();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadHome]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sawaaColors.teal[600]} />}
      >
        <TopBar f600={f600} />

        {/* Greeting */}
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))} style={styles.greetingBlock}>
          <Text style={[styles.dateLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>{today}</Text>
          <Text style={[styles.greeting, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? `صباح الخير، ${firstName}` : `Good morning, ${firstName}`}
          </Text>
        </Animated.View>

        {/* Mood check-in */}
        <Animated.View entering={FadeInDown.delay(120).duration(700).easing(Easing.out(Easing.cubic))} style={styles.cardWrap}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.moodCard}>
            <Text style={[styles.moodTitle, { fontFamily: f600, textAlign: dir.textAlign }]}>
              {dir.isRTL ? 'كيف تشعرين الآن؟' : 'How do you feel now?'}
            </Text>
            <View style={[styles.moodRow, { flexDirection: dir.row }]}>
              {MOODS.map((m, i) => (
                <Pressable key={i} onPress={() => setMood(i)} style={styles.moodItem} hitSlop={6}>
                  {i === mood ? (
                    <LinearGradient
                      colors={[m.color, `${m.color}dd`]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.moodEmoji, styles.moodEmojiActive, { borderColor: m.color }]}
                    >
                      <Text style={styles.moodEmojiText}>{m.emo}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.moodEmoji}>
                      <Text style={styles.moodEmojiText}>{m.emo}</Text>
                    </View>
                  )}
                  <Text style={[
                    styles.moodLabel,
                    { fontFamily: i === mood ? f600 : f400, color: i === mood ? sawaaColors.ink[900] : sawaaColors.ink[500] }
                  ]}>
                    {dir.isRTL ? m.ar : m.en}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Glass>
        </Animated.View>

        {/* Today section header */}
        <Animated.View entering={FadeInDown.delay(220).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}>
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'القادم' : 'Up next'}
          </Text>
          {unreadCount > 0 ? (
            <Pressable onPress={() => router.push('/(client)/(tabs)/notifications')}>
              <Text style={[styles.sectionMeta, { fontFamily: f600, color: sawaaColors.teal[700] }]}>
                {dir.isRTL
                  ? `${unreadCount.toLocaleString('ar-SA')} تنبيه جديد`
                  : `${unreadCount} new alert${unreadCount === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>

        {/* Next session card */}
        <Animated.View entering={FadeInDown.delay(300).duration(700).easing(Easing.out(Easing.cubic))} style={styles.cardWrap}>
          {loading ? (
            <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.sessionCard, styles.sessionLoading]}>
              <ActivityIndicator color={sawaaColors.teal[600]} />
            </Glass>
          ) : nextBooking ? (
            <Glass variant="strong" radius={sawaaRadius.xl} style={styles.sessionCard}>
              <Pressable
                onPress={() => router.push(`/(client)/appointment/${nextBooking.id}`)}
                style={[styles.sessionRow, { flexDirection: dir.row }]}
              >
                <LinearGradient
                  colors={[sawaaColors.teal[400], sawaaColors.teal[600]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sessionIcon}
                >
                  <Video size={22} color="#fff" strokeWidth={1.75} />
                </LinearGradient>
                <View style={styles.sessionMid}>
                  <Text style={[styles.sessionTime, { fontFamily: f600, textAlign: dir.textAlign }]}>
                    {(() => {
                      const iso = nextBooking.scheduledAt
                        ?? `${nextBooking.date}T${nextBooking.startTime}:00Z`;
                      const when = new Date(iso);
                      return formatRelativeTime(when, new Date(), dir.isRTL);
                    })()}
                  </Text>
                  <Text style={[styles.sessionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {nextBooking.employee
                      ? (dir.isRTL
                          ? `جلسة مع ${nextBooking.employee.user.firstName} ${nextBooking.employee.user.lastName}`.trim()
                          : `Session with ${nextBooking.employee.user.firstName} ${nextBooking.employee.user.lastName}`.trim())
                      : (dir.isRTL ? 'جلسة قادمة' : 'Upcoming session')}
                  </Text>
                </View>
                <View style={styles.sessionGo}>
                  <ArrowIcon size={14} color="#fff" strokeWidth={2} />
                </View>
              </Pressable>
            </Glass>
          ) : (
            <Glass variant="regular" radius={sawaaRadius.xl} style={[styles.sessionCard, styles.emptySession]}>
              <Text style={[styles.emptyText, { fontFamily: f600, textAlign: dir.textAlign }]}>
                {dir.isRTL ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'}
              </Text>
              <Pressable onPress={() => router.push('/(client)/therapists')} hitSlop={8}>
                <Text style={[styles.emptyCta, { fontFamily: f700 }]}>
                  {dir.isRTL ? 'احجزي الآن' : 'Book now'}
                </Text>
              </Pressable>
            </Glass>
          )}
        </Animated.View>

        {/* ── Featured Clinics ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(380).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}>
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'العيادات المميزة' : 'Featured Clinics'}
          </Text>
          <Text style={[styles.sectionMeta, { fontFamily: f600, color: sawaaColors.teal[700] }]}>
            {dir.isRTL ? 'عرض الكل' : 'See all'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(440).duration(700).easing(Easing.out(Easing.cubic))}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
          >
            {[
              { id: '1', ar: 'عيادة النفسية', en: 'Wellness Clinic', city: dir.isRTL ? 'الرياض' : 'Riyadh', rating: 4.7 },
              { id: '2', ar: 'مركز الصحة', en: 'Health Center', city: dir.isRTL ? 'جدة' : 'Jeddah', rating: 4.8 },
              { id: '3', ar: 'عيادة النور', en: 'Noor Clinic', city: dir.isRTL ? 'الدمام' : 'Dammam', rating: 4.6 },
              { id: '4', ar: 'مركز السكينة', en: 'Serenity Center', city: dir.isRTL ? 'مكة' : 'Makkah', rating: 4.9 },
            ].map((c) => (
              <Glass key={c.id} variant="strong" radius={sawaaRadius.xl} style={styles.clinicCard}>
                <Pressable onPress={() => router.push(`/(client)/clinic/${c.id}`)} style={styles.clinicInner}>
                  <View style={styles.clinicFavWrap}>
                    <Heart size={14} color={sawaaColors.ink[500]} strokeWidth={1.75} />
                  </View>
                  <LinearGradient
                    colors={[sawaaColors.teal[300], sawaaColors.teal[500]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.clinicIcon}
                  >
                    <Building2 size={36} color="#fff" strokeWidth={1.5} />
                  </LinearGradient>
                  <Text style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? c.ar : c.en}
                  </Text>
                  <View style={[styles.clinicMeta, { flexDirection: dir.row }]}>
                    <View style={[styles.clinicRating, { flexDirection: dir.row }]}>
                      <Text style={[styles.clinicRatingText, { fontFamily: f600 }]}>{c.rating}</Text>
                      <Star size={11} color={sawaaColors.accent.amber} strokeWidth={2} fill={sawaaColors.accent.amber} />
                    </View>
                    <Text style={[styles.clinicCity, { fontFamily: f400 }]}>{c.city}</Text>
                  </View>
                </Pressable>
              </Glass>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Support Sessions ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(520).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}>
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'جلسات الدعم' : 'Support sessions'}
          </Text>
          <Text style={[styles.sectionMeta, { fontFamily: f600, color: sawaaColors.teal[700] }]}>
            {dir.isRTL ? 'عرض الكل' : 'See all'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(580).duration(700).easing(Easing.out(Easing.cubic))}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
          >
            {[
              { titleAr: 'جلسة جماعية: القلق الاجتماعي', titleEn: 'Group: Social anxiety', metaAr: 'اليوم · ٨:٠٠ مساءً · د. مي', metaEn: 'Today · 8:00 PM · Dr. May', color: sawaaColors.accent.violet },
              { titleAr: 'مجموعة دعم الاكتئاب', titleEn: 'Depression support', metaAr: 'الثلاثاء · ٧:٣٠ مساءً', metaEn: 'Tue · 7:30 PM', color: sawaaColors.accent.rose },
              { titleAr: 'التأمل الجماعي', titleEn: 'Group meditation', metaAr: 'السبت · ٦:٠٠ مساءً', metaEn: 'Sat · 6:00 PM', color: sawaaColors.teal[500] },
            ].map((s, i) => (
              <Glass key={i} variant="strong" radius={sawaaRadius.xl} style={styles.supportCard}>
                <View style={styles.supportInner}>
                  <View style={[styles.supportIcon, { backgroundColor: `${s.color}22` }]}>
                    <Users size={22} color={s.color} strokeWidth={1.75} />
                  </View>
                  <Text style={[styles.supportTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? s.titleAr : s.titleEn}
                  </Text>
                  <Text style={[styles.supportMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? s.metaAr : s.metaEn}
                  </Text>
                  <Pressable style={styles.supportCta}>
                    <Text style={[styles.supportCtaText, { fontFamily: f700 }]}>
                      {dir.isRTL ? 'انضم' : 'Join'}
                    </Text>
                  </Pressable>
                </View>
              </Glass>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Therapists ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(640).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}>
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'المعالجون' : 'Therapists'}
          </Text>
          <Pressable onPress={() => router.push('/(client)/therapists')} hitSlop={8}>
            <Text style={[styles.sectionMeta, { fontFamily: f600, color: sawaaColors.teal[700] }]}>
              {dir.isRTL ? 'عرض الكل' : 'See all'}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(800).easing(Easing.out(Easing.cubic))}>
          {therapists.length === 0 ? (
            <Glass variant="regular" radius={sawaaRadius.xl} style={styles.emptyTherapists}>
              <Text style={[styles.emptyText, { fontFamily: f600, textAlign: dir.textAlign }]}>
                {dir.isRTL ? 'لا يوجد معالجون متاحون حالياً' : 'No therapists available right now'}
              </Text>
            </Glass>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
            >
              {therapists.map((t) => {
                const name = (dir.isRTL ? t.nameAr : t.nameEn) ?? t.nameAr ?? t.nameEn ?? '';
                const specialty = (dir.isRTL ? t.specialtyAr : t.specialty) ?? t.specialty ?? t.specialtyAr ?? '';
                const initial = name.trim().charAt(0) || '·';
                return (
                  <Glass key={t.id} variant="strong" radius={sawaaRadius.xl} style={styles.therapistSmallCard}>
                    <Pressable
                      onPress={() => router.push(`/(client)/employee/${t.slug ?? t.id}`)}
                      style={styles.therapistSmallInner}
                    >
                      <LinearGradient
                        colors={[sawaaColors.teal[400], sawaaColors.teal[600]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.therapistSmallAvatar}
                      >
                        <Text style={[styles.therapistSmallAvatarText, { fontFamily: f700 }]}>{initial}</Text>
                      </LinearGradient>
                      <Text style={[styles.therapistSmallName, { fontFamily: f700, textAlign: dir.textAlign }]} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={[styles.therapistSmallSpec, { fontFamily: f400, textAlign: dir.textAlign }]} numberOfLines={1}>
                        {specialty || (t.title ?? '')}
                      </Text>
                    </Pressable>
                  </Glass>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  topBarLeft: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42 },
  iconBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 42, height: 42 },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, color: sawaaColors.teal[700] },
  greetingBlock: { paddingHorizontal: 4, marginTop: 4 },
  dateLabel: { fontSize: 12, color: sawaaColors.teal[700], opacity: 0.75 },
  greeting: { fontSize: 26, lineHeight: 34, color: sawaaColors.ink[900], marginTop: 2 },
  cardWrap: {},
  moodCard: { padding: 20 },
  moodTitle: { fontSize: 14, color: sawaaColors.ink[700], marginBottom: 14 },
  moodRow: { justifyContent: 'space-between' },
  moodItem: { alignItems: 'center', gap: 6 },
  moodEmoji: {
    width: 46, height: 46, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.7)',
  },
  moodEmojiActive: { borderWidth: 2, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  moodEmojiText: { fontSize: 24 },
  moodLabel: { fontSize: 10.5 },
  sectionHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginTop: 4 },
  sectionTitle: { fontSize: 16, color: sawaaColors.ink[900] },
  sectionMeta: { fontSize: 12 },
  sessionCard: { padding: 14 },
  sessionLoading: { alignItems: 'center', justifyContent: 'center', minHeight: 76 },
  emptySession: { padding: 18, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: sawaaColors.ink[700] },
  emptyCta: { fontSize: 13, color: sawaaColors.teal[700] },
  emptyTherapists: { padding: 24, alignItems: 'center' },
  sessionRow: { alignItems: 'center', gap: 12 },
  sessionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sessionMid: { flex: 1 },
  sessionTime: { fontSize: 11, color: sawaaColors.teal[700] },
  sessionTitle: { fontSize: 14.5, color: sawaaColors.ink[900], marginTop: 1 },
  sessionGo: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: sawaaColors.teal[700],
    alignItems: 'center', justifyContent: 'center',
  },
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  clinicCard: { width: 170 },
  clinicInner: { padding: 12, gap: 10 },
  clinicFavWrap: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  clinicIcon: {
    height: 88, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  clinicName: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2 },
  clinicMeta: { justifyContent: 'space-between', alignItems: 'center' },
  clinicRating: { alignItems: 'center', gap: 3 },
  clinicRatingText: { fontSize: 11.5, color: sawaaColors.ink[900] },
  clinicCity: { fontSize: 11, color: sawaaColors.ink[500] },
  supportCard: { width: 220 },
  supportInner: { padding: 16, gap: 10, minHeight: 180 },
  supportIcon: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  supportTitle: { fontSize: 14, color: sawaaColors.ink[900], lineHeight: 20 },
  supportMeta: { fontSize: 11.5, color: sawaaColors.ink[500], flex: 1 },
  supportCta: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: sawaaColors.teal[600],
    alignSelf: 'stretch', alignItems: 'center',
  },
  supportCtaText: { color: '#fff', fontSize: 12 },
  therapistSmallCard: { width: 150 },
  therapistSmallInner: { padding: 12, gap: 6, alignItems: 'center' },
  therapistSmallAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4, position: 'relative',
  },
  therapistSmallAvatarText: { fontSize: 26, color: 'rgba(255,255,255,0.95)' },
  onlineDotSmall: {
    position: 'absolute', top: 4, right: 4, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#4bd67a', borderWidth: 1.5, borderColor: '#fff',
  },
  therapistSmallName: { fontSize: 12.5, color: sawaaColors.ink[900], width: '100%' },
  therapistSmallSpec: { fontSize: 10.5, color: sawaaColors.ink[500], width: '100%' },
  therapistSmallRating: { alignItems: 'center', gap: 3, marginTop: 2 },
  therapistSmallRatingText: { fontSize: 11, color: sawaaColors.ink[900] },
  therapistCard: { padding: 0, overflow: 'hidden' },
  therapistRow: { alignItems: 'stretch' },
  therapistAvatar: { width: 96, alignItems: 'center', justifyContent: 'flex-end', position: 'relative', paddingBottom: 10 },
  therapistAvatarText: { fontSize: 44, color: 'rgba(255,255,255,0.95)' },
  onlineDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4bd67a', borderWidth: 1.5, borderColor: '#fff' },
  therapistBody: { padding: 14, flex: 1 },
  therapistName: { fontSize: 14.5, color: sawaaColors.ink[900] },
  therapistSpecialty: { fontSize: 11.5, color: sawaaColors.ink[500], marginTop: 2 },
  therapistMeta: { alignItems: 'center', gap: 4, marginTop: 8 },
  therapistRating: { fontSize: 11, color: sawaaColors.ink[900] },
  therapistDot: { fontSize: 11, color: sawaaColors.ink[400] },
  therapistYears: { fontSize: 11, color: sawaaColors.ink[500] },
  tagRow: { gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  tagText: { fontSize: 10.5 },
});
