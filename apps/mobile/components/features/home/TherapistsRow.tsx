import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import type { PublicEmployeeItem } from '@/services/client/employees';

interface TherapistsRowProps {
  therapists: PublicEmployeeItem[];
  f400: string;
  f600: string;
  f700: string;
}

export function TherapistsRow({ therapists, f400, f600, f700 }: TherapistsRowProps) {
  const router = useRouter();

  if (therapists.length === 0) {
    return (
      <Glass variant="regular" radius={sawaaRadius.xl} style={styles.empty}>
        <Text style={[styles.emptyText, { fontFamily: f600, textAlign: 'right' }]}>
          {'لا يوجد معالجون متاحون حالياً'}
        </Text>
      </Glass>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: 'row' }]}
    >
      {therapists.map((t) => {
        const name = t.nameAr ?? t.nameEn ?? '';
        const specialty = t.specialtyAr ?? t.specialty ?? '';
        const initial = name.trim().charAt(0) || '·';
        const photo = t.publicImageUrl;
        return (
          <Glass key={t.id} variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            <Pressable
              onPress={() => router.push(`/(client)/employee/${t.slug ?? t.id}`)}
              style={styles.inner}
            >
              {photo ? (
                <View style={styles.avatar}>
                  <Image source={{ uri: photo }} style={styles.avatarImage} />
                </View>
              ) : (
                <LinearGradient
                  colors={[sawaaColors.teal[400], sawaaColors.teal[600]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
                </LinearGradient>
              )}
              <Text
                style={[styles.name, { fontFamily: f700, textAlign: 'right' }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                style={[styles.spec, { fontFamily: f400, textAlign: 'right' }]}
                numberOfLines={1}
              >
                {specialty || (t.title ?? '')}
              </Text>
            </Pressable>
          </Glass>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: sawaaColors.ink[700] },
  card: { width: 150 },
  inner: { padding: 12, gap: 6, alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: sawaaColors.teal[100],
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 26, color: 'rgba(255,255,255,0.95)' },
  name: { fontSize: 12.5, color: sawaaColors.ink[900], width: '100%' },
  spec: { fontSize: 10.5, color: sawaaColors.ink[500], width: '100%' },
});
