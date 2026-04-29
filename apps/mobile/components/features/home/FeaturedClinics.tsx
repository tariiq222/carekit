import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDepartments } from '@/hooks/queries';

interface FeaturedClinicsProps {
  f600: string;
  f700: string;
}

export function FeaturedClinics({ f600, f700 }: FeaturedClinicsProps) {
  const router = useRouter();
  const { data: departments = [], isLoading } = useDepartments();

  if (isLoading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.hScrollContent, { flexDirection: 'row' }]}
      >
        {[0, 1, 2].map((i) => (
          <Glass key={i} variant="strong" radius={sawaaRadius.xl} style={styles.clinicCard}>
            <View style={styles.clinicInner}>
              <View style={[styles.clinicIcon, { backgroundColor: sawaaColors.teal[100] }]} />
              <View style={[styles.skeletonBar, { width: '70%' }]} />
              <View style={[styles.skeletonBar, { width: '40%' }]} />
            </View>
          </Glass>
        ))}
      </ScrollView>
    );
  }

  if (departments.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: 'row' }]}
    >
      {departments.map((d) => {
        const serviceCount = d.services.length;
        return (
          <Glass key={d.id} variant="strong" radius={sawaaRadius.xl} style={styles.clinicCard}>
            <Pressable
              onPress={() => router.push(`/(client)/clinic/${d.id}`)}
              style={styles.clinicInner}
            >
              <LinearGradient
                colors={[sawaaColors.teal[300], sawaaColors.teal[500]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.clinicIcon}
              >
                <Building2 size={36} color="#fff" strokeWidth={1.5} />
              </LinearGradient>
              <Text
                numberOfLines={2}
                style={[styles.clinicName, { fontFamily: f700, textAlign: 'right' }]}
              >
                {d.nameAr}
              </Text>
              <View style={[styles.clinicMeta, { flexDirection: 'row' }]}>
                <View style={[styles.clinicRating, { flexDirection: 'row' }]}>
                  <Text style={[styles.clinicRatingText, { fontFamily: f600 }]}>
                    {serviceCount > 0 ? `${serviceCount} خدمات` : 'استشارة'}
                  </Text>
                  <Star
                    size={11}
                    color={sawaaColors.accent.amber}
                    strokeWidth={2}
                    fill={sawaaColors.accent.amber}
                  />
                </View>
              </View>
            </Pressable>
          </Glass>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  clinicCard: { width: 170 },
  clinicInner: { padding: 12, gap: 10 },
  clinicIcon: { height: 88, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  clinicName: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2, minHeight: 36 },
  clinicMeta: { justifyContent: 'space-between', alignItems: 'center' },
  clinicRating: { alignItems: 'center', gap: 3 },
  clinicRatingText: { fontSize: 11.5, color: sawaaColors.ink[900] },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: sawaaColors.teal[100],
    marginTop: 4,
  },
});
