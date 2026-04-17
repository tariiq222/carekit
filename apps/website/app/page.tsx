'use client';

import { useBranding } from '@/features/branding/public';

export default function HomePage() {
  const branding = useBranding();

  return (
    <main style={{ padding: '2rem' }}>
      <h1 style={{ color: 'var(--primary)' }}>
        {branding.organizationNameAr}
      </h1>
      {branding.productTagline ? (
        <p style={{ color: 'var(--primary-dark)' }}>{branding.productTagline}</p>
      ) : null}
      <p>
        تم جلب الهوية من <code>/api/public/branding</code> في SSR — أي تغيير في لوحة التحكم ينعكس على الصفحة التالية.
      </p>
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          borderRadius: '0.5rem',
          background: 'var(--primary)',
          color: 'white',
        }}
      >
        لون أساسي: {branding.colorPrimary ?? '(افتراضي)'}
      </div>
      <div
        style={{
          marginTop: '0.5rem',
          padding: '1rem',
          borderRadius: '0.5rem',
          background: 'var(--accent)',
          color: 'black',
        }}
      >
        لون مميّز: {branding.colorAccent ?? '(افتراضي)'}
      </div>
    </main>
  );
}
