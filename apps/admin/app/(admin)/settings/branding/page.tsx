import { BrandingForm } from '@/features/platform-branding/branding-form';

export default function BrandingSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Branding</h1>
        <p className="text-muted-foreground text-sm">
          Platform brand defaults — logo, colors, and locale settings stored in PlatformSetting.
        </p>
      </div>
      <BrandingForm />
    </div>
  );
}
