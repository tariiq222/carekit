import { Platform } from "react-native";

export const C = {
  deepTeal: "#154F57",
  softTeal: "#76B9C4",
  goldFill: "#FFB300",
  goldText: "#8A5A00",
  text: "#154F57",
  subtle: "#3E727A",

  // Background — rich vibrant teal fading to near-white
  bgTop: "#A7DDE5",
  bgUpper: "#C2E6EC",
  bgMid: "#D8EEF1",
  bgLower: "#E8F5F6",
  bgBot: "#F2F9F9",

  // Glass tokens
  glass: "rgba(255,255,255,0.45)",
  glassBrighter: "rgba(255,255,255,0.6)",
  glassBorder: "rgba(255,255,255,0.55)",
  ratingGlass: "rgba(255,255,255,0.85)",

  // Tab + notifications
  activeTab: "rgba(255, 255, 255, 0.72)",
  notifDot: "#E74C3C",

  // Support card tints
  greenTint: "rgba(163,205,160,0.42)",
  greenIconBg: "rgba(111,168,107,0.28)",
  greenIcon: "#5A8A56",
  peachTint: "rgba(231,198,160,0.48)",
  peachIconBg: "rgba(201,138,74,0.28)",
  peachIcon: "#C4833F",
  tealTint: "rgba(180,215,218,0.55)",
  tealIconBg: "rgba(118,185,196,0.32)",
  tealIcon: "#4E8E99",
} as const;

export const FONT = '"IBM Plex Sans Arabic"';

export const RADII = {
  card: 22,
  floating: 30,
  image: 16,
  pill: 999,
} as const;

export const SHADOW =
  Platform.OS === "web"
    ? ({
        boxShadow:
          "0 1px 2px rgba(21,79,87,0.06), 0 3px 6px rgba(21,79,87,0.05), 0 10px 20px rgba(21,79,87,0.07), 0 24px 48px rgba(21,79,87,0.09)",
      } as any)
    : ({
        shadowColor: C.deepTeal,
        shadowOpacity: 0.14,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      } as const);

export const SHADOW_SOFT =
  Platform.OS === "web"
    ? ({
        boxShadow:
          "0 1px 2px rgba(21,79,87,0.05), 0 4px 12px rgba(21,79,87,0.07)",
      } as any)
    : ({
        shadowColor: C.deepTeal,
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      } as const);

export const SHADOW_RAISED =
  Platform.OS === "web"
    ? ({
        boxShadow:
          "0 2px 4px rgba(21,79,87,0.07), 0 6px 14px rgba(21,79,87,0.07), 0 18px 36px rgba(21,79,87,0.10), 0 36px 72px rgba(21,79,87,0.12)",
      } as any)
    : ({
        shadowColor: C.deepTeal,
        shadowOpacity: 0.18,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: 16 },
        elevation: 10,
      } as const);

export const GLASS_WEB =
  Platform.OS === "web"
    ? ({
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.25), 0 10px 40px rgba(21,79,87,0.14)",
      } as any)
    : null;

export const GLASS_WEB_STRONG =
  Platform.OS === "web"
    ? ({
        backdropFilter: "blur(40px) saturate(200%)",
        WebkitBackdropFilter: "blur(40px) saturate(200%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.3), 0 14px 46px rgba(21,79,87,0.18)",
      } as any)
    : null;

export const INTERACTIVE_WEB =
  Platform.OS === "web"
    ? ({
        transition: "transform 220ms cubic-bezier(0.2, 0.9, 0.25, 1), box-shadow 220ms",
        cursor: "pointer",
      } as any)
    : null;

export const EASE = {
  standard: "cubic-bezier(0.2, 0.9, 0.25, 1)",
  stage: "cubic-bezier(0.32, 0.72, 0.15, 1)",
} as const;

export const DURATION = { short: 220, medium: 360 } as const;

type Variant = "regular" | "strong" | "clear";

type Cfg = {
  mainBlur: number;
  mainTintAlpha: number;
  baseTintAlpha: number;
  bloomAlpha: number;
  borderAlpha: number;
  nativeBlur: number;
};

export const GLASS_CFG: Record<Variant, Cfg> = {
  clear:   { mainBlur: 30, mainTintAlpha: 0.04, baseTintAlpha: 0.12, bloomAlpha: 0.22, borderAlpha: 0.36, nativeBlur: 58 },
  regular: { mainBlur: 50, mainTintAlpha: 0.06, baseTintAlpha: 0.20, bloomAlpha: 0.32, borderAlpha: 0.45, nativeBlur: 82 },
  strong:  { mainBlur: 65, mainTintAlpha: 0.09, baseTintAlpha: 0.28, bloomAlpha: 0.42, borderAlpha: 0.55, nativeBlur: 95 },
};
