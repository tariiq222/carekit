import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, RADII } from "@/theme/glass";
import { Glass } from "@/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EASE = "cubic-bezier(0.32, 0.72, 0.15, 1)";
const DURATION = 360;

type HeaderProps = {
  avatarUrl?: string;
  greeting: string;
  subtitle: string;
  onNotificationPress?: () => void;
  hasUnreadNotifications?: boolean;
};

export const Header = ({
  avatarUrl,
  greeting,
  subtitle,
  onNotificationPress,
  hasUnreadNotifications,
}: HeaderProps) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(DURATION, "easeInEaseOut", "opacity")
      );
    }
    if (open) setTimeout(() => inputRef.current?.focus(), DURATION);
  }, [open]);

  const webTransition: Record<string, string> | null =
    Platform.OS === "web"
      ? { transition: `all ${DURATION}ms ${EASE}` }
      : null;

  const placeholder = "ابحث عن معالج أو عيادة...";

  return (
    <View style={s.wrap}>
      <View style={[s.topRow, { flexDirection: 'row' }]}>
        <Glass variant="strong" radius={24} style={s.avatarBubble}>
          <View style={s.avatarImageWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, { backgroundColor: C.softTeal, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.deepTeal }}>
                  {greeting.charAt(0)}
                </Text>
              </View>
            )}
            <View style={s.avatarShine} pointerEvents="none" />
          </View>
        </Glass>

        <View style={[s.actions, { flexDirection: 'row' }]}>
          <View
            style={[
              s.bellWrap,
              {
                width: open ? 0 : 44,
                opacity: open ? 0 : 1,
                overflow: "hidden",
              },
              webTransition,
            ]}
          >
            <Pressable onPress={onNotificationPress}>
              <Glass variant="regular" radius={22} interactive style={s.iconBtn}>
                <Ionicons name="notifications-outline" size={20} color={C.deepTeal} />
                {hasUnreadNotifications && <View style={s.bellDot} />}
              </Glass>
            </Pressable>
          </View>

          <Pressable
            onPress={() => !open && setOpen(true)}
            style={[
              s.pillWrap,
              open ? { flex: 1 } : { width: 44 },
              webTransition,
            ]}
          >
            {({ pressed }) => (
            <Glass
              variant="regular"
              radius={22}
              interactive={!open}
              pressed={!open && pressed}
              style={s.pill}
            >
              <View
                style={[
                  s.pillRow,
                  StyleSheet.absoluteFillObject,
                  {
                    flexDirection: 'row',
                    justifyContent: open ? "flex-start" : "center",
                  },
                ]}
              >
                <View style={s.iconAnchor}>
                  <Ionicons name="search" size={20} color={C.deepTeal} />
                </View>

                <TextInput
                  ref={inputRef}
                  value={q}
                  onChangeText={setQ}
                  placeholder={placeholder}
                  placeholderTextColor={C.subtle}
                  editable={open}
                  style={[
                    s.input,
                    open ? { flex: 1, opacity: 1 } : { flex: 0, width: 0, minWidth: 0, opacity: 0 },
                    {
                      textAlign: 'right',
                      writingDirection: 'rtl',
                    },
                    Platform.OS === "web"
                      ? ({
                          transition: `opacity 180ms ease-out ${open ? 180 : 0}ms`,
                        } as Record<string, string>)
                      : null,
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                />

                <Pressable
                  onPress={() => {
                    if (!open) return;
                    setOpen(false);
                    setQ("");
                  }}
                  style={[
                    s.closeBtn,
                    open
                      ? { width: 30, opacity: 1, marginHorizontal: 4 }
                      : { width: 0, opacity: 0, marginHorizontal: 0 },
                    Platform.OS === "web"
                      ? ({
                          transition: `opacity 180ms ease-out ${open ? 220 : 0}ms, width 200ms ease-out, margin 200ms ease-out`,
                        } as Record<string, string>)
                      : null,
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                >
                  <Ionicons name="close" size={16} color={C.deepTeal} />
                </Pressable>
              </View>
            </Glass>
            )}
          </Pressable>
        </View>
      </View>

      <View style={[s.greetingBlock, { alignItems: 'flex-start' }]}>
        <View style={[s.greetingRow, { flexDirection: 'row' }]}>
          <Ionicons name="leaf" size={22} color={C.deepTeal} />
          <Text
            style={[
              s.greeting,
              { textAlign: 'right', writingDirection: 'rtl' },
            ]}
          >
            {greeting}
          </Text>
        </View>
        <Text
          style={[
            s.greetingSub,
            { textAlign: 'right', writingDirection: 'rtl' },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 18 },
  topRow: { alignItems: "center", gap: 14 },

  avatarBubble: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.deepTeal,
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  avatarImageWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
  },
  avatar: { width: 38, height: 38 },
  avatarShine: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.24)",
  },

  actions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    minWidth: 0,
  },

  pillWrap: { height: 44, justifyContent: "center" },
  pill: { flex: 1, height: 44 },
  pillRow: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  iconAnchor: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: C.deepTeal,
    height: 40,
    paddingHorizontal: 4,
  },
  closeBtn: {
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,79,87,0.08)",
    overflow: "hidden",
  },

  bellWrap: { height: 44, justifyContent: "center" },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 10,
    end: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.notifDot,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.95)",
  },

  greetingBlock: { marginTop: 22, paddingHorizontal: 2, gap: 4 },
  greetingRow: { alignItems: "center", gap: 8 },
  greeting: {
    fontSize: 32,
    fontWeight: "800",
    color: C.deepTeal,
    lineHeight: 42,
  },
  greetingSub: {
    fontSize: 14,
    color: C.subtle,
    fontWeight: "400",
  },
});
