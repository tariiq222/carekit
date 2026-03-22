import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';

/**
 * Chat screen stub — will be implemented in Phase 4 (AI Chatbot).
 * Currently shows a placeholder with the DS-matching AI icon.
 */
export default function ChatScreen() {
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
        {t('patient.chat')}
      </ThemedText>
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <Sparkles size={32} strokeWidth={1.5} color="#1D4ED8" />
        </View>
        <ThemedText variant="body" color={theme.colors.textSecondary} align="center">
          {t('tabs.assistant')}
        </ThemedText>
        <ThemedText variant="caption" color={theme.colors.textMuted} align="center">
          Phase 4 — AI Chatbot
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
    gap: 12,
    marginBottom: 100,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1D4ED814',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
