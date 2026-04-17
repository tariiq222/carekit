import type { ThemeLayoutProps } from '../../types';

export function SawaaLayout({ children }: ThemeLayoutProps) {
  return (
    <div
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
        <nav style={{ display: 'flex', gap: '1.5rem', color: 'var(--primary-dark)' }}>
          <a href="/">الرئيسية</a>
          <a href="/therapists">المعالجون</a>
          <a href="/specialties">التخصصات</a>
          <a href="/contact">تواصل معنا</a>
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
