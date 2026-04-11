import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Brain, Heart, Users, Activity, MessageCircle, HeartHandshake } from 'lucide-react-native';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { Specialty } from '@/types/models';

const SPECIALTY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  default: { icon: Activity, color: '#0D9488' },
};

const ICON_COLORS = ['#1D4ED8', '#84CC16', '#7C3AED', '#0D9488', '#EC4899', '#F59E0B'];

interface SpecialtyCardProps {
  specialty: Specialty;
  index: number;
  onPress: (id: string) => void;
}

export function SpecialtyCard({ specialty, index, onPress }: SpecialtyCardProps) {
  const { theme, isRTL } = useTheme();
  const color = ICON_COLORS[index % ICON_COLORS.length];
  const Icon = [Brain, Heart, Users, Activity, MessageCircle, HeartHandshake][index % 6];
  const name = isRTL ? specialty.nameAr : specialty.nameEn;

  return (
    <Pressable
      onPress={() => onPress(specialty.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.white,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${color}1A` }]}>
        <Icon size={20} strokeWidth={1.5} color={color} />
      </View>
      <ThemedText variant="caption" align="center" numberOfLines={2} style={styles.name}>
        {name}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    minWidth: 76,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontWeight: '500' },
});
