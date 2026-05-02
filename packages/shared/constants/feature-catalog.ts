import { FeatureKey } from "./feature-keys";

export type FeatureGroup =
  | "Booking & Scheduling"
  | "Client Engagement"
  | "Finance & Compliance"
  | "Operations"
  | "Platform";

export type FeatureCatalogEntry = {
  key: FeatureKey;
  kind: "boolean" | "quantitative";
  tier: "PRO" | "ENTERPRISE";
  group: FeatureGroup;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
};

export const FEATURE_CATALOG: Record<FeatureKey, FeatureCatalogEntry> = {
  [FeatureKey.RECURRING_BOOKINGS]: {
    key: FeatureKey.RECURRING_BOOKINGS,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الحجوزات المتكررة", nameEn: "Recurring Bookings",
    descAr: "إنشاء سلاسل مواعيد أسبوعية أو شهرية بنقرة واحدة",
    descEn: "Create weekly or monthly appointment series in one click",
  },
  [FeatureKey.WAITLIST]: {
    key: FeatureKey.WAITLIST,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "قائمة الانتظار", nameEn: "Waitlist",
    descAr: "إدارة قائمة عملاء بانتظار شواغر في الجدول",
    descEn: "Manage a queue of clients waiting for openings",
  },
  [FeatureKey.GROUP_SESSIONS]: {
    key: FeatureKey.GROUP_SESSIONS,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الجلسات الجماعية", nameEn: "Group Sessions",
    descAr: "حجز جلسات بسعة متعددة وإدارة المشاركين",
    descEn: "Book multi-capacity sessions and manage attendees",
  },
  [FeatureKey.AI_CHATBOT]: {
    key: FeatureKey.AI_CHATBOT,
    kind: "boolean", tier: "PRO", group: "Client Engagement",
    nameAr: "روبوت المحادثة الذكي", nameEn: "AI Chatbot",
    descAr: "مساعد آلي يجاوب العملاء عبر قاعدة المعرفة",
    descEn: "Knowledge-base assistant that answers clients automatically",
  },
  [FeatureKey.EMAIL_TEMPLATES]: {
    key: FeatureKey.EMAIL_TEMPLATES,
    kind: "boolean", tier: "PRO", group: "Client Engagement",
    nameAr: "قوالب البريد الإلكتروني", nameEn: "Email Templates",
    descAr: "تخصيص قوالب رسائل العملاء بهوية العيادة",
    descEn: "Customize client email templates with clinic branding",
  },
  [FeatureKey.COUPONS]: {
    key: FeatureKey.COUPONS,
    kind: "boolean", tier: "PRO", group: "Finance & Compliance",
    nameAr: "كوبونات الخصم", nameEn: "Coupons",
    descAr: "إنشاء أكواد خصم بنسبة أو مبلغ ثابت",
    descEn: "Issue percentage or fixed-amount discount codes",
  },
  [FeatureKey.ADVANCED_REPORTS]: {
    key: FeatureKey.ADVANCED_REPORTS,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "التقارير المتقدمة", nameEn: "Advanced Reports",
    descAr: "تقارير تشغيلية ومالية تفصيلية قابلة للتصدير",
    descEn: "Detailed operational and financial reports, exportable",
  },
  [FeatureKey.INTAKE_FORMS]: {
    key: FeatureKey.INTAKE_FORMS,
    kind: "boolean", tier: "ENTERPRISE", group: "Client Engagement",
    nameAr: "نماذج الاستقبال", nameEn: "Intake Forms",
    descAr: "نماذج استقبال مخصصة قبل الموعد",
    descEn: "Custom pre-appointment intake forms",
  },
  [FeatureKey.ZATCA]: {
    key: FeatureKey.ZATCA,
    kind: "boolean", tier: "ENTERPRISE", group: "Finance & Compliance",
    nameAr: "فوترة زاتكا الإلكترونية", nameEn: "ZATCA E-Invoicing",
    descAr: "إصدار فواتير متوافقة مع هيئة الزكاة والضريبة",
    descEn: "Issue ZATCA-compliant e-invoices",
  },
  [FeatureKey.CUSTOM_ROLES]: {
    key: FeatureKey.CUSTOM_ROLES,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "الأدوار المخصصة", nameEn: "Custom Roles",
    descAr: "تعريف أدوار وصلاحيات حسب احتياج المنشأة",
    descEn: "Define roles and permissions tailored to your org",
  },
  [FeatureKey.ACTIVITY_LOG]: {
    key: FeatureKey.ACTIVITY_LOG,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "سجل النشاط", nameEn: "Activity Log",
    descAr: "سجل تدقيق لكل إجراءات المستخدمين",
    descEn: "Audit trail of every user action",
  },
  [FeatureKey.BRANCHES]: {
    key: FeatureKey.BRANCHES,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "الفروع", nameEn: "Branches",
    descAr: "عدد الفروع المسموح بإنشائها",
    descEn: "Number of branches you can create",
  },
  [FeatureKey.EMPLOYEES]: {
    key: FeatureKey.EMPLOYEES,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "الموظفون", nameEn: "Employees",
    descAr: "الحد الأقصى لعدد الموظفين النشطين",
    descEn: "Maximum number of active employees",
  },
  [FeatureKey.SERVICES]: {
    key: FeatureKey.SERVICES,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "الخدمات", nameEn: "Services",
    descAr: "عدد الخدمات القابلة للتفعيل في الكتالوج",
    descEn: "Number of services activatable in the catalog",
  },
  [FeatureKey.MONTHLY_BOOKINGS]: {
    key: FeatureKey.MONTHLY_BOOKINGS,
    kind: "quantitative", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الحجوزات الشهرية", nameEn: "Monthly Bookings",
    descAr: "عدد الحجوزات المسموح بها كل شهر",
    descEn: "Bookings allowed per calendar month",
  },
  [FeatureKey.STORAGE]: {
    key: FeatureKey.STORAGE,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "مساحة التخزين", nameEn: "Storage",
    descAr: "إجمالي مساحة الملفات بالميجابايت",
    descEn: "Total file storage in MB",
  },
};
