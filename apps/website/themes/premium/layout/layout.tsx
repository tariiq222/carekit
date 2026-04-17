import type { ThemeLayoutProps } from '../../types';

export function PremiumLayout({ children }: ThemeLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#f5f5f5',
      }}
    >
      <header
        style={{
          padding: '1.5rem 3rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'rgba(10,10,10,0.8)',
          backdropFilter: 'blur(16px)',
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ letterSpacing: '0.2em', fontSize: '0.75rem' }}>CAREKIT</span>
        <nav style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem' }}>
          <a href="/" style={{ color: '#f5f5f5' }}>Home</a>
          <a href="/therapists" style={{ color: '#f5f5f5' }}>Therapists</a>
          <a href="/contact" style={{ color: '#f5f5f5' }}>Contact</a>
        </nav>
      </header>
      {children}
      <footer
        style={{
          padding: '3rem',
          textAlign: 'center',
          opacity: 0.4,
          fontSize: '0.75rem',
          letterSpacing: '0.2em',
        }}
      >
        PREMIUM · CAREKIT
      </footer>
    </div>
  );
}
