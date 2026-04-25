import { useEffect } from "react";
import { Platform } from "react-native";
import type { Locale } from "./useDir";

export function useWebFont(locale: Locale, isRTL: boolean) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    // One-time font + base style injection
    if (!document.getElementById("ck-web-font")) {
      const link = document.createElement("link");
      link.id = "ck-web-font";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap";
      document.head.appendChild(link);

      const style = document.createElement("style");
      style.id = "ck-web-style";
      style.innerHTML = `
        html, body {
          margin: 0; padding: 0;
          background: #E4ECED;
          font-family: 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        ::-webkit-scrollbar { display: none; }
      `;
      document.head.appendChild(style);
    }

    // Direction + lang — updated whenever locale changes.
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale, isRTL]);
}
