import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search, Users as UsersIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';

interface PatientItem {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  lastVisit: string;
  visitCount: number;
}

export default function PatientsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientItem[]>([]);

  const fontFamily = isRTL ? 'IBM Plex Sans Arabic' : 'Inter';

  const filtered = patients.filter((p) => {
    const name = `${p.firstName} ${p.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 },
      ]}
    >
      <ThemedText variant="displaySm" style={styles.title}>
        {t('practitioner.patients')}
      </ThemedText>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.white }]}>
        <Search size={18} strokeWidth={1.5} color={theme.colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('doctor.searchPatients')}
          placeholderTextColor={theme.colors.textMuted}
          textAlign={isRTL ? 'right' : 'left'}
          style={[styles.searchInput, { color: theme.colors.textPrimary, fontFamily }]}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const name = `${item.firstName} ${item.lastName}`;
          return (
            <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <ThemedCard style={styles.patientCard}>
                <View style={styles.patientRow}>
                  <Avatar size={44} name={name} imageUrl={item.avatarUrl} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="subheading" numberOfLines={1}>
                      {name}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t('doctor.lastVisit')}: {new Date(item.lastVisit).toLocaleDateString(
                        isRTL ? 'ar-SA' : 'en-US',
                        { month: 'short', day: 'numeric' },
                      )}
                    </ThemedText>
                  </View>
                  <View style={[styles.visitBadge, { backgroundColor: '#1D4ED81A' }]}>
                    <ThemedText variant="caption" color="#1D4ED8" style={{ fontWeight: '600' }}>
                      {item.visitCount} {t('doctor.visits')}
                    </ThemedText>
                  </View>
                </View>
              </ThemedCard>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <UsersIcon size={48} strokeWidth={1} color={theme.colors.textMuted} />
            <ThemedText variant="body" color={theme.colors.textMuted} align="center">
              {t('doctor.noPatients')}
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#001551',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list: { paddingBottom: 100 },
  patientCard: { padding: 14 },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visitBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  empty: { alignItems: 'center', gap: 16, paddingTop: 80 },
});
