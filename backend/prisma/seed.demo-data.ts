// ──────────────────────────────────────────────
// Demo/Seed Data — Realistic Saudi clinic data
// Covers ALL models and status variations
// ──────────────────────────────────────────────

// ─── Users (Patients + Staff) ─────────────────

export const DEMO_PATIENTS = [
  { email: 'sara.ahmed@example.com', firstName: 'سارة', lastName: 'أحمد', firstNameEn: 'Sara', lastNameEn: 'Ahmed', phone: '+966501000010', gender: 'female' as const },
  { email: 'omar.ali@example.com', firstName: 'عمر', lastName: 'علي', firstNameEn: 'Omar', lastNameEn: 'Ali', phone: '+966501000011', gender: 'male' as const },
  { email: 'noura.hassan@example.com', firstName: 'نورة', lastName: 'حسن', firstNameEn: 'Noura', lastNameEn: 'Hassan', phone: '+966501000012', gender: 'female' as const },
  { email: 'youssef.ibrahim@example.com', firstName: 'يوسف', lastName: 'إبراهيم', firstNameEn: 'Youssef', lastNameEn: 'Ibrahim', phone: '+966501000013', gender: 'male' as const },
  { email: 'fatima.saeed@example.com', firstName: 'فاطمة', lastName: 'سعيد', firstNameEn: 'Fatima', lastNameEn: 'Saeed', phone: '+966501000014', gender: 'female' as const },
  { email: 'khaled.nasser@example.com', firstName: 'خالد', lastName: 'ناصر', firstNameEn: 'Khaled', lastNameEn: 'Nasser', phone: '+966501000015', gender: 'male' as const },
  { email: 'mona.rashid@example.com', firstName: 'منى', lastName: 'راشد', firstNameEn: 'Mona', lastNameEn: 'Rashid', phone: '+966501000016', gender: 'female' as const },
  { email: 'ahmed.sultan@example.com', firstName: 'أحمد', lastName: 'سلطان', firstNameEn: 'Ahmed', lastNameEn: 'Sultan', phone: '+966501000017', gender: 'male' as const },
  { email: 'lama.turki@example.com', firstName: 'لمى', lastName: 'تركي', firstNameEn: 'Lama', lastNameEn: 'Turki', phone: '+966501000018', gender: 'female' as const },
  { email: 'faisal.majed@example.com', firstName: 'فيصل', lastName: 'ماجد', firstNameEn: 'Faisal', lastNameEn: 'Majed', phone: '+966501000019', gender: 'male' as const },
];

export const DEMO_RECEPTIONIST = {
  email: 'reception@carekit-test.com',
  firstName: 'هدى',
  lastName: 'العتيبي',
  phone: '+966501000002',
  gender: 'female' as const,
};

export const DEMO_ACCOUNTANT = {
  email: 'accountant@carekit-test.com',
  firstName: 'محمد',
  lastName: 'الشهري',
  phone: '+966501000003',
  gender: 'male' as const,
};

// ─── Practitioners ────────────────────────────

export const DEMO_PRACTITIONERS = [
  {
    email: 'dr.abdulrahman@carekit-test.com',
    firstName: 'عبدالرحمن', lastName: 'المالكي',
    phone: '+966501000004', gender: 'male' as const,
    specialtyEn: 'General Medicine', specialtyAr: 'طب عام',
    bio: 'Consultant in internal medicine with 15 years of experience',
    bioAr: 'استشاري طب باطني بخبرة 15 سنة',
    experience: 15, education: 'MBBS, King Saud University',
    educationAr: 'بكالوريوس طب — جامعة الملك سعود',
    priceClinic: 30000, pricePhone: 15000, priceVideo: 20000,
  },
  {
    email: 'dr.layla@carekit-test.com',
    firstName: 'ليلى', lastName: 'القحطاني',
    phone: '+966501000005', gender: 'female' as const,
    specialtyEn: 'Dermatology', specialtyAr: 'أمراض جلدية',
    bio: 'Board-certified dermatologist specializing in cosmetic dermatology',
    bioAr: 'أخصائية أمراض جلدية معتمدة متخصصة في الجلدية التجميلية',
    experience: 10, education: 'MD Dermatology, King Abdulaziz University',
    educationAr: 'ماجستير أمراض جلدية — جامعة الملك عبدالعزيز',
    priceClinic: 40000, pricePhone: 20000, priceVideo: 25000,
  },
  {
    email: 'dr.fahad@carekit-test.com',
    firstName: 'فهد', lastName: 'الدوسري',
    phone: '+966501000006', gender: 'male' as const,
    specialtyEn: 'Dentistry', specialtyAr: 'طب أسنان',
    bio: 'Specialist in orthodontics and cosmetic dentistry',
    bioAr: 'أخصائي تقويم أسنان وتجميل',
    experience: 8, education: 'BDS, Riyadh Elm University',
    educationAr: 'بكالوريوس طب أسنان — جامعة رياض العلم',
    priceClinic: 35000, pricePhone: 0, priceVideo: 15000,
  },
  {
    email: 'dr.hanan@carekit-test.com',
    firstName: 'حنان', lastName: 'العمري',
    phone: '+966501000007', gender: 'female' as const,
    specialtyEn: 'Pediatrics', specialtyAr: 'طب أطفال',
    bio: 'Pediatrician with special interest in newborn care',
    bioAr: 'طبيبة أطفال متخصصة في رعاية حديثي الولادة',
    experience: 12, education: 'MBBS + Fellowship Pediatrics',
    educationAr: 'بكالوريوس طب + زمالة طب أطفال',
    priceClinic: 25000, pricePhone: 12000, priceVideo: 18000,
  },
];

// ─── Service Categories & Services ────────────

export const DEMO_CATEGORIES = [
  { nameAr: 'الكشف العام', nameEn: 'General Consultation', sortOrder: 0 },
  { nameAr: 'الأسنان', nameEn: 'Dental', sortOrder: 1 },
  { nameAr: 'الجلدية والتجميل', nameEn: 'Dermatology & Cosmetics', sortOrder: 2 },
  { nameAr: 'الأطفال', nameEn: 'Pediatrics', sortOrder: 3 },
];

export const DEMO_SERVICES = [
  {
    nameAr: 'كشف عام', nameEn: 'General Checkup', categoryIdx: 0, price: 30000, duration: 30,
    descriptionAr: 'فحص طبي شامل', descriptionEn: 'Comprehensive medical examination',
    bufferMinutes: 5, depositEnabled: false, depositPercent: 100,
    allowRecurring: true, maxParticipants: 1, calendarColor: '#2563EB',
  },
  {
    nameAr: 'متابعة', nameEn: 'Follow-up Visit', categoryIdx: 0, price: 15000, duration: 15,
    descriptionAr: 'زيارة متابعة', descriptionEn: 'Follow-up consultation',
    bufferMinutes: 0, depositEnabled: false, depositPercent: 100,
    allowRecurring: true, maxParticipants: 1, calendarColor: '#7C3AED',
  },
  {
    nameAr: 'تنظيف أسنان', nameEn: 'Dental Cleaning', categoryIdx: 1, price: 25000, duration: 45,
    descriptionAr: 'تنظيف وتلميع الأسنان', descriptionEn: 'Professional teeth cleaning and polishing',
    bufferMinutes: 10, depositEnabled: true, depositPercent: 50,
    allowRecurring: false, maxParticipants: 1, calendarColor: '#059669',
  },
  {
    nameAr: 'حشوة أسنان', nameEn: 'Dental Filling', categoryIdx: 1, price: 40000, duration: 60,
    descriptionAr: 'حشوة تجميلية', descriptionEn: 'Cosmetic dental filling',
    bufferMinutes: 10, depositEnabled: true, depositPercent: 50,
    allowRecurring: false, maxParticipants: 1, calendarColor: '#059669',
  },
  {
    nameAr: 'استشارة جلدية', nameEn: 'Dermatology Consultation', categoryIdx: 2, price: 40000, duration: 30,
    descriptionAr: 'فحص واستشارة جلدية', descriptionEn: 'Skin examination and consultation',
    bufferMinutes: 5, depositEnabled: false, depositPercent: 100,
    allowRecurring: true, maxParticipants: 1, calendarColor: '#DC2626',
  },
  {
    nameAr: 'علاج بالليزر', nameEn: 'Laser Treatment', categoryIdx: 2, price: 80000, duration: 45,
    descriptionAr: 'جلسة ليزر تجميلية', descriptionEn: 'Cosmetic laser session',
    bufferMinutes: 15, depositEnabled: true, depositPercent: 30,
    allowRecurring: true, maxParticipants: 1, calendarColor: '#DC2626',
  },
  {
    nameAr: 'كشف أطفال', nameEn: 'Pediatric Checkup', categoryIdx: 3, price: 25000, duration: 30,
    descriptionAr: 'فحص شامل للأطفال', descriptionEn: 'Comprehensive pediatric examination',
    bufferMinutes: 5, depositEnabled: false, depositPercent: 100,
    allowRecurring: false, maxParticipants: 1, calendarColor: '#D97706',
  },
  {
    nameAr: 'تطعيمات', nameEn: 'Vaccinations', categoryIdx: 3, price: 10000, duration: 15,
    descriptionAr: 'تطعيمات الأطفال حسب الجدول', descriptionEn: 'Scheduled childhood vaccinations',
    bufferMinutes: 0, depositEnabled: false, depositPercent: 100,
    allowRecurring: false, maxParticipants: 1, calendarColor: '#D97706',
  },
];

// ─── Branches ─────────────────────────────────

export const DEMO_BRANCHES = [
  { nameAr: 'الفرع الرئيسي — الرياض', nameEn: 'Main Branch — Riyadh', address: 'شارع الملك فهد، حي العليا، الرياض', phone: '+966112000001', email: 'riyadh@carekit-test.com', isMain: true },
  { nameAr: 'فرع جدة', nameEn: 'Jeddah Branch', address: 'شارع التحلية، حي الروضة، جدة', phone: '+966122000001', email: 'jeddah@carekit-test.com', isMain: false },
];

// ─── Coupons ──────────────────────────────────

export const DEMO_COUPONS = [
  { code: 'WELCOME20', descriptionAr: 'خصم 20% للمرضى الجدد', descriptionEn: '20% off for new patients', discountType: 'percentage', discountValue: 20, maxUses: 100, expiresInDays: 90 },
  { code: 'DENTAL50', descriptionAr: 'خصم 50 ريال على خدمات الأسنان', descriptionEn: '50 SAR off dental services', discountType: 'fixed', discountValue: 5000, maxUses: 50, expiresInDays: 60 },
  { code: 'SUMMER2026', descriptionAr: 'عرض الصيف — خصم 15%', descriptionEn: 'Summer offer — 15% off', discountType: 'percentage', discountValue: 15, maxUses: 200, expiresInDays: 120 },
];

// ─── Gift Cards ───────────────────────────────

export const DEMO_GIFT_CARDS = [
  { code: 'GIFT-100-A1B2', initialAmount: 10000, balance: 10000 },
  { code: 'GIFT-250-C3D4', initialAmount: 25000, balance: 18000 },
  { code: 'GIFT-500-E5F6', initialAmount: 50000, balance: 0 },
];


// ─── Clinic Working Hours ─────────────────────

export const DEMO_WORKING_HOURS = [
  { dayOfWeek: 0, startTime: '09:00', endTime: '21:00', isActive: true },  // Sunday
  { dayOfWeek: 1, startTime: '09:00', endTime: '21:00', isActive: true },  // Monday
  { dayOfWeek: 2, startTime: '09:00', endTime: '21:00', isActive: true },  // Tuesday
  { dayOfWeek: 3, startTime: '09:00', endTime: '21:00', isActive: true },  // Wednesday
  { dayOfWeek: 4, startTime: '09:00', endTime: '21:00', isActive: true },  // Thursday
  { dayOfWeek: 5, startTime: '00:00', endTime: '00:00', isActive: false }, // Friday (closed)
  { dayOfWeek: 6, startTime: '16:00', endTime: '21:00', isActive: true },  // Saturday
];

// ─── Clinic Holidays ──────────────────────────

export const DEMO_HOLIDAYS = [
  { date: '2026-09-23', nameAr: 'اليوم الوطني السعودي', nameEn: 'Saudi National Day', isRecurring: true },
  { date: '2026-03-20', nameAr: 'عيد الفطر', nameEn: 'Eid Al-Fitr', isRecurring: false },
  { date: '2026-05-27', nameAr: 'عيد الأضحى', nameEn: 'Eid Al-Adha', isRecurring: false },
];

// ─── Patient Profiles (medical info) ─────────

export const DEMO_PATIENT_PROFILES = [
  { nationalId: '1234567890', nationality: 'Saudi', dateOfBirth: '1990-05-14', bloodType: 'A_POS' as const, allergies: 'بنسلين', chronicConditions: 'ضغط الدم', emergencyName: 'محمد أحمد', emergencyPhone: '+966501000101' },
  { nationalId: '2345678901', nationality: 'Saudi', dateOfBirth: '1985-09-22', bloodType: 'O_NEG' as const, allergies: null, chronicConditions: null, emergencyName: 'علي عمر', emergencyPhone: '+966501000102' },
  { nationalId: '3456789012', nationality: 'Saudi', dateOfBirth: '1995-03-07', bloodType: 'B_POS' as const, allergies: 'أسبرين', chronicConditions: null, emergencyName: 'عبدالله حسن', emergencyPhone: '+966501000103' },
  { nationalId: '4567890123', nationality: 'Saudi', dateOfBirth: '1978-11-30', bloodType: 'AB_POS' as const, allergies: null, chronicConditions: 'سكري النوع الثاني', emergencyName: 'سارة إبراهيم', emergencyPhone: '+966501000104' },
  { nationalId: '5678901234', nationality: 'Saudi', dateOfBirth: '2000-07-19', bloodType: 'O_POS' as const, allergies: null, chronicConditions: null, emergencyName: 'فاطمة علي', emergencyPhone: '+966501000105' },
  { nationalId: '6789012345', nationality: 'Saudi', dateOfBirth: '1992-01-25', bloodType: 'A_NEG' as const, allergies: 'إيبوبروفين', chronicConditions: 'ربو', emergencyName: 'يوسف ناصر', emergencyPhone: '+966501000106' },
  { nationalId: '7890123456', nationality: 'Saudi', dateOfBirth: '1988-06-10', bloodType: 'B_NEG' as const, allergies: null, chronicConditions: null, emergencyName: 'منى خالد', emergencyPhone: '+966501000107' },
  { nationalId: '8901234567', nationality: 'Saudi', dateOfBirth: '1975-12-03', bloodType: 'O_POS' as const, allergies: 'سلفا', chronicConditions: 'قلب', emergencyName: 'لمى أحمد', emergencyPhone: '+966501000108' },
  { nationalId: '9012345678', nationality: 'Saudi', dateOfBirth: '1998-04-16', bloodType: 'UNKNOWN' as const, allergies: null, chronicConditions: null, emergencyName: 'خالد تركي', emergencyPhone: '+966501000109' },
  { nationalId: '0123456789', nationality: 'Saudi', dateOfBirth: '1983-08-27', bloodType: 'A_POS' as const, allergies: null, chronicConditions: null, emergencyName: 'نورة فيصل', emergencyPhone: '+966501000110' },
];

// ─── Chatbot Config ───────────────────────────

export const DEMO_CHATBOT_CONFIG = [
  { key: 'personality', category: 'personality', value: { nameAr: 'كيركت', nameEn: 'CareKit Assistant', tone: 'friendly_professional', languages: ['ar', 'en'] } },
  { key: 'handoff_settings', category: 'handoff', value: { type: 'live_chat', fallbackPhone: '+966112000001', maxWaitMinutes: 5 } },
  { key: 'quick_replies', category: 'quick_replies', value: { ar: ['حجز موعد', 'إلغاء موعد', 'تغيير موعد', 'الأسعار', 'مواعيد العمل'], en: ['Book appointment', 'Cancel appointment', 'Reschedule', 'Prices', 'Working hours'] } },
  { key: 'ai_model', category: 'ai_model', value: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-20250514', maxTokens: 1024, temperature: 0.3 } },
];

// ─── Knowledge Base (sample entries) ──────────

export const DEMO_KNOWLEDGE_BASE = [
  { title: 'Working Hours', content: 'The clinic is open Sunday to Thursday from 9 AM to 9 PM, Saturday from 4 PM to 9 PM, and closed on Fridays.', category: 'general', source: 'manual' },
  { title: 'Payment Methods', content: 'We accept Mada, Visa, Mastercard, Apple Pay through Moyasar, and bank transfers to Al-Rajhi Bank.', category: 'payments', source: 'manual' },
  { title: 'Cancellation Policy', content: 'Cancellations made 24 hours before the appointment receive a full refund. Late cancellations are reviewed by admin.', category: 'policy', source: 'manual' },
  { title: 'Available Services', content: 'General checkups, follow-ups, dental cleaning, dental fillings, dermatology consultations, laser treatments, pediatric checkups, and vaccinations.', category: 'services', source: 'manual' },
];
