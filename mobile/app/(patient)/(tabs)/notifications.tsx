import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 },
      ]}
    >
      <ThemedText variant="displaySm" style={styles.title}>
        {t('tabs.notifications')}
      </ThemedText>
      <View style={styles.empty}>
        <Bell size={48} strokeWidth={1} color={theme.colors.textMuted} />
        <ThemedText variant="body" color={theme.colors.textMuted} align="center">
          {t('common.noResults')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 24 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 100,
  },
});
