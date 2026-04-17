'use client';

import { useBranding } from '@/features/branding/public';

export function SawaaHomePage() {
  const branding = useBranding();

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 960, margin: '0 auto' }}>
      <section style={{ textAlign: 'center', padding: '4rem 0' }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            color: 'var(--primary-dark)',
            margin: 0,
          }}
        >
          {branding.organizationNameAr}
        </h1>
        {branding.productTagline ? (
          <p
            style={{
              fontSize: '1.25rem',
              color: 'var(--primary)',
              marginTop: '1rem',
            }}
          >
            {branding.productTagline}
          </p>
        ) : null}
        <button
          style={{
            marginTop: '2rem',
            padding: '0.875rem 2rem',
            borderRadius: '9999px',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 30%, transparent)',
          }}
        >
          احجز جلستك
        </button>
      </section>

      <section style={{ padding: '3rem 0' }}>
        <h2 style={{ color: 'var(--primary-dark)' }}>لماذا نحن</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem',
          }}
        >
          {['خبرة معتمدة', 'سرية تامة', 'مرونة في المواعيد'].map((t) => (
            <article
              key={t}
              style={{
                padding: '1.5rem',
                borderRadius: '1rem',
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid color-mix(in srgb, var(--primary) 12%, transparent)',
              }}
            >
              <h3 style={{ color: 'var(--primary)', marginTop: 0 }}>{t}</h3>
              <p style={{ margin: 0, color: '#333' }}>
                نصّ توضيحي مؤقّت — يُستبدل بمحتوى المرحلة 1.5.
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
