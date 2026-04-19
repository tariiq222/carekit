import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function LoginPage() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const LoginComponent = theme.pages.login;
  const Layout = theme.Layout;

  return (
    <Layout>
      <LoginComponent />
    </Layout>
  );
}
