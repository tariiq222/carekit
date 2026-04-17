import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function BurnoutRoute() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const Page = theme.pages.burnoutTest;
  const Layout = theme.Layout;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
