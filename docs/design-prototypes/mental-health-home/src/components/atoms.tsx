import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C, FONT } from "../theme";
import { BG_SOURCE } from "../bgImage";
import { useDir } from "../useDir";

/* ------------------------------ Rating pill ------------------------------ */
export const Rating = ({ v }: { v: number }) => {
  const dir = useDir();
  return (
    <View style={[r.pill, { flexDirection: dir.row, alignSelf: dir.alignStart }]}>
      <Ionicons name="star" size={11} color={C.goldText} />
      <Text style={r.text}>{v.toFixed(1)}</Text>
    </View>
  );
};

const r = StyleSheet.create({
  pill: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.ratingGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.95)",
  },
  text: { fontFamily: FONT, fontSize: 11, color: C.deepTeal, fontWeight: "700" },
});

/* --------------------------------- Dots --------------------------------- */
export const Dots = ({ n, active }: { n: number; active: number }) => (
  <View style={d.row}>
    {Array.from({ length: n }).map((_, i) => (
      <View key={i} style={[d.dot, i === active && d.active]} />
    ))}
  </View>
);

const d = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -44 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(21,79,87,0.2)" },
  active: { width: 22, backgroundColor: C.softTeal },
});

/* ----------------------------- Section header ----------------------------
   Bar sits at the LOGICAL START — right in RTL, left in LTR.
   On web, document.dir handles the flip. On native, we explicitly flip. */
export const SectionHeader = ({ title }: { title: string }) => {
  const dir = useDir();
  return (
    <View style={[sh.row, { flexDirection: dir.row }]}>
      <View style={sh.bar} />
      <Text
        style={[sh.title, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        allowFontScaling={false}
      >
        {title}
      </Text>
    </View>
  );
};

/* ---------- Header A — Accent bar (vertical rule) + huge title --------- */
export const SectionHeaderA = ({ title }: { title: string }) => (
  <View style={shA.row}>
    <Text style={shA.title}>{title}</Text>
    <View style={shA.bar} />
  </View>
);
const shA = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 22,
    marginTop: 24,
    marginBottom: 12,
    gap: 12,
  },
  bar: {
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: C.softTeal,
  },
  title: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: "800",
    color: C.deepTeal,
  },
});

/* ---------- Header B — Title with highlight swipe under last word ------ */
export const SectionHeaderB = ({ title }: { title: string }) => (
  <View style={shB.wrap}>
    <View style={shB.stack}>
      <Text style={shB.title}>{title}</Text>
      <View style={shB.underline} />
    </View>
  </View>
);
const shB = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    marginTop: 24,
    marginBottom: 12,
    alignItems: "flex-end",
  },
  stack: { alignItems: "flex-end" },
  title: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: "800",
    color: C.deepTeal,
  },
  underline: {
    marginTop: 4,
    height: 6,
    width: 48,
    borderRadius: 3,
    backgroundColor: C.goldFill,
    opacity: 0.85,
  },
});

/* ---------- Header C — Glass chip with leading icon ------------------- */
export const SectionHeaderC = ({
  title,
  icon = "sparkles-outline",
}: {
  title: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) => (
  <View style={shC.row}>
    <View style={shC.chip}>
      <Text style={shC.chipText}>{title}</Text>
      <Ionicons name={icon} size={14} color={C.deepTeal} />
    </View>
  </View>
);
const shC = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    paddingHorizontal: 22,
    marginTop: 24,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  chipText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "700",
    color: C.deepTeal,
  },
});

const sh = StyleSheet.create({
  row: {
    alignItems: "center",
    paddingHorizontal: 22,
    marginTop: 26,
    marginBottom: 12,
    gap: 12,
  },
  bar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: C.softTeal,
  },
  title: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: "800",
    color: C.deepTeal,
    includeFontPadding: false,
    lineHeight: 28,
    flex: 1,
  },
});

/* -------- Silk curves overlay — thin white bezier lines (web via SVG) ---- */
const SilkCurves = () => {
  if (Platform.OS !== "web") return null;
  // Raw SVG mirrors the reference: 4 nested curves emanating from top-left,
  // thin white strokes, soft glow via feGaussianBlur.
  const svg = `
    <svg width="100%" height="640" viewBox="0 0 430 640" preserveAspectRatio="none"
         style="position:absolute;top:0;left:0;pointer-events:none;">
      <defs>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <linearGradient id="silk" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stop-color="rgba(255,255,255,0.95)"/>
          <stop offset="55%" stop-color="rgba(255,255,255,0.55)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#silk)" stroke-linecap="round" filter="url(#softGlow)">
        <path d="M -30 150 C 60 110, 160 170, 280 140 S 430 120, 480 140" stroke-width="1.4" opacity="0.85"/>
        <path d="M -40 200 C 70 155, 180 220, 300 190 S 440 170, 500 190" stroke-width="1.3" opacity="0.75"/>
        <path d="M -30 250 C 80 210, 200 275, 320 245 S 450 225, 510 245" stroke-width="1.1" opacity="0.6"/>
        <path d="M -40 300 C 90 265, 220 325, 340 300 S 460 280, 520 300" stroke-width="1"   opacity="0.45"/>
        <path d="M -30 360 C 100 325, 230 380, 360 360 S 470 340, 540 360" stroke-width="0.9" opacity="0.3"/>
      </g>
    </svg>
  `;
  return React.createElement("div", {
    style: {
      position: "absolute",
      top: 0, left: 0, right: 0, height: 640,
      pointerEvents: "none",
    },
    dangerouslySetInnerHTML: { __html: svg },
  });
};

/* ---------------------- Full-screen background -------------------------- */
export const Background = () => {
  // Option A: custom image (Hybrid mode — when BG_SOURCE is set)
  if (BG_SOURCE) {
    return (
      <>
        <Image
          source={BG_SOURCE}
          resizeMode="cover"
          fadeDuration={0}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Softening wash — reduces image saturation/intensity */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(255,255,255,0.35)" },
          ]}
        />
      </>
    );
  }

  // Option C: fallback — SVG silk curves + LinearGradient (zero network)
  return (
    <>
      <LinearGradient
        colors={[C.bgTop, C.bgUpper, C.bgMid, C.bgLower, C.bgBot]}
        locations={[0, 0.25, 0.5, 0.72, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <SilkCurves />
      <View
        pointerEvents="none"
        style={[
          {
            position: "absolute", bottom: -40, right: -40,
            width: 300, height: 300, borderRadius: 150,
            backgroundColor: "rgba(118,185,196,0.22)",
          },
          Platform.OS === "web" ? ({ filter: "blur(80px)" } as any) : null,
        ]}
      />
    </>
  );
};

/* ------------------- Fake iOS status bar (desktop preview) --------------- */
export const FakeStatusBar = () => (
  <View style={st.row}>
    <Text style={st.time}>9:41</Text>
    <View style={{ flex: 1 }} />
    <View style={st.cluster}>
      <Ionicons name="cellular" size={14} color={C.deepTeal} />
      <Ionicons name="wifi" size={14} color={C.deepTeal} />
      <Ionicons name="battery-full" size={17} color={C.deepTeal} />
    </View>
  </View>
);

const st = StyleSheet.create({
  row: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 2, height: 42,
  },
  time: { fontFamily: FONT, fontSize: 16, fontWeight: "700", color: C.deepTeal },
  cluster: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
});
