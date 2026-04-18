import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function RegisterPage() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const RegisterComponent = theme.pages.register;
  const Layout = theme.Layout;

  return (
    <Layout>
      <RegisterComponent />
    </Layout>
  );
}
