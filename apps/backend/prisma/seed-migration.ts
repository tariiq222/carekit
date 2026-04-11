import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface OldConfigRow {
  key: string;
  value: string;
}

async function migrate(): Promise<void> {
  console.log('Config migration: EAV → structured tables...');

  // Read old EAV table using raw SQL (renamed to white_label_config_old before running this)
  const oldRows = await prisma.$queryRawUnsafe<OldConfigRow[]>(
    `SELECT key, value FROM white_label_config_old`,
  );

  if (oldRows.length === 0) {
    console.log('No old config rows found. Skipping migration.');
    return;
  }

  const map = Object.fromEntries(oldRows.map((r) => [r.key, r.value]));
  const get = (key: string): string | null => map[key] || null;
  const getBool = (key: string, fallback: boolean): boolean => {
    const v = map[key];
    if (v === 'true') return true;
    if (v === 'false') return false;
    return fallback;
  };

  // 1. WhiteLabelConfig
  await prisma.whiteLabelConfig.create({
    data: {
      systemName: get('system_name') ?? 'CareKit Clinic',
      systemNameAr: get('system_name_ar') ?? 'عيادة كيركت',
      logoUrl: get('logo'),
      faviconUrl: null,
      primaryColor: get('primary_color') ?? '#2563EB',
      secondaryColor: get('secondary_color') ?? '#1E40AF',
      fontFamily: get('font') ?? 'Inter',
      domain: get('domain') ?? 'localhost',
      clinicCanEdit: false,
    },
  });
  console.log('  WhiteLabelConfig migrated');

  // 2. ClinicSettings
  await prisma.clinicSettings.create({
    data: {
      contactPhone: get('contact_phone'),
      contactEmail: get('contact_email'),
      address: get('address'),
      socialMedia: map['social_media'] ? JSON.parse(map['social_media']) : {},
      companyNameAr: get('company_name_ar'),
      companyNameEn: get('company_name_en'),
      businessRegistration: get('business_registration'),
      vatRegistrationNumber: get('vat_registration_number'),
      vatRate: parseInt(map['vat_rate'] ?? '15', 10),
      sellerAddress: get('seller_address'),
      clinicCity: get('clinic_city') ?? 'الرياض',
      postalCode: get('postal_code'),
      aboutAr: get('about_ar'),
      aboutEn: get('about_en'),
      privacyPolicyAr: get('privacy_policy_ar'),
      privacyPolicyEn: get('privacy_policy_en'),
      termsAr: get('terms_ar'),
      termsEn: get('terms_en'),
      cancellationPolicyAr: get('cancellation_policy_ar'),
      cancellationPolicyEn: get('cancellation_policy'),
      defaultLanguage: get('default_language') ?? 'ar',
      timezone: get('timezone') ?? 'Asia/Riyadh',
      weekStartDay: get('week_start_day') ?? 'sunday',
      dateFormat: get('date_format') ?? 'Y-m-d',
      timeFormat: get('time_format') ?? '24h',
      emailHeaderShowLogo: getBool('email_header_show_logo', true),
      emailHeaderShowName: getBool('email_header_show_name', true),
      emailFooterPhone: get('email_footer_phone'),
      emailFooterWebsite: get('email_footer_website'),
      emailFooterInstagram: get('email_footer_instagram'),
      emailFooterTwitter: get('email_footer_twitter'),
      emailFooterSnapchat: get('email_footer_snapchat'),
      emailFooterTiktok: get('email_footer_tiktok'),
      emailFooterLinkedin: get('email_footer_linkedin'),
      emailFooterYoutube: get('email_footer_youtube'),
      sessionDuration: parseInt(map['session_duration'] ?? '30', 10),
      reminderBeforeMinutes: parseInt(map['reminder_before_minutes'] ?? '60', 10),
    },
  });
  console.log('  ClinicSettings migrated');

  // 3. ClinicIntegrations
  await prisma.clinicIntegrations.create({
    data: {
      moyasarPublishableKey: get('moyasar_api_key'),
      moyasarSecretKey: get('moyasar_secret_key'),
      bankName: get('bank_name'),
      bankIban: get('bank_account_iban'),
      bankAccountHolder: get('bank_account_name'),
      zoomClientId: get('zoom_api_key'),
      zoomClientSecret: get('zoom_api_secret'),
      zoomAccountId: null,
      emailProvider: get('email_provider'),
      emailApiKey: get('email_api_key'),
      emailFrom: get('email_from'),
      openrouterApiKey: get('openrouter_api_key'),
      firebaseConfig: map['firebase_config'] ? JSON.parse(map['firebase_config']) : {},
      zatcaPhase: get('zatca_phase') ?? 'phase1',
      zatcaCsid: get('zatca_csid'),
      zatcaSecret: get('zatca_secret'),
      zatcaPrivateKey: get('zatca_private_key'),
      zatcaRequestId: get('zatca_request_id'),
    },
  });
  console.log('  ClinicIntegrations migrated');

  // 4. LicenseConfig — seed from FeatureFlag rows
  const flags = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } });
  const flagMap = Object.fromEntries(flags.map((f) => [f.key, f.enabled]));

  await prisma.licenseConfig.create({
    data: {
      hasCoupons: flagMap['coupons'] ?? true,
      hasGiftCards: flagMap['gift_cards'] ?? true,
      hasIntakeForms: flagMap['intake_forms'] ?? true,
      hasChatbot: flagMap['chatbot'] ?? true,
      hasRatings: flagMap['ratings'] ?? true,
      hasMultiBranch: flagMap['multi_branch'] ?? true,
      hasReports: flagMap['reports'] ?? true,
      hasRecurring: flagMap['recurring'] ?? true,
      hasWalkIn: flagMap['walk_in'] ?? true,
      hasWaitlist: flagMap['waitlist'] ?? true,
      hasZoom: flagMap['zoom'] ?? false,
      hasZatca: flagMap['zatca'] ?? true,
    },
  });
  console.log('  LicenseConfig migrated from FeatureFlag values');

  console.log('Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
