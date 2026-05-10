const AR_TO_LATIN: Record<string, string> = {
  'ا':'a','أ':'a','إ':'a','آ':'a','ى':'a',
  'ب':'b','ت':'t','ث':'th',
  'ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'dh',
  'ر':'r','ز':'z',
  'س':'s','ش':'sh',
  'ص':'s','ض':'d',
  'ط':'t','ظ':'z',
  'ع':'a','غ':'gh',
  'ف':'f','ق':'q',
  'ك':'k','ل':'l',
  'م':'m','ن':'n',
  'ه':'h','ة':'h',
  'و':'w','ؤ':'w',
  'ي':'y','ئ':'y',
  'ء':'',
};

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;
export const SLUG_MIN_LEN = 3;
export const SLUG_MAX_LEN = 30;
export const RESERVED_SUBDOMAINS = new Set([
  'www','api','admin','app','auth','dashboard','login','signup','register',
  'billing','settings','public','static','_next','support','help','docs',
  'cdn','mail','smtp','ftp','ns','mx','staging','status','blog','deqah','root','system',
]);

export function generateSubdomainSafeSlug(input: string): string {
  let s = '';
  for (const ch of input ?? '') s += AR_TO_LATIN[ch] ?? ch;
  s = s.toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length === 0) s = 'org';
  if (s.length > SLUG_MAX_LEN) s = s.slice(0, SLUG_MAX_LEN).replace(/-+$/g, '');
  if (s.length < SLUG_MIN_LEN) s = (s + 'org').slice(0, SLUG_MIN_LEN);
  return SLUG_REGEX.test(s) ? s : 'org';
}

export type SlugValidation = { ok: true } | { ok: false; reason: string };
export function validateSlug(slug: string): SlugValidation {
  if (slug.length < SLUG_MIN_LEN || slug.length > SLUG_MAX_LEN) {
    return { ok: false, reason: `between ${SLUG_MIN_LEN}–${SLUG_MAX_LEN} characters` };
  }
  if (!SLUG_REGEX.test(slug)) return { ok: false, reason: 'lowercase letters, digits, hyphens; no leading/trailing hyphen' };
  if (RESERVED_SUBDOMAINS.has(slug)) return { ok: false, reason: 'this name is reserved' };
  return { ok: true };
}
