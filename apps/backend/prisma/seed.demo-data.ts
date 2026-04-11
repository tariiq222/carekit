// ──────────────────────────────────────────────
// Demo/Seed Data — Realistic Saudi clinic data
// Covers ALL models and field variations
// ──────────────────────────────────────────────

// ─── Patients ─────────────────────────────────

export const DEMO_PATIENTS = [
  { email: 'sara.ahmed@example.com',    firstName: 'سارة',   lastName: 'أحمد',    phone: '+966501000010', gender: 'female' as const },
  { email: 'omar.ali@example.com',      firstName: 'عمر',    lastName: 'علي',     phone: '+966501000011', gender: 'male'   as const },
  { email: 'noura.hassan@example.com',  firstName: 'نورة',   lastName: 'حسن',     phone: '+966501000012', gender: 'female' as const },
  { email: 'youssef.ibrahim@example.com', firstName: 'يوسف', lastName: 'إبراهيم', phone: '+966501000013', gender: 'male'   as const },
  { email: 'fatima.saeed@example.com',  firstName: 'فاطمة',  lastName: 'سعيد',    phone: '+966501000014', gender: 'female' as const },
  { email: 'khaled.nasser@example.com', firstName: 'خالد',   lastName: 'ناصر',    phone: '+966501000015', gender: 'male'   as const },
  { email: 'mona.rashid@example.com',   firstName: 'منى',    lastName: 'راشد',    phone: '+966501000016', gender: 'female' as const },
  { email: 'ahmed.sultan@example.com',  firstName: 'أحمد',   lastName: 'سلطان',   phone: '+966501000017', gender: 'male'   as const },
  { email: 'lama.turki@example.com',    firstName: 'لمى',    lastName: 'تركي',    phone: '+966501000018', gender: 'female' as const },
  { email: 'faisal.majed@example.com',  firstName: 'فيصل',   lastName: 'ماجد',    phone: '+966501000019', gender: 'male'   as const },
];

// ─── Staff ────────────────────────────────────

export const DEMO_RECEPTIONIST = {
  email: 'reception@carekit-test.com',
  firstName: 'هدى', lastName: 'العتيبي',
  phone: '+966501000002', gender: 'female' as const,
};

export const DEMO_ACCOUNTANT = {
  email: 'accountant@carekit-test.com',
  firstName: 'محمد', lastName: 'الشهري',
  phone: '+966501000003', gender: 'male' as const,
};

// ─── Practitioners ────────────────────────────
// Covers: title, nameAr, specialty, bio, experience, education, prices, all fields

export const DEMO_PRACTITIONERS = [
  {
    email: 'dr.abdulrahman@carekit-test.com',
    firstName: 'عبدالرحمن', lastName: 'المالكي',
    phone: '+966509000001', gender: 'male' as const,
    title: 'د.',
    nameAr: 'د. عبدالرحمن المالكي',
    specialtyEn: 'General Medicine', specialtyAr: 'طب عام',
    bio: 'Consultant in internal medicine with 15 years of experience in primary care and chronic disease management.',
    bioAr: 'استشاري طب باطني بخبرة 15 سنة في الرعاية الأولية وإدارة الأمراض المزمنة.',
    experience: 15,
    education: 'MBBS, King Saud University — Board Certified Internal Medicine',
    educationAr: 'بكالوريوس الطب والجراحة — جامعة الملك سعود، البورد السعودي للطب الباطني',
    priceClinic: 30000, pricePhone: 15000, priceVideo: 20000,
  },
  {
    email: 'dr.layla@carekit-test.com',
    firstName: 'ليلى', lastName: 'القحطاني',
    phone: '+966509000002', gender: 'female' as const,
    title: 'د.',
    nameAr: 'د. ليلى القحطاني',
    specialtyEn: 'Dermatology', specialtyAr: 'أمراض جلدية',
    bio: 'Board-certified dermatologist specializing in cosmetic dermatology, laser treatments, and skin cancer screening.',
    bioAr: 'أخصائية أمراض جلدية معتمدة متخصصة في الجلدية التجميلية وعلاجات الليزر وفحص سرطان الجلد.',
    experience: 10,
    education: 'MD Dermatology, King Abdulaziz University — Fellowship in Cosmetic Dermatology',
    educationAr: 'ماجستير أمراض جلدية — جامعة الملك عبدالعزيز، زمالة الجلدية التجميلية',
    priceClinic: 40000, pricePhone: 20000, priceVideo: 25000,
  },
  {
    email: 'dr.fahad@carekit-test.com',
    firstName: 'فهد', lastName: 'الدوسري',
    phone: '+966509000003', gender: 'male' as const,
    title: 'د.',
    nameAr: 'د. فهد الدوسري',
    specialtyEn: 'Dentistry', specialtyAr: 'طب أسنان',
    bio: 'Specialist in orthodontics and cosmetic dentistry with expertise in invisible aligners and veneers.',
    bioAr: 'أخصائي تقويم أسنان وتجميل متخصص في المحاذيات الشفافة والقشرة التجميلية.',
    experience: 8,
    education: 'BDS, Riyadh Elm University — Diploma in Orthodontics',
    educationAr: 'بكالوريوس طب أسنان — جامعة رياض العلم، دبلوم تقويم الأسنان',
    priceClinic: 35000, pricePhone: 0, priceVideo: 15000,
  },
  {
    email: 'dr.hanan@carekit-test.com',
    firstName: 'حنان', lastName: 'العمري',
    phone: '+966509000004', gender: 'female' as const,
    title: 'د.',
    nameAr: 'د. حنان العمري',
    specialtyEn: 'Pediatrics', specialtyAr: 'طب أطفال',
    bio: 'Pediatrician with special interest in newborn care, developmental pediatrics, and childhood vaccinations.',
    bioAr: 'طبيبة أطفال متخصصة في رعاية حديثي الولادة وطب النمو والتطعيمات.',
    experience: 12,
    education: 'MBBS, Umm Al-Qura University — Fellowship in Pediatrics, KFSH',
    educationAr: 'بكالوريوس طب — جامعة أم القرى، زمالة طب أطفال — مستشفى الملك فيصل التخصصي',
    priceClinic: 25000, pricePhone: 12000, priceVideo: 18000,
  },
];

// ─── Service Categories ────────────────────────

export const DEMO_CATEGORIES = [
  { nameAr: 'الكشف العام',        nameEn: 'General Consultation',    sortOrder: 0 },
  { nameAr: 'الأسنان',            nameEn: 'Dental',                   sortOrder: 1 },
  { nameAr: 'الجلدية والتجميل',   nameEn: 'Dermatology & Cosmetics',  sortOrder: 2 },
  { nameAr: 'الأطفال',            nameEn: 'Pediatrics',               sortOrder: 3 },
];

// ─── Services ─────────────────────────────────
// Covers: price, duration, buffer, deposit, recurring, maxParticipants,
//         iconBgColor, minLeadMinutes, maxAdvanceDays, hidePriceOnBooking

export const DEMO_SERVICES = [
  {
    nameAr: 'كشف عام', nameEn: 'General Checkup', categoryIdx: 0,
    descriptionAr: 'فحص طبي شامل يشمل قياس العلامات الحيوية ومراجعة التاريخ المرضي',
    descriptionEn: 'Comprehensive medical examination including vital signs and medical history review',
    price: 30000, duration: 30, bufferMinutes: 5,
    depositEnabled: false, depositPercent: 100,
    allowRecurring: true, allowedRecurringPatterns: ['weekly', 'biweekly', 'monthly'],
    maxRecurrences: 12, maxParticipants: 1,
    iconBgColor: '#2563EB',
    minLeadMinutes: 60, maxAdvanceDays: 60,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'متابعة', nameEn: 'Follow-up Visit', categoryIdx: 0,
    descriptionAr: 'زيارة متابعة لمريض سبق له حضور الكشف العام',
    descriptionEn: 'Follow-up visit for existing patients',
    price: 15000, duration: 15, bufferMinutes: 0,
    depositEnabled: false, depositPercent: 100,
    allowRecurring: true, allowedRecurringPatterns: ['weekly', 'biweekly'],
    maxRecurrences: 6, maxParticipants: 1,
    iconBgColor: '#7C3AED',
    minLeadMinutes: 30, maxAdvanceDays: 30,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'تنظيف أسنان', nameEn: 'Dental Cleaning', categoryIdx: 1,
    descriptionAr: 'تنظيف وتلميع احترافي للأسنان وإزالة الجير',
    descriptionEn: 'Professional teeth cleaning, polishing, and tartar removal',
    price: 25000, duration: 45, bufferMinutes: 10,
    depositEnabled: true, depositPercent: 50,
    allowRecurring: false, allowedRecurringPatterns: [],
    maxRecurrences: 12, maxParticipants: 1,
    iconBgColor: '#059669',
    minLeadMinutes: 120, maxAdvanceDays: 90,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'حشوة أسنان', nameEn: 'Dental Filling', categoryIdx: 1,
    descriptionAr: 'حشوة تجميلية بمادة الكمبوزيت',
    descriptionEn: 'Cosmetic composite dental filling',
    price: 40000, duration: 60, bufferMinutes: 10,
    depositEnabled: true, depositPercent: 50,
    allowRecurring: false, allowedRecurringPatterns: [],
    maxRecurrences: 12, maxParticipants: 1,
    iconBgColor: '#059669',
    minLeadMinutes: 120, maxAdvanceDays: 90,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'استشارة جلدية', nameEn: 'Dermatology Consultation', categoryIdx: 2,
    descriptionAr: 'فحص واستشارة جلدية متكاملة مع خطة علاجية',
    descriptionEn: 'Full skin examination and consultation with treatment plan',
    price: 40000, duration: 30, bufferMinutes: 5,
    depositEnabled: false, depositPercent: 100,
    allowRecurring: true, allowedRecurringPatterns: ['weekly', 'biweekly'],
    maxRecurrences: 8, maxParticipants: 1,
    iconBgColor: '#DC2626',
    minLeadMinutes: 60, maxAdvanceDays: 60,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'علاج بالليزر', nameEn: 'Laser Treatment', categoryIdx: 2,
    descriptionAr: 'جلسة ليزر تجميلية — إزالة شعر أو علاج حب الشباب أو تجديد الجلد',
    descriptionEn: 'Cosmetic laser session — hair removal, acne treatment, or skin rejuvenation',
    price: 80000, duration: 45, bufferMinutes: 15,
    depositEnabled: true, depositPercent: 30,
    allowRecurring: true, allowedRecurringPatterns: ['every_2_days', 'weekly'],
    maxRecurrences: 6, maxParticipants: 1,
    iconBgColor: '#DC2626',
    minLeadMinutes: 1440, maxAdvanceDays: 60,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'كشف أطفال', nameEn: 'Pediatric Checkup', categoryIdx: 3,
    descriptionAr: 'فحص شامل للأطفال يشمل منحنيات النمو والتطور',
    descriptionEn: 'Comprehensive pediatric exam including growth charts and development assessment',
    price: 25000, duration: 30, bufferMinutes: 5,
    depositEnabled: false, depositPercent: 100,
    allowRecurring: false, allowedRecurringPatterns: [],
    maxRecurrences: 12, maxParticipants: 1,
    iconBgColor: '#D97706',
    minLeadMinutes: 60, maxAdvanceDays: 60,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
  {
    nameAr: 'تطعيمات', nameEn: 'Vaccinations', categoryIdx: 3,
    descriptionAr: 'تطعيمات الأطفال حسب الجدول الوطني السعودي',
    descriptionEn: 'Childhood vaccinations per the Saudi national immunization schedule',
    price: 10000, duration: 15, bufferMinutes: 0,
    depositEnabled: false, depositPercent: 100,
    allowRecurring: false, allowedRecurringPatterns: [],
    maxRecurrences: 12, maxParticipants: 1,
    iconBgColor: '#D97706',
    minLeadMinutes: 0, maxAdvanceDays: 90,
    hidePriceOnBooking: false, hideDurationOnBooking: false,
  },
];

// ─── Branches ─────────────────────────────────
// Covers: nameAr, nameEn, address, phone, email, isMain, timezone

export const DEMO_BRANCHES = [
  {
    nameAr: 'الفرع الرئيسي — الرياض', nameEn: 'Main Branch — Riyadh',
    address: 'شارع الملك فهد، حي العليا، الرياض 12343',
    phone: '+966112000001', email: 'riyadh@carekit-test.com',
    isMain: true, timezone: 'Asia/Riyadh',
  },
  {
    nameAr: 'فرع جدة', nameEn: 'Jeddah Branch',
    address: 'شارع التحلية، حي الروضة، جدة 23421',
    phone: '+966122000001', email: 'jeddah@carekit-test.com',
    isMain: false, timezone: 'Asia/Riyadh',
  },
];

// ─── Coupons ──────────────────────────────────
// Covers: code, discountType (percentage/fixed), discountValue, maxUses, minAmount

export const DEMO_COUPONS = [
  {
    code: 'WELCOME20',
    descriptionAr: 'خصم 20% للمرضى الجدد — صالح لأول حجز فقط',
    descriptionEn: '20% off for new patients — valid on first booking only',
    discountType: 'percentage', discountValue: 20,
    minAmount: 0, maxUses: 100, maxUsesPerUser: 1, expiresInDays: 90,
  },
  {
    code: 'DENTAL50',
    descriptionAr: 'خصم 50 ريال على خدمات الأسنان',
    descriptionEn: '50 SAR off dental services',
    discountType: 'fixed', discountValue: 5000,
    minAmount: 20000, maxUses: 50, maxUsesPerUser: 3, expiresInDays: 60,
  },
  {
    code: 'SUMMER2026',
    descriptionAr: 'عرض الصيف — خصم 15% على جميع الخدمات',
    descriptionEn: 'Summer offer — 15% off all services',
    discountType: 'percentage', discountValue: 15,
    minAmount: 0, maxUses: 200, maxUsesPerUser: 5, expiresInDays: 120,
  },
];

// ─── Gift Cards ───────────────────────────────
// Covers: code, initialAmount, balance (partial/full use)

export const DEMO_GIFT_CARDS = [
  { code: 'GIFT-100-A1B2', initialAmount: 10000, balance: 10000 },  // unused
  { code: 'GIFT-250-C3D4', initialAmount: 25000, balance: 18000 },  // partially used
  { code: 'GIFT-500-E5F6', initialAmount: 50000, balance:     0 },  // fully redeemed
];

// ─── Clinic Working Hours ─────────────────────

export const DEMO_WORKING_HOURS = [
  { dayOfWeek: 0, startTime: '09:00', endTime: '21:00', isActive: true  }, // Sunday
  { dayOfWeek: 1, startTime: '09:00', endTime: '21:00', isActive: true  }, // Monday
  { dayOfWeek: 2, startTime: '09:00', endTime: '21:00', isActive: true  }, // Tuesday
  { dayOfWeek: 3, startTime: '09:00', endTime: '21:00', isActive: true  }, // Wednesday
  { dayOfWeek: 4, startTime: '09:00', endTime: '21:00', isActive: true  }, // Thursday
  { dayOfWeek: 5, startTime: '00:00', endTime: '00:00', isActive: false }, // Friday (closed)
  { dayOfWeek: 6, startTime: '16:00', endTime: '21:00', isActive: true  }, // Saturday
];

// ─── Clinic Holidays ──────────────────────────

export const DEMO_HOLIDAYS = [
  { date: '2026-09-23', nameAr: 'اليوم الوطني السعودي', nameEn: 'Saudi National Day', isRecurring: true  },
  { date: '2026-03-20', nameAr: 'عيد الفطر',            nameEn: 'Eid Al-Fitr',        isRecurring: false },
  { date: '2026-05-27', nameAr: 'عيد الأضحى',           nameEn: 'Eid Al-Adha',        isRecurring: false },
];

// ─── Patient Profiles ─────────────────────────
// Covers: nationalId, nationality, dateOfBirth, bloodType,
//         allergies, chronicConditions, emergencyName, emergencyPhone

export const DEMO_PATIENT_PROFILES = [
  { nationalId: '1234567890', nationality: 'Saudi', dateOfBirth: '1990-05-14', bloodType: 'A_POS'   as const, allergies: 'بنسلين',       chronicConditions: 'ضغط الدم',         emergencyName: 'محمد أحمد',   emergencyPhone: '+966501000101' },
  { nationalId: '2345678901', nationality: 'Saudi', dateOfBirth: '1985-09-22', bloodType: 'O_NEG'   as const, allergies: null,            chronicConditions: null,               emergencyName: 'علي عمر',      emergencyPhone: '+966501000102' },
  { nationalId: '3456789012', nationality: 'Saudi', dateOfBirth: '1995-03-07', bloodType: 'B_POS'   as const, allergies: 'أسبرين',        chronicConditions: null,               emergencyName: 'عبدالله حسن', emergencyPhone: '+966501000103' },
  { nationalId: '4567890123', nationality: 'Saudi', dateOfBirth: '1978-11-30', bloodType: 'AB_POS'  as const, allergies: null,            chronicConditions: 'سكري النوع الثاني', emergencyName: 'سارة إبراهيم', emergencyPhone: '+966501000104' },
  { nationalId: '5678901234', nationality: 'Saudi', dateOfBirth: '2000-07-19', bloodType: 'O_POS'   as const, allergies: null,            chronicConditions: null,               emergencyName: 'فاطمة علي',   emergencyPhone: '+966501000105' },
  { nationalId: '6789012345', nationality: 'Saudi', dateOfBirth: '1992-01-25', bloodType: 'A_NEG'   as const, allergies: 'إيبوبروفين',   chronicConditions: 'ربو',              emergencyName: 'يوسف ناصر',   emergencyPhone: '+966501000106' },
  { nationalId: '7890123456', nationality: 'Saudi', dateOfBirth: '1988-06-10', bloodType: 'B_NEG'   as const, allergies: null,            chronicConditions: null,               emergencyName: 'منى خالد',    emergencyPhone: '+966501000107' },
  { nationalId: '8901234567', nationality: 'Saudi', dateOfBirth: '1975-12-03', bloodType: 'O_POS'   as const, allergies: 'سلفا',          chronicConditions: 'أمراض القلب',     emergencyName: 'لمى أحمد',    emergencyPhone: '+966501000108' },
  { nationalId: '9012345678', nationality: 'Saudi', dateOfBirth: '1998-04-16', bloodType: 'UNKNOWN' as const, allergies: null,            chronicConditions: null,               emergencyName: 'خالد تركي',   emergencyPhone: '+966501000109' },
  { nationalId: '0123456789', nationality: 'Saudi', dateOfBirth: '1983-08-27', bloodType: 'A_POS'   as const, allergies: 'لاتكس',         chronicConditions: null,               emergencyName: 'نورة فيصل',   emergencyPhone: '+966501000110' },
];

// ─── Chatbot Config ───────────────────────────
// Covers: key, category, value (JSON — personality/handoff/quick_replies/ai_model/sync)

export const DEMO_CHATBOT_CONFIG = [
  {
    key: 'personality', category: 'personality',
    value: {
      nameAr: 'مساعد كيركت', nameEn: 'CareKit Assistant',
      tone: 'friendly_professional', languages: ['ar', 'en'],
      greeting_ar: 'مرحباً! أنا مساعد كيركت. كيف يمكنني مساعدتك اليوم؟',
      greeting_en: 'Hello! I\'m the CareKit assistant. How can I help you today?',
    },
  },
  {
    key: 'handoff_settings', category: 'handoff',
    value: {
      type: 'live_chat', fallbackPhone: '+966112000001',
      maxWaitMinutes: 5, autoHandoffAfterTurns: 8,
      escalationKeywords: ['مدير', 'شكوى', 'مشكلة', 'manager', 'complaint'],
    },
  },
  {
    key: 'quick_replies', category: 'quick_replies',
    value: {
      ar: ['حجز موعد', 'إلغاء موعد', 'تغيير موعد', 'الأسعار', 'مواعيد العمل', 'الأطباء المتاحون'],
      en: ['Book appointment', 'Cancel appointment', 'Reschedule', 'Prices', 'Working hours', 'Available doctors'],
    },
  },
  {
    key: 'ai_model', category: 'ai_model',
    value: {
      provider: 'openrouter', model: 'anthropic/claude-sonnet-4-20250514',
      maxTokens: 1024, temperature: 0.3, streamEnabled: true,
    },
  },
  {
    key: 'sync_settings', category: 'sync',
    value: {
      autoSyncServices: true, autoSyncPractitioners: true,
      syncIntervalMinutes: 60, lastSyncAt: null,
    },
  },
];

// ─── Knowledge Base ───────────────────────────

export const DEMO_KNOWLEDGE_BASE = [
  {
    title: 'Working Hours',
    content: 'The clinic is open Sunday to Thursday from 9 AM to 9 PM, Saturday from 4 PM to 9 PM, and closed on Fridays.',
    category: 'general', source: 'manual',
  },
  {
    title: 'Payment Methods',
    content: 'We accept Mada, Visa, Mastercard, Apple Pay through Moyasar, and bank transfers to Al-Rajhi Bank (Account: 1234567890, IBAN: SA0380000000001234567890).',
    category: 'payments', source: 'manual',
  },
  {
    title: 'Cancellation Policy',
    content: 'Cancellations made 24 hours or more before the appointment receive a full refund. Late cancellations are subject to admin review. No-shows may forfeit the full amount.',
    category: 'policy', source: 'manual',
  },
  {
    title: 'Available Services',
    content: 'We offer: General checkups, follow-up visits, dental cleaning, dental fillings, dermatology consultations, laser treatments, pediatric checkups, and childhood vaccinations.',
    category: 'services', source: 'manual',
  },
  {
    title: 'Booking Instructions',
    content: 'You can book an appointment via the app or by speaking with our assistant. Choose your preferred doctor, service, date and time. Payment is required to confirm the booking.',
    category: 'general', source: 'manual',
  },
];

// ─── Practitioner Vacation (sample) ──────────
// Used by seed.demo-users.ts for testing vacation overlap

export const DEMO_VACATIONS = [
  { practitionerIdx: 0, startDate: '2026-04-10', endDate: '2026-04-17', reason: 'إجازة سنوية' },
  { practitionerIdx: 2, startDate: '2026-05-01', endDate: '2026-05-03', reason: 'مؤتمر طبي' },
];

// ─── WaitlistEntry samples ────────────────────
// Used by seed.demo-clinic.ts for waitlist status coverage

export const DEMO_WAITLIST = [
  { patientIdx: 2, practitionerIdx: 0, serviceIdx: 0, preferredDate: '2026-04-01', preferredTime: 'morning',   status: 'waiting'  as const },
  { patientIdx: 4, practitionerIdx: 1, serviceIdx: 4, preferredDate: '2026-04-05', preferredTime: 'afternoon', status: 'notified' as const },
  { patientIdx: 6, practitionerIdx: 3, serviceIdx: 6, preferredDate: null,         preferredTime: 'any',       status: 'expired'  as const },
];

// ─── FavoritePractitioner samples ────────────

export const DEMO_FAVORITES = [
  { patientIdx: 0, practitionerIdx: 0 },
  { patientIdx: 0, practitionerIdx: 1 },
  { patientIdx: 2, practitionerIdx: 3 },
  { patientIdx: 5, practitionerIdx: 2 },
];

// ─── IntakeForm samples ───────────────────────
// Covers: scope (global/service/practitioner/branch), type (pre_booking/pre_session/post_session)

export const DEMO_INTAKE_FORMS = [
  {
    nameAr: 'استبيان ما قبل الحجز — عام',
    nameEn: 'Pre-booking Questionnaire — General',
    type: 'pre_booking' as const, scope: 'global' as const,
    serviceIdx: null, practitionerIdx: null, branchIdx: null,
    fields: [
      { labelAr: 'هل تعاني من أي حساسية؟', labelEn: 'Do you have any allergies?', fieldType: 'textarea', isRequired: false },
      { labelAr: 'هل تتناول أدوية حالياً؟', labelEn: 'Are you currently on any medications?', fieldType: 'radio', options: { ar: ['نعم', 'لا'], en: ['Yes', 'No'] }, isRequired: true },
    ],
  },
  {
    nameAr: 'استبيان ما بعد الجلسة — تقييم الخدمة',
    nameEn: 'Post-session Feedback — Service Rating',
    type: 'post_session' as const, scope: 'global' as const,
    serviceIdx: null, practitionerIdx: null, branchIdx: null,
    fields: [
      { labelAr: 'كيف تقيّم تجربتك؟', labelEn: 'How would you rate your experience?', fieldType: 'rating', isRequired: true },
      { labelAr: 'ملاحظات إضافية', labelEn: 'Additional comments', fieldType: 'textarea', isRequired: false },
    ],
  },
  {
    nameAr: 'نموذج ما قبل جلسة الليزر',
    nameEn: 'Pre-session Laser Consent Form',
    type: 'pre_session' as const, scope: 'service' as const,
    serviceIdx: 5, practitionerIdx: null, branchIdx: null,
    fields: [
      { labelAr: 'هل لديك حساسية من الضوء؟', labelEn: 'Do you have photosensitivity?', fieldType: 'radio', options: { ar: ['نعم', 'لا'], en: ['Yes', 'No'] }, isRequired: true },
      { labelAr: 'هل تتناول أدوية مميعة للدم؟', labelEn: 'Are you on blood thinners?', fieldType: 'radio', options: { ar: ['نعم', 'لا'], en: ['Yes', 'No'] }, isRequired: true },
      { labelAr: 'موافقة المريض', labelEn: 'Patient consent', fieldType: 'checkbox', isRequired: true },
    ],
  },
];
