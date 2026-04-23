import { View, ScrollView, StyleSheet, ImageBackground, Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building2, Star, CalendarDays, MessageCircle, FileText, Users, Heart } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { QuickActions } from '@/components/QuickActions';
import { SectionHeader } from '@/components/SectionHeader';
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
      icon: CalendarDays,
      label: { ar: 'حجز موعد', en: 'Book Appointment' },
      onPress: () => router.push('/(client)/booking/create'),
    },
    {
      id: 'chat',
      icon: MessageCircle,
      label: { ar: 'تحدث معنا', en: 'Chat with us' },
      onPress: () => router.push('/(client)/chat'),
    },
    {
      id: 'records',
      icon: FileText,
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
          <SectionHeader
            title={dir.isRTL ? 'العيادات المميزة' : 'Featured Clinics'}
            style={styles.sectionHeaderInset}
          />
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

        {/* Support Sessions Section */}
        <View style={styles.section}>
          <SectionHeader
            title={dir.isRTL ? 'جلسات الدعم' : 'Support Sessions'}
            style={styles.sectionHeaderInset}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.rail,
              { flexDirection: dir.rowReverse, paddingHorizontal: 18 },
            ]}
          >
            <SupportCard
              title={dir.isRTL ? 'دعم العلاقات' : 'Relationship Support'}
              subtitle={dir.isRTL ? 'جلسات زوجية' : 'Couples sessions'}
              rating={4.7}
              icon={Users}
              tint={C.greenTint}
              iconColor={C.greenIcon}
            />
            <SupportCard
              title={dir.isRTL ? 'دعم القلق والتوتر' : 'Anxiety & Stress'}
              subtitle={dir.isRTL ? 'جلسات فردية' : 'Individual sessions'}
              rating={4.8}
              icon={Heart}
              tint={C.tealTint}
              iconColor={C.tealIcon}
            />
          </ScrollView>
        </View>

        {/* Therapists Section */}
        <View style={styles.section}>
          <SectionHeader
            title={dir.isRTL ? 'المعالجون المميزون' : 'Featured Therapists'}
            style={styles.sectionHeaderInset}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.rail,
              { flexDirection: dir.rowReverse, paddingHorizontal: 18 }
            ]}
          >
            <TherapistCard
              name={dir.isRTL ? 'د. فيصل السبيعي' : 'Dr. Faisal Al-Subaie'}
              specialty={dir.isRTL ? 'استشاري نفسي' : 'Psychiatry Consultant'}
              rating={4.9}
            />
            <TherapistCard
              name={dir.isRTL ? 'أ. نورة عبدالله' : 'Noura Abdullah'}
              specialty={dir.isRTL ? 'أخصائية علاج أسري' : 'Family Therapist'}
              rating={4.7}
            />
            <TherapistCard
              name={dir.isRTL ? 'د. أحمد' : 'Dr. Ahmed'}
              specialty={dir.isRTL ? 'استشاري' : 'Consultant'}
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
      <View style={styles.clinicImageWrap}>
        <Glass variant="strong" radius={RADII.image} style={styles.clinicImage}>
          <Building2 size={40} color={C.deepTeal} strokeWidth={1.5} />
        </Glass>
        <Glass variant="strong" radius={19} style={styles.clinicBadge}>
          <Building2 size={16} color={C.deepTeal} strokeWidth={2} />
        </Glass>
      </View>
      <View style={styles.clinicBody}>
        <Text
          style={[styles.clinicName, { writingDirection: dir.writingDirection }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={[styles.clinicMeta, { flexDirection: dir.row }]}>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>{rating}</Text>
            <Star size={12} color={C.goldText} fill={C.goldText} strokeWidth={0} />
          </View>
          <Text
            style={[styles.clinicCity, { writingDirection: dir.writingDirection }]}
            numberOfLines={1}
          >
            {city}
          </Text>
        </View>
      </View>
    </Glass>
  );
}

function TherapistCard({ name, specialty, rating }: { name: string; specialty: string; rating: number }) {
  const dir = useDir();
  return (
    <Glass variant="regular" radius={RADII.card} style={[styles.therapistCard, SHADOW]}>
      <Glass variant="strong" radius={30} style={styles.therapistImage}>
        <Text style={styles.therapistInitial}>{name.charAt(dir.isRTL ? 3 : 0) || name.charAt(0)}</Text>
      </Glass>
      <View style={styles.therapistBody}>
        <Text
          style={[styles.therapistName, { writingDirection: dir.writingDirection }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[styles.therapistSpecialty, { writingDirection: dir.writingDirection }]}
          numberOfLines={1}
        >
          {specialty}
        </Text>
        <View style={styles.therapistRating}>
          <Text style={styles.ratingText}>{rating}</Text>
          <Star size={12} color={C.goldText} fill={C.goldText} strokeWidth={0} />
        </View>
      </View>
    </Glass>
  );
}

function SupportCard({
  title,
  subtitle,
  rating,
  icon: Icon,
  tint,
  iconColor,
}: {
  title: string;
  subtitle: string;
  rating: number;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tint: string;
  iconColor: string;
}) {
  const dir = useDir();
  return (
    <Glass variant="regular" radius={RADII.card} style={[styles.supportCard, SHADOW]}>
      <View style={[styles.supportInner, { flexDirection: dir.row }]}>
        <View style={[styles.supportBody, { alignItems: dir.alignStart }]}>
          <Text
            style={[styles.supportTitle, { writingDirection: dir.writingDirection }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.supportSubtitle, { writingDirection: dir.writingDirection }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
          <View style={[styles.supportRating, { flexDirection: dir.row }]}>
            <Text style={styles.ratingText}>{rating}</Text>
            <Star size={12} color={C.goldText} fill={C.goldText} strokeWidth={0} />
          </View>
        </View>
        <View style={[styles.supportIcon, { backgroundColor: tint }]}>
          <Icon size={22} color={iconColor} strokeWidth={1.8} />
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  section: { marginTop: 24, gap: 12 },
  sectionHeaderInset: { paddingHorizontal: 18, marginBottom: 0 },
  rail: { gap: 14, paddingTop: 20, paddingBottom: 72 },
  clinicCard: { width: 200, padding: 8, paddingBottom: 14 },
  clinicImageWrap: {
    alignItems: 'center',
  },
  clinicImage: {
    width: '100%',
    height: 130,
    borderRadius: RADII.image,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clinicBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -19,
    shadowColor: C.deepTeal,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  clinicBody: { paddingHorizontal: 6, paddingTop: 8, gap: 10 },
  clinicName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.deepTeal,
    textAlign: 'center',
  },
  clinicMeta: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clinicCity: { fontSize: 12, color: C.subtle },
  therapistCard: { width: 200, padding: 8, paddingBottom: 14 },
  therapistImage: {
    width: '100%',
    height: 200,
    borderRadius: RADII.image,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  therapistInitial: { fontSize: 56, fontWeight: '800', color: C.deepTeal },
  therapistBody: {
    paddingHorizontal: 4,
    paddingTop: 12,
    gap: 4,
    alignItems: 'center',
  },
  therapistName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.deepTeal,
    textAlign: 'center',
  },
  therapistSpecialty: {
    fontSize: 12,
    color: C.subtle,
    textAlign: 'center',
  },
  therapistRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  supportCard: {
    width: 260,
    padding: 14,
  },
  supportInner: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  supportBody: { flex: 1, gap: 4 },
  supportTitle: { fontSize: 15, fontWeight: '800', color: C.deepTeal },
  supportSubtitle: { fontSize: 12, color: C.subtle },
  supportRating: { alignItems: 'center', gap: 4, marginTop: 4 },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: C.deepTeal },
});
