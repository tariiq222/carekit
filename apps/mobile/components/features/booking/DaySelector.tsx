import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';

const DAYS_AR_SHORT = ['أحد', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

interface DaySelectorProps {
  days: Date[];
  dayIdx: number;
  onSelect: (idx: number) => void;
  f500: string;
  f700: string;
}

export function DaySelector({ days, dayIdx, onSelect, f500, f700 }: DaySelectorProps) {
  const selectedDay = days[dayIdx];
  const monthLabel = `${MONTHS_AR[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

  return (
    <Glass variant="strong" radius={sawaaRadius.xl} style={styles.monthCard}>
      <View style={[styles.monthHead, { flexDirection: 'row' }]}>
        <View />
        <Text style={[styles.monthTitle, { fontFamily: f700 }]}>{monthLabel}</Text>
        <View />
      </View>
      <View style={[styles.daysRow, { flexDirection: 'row' }]}>
        {days.map((d, i) => {
          const isActive = i === dayIdx;
          const dow = d.getDay();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(i);
              }}
              style={[styles.dayCell, !isActive && styles.dayCellInactive]}
            >
              {isActive ? (
                <LinearGradient
                  colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[
                  styles.dayName,
                  { fontFamily: f500, color: isActive ? 'rgba(255,255,255,0.9)' : sawaaColors.ink[700] },
                ]}
              >
                {DAYS_AR_SHORT[dow]}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  { fontFamily: f700, color: isActive ? '#fff' : sawaaColors.ink[900] },
                ]}
              >
                {d.getDate().toLocaleString('ar-SA')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  monthCard: { padding: 12 },
  monthHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  monthTitle: { fontSize: 13.5, color: sawaaColors.ink[900] },
  daysRow: { justifyContent: 'space-between', gap: 6 },
  dayCell: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCellInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  dayName: { fontSize: 10.5, opacity: 0.85 },
  dayNum: { fontSize: 17, marginTop: 2 },
});
