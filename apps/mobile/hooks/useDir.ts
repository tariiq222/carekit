import { createContext, useContext } from "react";
import { Platform } from "react-native";

export type Locale = "ar" | "en";

export type DirState = {
  locale: Locale;
  isRTL: boolean;
  /**
   * Use for ROWS of localized children. On web, always "row" because the
   * browser mirrors layout through `document.dir`. On native, explicit flip is
   * required.
   */
  row: "row" | "row-reverse";
  /** Opposite of `row` for rare cases such as LTR numbers inside RTL UI. */
  rowReverse: "row" | "row-reverse";
  /** Cross-axis alignment hugging the logical start edge. */
  alignStart: "flex-start" | "flex-end";
  /** Cross-axis alignment hugging the logical end edge. */
  alignEnd: "flex-start" | "flex-end";
  /** textAlign for localized prose. */
  textAlign: "left" | "right";
  /** writingDirection for Text nodes. */
  writingDirection: "ltr" | "rtl";
  /** scaleX for directional icons such as chevrons and arrows. */
  iconScaleX: 1 | -1;
};

const build = (locale: Locale): DirState => {
  const isRTL = locale === "ar";
  const onWeb = Platform.OS === "web";

  return {
    locale,
    isRTL,
    row: onWeb ? "row" : isRTL ? "row-reverse" : "row",
    rowReverse: onWeb ? "row-reverse" : isRTL ? "row" : "row-reverse",
    alignStart: onWeb ? "flex-start" : isRTL ? "flex-end" : "flex-start",
    alignEnd: onWeb ? "flex-end" : isRTL ? "flex-start" : "flex-end",
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
    iconScaleX: isRTL ? -1 : 1,
  };
};

export const DirContext = createContext<DirState>(build("ar"));

export const buildDirState = build;

export const useDir = () => useContext(DirContext);
