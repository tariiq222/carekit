import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, FONT, RADII, SHADOW_RAISED } from "../theme";
import { TABS } from "../data";
import { Glass } from "./Glass";
import { useDir } from "../useDir";

export const TabBar = () => {
  const dir = useDir();
  return (
    <View style={s.outer}>
      <Glass variant="strong" radius={RADII.floating} style={[s.bar, SHADOW_RAISED]}>
        <View style={[s.row, { flexDirection: dir.row }]}>
          {TABS.map((t) => (
            <Pressable key={t.id} style={s.item}>
              {t.active ? (
                <View style={s.activeCapsule}>
                  <Ionicons name={t.icon} size={20} color={C.deepTeal} />
                </View>
              ) : (
                <View style={s.iconWrap}>
                  <Ionicons name={t.icon} size={22} color={C.subtle} />
                  {t.dot ? <View style={s.dot} /> : null}
                </View>
              )}
              <Text
                style={[s.label, t.active && s.activeLabel]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {t.label[dir.locale]}
              </Text>
              {t.active ? <View style={s.activePip} /> : null}
            </Pressable>
          ))}
        </View>
      </Glass>
    </View>
  );
};

const s = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: RADII.floating,
  },
  bar: { height: 80, paddingHorizontal: 6 },
  row: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCapsule: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.activeTab,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  dot: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.notifDot,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  label: {
    fontFamily: FONT,
    fontSize: 10,
    color: C.subtle,
    fontWeight: "500",
    textAlign: "center",
  },
  activeLabel: { color: C.deepTeal, fontWeight: "800", fontSize: 11 },
  activePip: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.deepTeal,
    marginTop: 2,
  },
});
