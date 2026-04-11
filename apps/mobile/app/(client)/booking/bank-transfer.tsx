import { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Camera,
  ImageIcon,
  Upload,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { paymentsService } from '@/services/payments';
import { clinicService } from '@/services/clinic';

interface BankDetailRowProps {
  label: string;
  value: string;
  textSecondary: string;
}

function BankDetailRow({ label, value, textSecondary }: BankDetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <ThemedText variant="bodySm" color={textSecondary}>
        {label}
      </ThemedText>
      <ThemedText variant="subheading">{value}</ThemedText>
    </View>
  );
}

export default function BankTransferScreen() {
  const params = useLocalSearchParams<{
    bookingId: string;
    total: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  useEffect(() => {
    clinicService.getSettings().then((res) => {
      if (res.data) {
        setBankName(res.data.bankName ?? '');
        setBankIban(res.data.bankIban ?? '');
        setAccountHolder(res.data.accountHolder ?? '');
      }
    }).catch(() => {
      // Bank details unavailable — user will see empty fields
    });
  }, []);

  const totalAmount = Number(params.total) || 0;

  const handleTakePhoto = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const handleChooseGallery = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!imageUri || !params.bookingId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      const res = await paymentsService.uploadBankTransferReceipt(
        params.bookingId,
        imageUri,
      );

      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({
          pathname: '/(patient)/booking/success',
          params: {
            bookingId: params.bookingId,
            pendingApproval: 'true',
          },
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('common.error'), t('payment.uploadError'));
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('payment.uploadError'));
    } finally {
      setLoading(false);
    }
  }, [imageUri, params.bookingId, router, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon
            size={24}
            strokeWidth={1.5}
            color={theme.colors.textPrimary}
          />
        </Pressable>

        <ThemedText variant="heading" style={styles.title}>
          {t('payment.bankTransfer')}
        </ThemedText>

        {/* Bank Details Card */}
        <ThemedCard style={styles.bankCard}>
          <ThemedText variant="label" style={styles.cardTitle}>
            {t('payment.bankDetails')}
          </ThemedText>
          <BankDetailRow
            label={t('payment.bankName')}
            value={bankName}
            textSecondary={theme.colors.textSecondary}
          />
          <View
            style={[
              styles.divider,
              { backgroundColor: theme.colors.surfaceLow },
            ]}
          />
          <BankDetailRow
            label={t('payment.iban')}
            value={bankIban}
            textSecondary={theme.colors.textSecondary}
          />
          <View
            style={[
              styles.divider,
              { backgroundColor: theme.colors.surfaceLow },
            ]}
          />
          <BankDetailRow
            label={t('payment.accountHolder')}
            value={accountHolder}
            textSecondary={theme.colors.textSecondary}
          />
        </ThemedCard>

        {/* Amount Card */}
        <ThemedCard style={styles.amountCard}>
          <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
            {t('payment.transferAmount')}
          </ThemedText>
          <ThemedText variant="displaySm" color="#1D4ED8">
            {totalAmount} {t('home.sar')}
          </ThemedText>
        </ThemedCard>

        {/* Upload Section */}
        <ThemedText variant="subheading" style={styles.sectionTitle}>
          {t('payment.uploadReceipt')}
        </ThemedText>

        {!imageUri ? (
          <>
            <View style={[styles.uploadBox, { borderColor: theme.colors.textSecondary }]}>
              <Upload size={32} strokeWidth={1.5} color={theme.colors.textSecondary} />
              <ThemedText
                variant="body"
                color={theme.colors.textSecondary}
                align="center"
              >
                {t('payment.uploadReceipt')}
              </ThemedText>
            </View>

            <View style={styles.uploadActions}>
              <ThemedButton
                onPress={handleTakePhoto}
                variant="outline"
                size="md"
                icon={<Camera size={18} strokeWidth={1.5} color="#1D4ED8" />}
                style={styles.uploadBtn}
              >
                {t('payment.takePhoto')}
              </ThemedButton>
              <ThemedButton
                onPress={handleChooseGallery}
                variant="outline"
                size="md"
                icon={
                  <ImageIcon size={18} strokeWidth={1.5} color="#1D4ED8" />
                }
                style={styles.uploadBtn}
              >
                {t('payment.chooseGallery')}
              </ThemedButton>
            </View>
          </>
        ) : (
          <View style={styles.previewSection}>
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <ThemedButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setImageUri(null);
              }}
              variant="ghost"
              size="sm"
            >
              {t('payment.changePhoto')}
            </ThemedButton>
          </View>
        )}

        {/* Submit Button */}
        <ThemedButton
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          full
          loading={loading}
          disabled={!imageUri || loading}
          style={{ marginTop: 24 }}
        >
          {t('payment.submitReceipt')}
        </ThemedButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { marginBottom: 20 },
  bankCard: { gap: 8, padding: 16, marginBottom: 16 },
  cardTitle: { marginBottom: 4 },
  detailRow: { gap: 4 },
  divider: { height: 1, marginVertical: 4 },
  amountCard: {
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: { marginBottom: 14 },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadBtn: { flex: 1 },
  previewSection: { alignItems: 'center', gap: 12 },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
});
