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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, FONT, RADII } from "../theme";
import { USER_AVATAR } from "../data";
import { Glass } from "./Glass";
import { useDir } from "../useDir";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EASE = "cubic-bezier(0.32, 0.72, 0.15, 1)";
const DURATION = 360;

export const Header = () => {
  const dir = useDir();
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

  const webTransition: any =
    Platform.OS === "web"
      ? { transition: `all ${DURATION}ms ${EASE}` }
      : null;

  const placeholder = dir.isRTL ? "ابحث عن معالج أو عيادة..." : "Search therapist or clinic…";
  const greeting = dir.isRTL ? "مرحباً سارة" : "Welcome back, Sara";
  const sub = dir.isRTL ? "كيف يمكننا مساعدتك اليوم؟" : "How can we help you today?";

  return (
    <View style={s.wrap}>
      <View style={[s.topRow, { flexDirection: dir.row }]}>
        {/* Avatar — alone at the logical start, wrapped in the same glass chip
            treatment as the bell + search pill so all three read as a family. */}
        <Glass variant="strong" radius={24} style={s.avatarBubble}>
          <View style={s.avatarImageWrap}>
            <Image source={{ uri: USER_AVATAR }} style={s.avatar} />
            <View style={s.avatarShine} pointerEvents="none" />
          </View>
        </Glass>

        {/* Actions take the rest of the row. When closed, bell + pill hug the
            end. When open, pill grows to fill — reaching up to just before
            the avatar (14pt gap). */}
        <View style={[s.actions, { flexDirection: dir.row }]}>
          {/* Bell — fades away when search opens */}
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
            <Glass variant="regular" radius={22} interactive style={s.iconBtn}>
              <Ionicons name="notifications-outline" size={20} color={C.deepTeal} />
              <View style={s.bellDot} />
            </Glass>
          </View>

          {/* Search pill — 44x44 when closed, grows to fill when open */}
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
                    flexDirection: dir.row,
                    justifyContent: open ? "flex-start" : "center",
                  },
                ]}
              >
                {/* Magnifying glass — logical start when open, centered when closed */}
                <View style={s.iconAnchor}>
                  <Ionicons name="search" size={20} color={C.deepTeal} />
                </View>

                {/* Input — always mounted but claims zero width when closed
                    so the icon isn't pushed around. Fades in once the pill
                    has grown. */}
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
                      textAlign: dir.textAlign,
                      writingDirection: dir.writingDirection,
                    },
                    Platform.OS === "web"
                      ? ({
                          transition: `opacity 180ms ease-out ${open ? 180 : 0}ms`,
                        } as any)
                      : null,
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                />

                {/* Close button — also claims zero width when closed. */}
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
                        } as any)
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

      {/* Greeting */}
      <View style={[s.greetingBlock, { alignItems: dir.alignStart }]}>
        <View style={[s.greetingRow, { flexDirection: dir.row }]}>
          <MaterialCommunityIcons name="leaf" size={22} color={C.deepTeal} />
          <Text
            style={[
              s.greeting,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {greeting}
          </Text>
        </View>
        <Text
          style={[
            s.greetingSub,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
        >
          {sub}
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
    ...(Platform.OS === "web"
      ? ({
          WebkitMaskImage:
            "radial-gradient(circle, black 52%, transparent 74%)",
          maskImage:
            "radial-gradient(circle, black 52%, transparent 74%)",
        } as any)
      : { borderRadius: 19, overflow: "hidden" }),
  },
  avatar: { width: 38, height: 38 },
  avatarShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === "web"
      ? ({
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.60) 0%, rgba(255,255,255,0.22) 36%, rgba(255,255,255,0) 56%)",
        } as any)
      : { backgroundColor: "rgba(255,255,255,0.24)" }),
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
    fontFamily: FONT,
    fontSize: 14,
    color: C.deepTeal,
    outlineStyle: "none" as any,
    outlineWidth: 0,
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
    right: 10,
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
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: "800",
    color: C.deepTeal,
    lineHeight: 42,
  },
  greetingSub: {
    fontFamily: FONT,
    fontSize: 14,
    color: C.subtle,
    fontWeight: "400",
  },
});
