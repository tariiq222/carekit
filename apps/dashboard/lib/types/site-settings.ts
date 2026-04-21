/**
 * Website CMS — site-settings types (key-value).
 */

export interface SiteSettingRow {
  key: string
  valueText: string | null
  valueAr: string | null
  valueEn: string | null
  valueJson: unknown
  valueMedia: string | null
}

export interface SiteSettingEntry {
  key: string
  valueText?: string | null
  valueAr?: string | null
  valueEn?: string | null
  valueJson?: unknown
  valueMedia?: string | null
}

export interface BulkUpsertSiteSettingsPayload {
  entries: SiteSettingEntry[]
}

export interface BulkUpsertResult {
  updated: number
}

/**
 * Hero section editable content (mirrored from website/features/site-content).
 * Each field maps to one SiteSetting row by a well-known key.
 */
export interface HeroFormValues {
  badgeText: string
  titlePrefix: string
  titleHighlight: string
  titleSuffix: string
  subtitle: string
  ctaPrimaryText: string
  ctaPrimaryHref: string
  ctaSecondaryText: string
  ctaSecondaryHref: string
  heroImageUrl: string
  badgeFloatTopLabel: string
  badgeFloatTopValue: string
  badgeFloatBottomLabel: string
  badgeFloatBottomValue: string
}

export const HERO_KEY_MAP: Record<keyof HeroFormValues, string> = {
  badgeText:             'home.hero.badge.ar',
  titlePrefix:           'home.hero.titlePrefix.ar',
  titleHighlight:        'home.hero.titleHighlight.ar',
  titleSuffix:           'home.hero.titleSuffix.ar',
  subtitle:              'home.hero.subtitle.ar',
  ctaPrimaryText:        'home.hero.ctaPrimary.text.ar',
  ctaPrimaryHref:        'home.hero.ctaPrimary.href',
  ctaSecondaryText:      'home.hero.ctaSecondary.text.ar',
  ctaSecondaryHref:      'home.hero.ctaSecondary.href',
  heroImageUrl:          'home.hero.heroImage',
  badgeFloatTopLabel:    'home.hero.badgeTop.label.ar',
  badgeFloatTopValue:    'home.hero.badgeTop.value.ar',
  badgeFloatBottomLabel: 'home.hero.badgeBottom.label.ar',
  badgeFloatBottomValue: 'home.hero.badgeBottom.value.ar',
}

export const HERO_DEFAULTS: HeroFormValues = {
  badgeText: 'مركز معتمد للاستشارات النفسية والأسرية',
  titlePrefix: 'رحلتك نحو',
  titleHighlight: 'السواء',
  titleSuffix: 'تبدأ اليوم',
  subtitle:
    'معالج يفهم ثقافتك، بيئة آمنة لا تحاسب، وسرّية مهنية تامة. جلسات حضورية في الرياض أو عن بُعد — متى ما كنت جاهزاً.',
  ctaPrimaryText: 'احجز موعدك',
  ctaPrimaryHref: '/booking',
  ctaSecondaryText: 'استكشف المعالجين',
  ctaSecondaryHref: '/therapists',
  heroImageUrl: '/images/hero.jpg',
  badgeFloatTopLabel: 'خبرة تتجاوز',
  badgeFloatTopValue: '15 عاماً',
  badgeFloatBottomLabel: 'مؤهلون من',
  badgeFloatBottomValue: 'هيئة التخصصات',
}

/**
 * Home page section intros (Features/Clinics/Team/FAQ/Testimonials/Blog/SupportGroups/CTA).
 * Mirrors website/features/site-content/section-intros. Each section exposes the
 * same 5 editable fields.
 */
export interface SectionIntroValues {
  tag: string
  titlePrefix: string
  titleHighlight: string
  titleSuffix: string
  subtitle: string
}

export type SectionIntroKey =
  | 'features'
  | 'clinics'
  | 'supportGroups'
  | 'team'
  | 'testimonials'
  | 'blog'
  | 'faq'
  | 'cta'

export interface SectionIntrosFormValues {
  features:      SectionIntroValues
  clinics:       SectionIntroValues
  supportGroups: SectionIntroValues
  team:          SectionIntroValues
  testimonials:  SectionIntroValues
  blog:          SectionIntroValues
  faq:           SectionIntroValues
  cta:           SectionIntroValues
}

export const SECTION_INTRO_FIELDS = [
  'tag',
  'titlePrefix',
  'titleHighlight',
  'titleSuffix',
  'subtitle',
] as const satisfies readonly (keyof SectionIntroValues)[]

export const SECTION_INTRO_KEYS: readonly SectionIntroKey[] = [
  'features',
  'clinics',
  'supportGroups',
  'team',
  'testimonials',
  'blog',
  'faq',
  'cta',
]

export const SECTION_INTRO_LABELS: Record<SectionIntroKey, string> = {
  features:      'المميزات',
  clinics:       'العيادات',
  supportGroups: 'مجموعات الدعم',
  team:          'الفريق',
  testimonials:  'آراء العملاء',
  blog:          'المدونة',
  faq:           'الأسئلة الشائعة',
  cta:           'الدعوة للإجراء',
}

export function sectionIntroKey(
  section: SectionIntroKey,
  field: keyof SectionIntroValues,
): string {
  return `home.${section}.${field}.ar`
}

export const SECTION_INTRO_DEFAULTS: SectionIntrosFormValues = {
  features: {
    tag: 'ميزاتنا',
    titlePrefix: 'كل ما يخص',
    titleHighlight: 'صحتك النفسية',
    titleSuffix: 'في مكان واحد',
    subtitle: 'نقدم خدمات متكاملة تجمع بين الاستشارات النفسية والأسرية وعلاج الإدمان',
  },
  clinics: {
    tag: 'عياداتنا',
    titlePrefix: 'عيادات',
    titleHighlight: 'متخصصة',
    titleSuffix: '',
    subtitle: 'كل عيادة صُممت لتغطية احتياج محدد بأعلى جودة',
  },
  supportGroups: {
    tag: 'مجموعات الدعم',
    titlePrefix: 'مجموعات دعم',
    titleHighlight: 'متخصصة',
    titleSuffix: '',
    subtitle: 'بيئة آمنة للمشاركة والتعافي مع مجموعة صغيرة بإشراف متخصصين',
  },
  team: {
    tag: 'فريقنا',
    titlePrefix: 'خبراء',
    titleHighlight: 'في خدمتك',
    titleSuffix: '',
    subtitle: 'فريق من المتخصصين المؤهلين في الصحة النفسية والاستشارات الأسرية',
  },
  testimonials: {
    tag: 'آراء عملائنا',
    titlePrefix: 'ماذا يقول',
    titleHighlight: 'عملاؤنا؟',
    titleSuffix: '',
    subtitle: 'تجارب حقيقية من أشخاص بدأوا رحلة تعافيهم معنا',
  },
  blog: {
    tag: 'المدونة',
    titlePrefix: 'مقالات',
    titleHighlight: 'ونصائح',
    titleSuffix: '',
    subtitle: 'محتوى متخصص من فريقنا لمساعدتك على فهم نفسك وتطوير حياتك',
  },
  faq: {
    tag: 'الأسئلة الشائعة',
    titlePrefix: 'أسئلة',
    titleHighlight: 'يطرحها الكثير',
    titleSuffix: '',
    subtitle: 'إجابات سريعة عن أكثر ما يهمّك قبل الحجز',
  },
  cta: {
    tag: 'ابدأ رحلتك',
    titlePrefix: 'جاهزون',
    titleHighlight: 'لمساعدتك',
    titleSuffix: '',
    subtitle: 'فريقنا جاهز لمساعدتك — سرية تامة',
  },
}
