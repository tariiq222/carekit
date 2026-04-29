import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * RTL-native enforcement for the mobile app.
 *
 * This build is single-tenant Arabic-only. `I18nManager.forceRTL(true)`
 * is set at boot in `i18n/index.ts`, so the RN layout engine auto-flips
 * `flexDirection: 'row'` and resolves `marginStart`/`marginEnd` /
 * `paddingStart`/`paddingEnd` / `start`/`end` to the correct physical edge.
 *
 * Physical directional props (`marginLeft`, `paddingRight`, etc.) and
 * literal `textAlign: 'left'` / `'right'` defeat that auto-flip and
 * are the historical source of every RTL bug in this codebase. They are
 * banned. Use:
 *   - logical style props: `marginStart/End`, `paddingStart/End`, `start/end`
 *   - the <RText> primitive for Arabic text (handles `writingDirection: 'rtl'`)
 *   - the <Row> primitive for horizontal layouts
 *   - the <DirectionalIcon> primitive for chevrons / arrows
 */
const rtlNativeRules = {
  files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Property[key.name='marginLeft']",
        message:
          'Use `marginStart` instead of `marginLeft` — RTL auto-flip needs logical props.',
      },
      {
        selector: "Property[key.name='marginRight']",
        message:
          'Use `marginEnd` instead of `marginRight` — RTL auto-flip needs logical props.',
      },
      {
        selector: "Property[key.name='paddingLeft']",
        message:
          'Use `paddingStart` instead of `paddingLeft` — RTL auto-flip needs logical props.',
      },
      {
        selector: "Property[key.name='paddingRight']",
        message:
          'Use `paddingEnd` instead of `paddingRight` — RTL auto-flip needs logical props.',
      },
      {
        selector:
          "Property[key.name='flexDirection'][value.value='row-reverse']",
        message:
          "`flexDirection: 'row-reverse'` double-flips under forceRTL(true). Use `'row'` (or the <Row> primitive) — the platform mirrors it.",
      },
      {
        selector: "Property[key.name='textAlign'][value.value='left']",
        message:
          'Avoid hardcoded `textAlign: \'left\'` in this Arabic-only build. Use <RText> (default `align="start"`) or `align="end"` for logical-end alignment.',
      },
      {
        selector: "Property[key.name='textAlign'][value.value='right']",
        message:
          'Avoid hardcoded `textAlign: \'right\'`. Use <RText> — it sets `textAlign: \'right\'` + `writingDirection: \'rtl\'` together (the latter is required for correct mixed-script bidi).',
      },
    ],
  },
};

const eslintConfig = defineConfig([
  rtlNativeRules,
  globalIgnores([
    'node_modules/**',
    'android/**',
    'ios/**',
    '.expo/**',
    'scripts/**',
    'hooks/useDir.ts',
    'theme/rtl.ts',
    'components/ui/RText.tsx',
    'components/ui/Row.tsx',
  ]),
]);

export default eslintConfig;
