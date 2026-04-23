import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * `prefers-reduced-transparency` (web) / `isReduceTransparencyEnabled` (iOS).
 * When true, Liquid Glass surfaces should collapse toward opaque so content
 * behind them doesn't bleed through.
 */
export function useReducedTransparency() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-reduced-transparency: reduce)");
      setOn(mq.matches);
      const handler = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }
    // Native
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => setOn(!!v));
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      (v) => setOn(!!v)
    );
    return () => sub?.remove?.();
  }, []);

  return on;
}

/**
 * `prefers-contrast: more` (web) / `isHighTextContrastEnabled` (iOS).
 * When true, Liquid Glass surfaces should thicken their border + raise the
 * specular highlight so edges are unambiguous.
 */
export function useIncreasedContrast() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-contrast: more)");
      setOn(mq.matches);
      const handler = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }
    // Native — iOS 13+
    (AccessibilityInfo as any).isHighTextContrastEnabled?.()
      .then((v: boolean) => setOn(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "highTextContrastChanged" as any,
      (v: boolean) => setOn(!!v)
    );
    return () => sub?.remove?.();
  }, []);

  return on;
}
