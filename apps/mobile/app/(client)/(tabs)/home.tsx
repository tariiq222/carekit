import { View, Text, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme';
import { C, RADII, SHADOW, SHADOW_RAISED } from '@/theme/glass';

export default function ClientHomeScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();

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
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: 22 }]}>
          <View style={[styles.headerRow, { flexDirection: dir.row }]}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={[
                  styles.greeting,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                ]}
              >
                مرحباً سارة
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
                ]}
              >
                كيف يمكننا مساعدتك اليوم؟
              </Text>
            </View>

            {/* Avatar + Bell */}
            <View style={[styles.headerIcons, { flexDirection: dir.row }]}>
              <Glass variant="clear" radius={RADII.pill} style={styles.iconBubble}>
                <Text style={styles.avatarText}>س</Text>
              </Glass>
              <Glass variant="clear" radius={RADII.pill} style={styles.iconBubble}>
                <View style={styles.bellIcon} />
                <View style={styles.notifDot} />
              </Glass>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Glass
          variant="strong"
          radius={RADII.floating}
          style={[styles.quickActions, SHADOW_RAISED, { marginHorizontal: 18 }]}
        >
          <View style={[styles.actionsGrid, { flexDirection: dir.row }]}>
            <ActionCard icon="📅" label="حجز موعد" tint={C.greenTint} />
            <ActionCard icon="💬" label="تحدث معنا" tint={C.peachTint} />
            <ActionCard icon="📋" label="سجلاتي" tint={C.tealTint} />
          </View>
        </Glass>

        {/* Section: Clinics */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
            ]}
          >
            العيادات المميزة
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.rail,
              { flexDirection: dir.rowReverse, paddingHorizontal: 18 }
            ]}
          >
            <ClinicCard name="عيادة النفسية" city="الرياض" />
            <ClinicCard name="مركز الصحة" city="جدة" />
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function ActionCard({ icon, label, tint }: { icon: string; label: string; tint: string }) {
  const dir = useDir();
  return (
    <Glass variant="regular" radius={RADII.card} style={[styles.actionCard, { backgroundColor: tint }]}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text
        style={[
          styles.actionLabel,
          { textAlign: dir.textAlign, writingDirection: dir.writingDirection }
        ]}
      >
        {label}
      </Text>
    </Glass>
  );
}

function ClinicCard({ name, city }: { name: string; city: string }) {
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
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { paddingTop: 6, paddingBottom: 18 },
  headerRow: { alignItems: 'flex-start', gap: 12 },
  greeting: { fontSize: 32, fontWeight: '800', color: C.deepTeal, lineHeight: 42 },
  subtitle: { fontSize: 14, color: C.subtle, lineHeight: 20 },
  headerIcons: { gap: 10, alignItems: 'center' },
  iconBubble: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: C.deepTeal },
  bellIcon: { width: 20, height: 20, backgroundColor: C.deepTeal, borderRadius: 4 },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.notifDot,
  },
  quickActions: { marginTop: 0, padding: 18 },
  actionsGrid: { gap: 12 },
  actionCard: { flex: 1, padding: 16, alignItems: 'center', gap: 8, minHeight: 100 },
  actionIcon: { fontSize: 32 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: C.deepTeal },
  section: { marginTop: 24, gap: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.deepTeal,
    paddingHorizontal: 18,
  },
  rail: { gap: 14, paddingTop: 20, paddingBottom: 72 },
  clinicCard: { width: 180, overflow: 'hidden' },
  clinicImage: { width: 180, height: 120, borderRadius: RADII.image },
  clinicBody: { padding: 10, gap: 4 },
  clinicName: { fontSize: 14, fontWeight: '700', color: C.deepTeal },
  clinicCity: { fontSize: 12, color: C.subtle },
});
