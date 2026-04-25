import React, { useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, RADII, SHADOW } from "../theme";
import { THERAPISTS } from "../data";
import { Rating } from "./atoms";
import { Glass } from "./Glass";
import { useDir } from "../useDir";

type Therapist = (typeof THERAPISTS)[number];

const TherapistCard = ({ t }: { t: Therapist }) => {
  const [failed, setFailed] = useState(false);
  const dir = useDir();
  const name = t.name[dir.locale];
  const initial = name.replace(/^(د\.|أ\.|Dr\.)\s*/i, "").trim().charAt(0);

  return (
    <Glass key={t.id} variant="regular" radius={RADII.card} interactive style={[s.card, SHADOW]}>
      <View style={s.photoWrap}>
        <LinearGradient
          colors={[C.softTeal, C.deepTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {!failed ? (
          <Image
            source={{ uri: t.image }}
            style={s.photo}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={s.fallbackMark}>
            <Text style={s.fallbackText}>{initial}</Text>
          </View>
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.08)"]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={[s.body, { alignItems: dir.alignStart }]}>
        <Text
          numberOfLines={1}
          style={[s.name, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[s.role, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        >
          {t.role[dir.locale]}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Rating v={t.rating} />
        </View>
      </View>
    </Glass>
  );
};

export const TherapistsRow = () => {
  const dir = useDir();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.rail, { flexDirection: dir.row }]}
    >
      {THERAPISTS.map((t) => (
        <TherapistCard key={t.id} t={t} />
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  rail: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 72,
    gap: 12,
  },
  card: { width: 150, padding: 10 },
  photoWrap: {
    height: 140,
    borderRadius: RADII.image,
    overflow: "hidden",
    position: "relative",
  },
  photo: { width: "100%", height: "100%" },
  fallbackMark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontFamily: FONT,
    fontSize: 48,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
  },
  body: { paddingHorizontal: 2, paddingTop: 10, paddingBottom: 4 },
  name: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "700",
    color: C.deepTeal,
  },
  role: {
    fontFamily: FONT,
    fontSize: 11,
    color: C.subtle,
    marginTop: 2,
  },
});
