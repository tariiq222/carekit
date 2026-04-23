import React, { useState } from "react";
import {
  View,
  Pressable,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  GlassView,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useReducedTransparency, useIncreasedContrast } from "../../hooks/useA11y";
import { GLASS_CFG } from "../glass";

// Cache at module load — availability cannot change during a session.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

// Map our DS variants → native liquid-glass styles.
// Native only exposes "clear" / "regular" / "none"; "strong" intentionally
// collapses to "regular" because the native effect already reads heavier
// than our BlurView fallback at the same nominal intensity.
const NATIVE_STYLE: Record<"regular" | "strong" | "clear", "regular" | "clear"> = {
  clear: "clear",
  regular: "regular",
  strong: "regular",
};

type Variant = "regular" | "strong" | "clear";

type Cfg = {
  mainBlur: number;
  mainTintAlpha: number;
  baseTintAlpha: number;
  bloomAlpha: number;
  borderAlpha: number;
  nativeBlur: number;
};

function applyA11y(cfg: Cfg, reduceT: boolean, increaseC: boolean): Cfg {
  let out = { ...cfg };
  if (reduceT) {
    out.baseTintAlpha = 0.85;
    out.mainTintAlpha = 0.45;
    out.bloomAlpha = 0;
    out.mainBlur = 0;
    out.nativeBlur = 0;
  }
  if (increaseC) {
    out.borderAlpha = Math.min(0.95, out.borderAlpha * 1.8);
  }
  return out;
}

type GlassProps = {
  variant?: Variant;
  tint?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  pressed?: boolean;
  accessibilityLabel?: string;
};

export const Glass = ({
  variant = "regular",
  tint,
  radius = 24,
  style,
  children,
  interactive,
  onPress,
  pressed: pressedOverride,
  accessibilityLabel,
}: GlassProps) => {
  const reduceTransparency = useReducedTransparency();
  const increaseContrast = useIncreasedContrast();
  const cfg = applyA11y(GLASS_CFG[variant], reduceTransparency, increaseContrast);

  const [pressedInternal, setPressedInternal] = useState(false);
  const pressed = pressedOverride ?? pressedInternal;

  const flat = StyleSheet.flatten(style) ?? {};
  // Forward layout-affecting props to the content view so children
  // (e.g. row inputs with icons) receive the correct flexDirection/gap.
  const contentCenter = {
    ...(flat.alignItems != null ? { alignItems: flat.alignItems } : {}),
    ...(flat.justifyContent != null ? { justifyContent: flat.justifyContent } : {}),
    ...(flat.flexDirection != null ? { flexDirection: flat.flexDirection } : {}),
    ...(flat.gap != null ? { gap: flat.gap } : {}),
    ...(flat.rowGap != null ? { rowGap: flat.rowGap } : {}),
    ...(flat.columnGap != null ? { columnGap: flat.columnGap } : {}),
  };

  const pressTransform: ViewStyle | undefined =
    (interactive || onPress) && pressed
      ? { transform: [{ scale: 0.97 }] }
      : undefined;

  const wrapperTransition: any =
    Platform.OS === "web" && (interactive || onPress)
      ? {
          transition:
            "transform 220ms cubic-bezier(0.2,0.9,0.25,1), box-shadow 220ms",
          cursor: "pointer",
        }
      : null;

  // Progressive enhancement: iOS 26+ renders a native UIVisualEffectView.
  // Reduce-transparency a11y forces the CSS fallback (flat surface) instead.
  const useLiquidGlass = HAS_LIQUID_GLASS && !reduceTransparency;

  const body = (
    <>
      {useLiquidGlass ? (
        <GlassView
          glassEffectStyle={NATIVE_STYLE[variant]}
          tintColor={tint}
          isInteractive={!!(interactive || onPress)}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius },
          ]}
        />
      ) : Platform.OS === "web" ? null : (
        <AppleGlassLayers cfg={cfg} radius={radius} tint={tint} pressed={pressed} />
      )}

      {Platform.OS === "web" && !useLiquidGlass ? <WebLayers cfg={cfg} radius={radius} tint={tint} pressed={pressed} /> : null}

      <View style={[
        { flex: 1, position: "relative", zIndex: 1 },
        contentCenter,
      ]}>{children}</View>
    </>
  );

  const wrapperStyle = [
    { borderRadius: radius, position: "relative" as const },
    Platform.OS !== "web" && { overflow: "hidden" as const },
    style,
    pressTransform,
    wrapperTransition,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressedInternal(true)}
        onPressOut={() => setPressedInternal(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={wrapperStyle}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={wrapperStyle}>{body}</View>;
};

function AppleGlassLayers({
  cfg,
  radius,
  tint,
  pressed,
}: {
  cfg: Cfg;
  radius: number;
  tint?: string;
  pressed: boolean;
}) {
  // Specular alpha: derived from border alpha — light reflected off glass surface
  const specularAlpha = cfg.borderAlpha * 0.65;
  const topEdgeAlpha = Math.min(0.92, cfg.borderAlpha * 1.75);

  return (
    <>
      {/* 1 — backdrop blur + base white tint */}
      <BlurView
        intensity={cfg.nativeBlur}
        tint="light"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: `rgba(255,255,255,${cfg.mainTintAlpha + 0.12})` },
        ]}
      />

      {/* 2 — specular gradient: simulates light hitting glass from above */}
      <LinearGradient
        colors={[`rgba(255,255,255,${specularAlpha})`, "rgba(255,255,255,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { bottom: "55%" }]}
      />

      {/* 3 — top-edge highlight line (brightest glass edge) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: `rgba(255,255,255,${topEdgeAlpha})`,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        }}
      />

      {/* 4 — outer glass border (sides + bottom) */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${cfg.borderAlpha + 0.08})`,
          },
        ]}
      />

      {/* 5 — bottom depth edge: grounds the surface in 3D space */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(21,79,87,0.07)",
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
        }}
      />

      {/* 6 — press flash */}
      {pressed ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius },
          ]}
        />
      ) : null}

      {/* 7 — optional tint overlay */}
      {tint ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]}
        />
      ) : null}
    </>
  );
}

function WebLayers({
  cfg,
  radius,
  tint,
  pressed,
}: {
  cfg: Cfg;
  radius: number;
  tint?: string;
  pressed: boolean;
}) {
  const abs = (extra: any): any => ({
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: "none",
    ...extra,
  });

  const baseAlpha = pressed ? cfg.baseTintAlpha + 0.05 : cfg.baseTintAlpha;

  return (
    <View
      style={abs({
        borderRadius: radius,
        overflow: "hidden",
        isolation: "isolate",
      })}
    >
      <View style={abs({ backgroundColor: `rgba(255,255,255,${baseAlpha})` })} />
      <View
        style={abs({
          backgroundColor: `rgba(255,255,255,${cfg.mainTintAlpha})`,
          backdropFilter: `blur(${cfg.mainBlur}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${cfg.mainBlur}px) saturate(180%)`,
        })}
      />
      {cfg.bloomAlpha > 0 ? (
        <View
          style={abs({
            left: 5,
            right: 5,
            top: 6,
            bottom: 6,
            backgroundColor: `rgba(255,255,255,${cfg.bloomAlpha})`,
            filter: "blur(3px)",
            borderRadius: radius,
          })}
        />
      ) : null}
      <View
        style={abs({
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0) 72%)",
          opacity: pressed ? 1 : 0,
          transform: `scale(${pressed ? 1 : 0.6})`,
          transition: "opacity 240ms ease-out, transform 340ms cubic-bezier(0.2,0.9,0.25,1)",
          mixBlendMode: "plus-lighter",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: pressed
            ? "inset 0 2px 10px rgba(21,79,87,0.18), inset 0 0 0 1px rgba(21,79,87,0.08)"
            : "inset 0 0 0 rgba(0,0,0,0)",
          transition: "box-shadow 220ms ease-out",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          top: 0,
          bottom: "60%",
          left: 0,
          right: 0,
          backgroundColor: "rgba(255,255,255,0.15)",
          backgroundBlendMode: "overlay",
          filter: "blur(6px)",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: "inset 0 0 0 1px rgba(21,79,87,0.08)",
          mixBlendMode: "multiply",
          filter: "blur(4px)",
        })}
      />
      <View
        style={abs({
          boxShadow:
            "inset 0 2px 6px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(255,255,255,0.2)",
          mixBlendMode: "plus-lighter",
          filter: "blur(1.5px)",
        })}
      />
      <View
        style={abs({
          border: `1px solid rgba(255,255,255,${cfg.borderAlpha})`,
          mixBlendMode: "plus-lighter",
          borderRadius: radius,
        })}
      />
      {tint ? <View style={abs({ backgroundColor: tint })} /> : null}
    </View>
  );
}
