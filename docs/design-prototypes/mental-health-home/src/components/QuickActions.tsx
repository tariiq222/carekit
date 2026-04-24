import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, FONT, RADII, SHADOW_RAISED } from "../theme";
import { QUICK_ACTIONS } from "../data";
import { Glass } from "./Glass";
import { useDir } from "../useDir";

export const QuickActions = () => {
  const dir = useDir();
  return (
    <View style={s.outer}>
      <Glass variant="strong" radius={RADII.floating} style={[s.panel, SHADOW_RAISED]}>
        <View style={[s.tilesRow, { flexDirection: dir.row }]}>
          {QUICK_ACTIONS.map((a, i) => (
            <React.Fragment key={a.id}>
              <Pressable style={s.tile}>
                <View style={s.iconBubble}>
                  <Ionicons name={a.icon} size={22} color={C.deepTeal} />
                </View>
                <Text style={s.label}>{a.label[dir.locale]}</Text>
              </Pressable>
              {i < QUICK_ACTIONS.length - 1 ? <View style={s.divider} /> : null}
            </React.Fragment>
          ))}
        </View>
      </Glass>
    </View>
  );
};

const s = StyleSheet.create({
  outer: { marginHorizontal: 18, borderRadius: RADII.floating },
  panel: { paddingVertical: 18, paddingHorizontal: 10 },
  tilesRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(118,185,196,0.18)",
    borderWidth: 1,
    borderColor: "rgba(118,185,196,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "600",
    color: C.deepTeal,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(21,79,87,0.08)",
    marginHorizontal: 4,
  },
});
