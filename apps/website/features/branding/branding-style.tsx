import type { PublicBranding } from '@deqah/shared';

const DEFAULTS: Record<string, string> = {
  '--primary': '#354FD8',
  '--primary-light': '#5B72E8',
  '--primary-dark': '#2438B0',
  '--accent': '#82CC17',
  '--accent-dark': '#5A9010',
  '--bg': '#EEF1F8',
  '--font-primary': "'IBM Plex Sans Arabic', system-ui, sans-serif",
};

export function BrandingStyle({ branding }: { branding: PublicBranding }) {
  const vars: Record<string, string> = {
    '--primary': branding.colorPrimary ?? DEFAULTS['--primary']!,
    '--primary-light': branding.colorPrimaryLight ?? DEFAULTS['--primary-light']!,
    '--primary-dark': branding.colorPrimaryDark ?? DEFAULTS['--primary-dark']!,
    '--accent': branding.colorAccent ?? DEFAULTS['--accent']!,
    '--accent-dark': branding.colorAccentDark ?? DEFAULTS['--accent-dark']!,
    '--bg': branding.colorBackground ?? DEFAULTS['--bg']!,
    '--font-primary': branding.fontFamily
      ? `'${branding.fontFamily}', system-ui, sans-serif`
      : DEFAULTS['--font-primary']!,
  };

  const css = `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
