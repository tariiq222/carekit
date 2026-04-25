import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ExternalLink,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  Video as VideoIcon,
  VideoOff,
} from 'lucide-react-native';

import { AquaBackground, GlassSurface as Glass, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { clientBookingsService } from '@/services/client';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VideoCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [duration, setDuration] = useState(754);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    clientBookingsService
      .getJoinUrl(bookingId)
      .then((res) => {
        if (!cancelled) setJoinUrl(res.joinUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          Alert.alert(
            dir.isRTL ? 'تعذّر إحضار رابط المكالمة' : 'Could not fetch call link',
            err instanceof Error ? err.message : String(err),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, dir.isRTL]);

  const openZoom = async () => {
    if (!joinUrl) return;
    const canOpen = await Linking.canOpenURL(joinUrl);
    if (!canOpen) {
      Alert.alert(dir.isRTL ? 'تعذّر فتح الرابط' : 'Cannot open link');
      return;
    }
    await Linking.openURL(joinUrl);
  };

  return (
    <AquaBackground variant="dark">
      {/* Therapist silhouette as backdrop */}
      <View style={styles.therapistWrap}>
        <LinearGradient
          colors={['#f7cbb7', '#e88f6c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.therapistCircle}
        >
          <Text style={[styles.therapistInitial, { fontFamily: f700 }]}>ف</Text>
        </LinearGradient>
      </View>

      {/* Top info bar */}
      <Animated.View
        entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}
        style={[styles.topBar, { top: insets.top + 8 }]}
      >
        <Glass variant="dark" radius={sawaaRadius.xl} style={styles.topBarInner}>
          <View style={[styles.topBarRow, { flexDirection: dir.row }]}>
            <View style={styles.liveDot} />
            <View style={styles.topBarMid}>
              <Text style={[styles.therapistName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                {dir.isRTL ? 'د. فاطمة العمران' : 'Dr. Fatima Al-Omran'}
              </Text>
              <Text style={[styles.topBarMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
                {dir.isRTL ? `جلسة مباشرة · ${formatDuration(duration)}` : `Live · ${formatDuration(duration)}`}
              </Text>
            </View>
            <View style={styles.encryptedChip}>
              <Text style={[styles.encryptedText, { fontFamily: f700 }]}>
                {dir.isRTL ? 'مشفّرة' : 'Encrypted'}
              </Text>
            </View>
          </View>
        </Glass>
      </Animated.View>

      {/* Self-view */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(700).easing(Easing.out(Easing.cubic))}
        style={[styles.selfView, { top: insets.top + 90 }]}
      >
        <LinearGradient
          colors={[sawaaColors.teal[400], sawaaColors.teal[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.selfGradient}
        >
          <Text style={[styles.selfInitial, { fontFamily: f700 }]}>س</Text>
          <View style={styles.selfLabel}>
            <Text style={[styles.selfLabelText, { fontFamily: f700 }]}>
              {dir.isRTL ? 'أنتِ' : 'You'}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Caption bubble */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.captionWrap, { bottom: insets.bottom + 160 }]}
      >
        <Glass variant="dark" radius={sawaaRadius.xl} style={styles.captionCard}>
          <View style={[styles.captionHead, { flexDirection: dir.row }]}>
            <View style={styles.captionDot} />
            <Text style={[styles.captionLabel, { fontFamily: f400 }]}>
              {dir.isRTL ? 'ترجمة فورية' : 'Live caption'}
            </Text>
          </View>
          <Text style={[styles.captionText, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL
              ? '"خذي نفساً عميقاً يا سارة… والآن، صِفي لي ذلك الشعور الذي يراودكِ صباحاً."'
              : '"Take a deep breath, Sara… now describe that feeling you get in the morning."'}
          </Text>
        </Glass>
      </Animated.View>

      {/* Controls — floating glass pill */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.controlsWrap, { bottom: insets.bottom + 24 }]}
      >
        <Glass variant="dark" radius={sawaaRadius.pill} style={styles.controlsPill}>
          <View style={[styles.controlsRow, { flexDirection: dir.row }]}>
            <ControlBtn on={micOn} onPress={() => setMicOn(!micOn)}>
              {micOn ? <Mic size={22} color="#fff" strokeWidth={1.75} /> : <MicOff size={22} color="#fff" strokeWidth={1.75} />}
            </ControlBtn>
            <ControlBtn on={camOn} onPress={() => setCamOn(!camOn)}>
              {camOn ? <VideoIcon size={22} color="#fff" strokeWidth={1.75} /> : <VideoOff size={22} color="#fff" strokeWidth={1.75} />}
            </ControlBtn>
            <ControlBtn on={false} onPress={() => router.push('/(client)/chat')}>
              <MessageCircle size={22} color="#fff" strokeWidth={1.75} />
            </ControlBtn>
            {joinUrl ? (
              <ControlBtn on={false} onPress={openZoom}>
                <ExternalLink size={22} color="#fff" strokeWidth={1.75} />
              </ControlBtn>
            ) : null}
            <EndCallBtn onPress={() => router.back()} />
          </View>
        </Glass>
      </Animated.View>
    </AquaBackground>
  );
}

function ControlBtn({ children, on, onPress }: { children: React.ReactNode; on: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.ctrlBtn,
        { backgroundColor: on ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)' },
      ]}
    >
      {children}
    </Pressable>
  );
}

function EndCallBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.endBtn}>
      <PhoneOff size={22} color="#fff" strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  therapistWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  therapistCircle: {
    width: 170, height: 170, borderRadius: 85,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#e88f6c', shadowOpacity: 0.4, shadowRadius: 40, shadowOffset: { width: 0, height: 20 },
  },
  therapistInitial: { fontSize: 70, color: 'rgba(255,255,255,0.95)' },
  topBar: { position: 'absolute', left: 16, right: 16, zIndex: 30 },
  topBarInner: { padding: 12 },
  topBarRow: { alignItems: 'center', gap: 10 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ff5b5b',
    shadowColor: '#ff5b5b', shadowOpacity: 1, shadowRadius: 6,
  },
  topBarMid: { flex: 1 },
  therapistName: { fontSize: 12.5, color: '#fff' },
  topBarMeta: { fontSize: 10.5, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  encryptedChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(75,214,122,0.2)',
    borderWidth: 0.5, borderColor: 'rgba(75,214,122,0.4)',
  },
  encryptedText: { fontSize: 10.5, color: '#4bd67a' },
  selfView: { position: 'absolute', left: 16, zIndex: 20 },
  selfGradient: {
    width: 92, height: 126, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    position: 'relative',
  },
  selfInitial: { fontSize: 36, color: 'rgba(255,255,255,0.95)' },
  selfLabel: {
    position: 'absolute', bottom: 6, left: 6,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  selfLabelText: { fontSize: 9, color: '#fff' },
  captionWrap: { position: 'absolute', left: 16, right: 16, zIndex: 20 },
  captionCard: { padding: 14 },
  captionHead: { alignItems: 'center', gap: 6, marginBottom: 4 },
  captionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: sawaaColors.teal[300] },
  captionLabel: { fontSize: 10.5, color: 'rgba(255,255,255,0.55)' },
  captionText: { fontSize: 13, color: '#fff', lineHeight: 22 },
  controlsWrap: { position: 'absolute', left: 16, right: 16, zIndex: 30 },
  controlsPill: { padding: 12 },
  controlsRow: { justifyContent: 'space-around', alignItems: 'center' },
  ctrlBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  endBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ff3b30',
    shadowColor: '#ff3b30', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
});
