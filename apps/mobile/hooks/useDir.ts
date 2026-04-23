import { createContext, useContext } from "react";
import { Platform, I18nManager } from "react-native";

export type Locale = "ar" | "en";

export type DirState = {
  locale: Locale;
  isRTL: boolean;
  /**
   * Use for ROWS of localized children. On web, always "row" — the browser
   * mirrors layout via `document.dir`. On native, explicit flip is required.
   */
  row: "row" | "row-reverse";
  /** Opposite of `row` — for rare cases (LTR numbers inside RTL, etc.). */
  rowReverse: "row" | "row-reverse";
  /** Cross-axis alignment hugging the LOGICAL START edge. */
  alignStart: "flex-start" | "flex-end";
  /** Cross-axis alignment hugging the LOGICAL END edge. */
  alignEnd: "flex-start" | "flex-end";
  /** textAlign for localized prose. */
  textAlign: "left" | "right";
  /** writingDirection for Text nodes. */
  writingDirection: "ltr" | "rtl";
  /** scaleX for directional icons (chevrons, arrows). */
  iconScaleX: 1 | -1;
};

const build = (locale: Locale): DirState => {
  const isRTL = locale === "ar";
  const onWeb = Platform.OS === "web";
  // When I18nManager.isRTL is true, React Native auto-mirrors flexDirection:"row".
  // Asking for "row-reverse" in that mode would double-flip back to LTR.
  const nativeAutoMirror = !onWeb && I18nManager.isRTL;
  const wantRTLRow = isRTL && !nativeAutoMirror;
  return {
    locale,
    isRTL,
    row: onWeb ? "row" : wantRTLRow ? "row-reverse" : "row",
    rowReverse: onWeb ? "row-reverse" : wantRTLRow ? "row" : "row-reverse",
    alignStart: onWeb ? "flex-start" : wantRTLRow ? "flex-end" : "flex-start",
    alignEnd: onWeb ? "flex-end" : wantRTLRow ? "flex-start" : "flex-end",
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
    iconScaleX: isRTL ? -1 : 1,
  };
};

export const DirContext = createContext<DirState>(build("ar"));

export const buildDirState = build;

export const useDir = () => useContext(DirContext);
