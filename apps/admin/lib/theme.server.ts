import 'server-only';
import { cookies } from 'next/headers';
import { THEME_COOKIE, type Theme } from './theme';

export async function readThemeCookie(): Promise<Theme> {
  const cookieStore = await cookies();
  const value = cookieStore.get(THEME_COOKIE)?.value;
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}
