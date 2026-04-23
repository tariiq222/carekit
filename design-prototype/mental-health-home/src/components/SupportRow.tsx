import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, FONT, RADII, SHADOW } from "../theme";
import { SUPPORTS } from "../data";
import { Glass } from "./Glass";
import { useDir } from "../useDir";

const Sphere = ({
  size,
  color,
  icon,
}: {
  size: number;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) => (
  <Glass
    variant="clear"
    radius={size / 2}
    style={{
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
  </Glass>
);

export const SupportRow = () => {
  const dir = useDir();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.rail, { flexDirection: dir.row }]}
    >
      {SUPPORTS.map((it) => (
        <Glass
          key={it.id}
          variant="regular"
          radius={RADII.card}
          tint={it.tint}
          interactive
          style={[s.card, SHADOW]}
        >
          <View style={[s.row, { flexDirection: dir.row }]}>
            <Sphere size={48} color={it.iconColor} icon={it.icon} />
            <View style={[s.content, { alignItems: dir.alignStart }]}>
              <Text
                style={[
                  s.title,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                ]}
              >
                {it.title[dir.locale]}
              </Text>
              <Text
                style={[
                  s.sub,
                  { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                ]}
              >
                {it.subtitle[dir.locale]}
              </Text>
              <View style={[s.rateRow, { flexDirection: dir.row }]}>
                <Ionicons name="star" size={13} color={C.goldText} />
                <Text style={s.rateText}>{it.rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </Glass>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  rail: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 72,
    gap: 14,
  },
  card: { width: 180 },
  row: {
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  content: { flex: 1 },
  title: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "700",
    color: C.deepTeal,
  },
  sub: {
    fontFamily: FONT,
    fontSize: 11,
    color: C.subtle,
    marginTop: 2,
  },
  rateRow: {
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  rateText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "700",
    color: C.deepTeal,
  },
});
