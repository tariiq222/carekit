import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';

import { sawaaColors } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useAppSelector } from '@/hooks/use-redux';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface HomeTopBarProps {
  f600: string;
}

export function HomeTopBar({ f600 }: HomeTopBarProps) {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const initial = (user?.firstName ?? 'س').charAt(0);
  const { count: unreadCount } = useUnreadCount();

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <Glass variant="regular" radius={21} style={styles.iconBtn}>
          <Pressable onPress={() => {}} style={styles.iconBtnInner}>
            <Search size={19} color={sawaaColors.teal[700]} strokeWidth={1.75} />
          </Pressable>
        </Glass>
        <Glass variant="regular" radius={21} style={styles.iconBtn}>
          <Pressable
            onPress={() => router.push('/(client)/(tabs)/notifications')}
            style={styles.iconBtnInner}
          >
            <Bell size={19} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </Glass>
      </View>
      <Glass variant="regular" radius={21} style={styles.avatarBtn}>
        <Pressable
          onPress={() => router.push('/(client)/(tabs)/profile')}
          style={styles.avatarInner}
        >
          <Text style={[styles.avatarText, { fontFamily: f600 }]}>{initial}</Text>
        </Pressable>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  topBarLeft: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42 },
  iconBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 42, height: 42 },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: sawaaColors.accent.rose,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, color: sawaaColors.teal[700] },
});
