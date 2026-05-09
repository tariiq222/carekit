import { getRequestConfig } from 'next-intl/server';
import { readLocaleCookie } from '@/lib/locale.server';

export default getRequestConfig(async () => {
  const locale = await readLocaleCookie();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
