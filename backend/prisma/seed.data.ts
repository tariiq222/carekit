import { ConfigValueType } from '@prisma/client';

// ──────────────────────────────────────────────
// Modules & Actions
// ──────────────────────────────────────────────

export const MODULES = [
  'users',
  'roles',
  'practitioners',
  'bookings',
  'services',
  'payments',
  'invoices',
  'reports',
  'notifications',
  'chatbot',
  'whitelabel',
  'patients',
  'ratings',
] as const;

export const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

// ──────────────────────────────────────────────
// Role Definitions
// ──────────────────────────────────────────────

export interface RoleDefinition {
  name: string;
  slug: string;
  description: string;
  isDefault: boolean;
  isSystem: boolean;
  permissions: Record<string, string[]>;
}

export const ROLES: RoleDefinition[] = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    description: 'Full system access with all permissions',
    isDefault: false,
    isSystem: true,
    permissions: Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])),
  },
  {
    name: 'Receptionist',
    slug: 'receptionist',
    description: 'Front desk staff managing bookings and patients',
    isDefault: false,
    isSystem: true,
    permissions: {
      bookings: ['view', 'create', 'edit'],
      patients: ['view', 'create', 'edit'],
      practitioners: ['view', 'create', 'edit'],
      services: ['view', 'create', 'edit'],
      notifications: ['view', 'create', 'edit'],
      payments: ['view'],
      invoices: ['view'],
    },
  },
  {
    name: 'Accountant',
    slug: 'accountant',
    description: 'Financial staff managing payments, invoices, and reports',
    isDefault: false,
    isSystem: true,
    permissions: {
      payments: ['view', 'create', 'edit'],
      invoices: ['view', 'create', 'edit'],
      reports: ['view', 'create', 'edit'],
      bookings: ['view'],
    },
  },
  {
    name: 'Practitioner',
    slug: 'practitioner',
    description: 'Doctor or specialist providing medical services',
    isDefault: false,
    isSystem: true,
    permissions: {
      bookings: ['view'],
      patients: ['view'],
      ratings: ['view'],
      practitioners: ['view', 'edit'],
    },
  },
  {
    name: 'Patient',
    slug: 'patient',
    description: 'Patient using the clinic services',
    isDefault: true,
    isSystem: true,
    permissions: {
      bookings: ['view', 'create'],
      payments: ['view'],
      invoices: ['view'],
      ratings: ['view', 'create', 'edit'],
      practitioners: ['view'],
      services: ['view'],
    },
  },
];

// ──────────────────────────────────────────────
// Specialties
// ──────────────────────────────────────────────

export const SPECIALTIES = [
  { nameEn: 'General Medicine', nameAr: 'الطب العام', sortOrder: 0 },
  { nameEn: 'Dentistry', nameAr: 'طب الأسنان', sortOrder: 1 },
  { nameEn: 'Dermatology', nameAr: 'الأمراض الجلدية', sortOrder: 2 },
  { nameEn: 'Pediatrics', nameAr: 'طب الأطفال', sortOrder: 3 },
  { nameEn: 'Ophthalmology', nameAr: 'طب العيون', sortOrder: 4 },
  { nameEn: 'Cardiology', nameAr: 'أمراض القلب', sortOrder: 5 },
  { nameEn: 'Orthopedics', nameAr: 'جراحة العظام', sortOrder: 6 },
  { nameEn: 'ENT', nameAr: 'أنف وأذن وحنجرة', sortOrder: 7 },
];

// ──────────────────────────────────────────────
// WhiteLabel Config Defaults
// ──────────────────────────────────────────────

export interface WhiteLabelEntry {
  key: string;
  value: string;
  type: ConfigValueType;
  description: string;
}

export const WHITE_LABEL_DEFAULTS: WhiteLabelEntry[] = [
  // Branding
  { key: 'clinic_name', value: 'CareKit Clinic', type: 'string', description: 'Clinic display name (English)' },
  { key: 'clinic_name_ar', value: 'عيادة كيركت', type: 'string', description: 'Clinic display name (Arabic)' },
  { key: 'logo', value: '', type: 'file', description: 'Clinic logo URL' },
  { key: 'primary_color', value: '#2563EB', type: 'string', description: 'Primary brand color (hex)' },
  { key: 'secondary_color', value: '#1E40AF', type: 'string', description: 'Secondary brand color (hex)' },
  { key: 'font', value: 'Inter', type: 'string', description: 'Primary font family' },
  { key: 'app_name', value: 'CareKit', type: 'string', description: 'Application display name' },
  { key: 'domain', value: 'localhost', type: 'string', description: 'Client domain' },

  // Contact
  { key: 'contact_phone', value: '+966500000000', type: 'string', description: 'Clinic phone number' },
  { key: 'contact_email', value: 'info@carekit.com', type: 'string', description: 'Clinic contact email' },
  { key: 'address', value: '', type: 'string', description: 'Clinic physical address' },
  { key: 'social_media', value: '{}', type: 'json', description: 'Social media links (JSON object)' },

  // Payment
  { key: 'moyasar_api_key', value: '', type: 'string', description: 'Moyasar publishable API key' },
  { key: 'moyasar_secret_key', value: '', type: 'string', description: 'Moyasar secret API key' },
  { key: 'bank_account_name', value: '', type: 'string', description: 'Bank account holder name' },
  { key: 'bank_account_number', value: '', type: 'string', description: 'Bank account number' },
  { key: 'bank_account_iban', value: '', type: 'string', description: 'Bank IBAN number' },

  // Zoom
  { key: 'zoom_api_key', value: '', type: 'string', description: 'Zoom API key' },
  { key: 'zoom_api_secret', value: '', type: 'string', description: 'Zoom API secret' },

  // AI
  { key: 'openrouter_api_key', value: '', type: 'string', description: 'OpenRouter API key for AI chatbot' },

  // Content (AR/EN)
  { key: 'cancellation_policy', value: 'Default cancellation policy', type: 'string', description: 'Cancellation policy text (English)' },
  { key: 'cancellation_policy_ar', value: 'سياسة الإلغاء الافتراضية', type: 'string', description: 'Cancellation policy text (Arabic)' },
  { key: 'about_ar', value: '', type: 'string', description: 'About clinic text (Arabic)' },
  { key: 'about_en', value: '', type: 'string', description: 'About clinic text (English)' },
  { key: 'privacy_policy_ar', value: '', type: 'string', description: 'Privacy policy text (Arabic)' },
  { key: 'privacy_policy_en', value: '', type: 'string', description: 'Privacy policy text (English)' },
  { key: 'terms_ar', value: '', type: 'string', description: 'Terms of service text (Arabic)' },
  { key: 'terms_en', value: '', type: 'string', description: 'Terms of service text (English)' },

  // ZATCA (Saudi e-Invoicing)
  { key: 'zatca_phase', value: 'phase1', type: 'string', description: 'ZATCA phase: phase1 (QR only) | phase2 (API integration)' },
  { key: 'vat_registration_number', value: '', type: 'string', description: 'VAT registration number (15 digits, starts and ends with 3)' },
  { key: 'vat_rate', value: '0', type: 'string', description: 'VAT rate percentage (0 or 15)' },
  { key: 'business_registration', value: '', type: 'string', description: 'Commercial registration number (CR)' },
  { key: 'seller_address', value: '', type: 'string', description: 'Clinic address for invoices' },
  { key: 'clinic_city', value: 'الرياض', type: 'string', description: 'Clinic city for invoices' },

  // Settings
  { key: 'default_language', value: 'ar', type: 'string', description: 'Default language (ar/en)' },
  { key: 'timezone', value: 'Asia/Riyadh', type: 'string', description: 'Clinic timezone' },
  { key: 'session_duration', value: '30', type: 'string', description: 'Default session duration in minutes' },
  { key: 'reminder_before_minutes', value: '60', type: 'string', description: 'Send reminder X minutes before appointment' },
  { key: 'firebase_config', value: '{}', type: 'json', description: 'Firebase FCM configuration (JSON)' },
];
