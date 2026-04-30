import { bilingualLayout, escapeHtml, BRAND } from '../shared';

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x" onerror='b()'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onerror=&#39;b()&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('BRAND', () => {
  it('exposes the Deqah primary color and font', () => {
    expect(BRAND.primary).toBe('#354FD8');
    expect(BRAND.fontFamily).toMatch(/IBM Plex Sans Arabic/);
  });
});

describe('bilingualLayout', () => {
  it('wraps AR + EN halves and respects dir attributes', () => {
    const html = bilingualLayout({ ar: '<p>مرحبا</p>', en: '<p>Hello</p>' });
    expect(html).toMatch(/<!DOCTYPE html>/);
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toMatch(/dir="ltr"/);
    expect(html).toContain('<p>مرحبا</p>');
    expect(html).toContain('<p>Hello</p>');
    // AR half precedes EN half
    expect(html.indexOf('مرحبا')).toBeLessThan(html.indexOf('Hello'));
  });
});
