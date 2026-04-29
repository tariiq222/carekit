/**
 * Idempotent content seed for the Sawaa tenant (mobile build).
 *
 * Pulls public info from sawaa.sa (8 clinics → Departments + ServiceCategories,
 * representative services, ~24 team members → Employees) and tops it up with
 * plausible demo data (avatars, branch hours, branding tweaks).
 *
 * Run:  npm run seed:sawaa-content --workspace=backend
 * Safe to re-run — uses upserts keyed on (organizationId, nameAr) / slug / email.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';

const SAWAA_ORG_ID = 'ac6c56f2-073b-4704-b2d2-3d21e238d616';

// ─── Brand identity (sawaa.sa) ─────────────────────────────────────────────────

const BRANDING = {
  organizationNameAr: 'مركز سواء للاستشارات الأسرية والنفسية',
  organizationNameEn: 'Sawaa Center for Family & Psychological Consultations',
  productTagline: 'علاج بلا دواء — معك لنستمر في السواء',
  logoUrl: 'https://sawaa.sa/wp-content/uploads/2023/08/مركز-سواء-لوقو-1024x1024.png',
  faviconUrl: 'https://sawaa.sa/wp-content/uploads/2023/08/مركز-سواء-لوقو-1024x1024.png',
  // Earthy browns from the live site
  colorPrimary: '#7B5E3C',
  colorPrimaryLight: '#A88A66',
  colorPrimaryDark: '#553F26',
  colorAccent: '#C9A97A',
  colorAccentDark: '#8C7350',
  colorBackground: '#FBF7F1',
  fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif',
  websiteDomain: 'sawaa.sa',
};

const ORG_SETTINGS = {
  companyNameAr: BRANDING.organizationNameAr,
  companyNameEn: BRANDING.organizationNameEn,
  contactPhone: '+966558446605',
  contactEmail: 'info@sawaa.sa',
  address: 'الرياض، شارع تركي الأول، حي المحمدية',
  organizationCity: 'Riyadh',
  postalCode: '12361',
  defaultLanguage: 'ar',
  timezone: 'Asia/Riyadh',
  weekStartDay: 'sunday',
  socialMedia: {
    instagram: 'https://instagram.com/sawaa.co',
    tiktok: 'https://tiktok.com/@sawa_center',
    youtube: 'https://youtube.com/channel/UCmyB91xiXERIJvHLt3TszBw',
    snapchat: 'https://snapchat.com/add/sawaa_co',
    twitter: 'https://x.com/sawaa_co',
    whatsapp: 'https://wa.me/966558446605',
  },
  aboutAr:
    'مركز سواء للاستشارات الأسرية والنفسية مرخص من وزارة الموارد البشرية والتنمية الاجتماعية والهيئة السعودية للتخصصات الصحية. نقدم استشارات نفسية واجتماعية وعلاج سلوكي معرفي بأيدي نخبة من الاستشاريين وأعضاء هيئة التدريس بخبرة تتجاوز ١٠ سنوات. خدمنا أكثر من ١٥٠٠ أسرة بنسبة رضا ٩٧٪.',
  aboutEn:
    'Sawaa Center for Family & Psychological Consultations is licensed by the Saudi Ministry of Human Resources and the Saudi Commission for Health Specialties. We provide psychological, social and cognitive-behavioral therapy delivered by senior consultants and academic faculty with 10+ years of experience. Trusted by 1,500+ families with a 97% satisfaction rate.',
  cancellationPolicyAr:
    'يحق للعميل إلغاء الموعد قبل ٢٤ ساعة من وقت الجلسة لاسترداد كامل المبلغ. الإلغاء خلال ٢٤ ساعة يُحتسب جلسة كاملة.',
  cancellationPolicyEn:
    'Cancellations made more than 24 hours before the session are fully refundable. Cancellations within 24 hours are charged in full.',
  emailFooterPhone: '+966558446605',
  emailFooterWebsite: 'https://sawaa.sa',
  emailFooterInstagram: 'https://instagram.com/sawaa.co',
  emailFooterTiktok: 'https://tiktok.com/@sawa_center',
  emailFooterSnapchat: 'https://snapchat.com/add/sawaa_co',
  emailFooterTwitter: 'https://x.com/sawaa_co',
  emailFooterYoutube: 'https://youtube.com/channel/UCmyB91xiXERIJvHLt3TszBw',
  sessionDuration: 60,
  reminderBeforeMinutes: 60,
  paymentMoyasarEnabled: true,
  paymentAtClinicEnabled: true,
};

// ─── Departments = the 8 Sawaa clinics ────────────────────────────────────────

const DEPARTMENTS = [
  {
    nameAr: 'استشارات الأخصائيين',
    nameEn: 'Specialist Consultations',
    descriptionAr: 'إشراف إكلينيكي عن بُعد ومراجعة الحالات للأخصائيين والممارسين.',
    descriptionEn: 'Remote clinical supervision and case reviews for practitioners.',
    icon: 'briefcase-medical',
    sortOrder: 1,
  },
  {
    nameAr: 'عيادة العافية',
    nameEn: 'Wellness Clinic',
    descriptionAr: 'ضغوط العمل، التوازن المهني والشخصي، إدارة التوتر اليومي.',
    descriptionEn: 'Work stress, life-work balance, daily anxiety management.',
    icon: 'heart-pulse',
    sortOrder: 2,
  },
  {
    nameAr: 'عيادة الدعم والمواساة',
    nameEn: 'Support & Compassion Clinic',
    descriptionAr: 'التعافي من الصدمات، الدعم في الأزمات، الفقد والحزن.',
    descriptionEn: 'Trauma recovery, crisis support, grief and loss.',
    icon: 'hand-heart',
    sortOrder: 3,
  },
  {
    nameAr: 'عيادة النمو والتطوير',
    nameEn: 'Growth & Development Clinic',
    descriptionAr: 'الأطفال والمراهقون دون السادسة عشرة — التطوّر السلوكي والمعرفي.',
    descriptionEn: 'Children and teens under 16 — behavioral and cognitive development.',
    icon: 'baby',
    sortOrder: 4,
  },
  {
    nameAr: 'عيادة السعادة',
    nameEn: 'Happiness Clinic',
    descriptionAr: 'الاستشارات الزوجية والأسرية وحل النزاعات.',
    descriptionEn: 'Marital and family counseling and conflict resolution.',
    icon: 'users-round',
    sortOrder: 5,
  },
  {
    nameAr: 'عيادة التوافق والتكيف',
    nameEn: 'Compatibility & Adaptation Clinic',
    descriptionAr: 'الاضطرابات النفسية، تطوير الشخصية، اضطرابات القلق والمزاج.',
    descriptionEn: 'Psychological disorders, personality development, anxiety and mood.',
    icon: 'brain',
    sortOrder: 6,
  },
  {
    nameAr: 'عيادة القياس والتقويم',
    nameEn: 'Assessment & Evaluation Clinic',
    descriptionAr: 'الاختبارات النفسية، قياس الذكاء، التقييم الشامل.',
    descriptionEn: 'Psychological testing, IQ measurement, comprehensive evaluation.',
    icon: 'clipboard-check',
    sortOrder: 7,
  },
  {
    nameAr: 'عيادة التحفيز والتغيير',
    nameEn: 'Motivation & Change Clinic',
    descriptionAr: 'الإدمان، الاضطرابات السلوكية، برامج التغيير المعرفي.',
    descriptionEn: 'Addiction, behavioral disorders, cognitive change programs.',
    icon: 'sparkles',
    sortOrder: 8,
  },
] as const;

// ─── Services per department ──────────────────────────────────────────────────

type ServiceSeed = {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  durationMins: number;
  price: number;
  iconName?: string;
};

const SERVICES: Record<string, ServiceSeed[]> = {
  'استشارات الأخصائيين': [
    {
      nameAr: 'إشراف إكلينيكي فردي',
      nameEn: 'Individual Clinical Supervision',
      descriptionAr: 'جلسة إشراف عن بُعد مع استشاري لمراجعة حالة واحدة.',
      durationMins: 60,
      price: 350,
      iconName: 'video',
    },
    {
      nameAr: 'مراجعة حالة جماعية',
      nameEn: 'Group Case Review',
      descriptionAr: 'مراجعة جماعية لحالة سريرية مع نقاش مفتوح.',
      durationMins: 90,
      price: 250,
      iconName: 'users',
    },
  ],
  'عيادة العافية': [
    {
      nameAr: 'استشارة ضغوط العمل',
      nameEn: 'Work Stress Consultation',
      descriptionAr: 'تقييم مصادر الضغط المهني وبناء خطة إدارة عملية.',
      durationMins: 50,
      price: 280,
      iconName: 'briefcase',
    },
    {
      nameAr: 'برنامج التوازن المهني (٤ جلسات)',
      nameEn: 'Work-Life Balance Program (4 sessions)',
      descriptionAr: 'برنامج متعدد الجلسات لإعادة بناء التوازن الشخصي والمهني.',
      durationMins: 60,
      price: 1080,
      iconName: 'scale',
    },
  ],
  'عيادة الدعم والمواساة': [
    {
      nameAr: 'جلسة دعم بعد الصدمة',
      nameEn: 'Post-Trauma Support Session',
      descriptionAr: 'جلسة فردية لاستعادة الاستقرار النفسي بعد حدث صادم.',
      durationMins: 60,
      price: 320,
      iconName: 'shield-check',
    },
    {
      nameAr: 'استشارة الفقد والحزن',
      nameEn: 'Grief & Loss Consultation',
      descriptionAr: 'مرافقة في رحلة الحزن مع أدوات تأقلم عملية.',
      durationMins: 60,
      price: 300,
      iconName: 'heart',
    },
  ],
  'عيادة النمو والتطوير': [
    {
      nameAr: 'تقييم سلوكي للأطفال',
      nameEn: 'Child Behavioral Assessment',
      descriptionAr: 'جلسة تقييم سلوكي شاملة للأطفال من ٤–١٦ سنة.',
      durationMins: 75,
      price: 380,
      iconName: 'puzzle',
    },
    {
      nameAr: 'استشارة تربوية للوالدين',
      nameEn: 'Parental Coaching Session',
      descriptionAr: 'إرشاد والديّ لتعديل السلوك ومهارات التواصل مع الأبناء.',
      durationMins: 50,
      price: 260,
      iconName: 'graduation-cap',
    },
  ],
  'عيادة السعادة': [
    {
      nameAr: 'استشارة زوجية',
      nameEn: 'Couples Counseling',
      descriptionAr: 'جلسة مشتركة للزوجين لتحسين التواصل وحل الخلافات.',
      durationMins: 75,
      price: 420,
      iconName: 'heart-handshake',
    },
    {
      nameAr: 'استشارة ما قبل الزواج',
      nameEn: 'Pre-Marital Counseling',
      descriptionAr: 'تقييم التوافق الشخصي والقيمي قبل الارتباط.',
      durationMins: 60,
      price: 350,
      iconName: 'rings',
    },
    {
      nameAr: 'استشارة أسرية',
      nameEn: 'Family Counseling',
      descriptionAr: 'جلسة جماعية للأسرة لمعالجة نزاع أو تحسين الديناميكية.',
      durationMins: 75,
      price: 400,
      iconName: 'home-heart',
    },
  ],
  'عيادة التوافق والتكيف': [
    {
      nameAr: 'علاج معرفي سلوكي (CBT)',
      nameEn: 'Cognitive Behavioral Therapy',
      descriptionAr: 'جلسة علاج CBT لاضطرابات القلق والاكتئاب.',
      durationMins: 60,
      price: 350,
      iconName: 'brain-circuit',
    },
    {
      nameAr: 'تطوير الشخصية',
      nameEn: 'Personality Development',
      descriptionAr: 'برنامج فردي لتعزيز الثقة وتطوير المهارات الشخصية.',
      durationMins: 60,
      price: 290,
      iconName: 'user-check',
    },
  ],
  'عيادة القياس والتقويم': [
    {
      nameAr: 'اختبار الذكاء (IQ)',
      nameEn: 'IQ Assessment',
      descriptionAr: 'تقييم نسبة الذكاء باستخدام مقاييس معتمدة.',
      durationMins: 90,
      price: 550,
      iconName: 'gauge',
    },
    {
      nameAr: 'تقييم نفسي شامل',
      nameEn: 'Comprehensive Psychological Evaluation',
      descriptionAr: 'تقييم متعدد المحاور مع تقرير مكتوب وتوصيات.',
      durationMins: 120,
      price: 800,
      iconName: 'file-text',
    },
  ],
  'عيادة التحفيز والتغيير': [
    {
      nameAr: 'استشارة الإدمان',
      nameEn: 'Addiction Consultation',
      descriptionAr: 'تقييم سرّي للحالة وبناء خطة تعافٍ مرحلية.',
      durationMins: 60,
      price: 380,
      iconName: 'shield',
    },
    {
      nameAr: 'برنامج التغيير السلوكي (٦ جلسات)',
      nameEn: 'Behavioral Change Program (6 sessions)',
      descriptionAr: 'برنامج منظّم لتعديل عادات سلوكية مستهدفة.',
      durationMins: 60,
      price: 1900,
      iconName: 'target',
    },
  ],
};

// ─── Team — 24 members extracted from sawaa.sa /team listings ────────────────

type EmployeeSeed = {
  nameAr: string;
  nameEn: string;
  title: string;
  specialtyAr: string;
  bioAr: string;
  experience: number;
  gender: 'MALE' | 'FEMALE';
  emailLocal: string;
  avatar: string;
  departmentAr: string;
};

// Demo avatar pool — Unsplash portrait IDs (royalty free)
const F_AVATARS = [
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
];
const M_AVATARS = [
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400',
  'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=400',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400',
];

const f = (i: number) => F_AVATARS[i % F_AVATARS.length];
const m = (i: number) => M_AVATARS[i % M_AVATARS.length];

const EMPLOYEES: EmployeeSeed[] = [
  // Senior consultants
  { nameAr: 'د. عائشة الحجازي', nameEn: 'Dr. Aisha Al-Hijazi', title: 'استشاري نفسي إكلينيكي — أستاذ مشارك', specialtyAr: 'علم النفس الإكلينيكي', bioAr: 'استشارية وأستاذ مشارك في علم النفس الإكلينيكي بخبرة تتجاوز ٢٠ سنة في علاج اضطرابات المزاج والقلق.', experience: 22, gender: 'FEMALE', emailLocal: 'a.hijazi', avatar: f(0), departmentAr: 'استشارات الأخصائيين' },
  { nameAr: 'د. بندر العالم', nameEn: 'Dr. Bander Al-Alim', title: 'استشاري علم نفس', specialtyAr: 'علم النفس العام', bioAr: 'استشاري نفسي بخبرة تتجاوز ١٠ سنوات في الإرشاد الفردي والأسري.', experience: 12, gender: 'MALE', emailLocal: 'b.alalim', avatar: m(0), departmentAr: 'استشارات الأخصائيين' },
  { nameAr: 'د. فايزة العنزي', nameEn: 'Dr. Fayza Al-Anzi', title: 'استشاري خدمة اجتماعية', specialtyAr: 'الخدمة الاجتماعية', bioAr: 'استشارية في الخدمة الاجتماعية بخبرة ١٥ سنة في العمل مع الأسر.', experience: 15, gender: 'FEMALE', emailLocal: 'f.alanzi', avatar: f(1), departmentAr: 'عيادة السعادة' },
  { nameAr: 'د. نورة الداود', nameEn: 'Dr. Nora Al-Dawood', title: 'استشاري اجتماعي', specialtyAr: 'الإرشاد الاجتماعي', bioAr: 'استشارية اجتماعية متخصصة في النزاعات الأسرية.', experience: 16, gender: 'FEMALE', emailLocal: 'n.aldawood', avatar: f(2), departmentAr: 'عيادة السعادة' },
  { nameAr: 'د. ماجد الحربي', nameEn: 'Dr. Majed Al-Harbi', title: 'استشاري علم نفس إكلينيكي', specialtyAr: 'العلاج المعرفي السلوكي', bioAr: 'استشاري إكلينيكي معتمد في CBT لمعالجة القلق والاكتئاب.', experience: 17, gender: 'MALE', emailLocal: 'm.alharbi', avatar: m(1), departmentAr: 'عيادة التوافق والتكيف' },

  // Clinical specialists
  { nameAr: 'د. فهيد الحربي', nameEn: 'Dr. Fuhaid Al-Harbi', title: 'أخصائي نفسي إكلينيكي', specialtyAr: 'علم النفس الإكلينيكي', bioAr: 'أخصائي إكلينيكي بخبرة ١٥ سنة في علاج الاضطرابات السلوكية.', experience: 15, gender: 'MALE', emailLocal: 'fu.alharbi', avatar: m(2), departmentAr: 'عيادة التوافق والتكيف' },
  { nameAr: 'د. محمد عودة', nameEn: 'Dr. Muhammad Awda', title: 'استشاري علم نفس إكلينيكي', specialtyAr: 'الاضطرابات الذهانية', bioAr: 'خبرة تتجاوز ٣٠ سنة في العلاج الإكلينيكي وتأهيل الحالات المزمنة.', experience: 32, gender: 'MALE', emailLocal: 'm.awda', avatar: m(3), departmentAr: 'عيادة التوافق والتكيف' },
  { nameAr: 'د. عهود الشلهوب', nameEn: 'Dr. Ehoud Al-Shlhoub', title: 'أخصائي علم النفس الجنائي', specialtyAr: 'علم النفس الجنائي', bioAr: 'أخصائية في علم النفس الجنائي والتقييم القانوني للحالات.', experience: 16, gender: 'FEMALE', emailLocal: 'e.alshlhoub', avatar: f(3), departmentAr: 'عيادة القياس والتقويم' },

  // Psychologists
  { nameAr: 'أ. أمل الهوساوي', nameEn: 'Amal Al-Housawi', title: 'أخصائي نفسي', specialtyAr: 'اضطرابات الطفولة', bioAr: 'أخصائية نفسية متخصصة في اضطرابات الأطفال بخبرة ١٥ سنة.', experience: 15, gender: 'FEMALE', emailLocal: 'a.alhousawi', avatar: f(4), departmentAr: 'عيادة النمو والتطوير' },
  { nameAr: 'أ. دعاء الفضلي', nameEn: 'Duaa Al-Fadli', title: 'أخصائي نفسي', specialtyAr: 'اضطرابات البالغين والمراهقين', bioAr: 'أخصائية نفسية في علاج اضطرابات البالغين والمراهقين.', experience: 6, gender: 'FEMALE', emailLocal: 'd.alfadli', avatar: f(5), departmentAr: 'عيادة النمو والتطوير' },
  { nameAr: 'أ. رغد النهدي', nameEn: 'Raghad Al-Nahdi', title: 'أخصائي قياس وتقويم', specialtyAr: 'القياس النفسي', bioAr: 'أخصائية في تطبيق المقاييس النفسية وتفسيرها.', experience: 7, gender: 'FEMALE', emailLocal: 'r.alnahdi', avatar: f(6), departmentAr: 'عيادة القياس والتقويم' },
  { nameAr: 'أ. سارة الجبرين', nameEn: 'Sarah Al-Jubrain', title: 'أخصائي نفسي', specialtyAr: 'العلاج التكاملي', bioAr: 'أخصائية تستخدم العلاج التكاملي بدمج عدة مدارس علاجية.', experience: 8, gender: 'FEMALE', emailLocal: 's.aljubrain', avatar: f(7), departmentAr: 'عيادة العافية' },
  { nameAr: 'أ. ندى البواردي', nameEn: 'Nada Al-Bawardi', title: 'أخصائي قياس نفسي', specialtyAr: 'التقييم النفسي', bioAr: 'أخصائية في تطبيق وتفسير الاختبارات النفسية المعتمدة.', experience: 9, gender: 'FEMALE', emailLocal: 'n.albawardi', avatar: f(0), departmentAr: 'عيادة القياس والتقويم' },
  { nameAr: 'أ. سحر الزهراني', nameEn: 'Sahary Al-Zahrani', title: 'أخصائي قياس وتقويم', specialtyAr: 'الاختبارات النفسية', bioAr: 'أخصائية متخصصة في اختبارات الذكاء والشخصية.', experience: 6, gender: 'FEMALE', emailLocal: 's.alzahrani', avatar: f(1), departmentAr: 'عيادة القياس والتقويم' },
  { nameAr: 'أ. ريناد الكليب', nameEn: 'Rinad Al-Klaib', title: 'أخصائي قياس وتقويم', specialtyAr: 'القياس النفسي', bioAr: 'أخصائية في تقييم الحالات الفردية وكتابة التقارير الإكلينيكية.', experience: 5, gender: 'FEMALE', emailLocal: 'r.alklaib', avatar: f(2), departmentAr: 'عيادة القياس والتقويم' },
  { nameAr: 'أ. عبدالرحمن المعاضم', nameEn: 'Abdulrahman Muathim', title: 'أخصائي قياس نفسي', specialtyAr: 'التقييم النفسي', bioAr: 'أخصائي في تطبيق المقاييس النفسية للأطفال والبالغين.', experience: 7, gender: 'MALE', emailLocal: 'a.muathim', avatar: m(4), departmentAr: 'عيادة القياس والتقويم' },

  // Social workers
  { nameAr: 'أ. خالد العنزي', nameEn: 'Khalid Al-Anzi', title: 'أخصائي اجتماعي أول', specialtyAr: 'الإرشاد الأسري', bioAr: 'أخصائي اجتماعي بخبرة تتجاوز ٣٠ سنة في الاستشارات الأسرية.', experience: 31, gender: 'MALE', emailLocal: 'k.alanzi', avatar: m(5), departmentAr: 'عيادة السعادة' },
  { nameAr: 'أ. نجاح العنزي', nameEn: 'Najah Al-Anzi', title: 'أخصائي اجتماعي أول', specialtyAr: 'الإرشاد الأسري', bioAr: 'أخصائية اجتماعية بخبرة ١٥ سنة في النزاعات الزوجية.', experience: 15, gender: 'FEMALE', emailLocal: 'n.alanzi', avatar: f(3), departmentAr: 'عيادة السعادة' },
  { nameAr: 'أ. نورة العنزي', nameEn: 'Nora Al-Anzi', title: 'أخصائي اجتماعي أول', specialtyAr: 'الدعم الأسري', bioAr: 'أخصائية اجتماعية متخصصة في دعم الأسر بعد الأزمات.', experience: 13, gender: 'FEMALE', emailLocal: 'no.alanzi', avatar: f(4), departmentAr: 'عيادة الدعم والمواساة' },
  { nameAr: 'أ. نسرين الصبان', nameEn: 'Nasreen Al-Sabban', title: 'أخصائي اجتماعي أول', specialtyAr: 'الإرشاد الاجتماعي', bioAr: 'أخصائية اجتماعية بخبرة ١٥ سنة في الاستشارات الفردية والأسرية.', experience: 15, gender: 'FEMALE', emailLocal: 'n.alsabban', avatar: f(5), departmentAr: 'عيادة السعادة' },

  // Specialists
  { nameAr: 'أ. ماجد الفيصل', nameEn: 'Majed Al-Faisal', title: 'أخصائي إدمان', specialtyAr: 'علاج الإدمان', bioAr: 'أخصائي إدمان بخبرة ٢٠ سنة في برامج التأهيل والتعافي.', experience: 21, gender: 'MALE', emailLocal: 'm.alfaisal', avatar: m(6), departmentAr: 'عيادة التحفيز والتغيير' },
  { nameAr: 'أ. خالد المحمدي', nameEn: 'Khalid Al-Muhammadi', title: 'أخصائي نفسي', specialtyAr: 'العلاج السلوكي', bioAr: 'أخصائي نفسي بخبرة ١٥ سنة في تعديل السلوك.', experience: 16, gender: 'MALE', emailLocal: 'k.almuhammadi', avatar: m(7), departmentAr: 'عيادة التحفيز والتغيير' },

  // Wellness focus
  { nameAr: 'أ. ريم القحطاني', nameEn: 'Reem Al-Qahtani', title: 'أخصائي نفسي', specialtyAr: 'إدارة التوتر', bioAr: 'أخصائية تستخدم اليقظة الذهنية وأساليب الاسترخاء.', experience: 6, gender: 'FEMALE', emailLocal: 'r.alqahtani', avatar: f(6), departmentAr: 'عيادة العافية' },
  { nameAr: 'أ. فيصل الشمري', nameEn: 'Faisal Al-Shammari', title: 'أخصائي نفسي', specialtyAr: 'الإرشاد المهني', bioAr: 'متخصص في الإرشاد المهني وتطوير المسار الوظيفي.', experience: 8, gender: 'MALE', emailLocal: 'f.alshammari', avatar: m(0), departmentAr: 'عيادة العافية' },
];

// ─── Branch hours: Sat–Thu 9:00–22:00, Fri off ───────────────────────────────

const BUSINESS_HOURS = [
  { dayOfWeek: 0, startTime: '09:00', endTime: '22:00', isOpen: true }, // Sun
  { dayOfWeek: 1, startTime: '09:00', endTime: '22:00', isOpen: true },
  { dayOfWeek: 2, startTime: '09:00', endTime: '22:00', isOpen: true },
  { dayOfWeek: 3, startTime: '09:00', endTime: '22:00', isOpen: true },
  { dayOfWeek: 4, startTime: '09:00', endTime: '22:00', isOpen: true }, // Thu
  { dayOfWeek: 5, startTime: '00:00', endTime: '00:00', isOpen: false }, // Fri off
  { dayOfWeek: 6, startTime: '09:00', endTime: '22:00', isOpen: true }, // Sat
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  console.log(`→ Seeding Sawaa content into org ${SAWAA_ORG_ID}`);

  // 1) Organization name + slug confirmation
  await prisma.organization.update({
    where: { id: SAWAA_ORG_ID },
    data: {
      nameAr: BRANDING.organizationNameAr,
      nameEn: BRANDING.organizationNameEn,
      slug: 'sawaa',
    },
  });

  // 2) Branding
  await prisma.brandingConfig.upsert({
    where: { organizationId: SAWAA_ORG_ID },
    create: { organizationId: SAWAA_ORG_ID, ...BRANDING },
    update: BRANDING,
  });
  console.log('  ✓ Branding upserted');

  // 3) Organization settings
  await prisma.organizationSettings.upsert({
    where: { organizationId: SAWAA_ORG_ID },
    create: { organizationId: SAWAA_ORG_ID, ...ORG_SETTINGS },
    update: ORG_SETTINGS,
  });
  console.log('  ✓ OrganizationSettings upserted');

  // 4) Main branch
  const existingBranch = await prisma.branch.findFirst({
    where: { organizationId: SAWAA_ORG_ID, isMain: true },
  });
  const branch = existingBranch
    ? await prisma.branch.update({
        where: { id: existingBranch.id },
        data: {
          nameAr: 'فرع الرياض الرئيسي',
          nameEn: 'Riyadh Main Branch',
          phone: '+966558446605',
          addressAr: 'شارع تركي الأول، حي المحمدية، الرياض',
          addressEn: 'Turki Al-Awwal St, Al-Mohammadiyah, Riyadh',
          city: 'Riyadh',
          country: 'SA',
          latitude: 24.7464,
          longitude: 46.6753,
          isMain: true,
          isActive: true,
        },
      })
    : await prisma.branch.create({
        data: {
          organizationId: SAWAA_ORG_ID,
          nameAr: 'فرع الرياض الرئيسي',
          nameEn: 'Riyadh Main Branch',
          phone: '+966558446605',
          addressAr: 'شارع تركي الأول، حي المحمدية، الرياض',
          addressEn: 'Turki Al-Awwal St, Al-Mohammadiyah, Riyadh',
          city: 'Riyadh',
          country: 'SA',
          latitude: 24.7464,
          longitude: 46.6753,
          isMain: true,
          isActive: true,
        },
      });
  console.log(`  ✓ Branch ready: ${branch.nameAr}`);

  // 5) Business hours (idempotent via unique [branchId, dayOfWeek])
  for (const h of BUSINESS_HOURS) {
    await prisma.businessHour.upsert({
      where: { branchId_dayOfWeek: { branchId: branch.id, dayOfWeek: h.dayOfWeek } },
      create: { organizationId: SAWAA_ORG_ID, branchId: branch.id, ...h },
      update: { startTime: h.startTime, endTime: h.endTime, isOpen: h.isOpen },
    });
  }
  console.log('  ✓ Business hours set (Sat–Thu 09:00–22:00, Fri off)');

  // 6) Departments (one ServiceCategory per department for the services to live in)
  const deptByName = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { dept_org_nameAr: { organizationId: SAWAA_ORG_ID, nameAr: dept.nameAr } },
      create: { organizationId: SAWAA_ORG_ID, ...dept },
      update: {
        nameEn: dept.nameEn,
        descriptionAr: dept.descriptionAr,
        descriptionEn: dept.descriptionEn,
        icon: dept.icon,
        sortOrder: dept.sortOrder,
        isActive: true,
      },
    });
    deptByName.set(dept.nameAr, row.id);
  }
  console.log(`  ✓ Departments upserted: ${deptByName.size}`);

  const catByDept = new Map<string, string>();
  for (const [deptName, deptId] of deptByName) {
    // Find or create a single matching category (no @@unique exists, so we look-then-create)
    const existing = await prisma.serviceCategory.findFirst({
      where: { organizationId: SAWAA_ORG_ID, departmentId: deptId, nameAr: deptName },
    });
    const cat =
      existing ??
      (await prisma.serviceCategory.create({
        data: {
          organizationId: SAWAA_ORG_ID,
          departmentId: deptId,
          nameAr: deptName,
          nameEn: DEPARTMENTS.find((d) => d.nameAr === deptName)!.nameEn,
        },
      }));
    catByDept.set(deptName, cat.id);
  }

  // 7) Services (one per row; lookup via (orgId, categoryId, nameAr))
  let serviceCount = 0;
  const servicesByDept = new Map<string, string[]>(); // deptName → service ids
  for (const [deptName, list] of Object.entries(SERVICES)) {
    const categoryId = catByDept.get(deptName);
    if (!categoryId) continue;
    const ids: string[] = [];
    for (const svc of list) {
      const existing = await prisma.service.findFirst({
        where: { organizationId: SAWAA_ORG_ID, categoryId, nameAr: svc.nameAr },
      });
      const row = existing
        ? await prisma.service.update({
            where: { id: existing.id },
            data: {
              nameEn: svc.nameEn,
              descriptionAr: svc.descriptionAr,
              durationMins: svc.durationMins,
              price: new Prisma.Decimal(svc.price),
              currency: 'SAR',
              iconName: svc.iconName,
              isActive: true,
              isHidden: false,
            },
          })
        : await prisma.service.create({
            data: {
              organizationId: SAWAA_ORG_ID,
              categoryId,
              nameAr: svc.nameAr,
              nameEn: svc.nameEn,
              descriptionAr: svc.descriptionAr,
              durationMins: svc.durationMins,
              price: new Prisma.Decimal(svc.price),
              currency: 'SAR',
              iconName: svc.iconName,
            },
          });
      ids.push(row.id);
      serviceCount++;

      // Default duration option (required by CheckAvailabilityHandler when no
      // durationMins is passed in). bookingType=null → applies to all flows.
      const existingOpt = await prisma.serviceDurationOption.findFirst({
        where: { serviceId: row.id, bookingType: null, isDefault: true },
      });
      if (!existingOpt) {
        await prisma.serviceDurationOption.create({
          data: {
            organizationId: SAWAA_ORG_ID,
            serviceId: row.id,
            bookingType: null,
            label: `${svc.durationMins} min`,
            labelAr: `${svc.durationMins} دقيقة`,
            durationMins: svc.durationMins,
            price: new Prisma.Decimal(svc.price),
            currency: 'SAR',
            isDefault: true,
            isActive: true,
            sortOrder: 0,
          },
        });
      } else {
        await prisma.serviceDurationOption.update({
          where: { id: existingOpt.id },
          data: {
            durationMins: svc.durationMins,
            price: new Prisma.Decimal(svc.price),
            isActive: true,
          },
        });
      }
    }
    servicesByDept.set(deptName, ids);
  }
  console.log(`  ✓ Services upserted: ${serviceCount} (with default duration options)`);

  // 8) Employees + branch + service links + weekly availability
  let employeeCount = 0;
  for (const e of EMPLOYEES) {
    const email = `${e.emailLocal}@sawaa.sa`;
    const slug = e.emailLocal.replace(/\./g, '-');
    const existing = await prisma.employee.findFirst({
      where: { organizationId: SAWAA_ORG_ID, email },
    });
    const data = {
      organizationId: SAWAA_ORG_ID,
      name: e.nameAr,
      nameAr: e.nameAr,
      nameEn: e.nameEn,
      title: e.title,
      specialtyAr: e.specialtyAr,
      specialty: e.specialtyAr,
      bioAr: e.bioAr,
      bio: e.bioAr,
      experience: e.experience,
      gender: e.gender,
      avatarUrl: e.avatar,
      publicImageUrl: e.avatar,
      publicBioAr: e.bioAr,
      email,
      slug,
      isActive: true,
      isPublic: true,
      employmentType: 'FULL_TIME' as const,
      onboardingStatus: 'COMPLETED' as const,
    };
    const emp = existing
      ? await prisma.employee.update({ where: { id: existing.id }, data })
      : await prisma.employee.create({ data });

    // Link to main branch
    await prisma.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: emp.id, branchId: branch.id } },
      create: { organizationId: SAWAA_ORG_ID, employeeId: emp.id, branchId: branch.id },
      update: {},
    });

    // Link to all services in their department
    const serviceIds = servicesByDept.get(e.departmentAr) ?? [];
    for (const sid of serviceIds) {
      await prisma.employeeService.upsert({
        where: { employeeId_serviceId: { employeeId: emp.id, serviceId: sid } },
        create: { organizationId: SAWAA_ORG_ID, employeeId: emp.id, serviceId: sid },
        update: {},
      });
    }

    // Weekly availability — Sat–Thu 10:00–20:00 (Fri off)
    for (const day of [0, 1, 2, 3, 4, 6]) {
      const exists = await prisma.employeeAvailability.findFirst({
        where: { employeeId: emp.id, dayOfWeek: day },
      });
      if (!exists) {
        await prisma.employeeAvailability.create({
          data: {
            organizationId: SAWAA_ORG_ID,
            employeeId: emp.id,
            dayOfWeek: day,
            startTime: '10:00',
            endTime: '20:00',
            isActive: true,
          },
        });
      }
    }
    employeeCount++;
  }
  console.log(`  ✓ Employees upserted: ${employeeCount}`);

  console.log('\n✅ Sawaa content seed complete.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
