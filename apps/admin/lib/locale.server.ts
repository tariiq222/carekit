import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from './locale';

export async function readLocaleCookie(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value === 'ar' || value === 'en') return value;
  return DEFAULT_LOCALE;
}
