import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { Search } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

type MoodPoint = { dayAr: string; dayEn: string; value: number };

const MOOD_WEEK: MoodPoint[] = [
  { dayAr: 'الأحد', dayEn: 'Sun', value: 2 },
  { dayAr: 'الاثنين', dayEn: 'Mon', value: 3 },
  { dayAr: 'الثلاثاء', dayEn: 'Tue', value: 2.5 },
  { dayAr: 'الأربعاء', dayEn: 'Wed', value: 3.5 },
  { dayAr: 'الخميس', dayEn: 'Thu', value: 4 },
  { dayAr: 'الجمعة', dayEn: 'Fri', value: 4.5 },
  { dayAr: 'السبت', dayEn: 'Sat', value: 4.2 },
];

type Entry = {
  id: string;
  dateAr: string;
  dateEn: string;
  summaryAr: string;
  summaryEn: string;
  tagsAr: string[];
  tagsEn: string[];
};

const ENTRIES: Entry[] = [
  {
    id: '1',
    dateAr: 'اليوم',
    dateEn: 'Today',
    summaryAr: 'شعرت بصفاء بعد جلسة التأمل الصباحية',
    summaryEn: 'Felt clear after the morning meditation',
    tagsAr: ['هدوء', 'تركيز', 'امتنان'],
    tagsEn: ['Calm', 'Focused', 'Grateful'],
  },
  {
    id: '2',
    dateAr: 'أمس',
    dateEn: 'Yesterday',
    summaryAr: 'يوم متوازن مع بعض التوتر في المساء',
    summaryEn: 'Balanced day, mild evening stress',
    tagsAr: ['متفائلة', 'متوترة'],
    tagsEn: ['Hopeful', 'Tense'],
  },
  {
    id: '3',
    dateAr: 'الجمعة',
    dateEn: 'Friday',
    summaryAr: 'تمشية طويلة مع العائلة، شعور دافئ',
    summaryEn: 'Long walk with family, warm mood',
    tagsAr: ['سعيدة', 'ممتنة', 'مرتاحة'],
    tagsEn: ['Joyful', 'Grateful', 'Relaxed'],
  },
  {
    id: '4',
    dateAr: 'الخميس',
    dateEn: 'Thursday',
    summaryAr: 'ضغط عمل خفيف لكن أنهيت المهام',
    summaryEn: 'Light work pressure but finished tasks',
    tagsAr: ['منجزة', 'متعبة'],
    tagsEn: ['Productive', 'Tired'],
  },
];

const CHART_W = 290;
const CHART_H = 100;

function buildPath(points: { x: number; y: number }[]): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    line += ` Q ${cpx} ${prev.y}, ${cpx} ${(prev.y + curr.y) / 2} T ${curr.x} ${curr.y}`;
  }
  const last = points[points.length - 1];
  const first = points[0];
  const area = `${line} L ${last.x} ${CHART_H} L ${first.x} ${CHART_H} Z`;
  return { line, area };
}

export default function RecordsScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [query, setQuery] = useState('');

  const points = useMemo(() => {
    const max = 5;
    const min = 1;
    const pad = 14;
    const usable = CHART_W - pad * 2;
    const step = usable / (MOOD_WEEK.length - 1);
    return MOOD_WEEK.map((m, i) => {
      const norm = (m.value - min) / (max - min);
      const y = CHART_H - 14 - norm * (CHART_H - 28);
      return { x: pad + i * step, y };
    });
  }, []);

  const path = useMemo(() => buildPath(points), [points]);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'سجلاتي' : 'My records'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'سجلاتكِ محمية بالتشفير' : 'Your records are end-to-end encrypted'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Glass variant="regular" radius={sawaaRadius.lg} style={styles.searchWrap}>
            <View style={[styles.searchRow, { flexDirection: dir.row }]}>
              <Search size={18} color={sawaaColors.ink[500]} strokeWidth={1.75} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={dir.isRTL ? 'ابحث في سجلاتك…' : 'Search your records…'}
                placeholderTextColor={sawaaColors.ink[400]}
                style={[
                  styles.searchInput,
                  {
                    fontFamily: f400,
                    textAlign: dir.textAlign,
                    writingDirection: dir.writingDirection,
                  },
                ]}
              />
            </View>
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.chartCard}>
            <View style={[styles.chartHead, { flexDirection: dir.row }]}>
              <View style={styles.deltaBadge}>
                <Text style={[styles.deltaText, { fontFamily: f700 }]}>↑ 18%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chartLabel, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? 'آخر ٧ أيام' : 'Last 7 days'}
                </Text>
                <Text style={[styles.chartTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? 'المزاج خلال الأسبوع' : 'Mood this week'}
                </Text>
              </View>
            </View>

            <View style={styles.chartBox}>
              <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                <Defs>
                  <SvgGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={sawaaColors.teal[500]} stopOpacity={0.38} />
                    <Stop offset="100%" stopColor={sawaaColors.teal[500]} stopOpacity={0} />
                  </SvgGradient>
                  <SvgGradient id="moodStroke" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor={sawaaColors.teal[400]} />
                    <Stop offset="100%" stopColor={sawaaColors.teal[700]} />
                  </SvgGradient>
                </Defs>
                <Path d={path.area} fill="url(#moodFill)" />
                <Path
                  d={path.line}
                  stroke="url(#moodStroke)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="none"
                />
                {points.map((p, i) => (
                  <Circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill="#fff"
                    stroke={sawaaColors.teal[600]}
                    strokeWidth={2}
                  />
                ))}
              </Svg>
            </View>

            <View style={[styles.daysRow, { flexDirection: dir.row }]}>
              {MOOD_WEEK.map((m, i) => (
                <Text key={i} style={[styles.dayLabel, { fontFamily: f400 }]}>
                  {(dir.isRTL ? m.dayAr : m.dayEn).slice(0, 3)}
                </Text>
              ))}
            </View>
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'سجلات حديثة' : 'Recent entries'}
          </Text>
        </Animated.View>

        {ENTRIES.map((e, i) => (
          <Animated.View
            key={e.id}
            entering={FadeInDown.delay(260 + i * 60).duration(600).easing(Easing.out(Easing.cubic))}
          >
            <Glass variant="regular" radius={sawaaRadius.xl} style={styles.entryCard}>
              <View style={[styles.entryHead, { flexDirection: dir.row }]}>
                <Text style={[styles.entrySummary, { fontFamily: f600, textAlign: dir.textAlign, flex: 1 }]}>
                  {dir.isRTL ? e.summaryAr : e.summaryEn}
                </Text>
                <Text style={[styles.entryDate, { fontFamily: f400 }]}>
                  {dir.isRTL ? e.dateAr : e.dateEn}
                </Text>
              </View>
              <View style={[styles.tagRow, { flexDirection: dir.row }]}>
                {(dir.isRTL ? e.tagsAr : e.tagsEn).map((tag, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={[styles.tagText, { fontFamily: f600 }]}>{tag}</Text>
                  </View>
                ))}
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
  searchWrap: { paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  searchRow: { alignItems: 'center', gap: 10 },
  searchInput: {
    flex: 1, fontSize: 13.5, color: sawaaColors.ink[900],
    paddingVertical: 10, minHeight: 40,
  },
  chartCard: { padding: 18 },
  chartHead: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  deltaBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(75,214,122,0.16)',
  },
  deltaText: { fontSize: 11, color: '#1f8f3e' },
  chartLabel: { fontSize: 11, color: sawaaColors.ink[500] },
  chartTitle: { fontSize: 15, color: sawaaColors.ink[900], marginTop: 2 },
  chartBox: { marginTop: 18, height: CHART_H },
  daysRow: { justifyContent: 'space-between', marginTop: 6 },
  dayLabel: { fontSize: 10.5, color: sawaaColors.ink[500] },
  sectionTitle: { fontSize: 15, color: sawaaColors.ink[900], paddingHorizontal: 4, marginTop: 4 },
  entryCard: { padding: 14, gap: 10 },
  entryHead: { gap: 8, alignItems: 'baseline' },
  entrySummary: { fontSize: 13.5, color: sawaaColors.ink[900], lineHeight: 20 },
  entryDate: { fontSize: 11, color: sawaaColors.ink[400] },
  tagRow: { gap: 6, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  tagText: { fontSize: 11, color: sawaaColors.teal[700] },
});
