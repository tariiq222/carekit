
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
  'coupons',
  'branches',
  'intake_forms',
  'gift-cards',
  'activity-log',
  'departments',
  'license',
  'clinic-settings',
  'clinic-integrations',
  'feature-flags',
  'groups',
] as const;

export const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

// ──────────────────────────────────────────────
// Extra permissions beyond the standard MODULES × ACTIONS matrix
// These are granular permissions for specific features
// ──────────────────────────────────────────────

export interface ExtraPermission {
  module: string;
  action: string;
  description: string;
  descriptionAr: string;
}

export const EXTRA_PERMISSIONS: ExtraPermission[] = [
  // notifications — update (mark as read / dismiss)
  {
    module: 'notifications',
    action: 'update',
    description: 'Mark notifications as read or update their state',
    descriptionAr: 'تحديث حالة الإشعارات (قراءة / إخفاء)',
  },
  // chatbot — use (send messages, start sessions)
  {
    module: 'chatbot',
    action: 'use',
    description: 'Use the chatbot — send messages and start sessions',
    descriptionAr: 'استخدام الشات بوت — إرسال رسائل وبدء جلسات',
  },
  // practitioners — favorites
  {
    module: 'practitioners',
    action: 'favorites:view',
    description: 'View favorite practitioners list',
    descriptionAr: 'عرض قائمة الأطباء المفضلين',
  },
  {
    module: 'practitioners',
    action: 'favorites:edit',
    description: 'Add or remove practitioners from favorites',
    descriptionAr: 'إضافة أو إزالة الأطباء من المفضلة',
  },
];

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
    permissions: {
      ...Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])),
      // Extra permissions
      notifications: ['view', 'create', 'edit', 'delete', 'update'],
      chatbot: ['view', 'create', 'edit', 'delete', 'use'],
      practitioners: ['view', 'create', 'edit', 'delete', 'favorites:view', 'favorites:edit'],
    },
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Clinic manager with full access except white-label and role management',
    isDefault: false,
    isSystem: true,
    permissions: {
      ...Object.fromEntries(
        MODULES.filter((m) => m !== 'whitelabel' && m !== 'roles' && m !== 'license').map((m) => [m, [...ACTIONS]]),
      ),
      license: ['view'],
      // Extra permissions
      notifications: ['view', 'create', 'edit', 'delete', 'update'],
      chatbot: ['view', 'create', 'edit', 'delete', 'use'],
      practitioners: ['view', 'create', 'edit', 'delete', 'favorites:view', 'favorites:edit'],
    },
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
      departments: ['view'],
      branches: ['view'],
      'gift-cards': ['view'],
      groups: ['view', 'create', 'edit'],
      notifications: ['view', 'create', 'edit', 'update'],
      payments: ['view'],
      invoices: ['view'],
      coupons: ['view'],
      chatbot: ['use'],
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
      coupons: ['view', 'create', 'edit', 'delete'],
      notifications: ['view', 'update'],
      departments: ['view'],
      chatbot: ['use'],
    },
  },
  {
    name: 'Practitioner',
    slug: 'practitioner',
    description: 'Doctor or specialist providing medical services',
    isDefault: false,
    isSystem: true,
    permissions: {
      bookings: ['view', 'edit'],
      patients: ['view'],
      ratings: ['view'],
      practitioners: ['view', 'edit'],
      departments: ['view'],
      notifications: ['view', 'update'],
      chatbot: ['use'],
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
      payments: ['view', 'create'],
      invoices: ['view'],
      ratings: ['view', 'create', 'edit'],
      practitioners: ['view', 'favorites:view', 'favorites:edit'],
      services: ['view'],
      departments: ['view'],
      groups: ['view', 'create'],
      notifications: ['view', 'update'],
      chatbot: ['use'],
    },
  },
];

// ──────────────────────────────────────────────
// WhiteLabel Config Defaults (branding — CareKit controls)
// ──────────────────────────────────────────────

export const WHITELABEL_DEFAULTS = {
  systemName: 'CareKit Clinic',
  systemNameAr: 'عيادة كيركت',
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  primaryColor: '#2563EB',
  secondaryColor: '#1E40AF',
  fontFamily: 'Inter',
  domain: 'localhost',
  clinicCanEdit: false,
};

// ──────────────────────────────────────────────
// License Config Defaults (feature availability — CareKit controls)
// ──────────────────────────────────────────────

export const LICENSE_DEFAULTS = {
  hasCoupons: true,
  hasGiftCards: true,
  hasIntakeForms: true,
  hasChatbot: true,
  hasRatings: true,
  hasMultiBranch: true,
  hasReports: true,
  hasRecurring: true,
  hasWalkIn: true,
  hasWaitlist: true,
  hasZoom: false,
  hasZatca: true,
  hasDepartments: true,
  hasGroupSessions: true,
  hasCourses: true,
};

// ──────────────────────────────────────────────
// Clinic Settings Defaults (clinic controls after delivery)
// ──────────────────────────────────────────────

export const CLINIC_SETTINGS_DEFAULTS = {
  companyNameAr: null as string | null,
  companyNameEn: null as string | null,
  businessRegistration: null as string | null,
  vatRegistrationNumber: null as string | null,
  vatRate: 15,
  sellerAddress: null as string | null,
  clinicCity: 'الرياض',
  postalCode: null as string | null,
  contactPhone: '+966500000000',
  contactEmail: 'info@carekit.com',
  address: null as string | null,
  socialMedia: {},
  aboutAr: null as string | null,
  aboutEn: null as string | null,
  privacyPolicyAr: null as string | null,
  privacyPolicyEn: null as string | null,
  termsAr: null as string | null,
  termsEn: null as string | null,
  cancellationPolicyAr: 'يجب إلغاء الحجز قبل 24 ساعة على الأقل من موعد الزيارة.',
  cancellationPolicyEn: 'Cancellations must be made at least 24 hours before the appointment.',
  defaultLanguage: 'ar',
  timezone: 'Asia/Riyadh',
  weekStartDay: 'sunday',
  dateFormat: 'Y-m-d',
  timeFormat: '24h',
  emailHeaderShowLogo: true,
  emailHeaderShowName: true,
  emailFooterPhone: null as string | null,
  emailFooterWebsite: null as string | null,
  emailFooterInstagram: null as string | null,
  emailFooterTwitter: null as string | null,
  emailFooterSnapchat: null as string | null,
  emailFooterTiktok: null as string | null,
  emailFooterLinkedin: null as string | null,
  emailFooterYoutube: null as string | null,
  sessionDuration: 30,
  reminderBeforeMinutes: 60,
};

// ──────────────────────────────────────────────
// Clinic Integrations Defaults (clinic controls — API keys)
// ──────────────────────────────────────────────

export const CLINIC_INTEGRATIONS_DEFAULTS = {
  moyasarPublishableKey: null as string | null,
  moyasarSecretKey: null as string | null,
  bankName: null as string | null,
  bankIban: null as string | null,
  bankAccountHolder: null as string | null,
  zoomClientId: null as string | null,
  zoomClientSecret: null as string | null,
  zoomAccountId: null as string | null,
  emailProvider: null as string | null,
  emailApiKey: null as string | null,
  emailFrom: null as string | null,
  openrouterApiKey: null as string | null,
  firebaseConfig: {},
  zatcaPhase: 'phase1',
  zatcaCsid: null as string | null,
  zatcaSecret: null as string | null,
  zatcaPrivateKey: null as string | null,
  zatcaRequestId: null as string | null,
};

// ──────────────────────────────────────────────
// Feature Flags
// ──────────────────────────────────────────────

export interface FeatureFlagDefinition {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  enabled: boolean;
}

export const FEATURE_FLAGS: FeatureFlagDefinition[] = [
  // Modules
  { key: 'coupons', nameEn: 'Coupons', nameAr: 'الكوبونات', descriptionEn: 'Enable coupon creation and redemption', descriptionAr: 'تفعيل إنشاء واستخدام الكوبونات', enabled: true },
  { key: 'gift_cards', nameEn: 'Gift Cards', nameAr: 'بطاقات الهدايا', descriptionEn: 'Enable gift card purchase and redemption', descriptionAr: 'تفعيل شراء واستخدام بطاقات الهدايا', enabled: true },
  { key: 'intake_forms', nameEn: 'Intake Forms', nameAr: 'نماذج المعلومات', descriptionEn: 'Enable patient intake forms before appointments', descriptionAr: 'تفعيل نماذج المعلومات قبل المواعيد', enabled: true },
  { key: 'chatbot', nameEn: 'AI Chatbot', nameAr: 'الشات بوت', descriptionEn: 'Enable AI-powered patient assistant', descriptionAr: 'تفعيل المساعد الذكي للمرضى', enabled: true },
  { key: 'ratings', nameEn: 'Ratings & Reviews', nameAr: 'التقييمات', descriptionEn: 'Enable patient ratings and reviews', descriptionAr: 'تفعيل تقييمات المرضى', enabled: true },
  { key: 'multi_branch', nameEn: 'Multi-Branch', nameAr: 'تعدد الفروع', descriptionEn: 'Enable multiple clinic branches', descriptionAr: 'تفعيل إدارة فروع متعددة', enabled: true },
  { key: 'reports', nameEn: 'Reports', nameAr: 'التقارير', descriptionEn: 'Enable analytics and reports dashboard', descriptionAr: 'تفعيل لوحة التقارير والتحليلات', enabled: true },
  // Booking features
  { key: 'recurring', nameEn: 'Recurring Bookings', nameAr: 'الحجز المتكرر', descriptionEn: 'Allow patients to book recurring appointments', descriptionAr: 'السماح للمرضى بحجز مواعيد متكررة', enabled: true },
  { key: 'walk_in', nameEn: 'Walk-in', nameAr: 'الحضور بدون موعد', descriptionEn: 'Allow staff to register walk-in patients', descriptionAr: 'السماح للموظفين بتسجيل المرضى الحاضرين بدون موعد', enabled: true },
  { key: 'waitlist', nameEn: 'Waitlist', nameAr: 'قائمة الانتظار', descriptionEn: 'Allow patients to join a waitlist when slots are full', descriptionAr: 'السماح للمرضى بالانضمام لقائمة انتظار عند امتلاء المواعيد', enabled: true },
  { key: 'zoom', nameEn: 'Zoom Video Calls', nameAr: 'مكالمات Zoom', descriptionEn: 'Auto-generate Zoom links for video consultations', descriptionAr: 'إنشاء روابط Zoom تلقائياً للاستشارات المرئية', enabled: false },
  // Compliance
  { key: 'zatca', nameEn: 'ZATCA / Fatoora', nameAr: 'ZATCA / فاتورة', descriptionEn: 'Enable Saudi e-invoicing compliance (ZATCA)', descriptionAr: 'تفعيل الامتثال للفوترة الإلكترونية السعودية', enabled: true },
  // Organizational
  { key: 'departments', nameEn: 'Departments', nameAr: 'الأقسام', descriptionEn: 'Enable department-based organization for services', descriptionAr: 'تفعيل تنظيم الخدمات حسب الأقسام', enabled: false },
  // Group features
  { key: 'groups', nameEn: 'Groups', nameAr: 'المجموعات', descriptionEn: 'Group therapy sessions and training courses', descriptionAr: 'جلسات جماعية ودورات تدريبية', enabled: true },
];

// ──────────────────────────────────────────────
// Email Templates
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Specialties
// ──────────────────────────────────────────────

export interface SpecialtyDefinition {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  sortOrder: number;
}

export const SPECIALTIES: SpecialtyDefinition[] = [
  { nameEn: 'General Medicine', nameAr: 'طب عام', descriptionEn: 'Primary care and general health', descriptionAr: 'الرعاية الصحية الأولية والعامة', sortOrder: 0 },
  { nameEn: 'Dermatology', nameAr: 'أمراض جلدية', descriptionEn: 'Skin, hair and nail conditions', descriptionAr: 'أمراض الجلد والشعر والأظافر', sortOrder: 2 },
  { nameEn: 'Pediatrics', nameAr: 'طب أطفال', descriptionEn: 'Healthcare for infants, children and adolescents', descriptionAr: 'رعاية الرضع والأطفال والمراهقين', sortOrder: 3 },
  { nameEn: 'Dentistry', nameAr: 'طب أسنان', descriptionEn: 'Oral health and dental care', descriptionAr: 'صحة الفم والعناية بالأسنان', sortOrder: 4 },
  { nameEn: 'Cardiology', nameAr: 'أمراض القلب', descriptionEn: 'Heart and cardiovascular system disorders', descriptionAr: 'أمراض القلب والجهاز القلبي الوعائي', sortOrder: 5 },
  { nameEn: 'Orthopedics', nameAr: 'العظام والمفاصل', descriptionEn: 'Musculoskeletal system and sports injuries', descriptionAr: 'الجهاز العضلي الهيكلي وإصابات الملاعب', sortOrder: 6 },
  { nameEn: 'Ophthalmology', nameAr: 'طب العيون', descriptionEn: 'Eye and vision care', descriptionAr: 'العناية بالعين والبصر', sortOrder: 7 },
  { nameEn: 'Psychiatry', nameAr: 'الطب النفسي', descriptionEn: 'Mental health and behavioral disorders', descriptionAr: 'الصحة النفسية واضطرابات السلوك', sortOrder: 8 },
];

// ──────────────────────────────────────────────
// Email Templates
// ──────────────────────────────────────────────

export const EMAIL_TEMPLATES = [
  {
    slug: 'otp-login',
    nameEn: 'OTP Login',
    nameAr: 'رمز تسجيل الدخول',
    subjectEn: 'Your Login Code',
    subjectAr: 'رمز تسجيل الدخول',
    bodyEn: 'Hi {{firstName}},\n\nYour login verification code is: {{code}}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.',
    bodyAr: '{{firstName}} ,مرحبا\n\n{{code}} :رمز التحقق لتسجيل الدخول هو\n\n.صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد',
    variables: ['firstName', 'code'],
  },
  {
    slug: 'otp-reset',
    nameEn: 'Password Reset',
    nameAr: 'إعادة تعيين كلمة المرور',
    subjectEn: 'Password Reset Code',
    subjectAr: 'رمز إعادة تعيين كلمة المرور',
    bodyEn: 'Hi {{firstName}},\n\nYour password reset code is: {{code}}\n\nThis code expires in 10 minutes.',
    bodyAr: '{{firstName}} ,مرحبا\n\n{{code}} :رمز إعادة تعيين كلمة المرور هو\n\n.صالح لمدة 10 دقائق',
    variables: ['firstName', 'code'],
  },
  {
    slug: 'otp-verify',
    nameEn: 'Email Verification',
    nameAr: 'تأكيد البريد الإلكتروني',
    subjectEn: 'Email Verification Code',
    subjectAr: 'رمز تأكيد البريد الإلكتروني',
    bodyEn: 'Hi {{firstName}},\n\nYour email verification code is: {{code}}\n\nThis code expires in 10 minutes.',
    bodyAr: '{{firstName}} ,مرحبا\n\n{{code}} :رمز تأكيد البريد الإلكتروني هو\n\n.صالح لمدة 10 دقائق',
    variables: ['firstName', 'code'],
  },
  {
    slug: 'welcome',
    nameEn: 'Welcome',
    nameAr: 'أهلا وسهلا',
    subjectEn: 'Welcome to CareKit',
    subjectAr: 'أهلا بك في كيركت',
    bodyEn: 'Hi {{firstName}},\n\nWelcome to CareKit! Your account has been created successfully.',
    bodyAr: '{{firstName}} ,مرحبا\n\nأهلا بك في كيركت! تم إنشاء حسابك بنجاح.',
    variables: ['firstName'],
  },
  {
    slug: 'booking-confirmation',
    nameEn: 'Booking Confirmation',
    nameAr: 'تأكيد الحجز',
    subjectEn: 'Booking Confirmed',
    subjectAr: 'تم تأكيد الحجز',
    bodyEn: 'Hi {{firstName}},\n\nYour booking has been confirmed:\n\nService: {{service}}\nPractitioner: {{practitioner}}\nDate: {{date}}\nTime: {{time}}',
    bodyAr: '{{firstName}} ,مرحبا\n\nتم تأكيد حجزك:\n\nالخدمة: {{service}}\nالطبيب: {{practitioner}}\nالتاريخ: {{date}}\nالوقت: {{time}}',
    variables: ['firstName', 'service', 'practitioner', 'date', 'time'],
  },
];
