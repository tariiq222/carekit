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
