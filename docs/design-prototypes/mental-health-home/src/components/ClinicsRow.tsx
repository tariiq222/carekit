import React, { useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C, FONT, RADII, SHADOW, SHADOW_SOFT } from "../theme";
import { CLINICS } from "../data";
import { Rating } from "./atoms";
import { Glass } from "./Glass";
import { useDir } from "../useDir";

type Clinic = (typeof CLINICS)[number];

const ClinicCard = ({ c }: { c: Clinic }) => {
  const [failed, setFailed] = useState(false);
  const dir = useDir();

  return (
    <Glass variant="regular" radius={RADII.card} interactive style={[s.card, SHADOW]}>
      <View style={s.imgWrap}>
        <View style={s.imgInner}>
          {/* Branded fallback — always rendered behind image; shows if image fails/loads slow */}
          <LinearGradient
            colors={[C.softTeal, C.deepTeal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {!failed ? (
            <Image
              source={{ uri: c.image }}
              style={s.img}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <View style={s.fallbackMark}>
              <Ionicons name={c.icon} size={44} color="rgba(255,255,255,0.85)" />
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.1)"]}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={s.badgeWrap}>
          <Glass variant="clear" radius={24} style={[s.badge, SHADOW_SOFT]}>
            <Ionicons name={c.icon} size={22} color={C.deepTeal} />
          </Glass>
        </View>
      </View>
      <View style={s.body}>
        <Text
          numberOfLines={1}
          style={[s.title, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        >
          {c.title[dir.locale]}
        </Text>
        <View style={[s.foot, { flexDirection: dir.row }]}>
          <Rating v={c.rating} />
          <Text style={s.city}>{c.city[dir.locale]}</Text>
        </View>
      </View>
    </Glass>
  );
};

export const ClinicsRow = () => {
  const dir = useDir();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.rail, { flexDirection: dir.row }]}
    >
      {CLINICS.map((c) => (
        <ClinicCard key={c.id} c={c} />
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
  card: { width: 180, padding: 10 },
  imgWrap: {
    height: 120,
    borderRadius: RADII.image,
    marginBottom: 24,
    position: "relative",
  },
  imgInner: { ...StyleSheet.absoluteFillObject, borderRadius: RADII.image, overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  fallbackMark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWrap: {
    position: "absolute",
    bottom: -24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  badge: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 4, paddingBottom: 4 },
  title: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "700",
    color: C.deepTeal,
    marginTop: 8,
  },
  foot: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  city: { fontFamily: FONT, fontSize: 12, color: C.subtle, fontWeight: "500" },
});
