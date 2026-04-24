import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Calendar, Check, FileText, Leaf, MessageCircle, Video } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

type NotifItem = {
  id: string;
  when: { ar: string; en: string };
  title: { ar: string; en: string };
  body: { ar: string; en: string };
  icon: React.ReactNode;
  color: string;
  unread?: boolean;
};

const ITEMS: NotifItem[] = [
  {
    id: '1',
    when: { ar: 'الآن', en: 'Now' },
    title: { ar: 'جلستك تبدأ خلال ١٥ دقيقة', en: 'Session starts in 15 min' },
    body: { ar: 'د. فاطمة العمران · جلسة فيديو', en: 'Dr. Fatima · Video' },
    icon: <Video size={18} color={sawaaColors.teal[600]} strokeWidth={1.75} />,
    color: sawaaColors.teal[600],
    unread: true,
  },
  {
    id: '2',
    when: { ar: 'منذ ساعة', en: '1h ago' },
    title: { ar: 'تذكير تأمل الظهيرة', en: 'Midday meditation' },
    body: { ar: 'خذي نفساً عميقاً — ٥ دقائق فقط', en: 'Breathe — just 5 min' },
    icon: <Leaf size={18} color={sawaaColors.accent.violet} strokeWidth={1.75} />,
    color: sawaaColors.accent.violet,
    unread: true,
  },
  {
    id: '3',
    when: { ar: 'اليوم · ١٠:١٢', en: 'Today · 10:12' },
    title: { ar: 'تم تأكيد حجزك', en: 'Booking confirmed' },
    body: { ar: 'الخميس ١٦ نوفمبر · ٦:٣٠ م', en: 'Thu Nov 16 · 6:30 PM' },
    icon: <Check size={18} color={sawaaColors.teal[600]} strokeWidth={1.75} />,
    color: sawaaColors.teal[600],
  },
  {
    id: '4',
    when: { ar: 'أمس', en: 'Yesterday' },
    title: { ar: 'رسالة من د. منى السالم', en: 'Message from Dr. Mona' },
    body: { ar: '"رائع يا سارة، واصلي التمارين..."', en: '"Great, keep going..."' },
    icon: <MessageCircle size={18} color={sawaaColors.accent.rose} strokeWidth={1.75} />,
    color: sawaaColors.accent.rose,
  },
  {
    id: '5',
    when: { ar: 'أمس', en: 'Yesterday' },
    title: { ar: 'تقرير أسبوعك متاح', en: 'Weekly report ready' },
    body: { ar: 'تحسّن ملحوظ بنسبة ١٨٪ في المزاج', en: '18% mood improvement' },
    icon: <FileText size={18} color={sawaaColors.accent.amber} strokeWidth={1.75} />,
    color: sawaaColors.accent.amber,
  },
  {
    id: '6',
    when: { ar: 'الأحد', en: 'Sunday' },
    title: { ar: 'جلسة جماعية: القلق الاجتماعي', en: 'Group: Social anxiety' },
    body: { ar: 'دعوة للانضمام · مساء الاثنين', en: 'Monday evening' },
    icon: <Calendar size={18} color={sawaaColors.accent.violet} strokeWidth={1.75} />,
    color: sawaaColors.accent.violet,
  },
];

const FILTERS = [
  { key: 'all', ar: 'الكل', en: 'All', count: 12 },
  { key: 'sessions', ar: 'الجلسات', en: 'Sessions', count: 4 },
  { key: 'messages', ar: 'الرسائل', en: 'Messages', count: 2 },
  { key: 'reminders', ar: 'التذكيرات', en: 'Reminders', count: 6 },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [active, setActive] = useState('all');
  const unreadCount = ITEMS.filter((i) => i.unread).length;

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'الإشعارات' : 'Notifications'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL
              ? `لديكِ ${unreadCount === 1 ? 'إشعار جديد' : `${unreadCount} إشعارات جديدة`}`
              : `${unreadCount} new ${unreadCount === 1 ? 'notification' : 'notifications'}`}
          </Text>
        </Animated.View>

        {/* Filter chips */}
        <Animated.View entering={FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterRow, { flexDirection: dir.row }]}
          >
            {FILTERS.map((f) => {
              const isActive = f.key === active;
              return (
                <Glass
                  key={f.key}
                  variant={isActive ? 'strong' : 'regular'}
                  radius={16}
                  onPress={() => setActive(f.key)}
                  interactive
                  style={styles.chip}
                >
                  <View style={[styles.chipInner, { flexDirection: dir.row }]}>
                    <Text style={[
                      styles.chipLabel,
                      { fontFamily: f600, color: isActive ? sawaaColors.teal[700] : sawaaColors.ink[700] }
                    ]}>
                      {dir.isRTL ? f.ar : f.en}
                    </Text>
                    <View style={[
                      styles.chipBadge,
                      { backgroundColor: isActive ? sawaaColors.teal[600] : 'rgba(10,40,40,0.1)' }
                    ]}>
                      <Text style={[
                        styles.chipBadgeText,
                        { fontFamily: f600, color: isActive ? '#fff' : sawaaColors.ink[500] }
                      ]}>
                        {f.count}
                      </Text>
                    </View>
                  </View>
                </Glass>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Notifications list */}
        {ITEMS.map((n, i) => (
          <Animated.View
            key={n.id}
            entering={FadeInDown.delay(150 + i * 60).duration(600).easing(Easing.out(Easing.cubic))}
          >
            <Glass variant={n.unread ? 'strong' : 'regular'} radius={sawaaRadius.xl} style={styles.card}>
              <View style={[styles.row, { flexDirection: dir.row }]}>
                <View style={[
                  styles.iconBox,
                  { backgroundColor: `${n.color}22`, borderColor: `${n.color}33` }
                ]}>
                  {n.icon}
                </View>
                <View style={styles.body}>
                  <View style={[styles.bodyHead, { flexDirection: dir.row }]}>
                    <Text style={[styles.itemTitle, { fontFamily: f700, textAlign: dir.textAlign, flex: 1 }]}>
                      {dir.isRTL ? n.title.ar : n.title.en}
                    </Text>
                    <Text style={[styles.when, { fontFamily: f400 }]}>
                      {dir.isRTL ? n.when.ar : n.when.en}
                    </Text>
                  </View>
                  <Text style={[styles.itemBody, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? n.body.ar : n.body.en}
                  </Text>
                </View>
                {n.unread && <View style={styles.unreadDot} />}
              </View>
            </Glass>
          </Animated.View>
        ))}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 12 },
  title: { fontSize: 28, color: sawaaColors.ink[900], paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: sawaaColors.ink[500], marginTop: 2, paddingHorizontal: 4 },
  filterRow: { gap: 8, paddingHorizontal: 4, paddingVertical: 4 },
  chip: { minWidth: 70 },
  chipInner: { alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  chipLabel: { fontSize: 12 },
  chipBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  chipBadgeText: { fontSize: 10 },
  card: { padding: 14 },
  row: { gap: 12, alignItems: 'flex-start' },
  iconBox: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },
  body: { flex: 1 },
  bodyHead: { justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  itemTitle: { fontSize: 13.5, color: sawaaColors.ink[900] },
  when: { fontSize: 10.5, color: sawaaColors.ink[400] },
  itemBody: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 3, lineHeight: 18 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: sawaaColors.teal[500], marginTop: 6 },
});
