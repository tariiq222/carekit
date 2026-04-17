import { getLocale, LanguageSwitcher } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import type { ThemeLayoutProps } from '../../types';

export async function SawaaLayout({ children }: ThemeLayoutProps) {
  const locale = await getLocale();
  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--primary) 8%, transparent) 100%)',
      }}
    >
      <header
        style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <nav
          style={{
            display: 'flex',
            gap: '1.5rem',
            color: 'var(--primary-dark)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <a href="/">{t(locale, 'nav.home')}</a>
            <a href="/therapists">{t(locale, 'nav.therapists')}</a>
            <a href="/burnout-test">{t(locale, 'nav.burnout')}</a>
            <a href="/contact">{t(locale, 'nav.contact')}</a>
          </div>
          <LanguageSwitcher current={locale} />
        </nav>
      </header>
      {children}
      <footer
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--primary-dark)',
          opacity: 0.7,
        }}
      >
        Sawaa theme · CareKit
      </footer>
    </div>
  );
}
