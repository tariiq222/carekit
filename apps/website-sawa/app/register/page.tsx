import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/register',
    titleAr: 'إنشاء حساب',
    descriptionAr: 'أنشئ حسابك خلال دقيقة لحجز جلساتك ومتابعة مواعيدك من أي جهاز.',
  });
}

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
