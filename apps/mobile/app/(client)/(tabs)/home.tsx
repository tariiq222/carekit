import { View, ScrollView, StyleSheet, ImageBackground, Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/Header';
import { QuickActions } from '@/components/QuickActions';
import { Glass } from '@/theme';
import { C, RADII, SHADOW } from '@/theme/glass';
import { useDir } from '@/hooks/useDir';

export default function ClientHomeScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const router = useRouter();

  const quickActions = [
    {
      id: 'book',
      icon: 'calendar-outline' as const,
      label: { ar: 'حجز موعد', en: 'Book Appointment' },
      onPress: () => router.push('/(client)/booking/create'),
    },
    {
      id: 'chat',
      icon: 'chatbubbles-outline' as const,
      label: { ar: 'تحدث معنا', en: 'Chat with us' },
      onPress: () => router.push('/(client)/(tabs)/chat'),
    },
    {
      id: 'records',
      icon: 'document-text-outline' as const,
      label: { ar: 'سجلاتي', en: 'My Records' },
      onPress: () => router.push('/(client)/records'),
    },
  ];

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 6, paddingBottom: 120 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header
          greeting={dir.isRTL ? 'مرحباً سارة' : 'Welcome back, Sara'}
          subtitle={dir.isRTL ? 'كيف يمكننا مساعدتك اليوم؟' : 'How can we help you today?'}
          onNotificationPress={() => router.push('/(client)/(tabs)/notifications')}
          hasUnreadNotifications={false}
        />

        <QuickActions actions={quickActions} />

        {/* Clinics Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
            ]}
          >
            {dir.isRTL ? 'العيادات المميزة' : 'Featured Clinics'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.rail,
              { flexDirection: dir.rowReverse, paddingHorizontal: 18 }
            ]}
          >
            <ClinicCard
              name={dir.isRTL ? 'عيادة النفسية' : 'Mental Health Clinic'}
              city={dir.isRTL ? 'الرياض' : 'Riyadh'}
              rating={4.7}
            />
            <ClinicCard
              name={dir.isRTL ? 'مركز الصحة' : 'Health Center'}
              city={dir.isRTL ? 'جدة' : 'Jeddah'}
              rating={4.8}
            />
          </ScrollView>
        </View>

        {/* Therapists Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
            ]}
          >
            {dir.isRTL ? 'المعالجون المميزون' : 'Featured Therapists'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.rail,
              { flexDirection: dir.rowReverse, paddingHorizontal: 18 }
            ]}
          >
            <TherapistCard
              name={dir.isRTL ? 'د. فيصل أحمد' : 'Dr. Faisal Ahmed'}
              specialty={dir.isRTL ? 'طب نفسي' : 'Psychiatry'}
              rating={4.9}
            />
            <TherapistCard
              name={dir.isRTL ? 'د. سارة محمد' : 'Dr. Sara Mohammed'}
              specialty={dir.isRTL ? 'علاج نفسي' : 'Psychotherapy'}
              rating={4.8}
            />
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function ClinicCard({ name, city, rating }: { name: string; city: string; rating: number }) {
  const dir = useDir();
  return (
    <Glass variant="regular" radius={RADII.card} style={[styles.clinicCard, SHADOW]}>
      <View style={styles.clinicImage}>
        <LinearGradient
          colors={[C.softTeal, C.deepTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="business-outline" size={32} color="#FFF" />
      </View>
      <View style={styles.clinicBody}>
        <Text
          style={[
            styles.clinicName,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
          ]}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.clinicCity,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
          ]}
        >
          {city}
        </Text>
        <View style={[styles.ratingPill, { alignSelf: dir.alignStart }]}>
          <Ionicons name="star" size={12} color={C.goldText} />
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      </View>
    </Glass>
  );
}

function TherapistCard({ name, specialty, rating }: { name: string; specialty: string; rating: number }) {
  const dir = useDir();
  return (
    <Glass variant="regular" radius={RADII.card} style={[styles.therapistCard, SHADOW]}>
      <View style={styles.therapistAvatar}>
        <LinearGradient
          colors={[C.softTeal, C.deepTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.therapistInitial}>{name.charAt(0)}</Text>
      </View>
      <View style={[styles.therapistBody, { alignItems: dir.alignStart }]}>
        <Text
          style={[
            styles.therapistName,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
          ]}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.therapistSpecialty,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
          ]}
        >
          {specialty}
        </Text>
        <View style={[styles.ratingPill, { alignSelf: dir.alignStart }]}>
          <Ionicons name="star" size={12} color={C.goldText} />
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  section: { marginTop: 24, gap: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.deepTeal,
    paddingHorizontal: 18,
  },
  rail: { gap: 14, paddingTop: 20, paddingBottom: 72 },
  clinicCard: { width: 180, overflow: 'hidden' },
  clinicImage: {
    width: 180,
    height: 120,
    borderRadius: RADII.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicBody: { padding: 10, gap: 4 },
  clinicName: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
  clinicCity: { fontSize: 12, color: C.subtle },
  therapistCard: { width: 150, padding: 12, gap: 10 },
  therapistAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  therapistInitial: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  therapistBody: { gap: 4 },
  therapistName: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
  therapistSpecialty: { fontSize: 12, color: C.subtle },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.ratingGlass,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    marginTop: 4,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: C.deepTeal },
});
