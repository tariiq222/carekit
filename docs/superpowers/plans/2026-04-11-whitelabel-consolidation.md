# WhiteLabel Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** دمج `WhiteLabelConfig` و `OrganizationSettings.theme` (JSON blob) في جدول `WhiteLabelConfig` واحد موحّد، مع حذف التكرار بالكامل عبر Backend + Dashboard + Mobile + api-client + shared packages.

**Architecture:**
- `WhiteLabelConfig` يُوسَّع ليستوعب جميع حقول `OrganizationTheme` (الألوان المتقدمة، tagline، fontUrl) كحقول صريحة بدل JSON blob.
- `OrganizationSettings.theme` يُحذف من الـ schema وكل كوده.
- الـ endpoint الموحّد: `GET/PUT /whitelabel` يعود بـ config كاملة. `GET /whitelabel/public` للبيانات العامة.
- الداشبورد والموبايل يستهلكان `/whitelabel/public` فقط لعمل theming.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Next.js 15, React Native / Expo, `@carekit/shared`, `@carekit/api-client`

---

## خريطة الملفات المتأثرة

### Backend (حذف + تعديل)
- **MODIFY** `prisma/schema/config.prisma` — توسيع `WhiteLabelConfig` بالحقول الجديدة
- **MODIFY** `prisma/schema/organization-settings.prisma` — حذف حقل `theme` من `OrganizationSettings`
- **CREATE** `prisma/migrations/...` — migration جديدة (لا تُعدَّل القديمة)
- **MODIFY** `src/modules/whitelabel/dto/update-config.dto.ts` — إضافة الحقول الجديدة
- **MODIFY** `src/modules/whitelabel/whitelabel.service.ts` — توسيع `getPublicBranding` + حذف `adminUpdate`
- **MODIFY** `src/modules/whitelabel/whitelabel.controller.ts` — لا تغيير جوهري
- **DELETE** `src/modules/organization-settings/theme.service.ts`
- **DELETE** `src/modules/organization-settings/theme.controller.ts`
- **DELETE** `src/modules/organization-settings/dto/update-theme.dto.ts`
- **DELETE** `src/modules/organization-settings/clinic-theme.ts`
- **MODIFY** `src/modules/organization-settings/organization-settings.module.ts` — حذف ThemeService/ThemeController
- **MODIFY** `src/config/constants/cache.ts` — حذف مفاتيح cache غير المستخدمة
- **MODIFY** `prisma/seed.data.ts` — تحديث `WHITELABEL_DEFAULTS`
- **MODIFY** `prisma/seed.ts` — حذف seeding الـ theme من OrganizationSettings

### Shared packages
- **MODIFY** `packages/shared/types/theme.ts` — توحيد `OrganizationTheme` مع `WhiteLabelConfig`
- **MODIFY** `packages/shared/tokens/white-label.ts` — تبسيط `WhiteLabelTheme`
- **MODIFY** `packages/api-client/src/modules/theme.ts` — تغيير endpoint من `/organization-settings/theme` إلى `/whitelabel/public`
- **MODIFY** `packages/api-client/src/modules/whitelabel.ts` — توحيد الـ type

### Dashboard
- **MODIFY** `lib/api/whitelabel.ts` — لا تغيير في الـ endpoint، فقط الـ type يتوسع
- **MODIFY** `lib/types/whitelabel.ts` — إضافة الحقول الجديدة
- **MODIFY** `components/providers/branding-provider.tsx` — تغذية من `BrandingConfig` الموسَّع
- **MODIFY** `components/features/white-label/branding-tab.tsx` — إضافة حقول colorAccent، colorPrimaryLight، colorPrimaryDark
- **DELETE** أي استدعاء dashboard لـ `GET/PATCH /organization-settings/theme`
- **MODIFY** `hooks/use-whitelabel.ts` — لا تغيير

### Mobile
- **MODIFY** `theme/ThemeProvider.tsx` — جلب `/whitelabel/public` عند startup وتطبيق الألوان ديناميكياً
- **MODIFY** `theme/tokens.ts` — قبول override ديناميكي للألوان من API

---

## Task 1: توسيع schema `WhiteLabelConfig` وحذف `theme` من `OrganizationSettings`

**Files:**
- Modify: `apps/backend/prisma/schema/config.prisma`
- Modify: `apps/backend/prisma/schema/organization-settings.prisma`
- Create: migration جديدة (بعد تشغيل `prisma migrate dev`)

- [ ] **Step 1: تعديل `config.prisma`**

استبدل نموذج `WhiteLabelConfig` بالكامل:

```prisma
model WhiteLabelConfig {
  id                String   @id @default(uuid())
  // Identity
  systemName        String   @default("CareKit Clinic") @map("system_name")
  systemNameAr      String   @default("عيادة كيركت") @map("system_name_ar")
  productTagline    String?  @map("product_tagline")
  // Assets
  logoUrl           String?  @map("logo_url")
  faviconUrl        String?  @map("favicon_url")
  // Colors
  colorPrimary      String   @default("#354FD8") @map("color_primary")
  colorPrimaryLight String   @default("#5B72E8") @map("color_primary_light")
  colorPrimaryDark  String   @default("#2438B0") @map("color_primary_dark")
  colorAccent       String   @default("#82CC17") @map("color_accent")
  colorAccentDark   String   @default("#5A9010") @map("color_accent_dark")
  colorBackground   String   @default("#EEF1F8") @map("color_background")
  // Typography
  fontFamily        String   @default("IBM Plex Sans Arabic") @map("font_family")
  fontUrl           String?  @map("font_url")
  // Platform config (SaaS-level, not clinic-editable)
  domain            String   @default("localhost")
  clinicCanEdit     Boolean  @default(false) @map("clinic_can_edit")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("white_label_config")
}
```

- [ ] **Step 2: حذف حقل `theme` من `organization-settings.prisma`**

في ملف `apps/backend/prisma/schema/organization-settings.prisma`، احذف السطر:
```prisma
  theme                 Json?    // OrganizationTheme — null = DEFAULT_THEME
```

- [ ] **Step 3: إنشاء Migration**

```bash
cd apps/backend && npx prisma migrate dev --name "consolidate_whitelabel_theme"
```

المتوقع: migration جديدة تضيف أعمدة `color_primary`، `color_primary_light`، `color_primary_dark`، `color_accent`، `color_accent_dark`، `color_background`، `font_url`، `product_tagline` إلى `white_label_config` وتحذف عمود `theme` من `clinic_settings`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema/config.prisma \
        apps/backend/prisma/schema/organization-settings.prisma \
        apps/backend/prisma/migrations/
git commit -m "refactor(schema): consolidate WhiteLabelConfig — absorb OrganizationSettings.theme fields"
```

---

## Task 2: تحديث `WhitelabelService` و DTO

**Files:**
- Modify: `apps/backend/src/modules/whitelabel/dto/update-config.dto.ts`
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.service.ts`

- [ ] **Step 1: تحديث `update-config.dto.ts`**

```typescript
import { IsBoolean, IsOptional, IsString, MaxLength, IsUrl, IsHexColor } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWhitelabelDto {
  // Identity
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  systemName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  systemNameAr?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  productTagline?: string;

  // Assets
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  logoUrl?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  faviconUrl?: string | null;

  // Colors
  @ApiPropertyOptional({ example: '#354FD8' }) @IsOptional() @IsHexColor()
  colorPrimary?: string;

  @ApiPropertyOptional({ example: '#5B72E8' }) @IsOptional() @IsHexColor()
  colorPrimaryLight?: string;

  @ApiPropertyOptional({ example: '#2438B0' }) @IsOptional() @IsHexColor()
  colorPrimaryDark?: string;

  @ApiPropertyOptional({ example: '#82CC17' }) @IsOptional() @IsHexColor()
  colorAccent?: string;

  @ApiPropertyOptional({ example: '#5A9010' }) @IsOptional() @IsHexColor()
  colorAccentDark?: string;

  @ApiPropertyOptional({ example: '#EEF1F8' }) @IsOptional() @IsHexColor()
  colorBackground?: string;

  // Typography
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  fontUrl?: string | null;

  // SaaS-level
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  clinicCanEdit?: boolean;
}
```

- [ ] **Step 2: تحديث `whitelabel.service.ts`**

استبدل الملف بالكامل:

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateWhitelabelDto } from './dto/update-config.dto.js';
import type { WhiteLabelConfig } from '@prisma/client';

export type PublicBranding = Pick<
  WhiteLabelConfig,
  | 'systemName'
  | 'systemNameAr'
  | 'productTagline'
  | 'logoUrl'
  | 'faviconUrl'
  | 'colorPrimary'
  | 'colorPrimaryLight'
  | 'colorPrimaryDark'
  | 'colorAccent'
  | 'colorAccentDark'
  | 'colorBackground'
  | 'fontFamily'
  | 'fontUrl'
>;

@Injectable()
export class WhitelabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<WhiteLabelConfig> {
    const cached = await this.cache.get<WhiteLabelConfig>(CACHE_KEYS.WHITELABEL);
    if (cached) return cached;

    const config = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    await this.cache.set(CACHE_KEYS.WHITELABEL, config, CACHE_TTL.WHITELABEL_CONFIG);
    return config;
  }

  async getPublicBranding(): Promise<PublicBranding> {
    const cached = await this.cache.get<PublicBranding>(CACHE_KEYS.WHITELABEL_PUBLIC);
    if (cached) return cached;

    const config = await this.get();
    const result: PublicBranding = {
      systemName:        config.systemName,
      systemNameAr:      config.systemNameAr,
      productTagline:    config.productTagline,
      logoUrl:           config.logoUrl,
      faviconUrl:        config.faviconUrl,
      colorPrimary:      config.colorPrimary,
      colorPrimaryLight: config.colorPrimaryLight,
      colorPrimaryDark:  config.colorPrimaryDark,
      colorAccent:       config.colorAccent,
      colorAccentDark:   config.colorAccentDark,
      colorBackground:   config.colorBackground,
      fontFamily:        config.fontFamily,
      fontUrl:           config.fontUrl,
    };
    await this.cache.set(CACHE_KEYS.WHITELABEL_PUBLIC, result, CACHE_TTL.WHITELABEL_CONFIG);
    return result;
  }

  async update(dto: UpdateWhitelabelDto): Promise<WhiteLabelConfig> {
    const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    if (!current.clinicCanEdit) {
      throw new ForbiddenException('Whitelabel config is locked. Contact CareKit support.');
    }
    const updated = await this.prisma.whiteLabelConfig.update({
      where: { id: current.id },
      data: dto,
    });
    await this.invalidate();
    return updated;
  }

  async adminUpdate(dto: UpdateWhitelabelDto): Promise<WhiteLabelConfig> {
    const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    const updated = await this.prisma.whiteLabelConfig.update({
      where: { id: current.id },
      data: dto,
    });
    await this.invalidate();
    return updated;
  }

  async getSystemName(): Promise<string> {
    const config = await this.get();
    return config.systemName;
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEYS.WHITELABEL);
    await this.cache.del(CACHE_KEYS.WHITELABEL_PUBLIC);
  }
}
```

- [ ] **Step 3: تشغيل الـ tests**

```bash
cd apps/backend && npm run test
```

المتوقع: جميع الـ tests تمر (قد تكون هناك type errors مؤقتة حتى نكمل Task 3).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/whitelabel/
git commit -m "refactor(whitelabel): expand service + DTO with full theme fields"
```

---

## Task 3: حذف ThemeService / ThemeController من organization-settings

**Files:**
- Delete: `apps/backend/src/modules/organization-settings/theme.service.ts`
- Delete: `apps/backend/src/modules/organization-settings/theme.controller.ts`
- Delete: `apps/backend/src/modules/organization-settings/dto/update-theme.dto.ts`
- Delete: `apps/backend/src/modules/organization-settings/clinic-theme.ts`
- Modify: `apps/backend/src/modules/organization-settings/organization-settings.module.ts`

- [ ] **Step 1: حذف الملفات الأربعة**

```bash
rm apps/backend/src/modules/organization-settings/theme.service.ts
rm apps/backend/src/modules/organization-settings/theme.controller.ts
rm apps/backend/src/modules/organization-settings/dto/update-theme.dto.ts
rm apps/backend/src/modules/organization-settings/clinic-theme.ts
```

- [ ] **Step 2: تحديث `organization-settings.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { OrganizationSettingsController } from './organization-settings.controller.js';
import { OrganizationSettingsService } from './organization-settings.service.js';

@Module({
  controllers: [OrganizationSettingsController],
  providers: [OrganizationSettingsService],
  exports: [OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
```

- [ ] **Step 3: تشغيل الـ tests**

```bash
cd apps/backend && npm run test
```

المتوقع: لا أخطاء compile.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/organization-settings/
git commit -m "refactor(organization-settings): remove ThemeService, ThemeController — merged into whitelabel"
```

---

## Task 4: تحديث Seed data

**Files:**
- Modify: `apps/backend/prisma/seed.data.ts`
- Modify: `apps/backend/prisma/seed.ts`

- [ ] **Step 1: تحديث `WHITELABEL_DEFAULTS` في `seed.data.ts`**

ابحث عن `WHITELABEL_DEFAULTS` (السطر ~202) واستبدله بـ:

```typescript
export const WHITELABEL_DEFAULTS = {
  systemName:        'CareKit Clinic',
  systemNameAr:      'عيادة كيركت',
  productTagline:    'إدارة العيادة',
  logoUrl:           null as string | null,
  faviconUrl:        null as string | null,
  colorPrimary:      '#354FD8',
  colorPrimaryLight: '#5B72E8',
  colorPrimaryDark:  '#2438B0',
  colorAccent:       '#82CC17',
  colorAccentDark:   '#5A9010',
  colorBackground:   '#EEF1F8',
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap' as string | null,
  domain:            'localhost',
  clinicCanEdit:     false,
};
```

- [ ] **Step 2: تحديث `seed.ts` — حذف seeding الـ theme**

في `seed.ts`، ابحث عن الجزء الذي يعمل `prisma.organizationSettings.create` ويتأكد أنه لا يشمل حقل `theme` بعد الآن (بسبب حذفه من الـ schema، Prisma سيرفضه تلقائياً).

إذا وُجد في الكود `theme: ...` أو `DEFAULT_THEME` ضمن `CLINIC_SETTINGS_DEFAULTS`، احذفه من `seed.data.ts`.

```bash
grep -n "theme\|DEFAULT_THEME" apps/backend/prisma/seed.data.ts
```

احذف أي سطر يضمّ `theme:` ضمن `CLINIC_SETTINGS_DEFAULTS`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma/seed.data.ts apps/backend/prisma/seed.ts
git commit -m "refactor(seeds): update WHITELABEL_DEFAULTS with full theme fields, remove theme from OrganizationSettings seed"
```

---

## Task 5: تحديث `@carekit/shared` — توحيد `OrganizationTheme`

**Files:**
- Modify: `packages/shared/types/theme.ts`
- Modify: `packages/shared/tokens/white-label.ts`
- Modify: `packages/shared/theme/generate-css.ts` (إذا لزم)

- [ ] **Step 1: تحديث `packages/shared/types/theme.ts`**

استبدل الملف بالكامل. هذا هو **مصدر الحقيقة الوحيد** لـ `OrganizationTheme`:

```typescript
/**
 * OrganizationTheme — the canonical shape returned by GET /whitelabel/public.
 * All apps (dashboard, mobile) consume this type.
 */
export interface OrganizationTheme {
  // Identity
  systemName:        string;
  systemNameAr:      string;
  productTagline:    string | null;
  // Assets
  logoUrl:           string | null;
  faviconUrl:        string | null;
  // Colors
  colorPrimary:      string;
  colorPrimaryLight: string;
  colorPrimaryDark:  string;
  colorAccent:       string;
  colorAccentDark:   string;
  colorBackground:   string;
  // Typography
  fontFamily:        string;
  fontUrl:           string | null;
}

export interface DerivedTokens {
  colorPrimaryGlow:  string;
  colorPrimaryUltra: string;
  colorAccentGlow:   string;
  colorAccentUltra:  string;
}

export const DEFAULT_THEME: OrganizationTheme = {
  systemName:        'CareKit',
  systemNameAr:      'كيركيت',
  productTagline:    'إدارة العيادة',
  logoUrl:           null,
  faviconUrl:        null,
  colorPrimary:      '#354FD8',
  colorPrimaryLight: '#5B72E8',
  colorPrimaryDark:  '#2438B0',
  colorAccent:       '#82CC17',
  colorAccentDark:   '#5A9010',
  colorBackground:   '#EEF1F8',
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
};
```

- [ ] **Step 2: تبسيط `packages/shared/tokens/white-label.ts`**

استبدل بالكامل ليعيد تصدير من `types/theme.ts` فقط (لا ازدواجية):

```typescript
// Re-export from canonical source — do not duplicate
export type { OrganizationTheme, DerivedTokens } from '../types/theme.js';
export { DEFAULT_THEME } from '../types/theme.js';
```

- [ ] **Step 3: التحقق من `generate-css.ts`**

افتح `packages/shared/theme/generate-css.ts` وتأكد أن الحقول المستخدمة تطابق `OrganizationTheme` الجديد:
- `theme.colorPrimary` ✓
- `theme.colorPrimaryLight` ✓  
- `theme.colorPrimaryDark` ✓
- `theme.colorAccent` ✓
- `theme.colorAccentDark` ✓
- `theme.colorBackground` ✓
- `theme.fontFamily` ✓

لا تغيير مطلوب في هذا الملف.

- [ ] **Step 4: Build packages**

```bash
cd packages/shared && npm run build 2>/dev/null || npx tsc --noEmit
```

المتوقع: لا أخطاء.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "refactor(shared): consolidate OrganizationTheme — single source of truth with identity + theme fields"
```

---

## Task 6: تحديث `@carekit/api-client`

**Files:**
- Modify: `packages/api-client/src/modules/theme.ts`
- Modify: `packages/api-client/src/modules/whitelabel.ts`

- [ ] **Step 1: تحديث `packages/api-client/src/modules/theme.ts`**

```typescript
import { apiRequest } from '../client.js'
import type { OrganizationTheme } from '@carekit/shared/types'

/**
 * Fetches public branding/theme from the unified whitelabel endpoint.
 * Used by mobile app on startup.
 */
export async function getTheme(): Promise<OrganizationTheme> {
  return apiRequest<OrganizationTheme>('/whitelabel/public')
}
```

- [ ] **Step 2: تحديث `packages/api-client/src/modules/whitelabel.ts`**

```typescript
import { apiRequest } from '../client.js'
import type { OrganizationTheme } from '@carekit/shared/types'

export async function getWhitelabelPublic(): Promise<OrganizationTheme> {
  return apiRequest<OrganizationTheme>('/whitelabel/public')
}
```

- [ ] **Step 3: Build**

```bash
cd packages/api-client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/
git commit -m "refactor(api-client): point theme + whitelabel modules to /whitelabel/public unified endpoint"
```

---

## Task 7: تحديث Dashboard — Types + BrandingProvider

**Files:**
- Modify: `apps/dashboard/lib/types/whitelabel.ts` (أو أنشئه إذا لم يكن موجوداً كملف مستقل)
- Modify: `apps/dashboard/components/providers/branding-provider.tsx`
- Modify: `apps/dashboard/lib/api/whitelabel.ts`

- [ ] **Step 1: تحديث types**

ابحث عن تعريف `WhiteLabelConfig` و `UpdateWhitelabelPayload` في dashboard:

```bash
find apps/dashboard/lib/types -name "whitelabel*" 2>/dev/null
grep -rn "WhiteLabelConfig\|UpdateWhitelabelPayload\|PublicBranding" apps/dashboard/lib/types --include="*.ts" -l
```

في الملف الذي يحتوي هذه الأنواع، حدّث `WhiteLabelConfig` و `PublicBranding` ليعكسا الحقول الجديدة:

```typescript
export interface WhiteLabelConfig {
  id: string;
  // Identity
  systemName:        string;
  systemNameAr:      string;
  productTagline:    string | null;
  // Assets
  logoUrl:           string | null;
  faviconUrl:        string | null;
  // Colors
  colorPrimary:      string;
  colorPrimaryLight: string;
  colorPrimaryDark:  string;
  colorAccent:       string;
  colorAccentDark:   string;
  colorBackground:   string;
  // Typography
  fontFamily:        string;
  fontUrl:           string | null;
  // SaaS config
  domain:            string;
  clinicCanEdit:     boolean;
  createdAt:         string;
  updatedAt:         string;
}

export type PublicBranding = Omit<WhiteLabelConfig, 'id' | 'domain' | 'clinicCanEdit' | 'createdAt' | 'updatedAt'>;

export type UpdateWhitelabelPayload = Partial<Omit<WhiteLabelConfig, 'id' | 'createdAt' | 'updatedAt'>>;
```

- [ ] **Step 2: تحديث `branding-provider.tsx`**

في دالة `fetchBranding`، استبدل منطق استخراج الألوان:

```typescript
// قبل (بيانات ناقصة)
const primary = data.primaryColor ?? data.primary_color
const accent = data.secondaryColor ?? data.secondary_color

// بعد (حقول موحدة من الـ API الجديد)
const primary   = data.colorPrimary
const accent    = data.colorAccent
const bgColor   = data.colorBackground
const fontFam   = data.fontFamily
const fontSrc   = data.fontUrl
const logoSrc   = data.logoUrl
```

أضف أيضاً تطبيق `--bg` و `--font-primary` و `--font-url` في دوال `injectLightVars`/`injectDarkVars` بحيث تُطبَّق أيضاً عند startup.

النص الكامل للجزء المعدَّل في `fetchBranding`:

```typescript
async function fetchBranding(): Promise<BrandingColors | null> {
  if (brandingCache && Date.now() - brandingCache.ts < BRANDING_CACHE_TTL) {
    return brandingCache.colors
  }
  try {
    const res = await fetch(`${API_BASE}/whitelabel/public`)
    if (!res.ok) {
      brandingCache = { colors: null, ts: Date.now() }
      return null
    }
    const body = await res.json()
    const data: PublicBranding = body.data ?? body

    if (!data.colorPrimary || !isValidHex(data.colorPrimary)) {
      brandingCache = { colors: null, ts: Date.now() }
      return null
    }
    const colors: BrandingColors = {
      primary:    data.colorPrimary,
      accent:     isValidHex(data.colorAccent) ? data.colorAccent : data.colorPrimary,
      background: data.colorBackground,
      fontFamily: data.fontFamily,
      fontUrl:    data.fontUrl ?? null,
    }
    brandingCache = { colors, ts: Date.now() }
    return colors
  } catch {
    brandingCache = { colors: null, ts: Date.now() }
    return null
  }
}
```

> ملاحظة: إذا كان `BrandingColors` في `lib/color-utils.ts` لا يحتوي `background`، `fontFamily`، `fontUrl`، فيجب توسيعه بهذه الحقول. تحقق أولاً:
> ```bash
> grep -n "BrandingColors" apps/dashboard/lib/color-utils.ts
> ```

- [ ] **Step 3: تحديث `lib/api/whitelabel.ts`**

أضف import للـ type الجديد:

```typescript
import type { WhiteLabelConfig, UpdateWhitelabelPayload, PublicBranding } from "@/lib/types/whitelabel"
```

لا تغيير في الـ endpoint URLs (تبقى `/whitelabel` و `/whitelabel/public`).

- [ ] **Step 4: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

المتوقع: لا أخطاء.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/types/ apps/dashboard/lib/api/whitelabel.ts apps/dashboard/components/providers/branding-provider.tsx
git commit -m "refactor(dashboard): update whitelabel types + branding-provider for unified theme fields"
```

---

## Task 8: تحديث Dashboard — `branding-tab.tsx`

**Files:**
- Modify: `apps/dashboard/components/features/white-label/branding-tab.tsx`

- [ ] **Step 1: توسيع النموذج**

استبدل الـ state variables القديمة (`primaryColor`, `secondaryColor`) بالحقول الجديدة:

```typescript
const [systemName, setSystemName] = useState("")
const [systemNameAr, setSystemNameAr] = useState("")
const [productTagline, setProductTagline] = useState("")
const [colorPrimary, setColorPrimary] = useState("")
const [colorPrimaryLight, setColorPrimaryLight] = useState("")
const [colorPrimaryDark, setColorPrimaryDark] = useState("")
const [colorAccent, setColorAccent] = useState("")
const [colorAccentDark, setColorAccentDark] = useState("")
const [colorBackground, setColorBackground] = useState("")
const [fontFamily, setFontFamily] = useState("")
const [fontUrl, setFontUrl] = useState("")
const [logoUrl, setLogoUrl] = useState("")
const [faviconUrl, setFaviconUrl] = useState("")
```

في `useEffect` على `whitelabel`:

```typescript
useEffect(() => {
  if (!whitelabel) return
  setSystemName(whitelabel.systemName ?? "")
  setSystemNameAr(whitelabel.systemNameAr ?? "")
  setProductTagline(whitelabel.productTagline ?? "")
  setColorPrimary(whitelabel.colorPrimary ?? "")
  setColorPrimaryLight(whitelabel.colorPrimaryLight ?? "")
  setColorPrimaryDark(whitelabel.colorPrimaryDark ?? "")
  setColorAccent(whitelabel.colorAccent ?? "")
  setColorAccentDark(whitelabel.colorAccentDark ?? "")
  setColorBackground(whitelabel.colorBackground ?? "")
  setFontFamily(whitelabel.fontFamily ?? "")
  setFontUrl(whitelabel.fontUrl ?? "")
  setLogoUrl(whitelabel.logoUrl ?? "")
  setFaviconUrl(whitelabel.faviconUrl ?? "")
}, [whitelabel])
```

في `handleSave`:

```typescript
const handleSave = () => {
  onSave({
    systemName,
    systemNameAr,
    productTagline: productTagline || null,
    colorPrimary,
    colorPrimaryLight,
    colorPrimaryDark,
    colorAccent,
    colorAccentDark,
    colorBackground,
    fontFamily,
    fontUrl: fontUrl || null,
    logoUrl: logoUrl || null,
    faviconUrl: faviconUrl || null,
  })
  if (isValidHex(colorPrimary)) {
    apply({ primary: colorPrimary, accent: isValidHex(colorAccent) ? colorAccent : colorPrimary })
  }
}
```

في الـ JSX، أضف حقول اللون الجديدة بنفس نمط الحقول الموجودة (`ColorSwatchInput` + `Input`):

- `colorPrimaryLight` — label: "اللون الأساسي الفاتح"
- `colorPrimaryDark` — label: "اللون الأساسي الداكن"
- `colorAccent` — label: "لون التمييز"
- `colorAccentDark` — label: "لون التمييز الداكن"
- `colorBackground` — label: "لون الخلفية"
- `productTagline` — `Input` عادي
- `fontUrl` — `Input` عادي

- [ ] **Step 2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/features/white-label/branding-tab.tsx
git commit -m "feat(dashboard/whitelabel): expand branding tab with full theme color and font fields"
```

---

## Task 9: إزالة أي استدعاء للـ theme endpoint القديم من Dashboard

**Files:**
- Modify: أي ملف يستدعي `/organization-settings/theme`

- [ ] **Step 1: البحث**

```bash
grep -rn "organization-settings/theme\|fetchTheme\|updateTheme\|resetTheme\|useTheme" \
  apps/dashboard --include="*.ts" --include="*.tsx" | grep -v node_modules
```

- [ ] **Step 2: التعديل**

لكل نتيجة:
- إذا كان الملف يجلب الـ theme ليطبق الألوان → استبدل بـ `fetchPublicBranding()` من `lib/api/whitelabel.ts`
- إذا كان الملف يُعدِّل الـ theme → استبدل بـ `updateWhitelabel()` من `lib/api/whitelabel.ts`
- إذا كانت `resetTheme` → احذف الوظيفة أو حوّلها لـ reset عبر `updateWhitelabel(DEFAULT_THEME_FIELDS)`

- [ ] **Step 3: Typecheck + Test**

```bash
cd apps/dashboard && npm run typecheck && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/
git commit -m "refactor(dashboard): remove all calls to deprecated /organization-settings/theme endpoint"
```

---

## Task 10: تحديث Mobile — ربط الثيم بـ `/whitelabel/public`

**Context:** الموبايل حالياً يستخدم `theme/tokens.ts` التي تجلب tokens من `@carekit/shared/tokens` (ثابتة في bundle). لا يوجد حالياً جلب ديناميكي من الـ API. هذه المهمة تضيف dynamic theming عند startup.

**Files:**
- Modify: `apps/mobile/theme/ThemeProvider.tsx`
- Modify: `apps/mobile/theme/tokens.ts`

- [ ] **Step 1: تعديل `tokens.ts` ليقبل override ديناميكي**

```typescript
import { colors, typography, spacing, radius, rnShadows, animations } from '@carekit/shared/tokens';
import type { OrganizationTheme } from '@carekit/shared/types';

function buildTheme(overrides?: Partial<OrganizationTheme>) {
  return {
    colors: {
      ...colors,
      primary: overrides?.colorPrimary ?? colors.primary[600],
      accent:  overrides?.colorAccent  ?? colors.secondary[500],
      background: overrides?.colorBackground ?? colors.gray[50],
    },
    typography,
    spacing,
    radius,
    shadows: rnShadows,
    animations,
  } as const;
}

export const theme = buildTheme();
export type AppTheme = ReturnType<typeof buildTheme>;
export { buildTheme };
```

- [ ] **Step 2: تعديل `ThemeProvider.tsx` لجلب `/whitelabel/public` عند startup**

```typescript
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { buildTheme, type AppTheme } from './tokens';
import type { OrganizationTheme } from '@carekit/shared/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5100/api/v1';

interface ThemeContextValue {
  theme: AppTheme;
  isRTL: boolean;
  language: 'ar' | 'en';
  clinicTheme: OrganizationTheme | null;
}

const defaultTheme = buildTheme();

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  isRTL: true,
  language: 'ar',
  clinicTheme: null,
});

interface ThemeProviderProps {
  children: ReactNode;
  language?: 'ar' | 'en';
}

export function ThemeProvider({ children, language = 'ar' }: ThemeProviderProps) {
  const isRTL = language === 'ar';
  const [appTheme, setAppTheme] = useState<AppTheme>(defaultTheme);
  const [clinicTheme, setOrganizationTheme] = useState<OrganizationTheme | null>(null);

  useEffect(() => {
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [isRTL]);

  useEffect(() => {
    fetch(`${API_BASE}/whitelabel/public`)
      .then((r) => r.json())
      .then((body) => {
        const data: OrganizationTheme = body.data ?? body;
        setOrganizationTheme(data);
        setAppTheme(buildTheme(data));
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: appTheme, isRTL, language, clinicTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 3: Typecheck Mobile**

```bash
cd apps/mobile && npx tsc --noEmit
```

المتوقع: لا أخطاء. (تحقق من أن `EXPO_PUBLIC_API_URL` موجود في `.env`)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/theme/
git commit -m "feat(mobile): load dynamic theme from /whitelabel/public at startup"
```

---

## Task 11: تنظيف Cache Keys

**Files:**
- Modify: `apps/backend/src/config/constants/cache.ts`

- [ ] **Step 1: حذف `CLINIC_SETTINGS_TIMEZONE` من CACHE_KEYS إذا لم يعد مستخدماً**

```bash
grep -rn "CLINIC_SETTINGS_TIMEZONE" apps/backend/src --include="*.ts"
```

إذا ظهرت نتائج في `organization-settings.service.ts` فقط، تأكد أن الـ service لا يزال يستخدمه (timezone ما زال في `OrganizationSettings` وهذا صحيح — لا تحذفه).

- [ ] **Step 2: إزالة مفاتيح cache غير المستخدمة**

```bash
grep -rn "WHITELABEL_PUBLIC\|CLINIC_SETTINGS_PUBLIC" apps/backend/src --include="*.ts"
```

تأكد أن كل مفتاح مستخدم. إذا وُجد مفتاح غير مستخدم بعد الحذف، أزله من `CACHE_KEYS` و `CACHE_TTL`.

- [ ] **Step 3: Commit إذا تغير شيء**

```bash
git add apps/backend/src/config/constants/cache.ts
git commit -m "refactor(backend): clean up unused cache keys after theme consolidation"
```

---

## Task 12: التحقق الشامل

- [ ] **Step 1: Backend tests**

```bash
cd apps/backend && npm run test && npm run test:e2e
```

المتوقع: جميع الـ tests تمر.

- [ ] **Step 2: Dashboard typecheck + tests**

```bash
cd apps/dashboard && npm run typecheck && npm run test
```

- [ ] **Step 3: Mobile typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Full build**

```bash
cd /Users/tariq/Documents/my_programs/CareKit && npm run build
```

- [ ] **Step 5: تشغيل Seed للتحقق**

```bash
cd apps/backend && npm run prisma:seed
```

المتوقع: seed يكتمل بدون أخطاء.

---

## ملاحظات التنفيذ

1. **Migration**: لا تمس الـ migrations القديمة. Migration الجديدة تضيف الأعمدة الجديدة وتحذف `theme` column فقط.
2. **Backward compat**: الـ endpoint `GET /whitelabel/public` يبقى نفس الـ URL، فقط الـ response يتوسع. الـ clients القديمة لن تتأثر.
3. **`OrganizationSettings.timezone`**: يبقى في `OrganizationSettings` كما هو — هو يخص إعدادات التشغيل وليس الهوية البصرية.
4. **`clinicCanEdit` flag**: يبقى في `WhiteLabelConfig` ويُطبَّق في `update()` — الـ admin يتحكم في من يعدّل.
5. **Mobile**: التغيير لا يكسر شيئاً — إذا فشل الـ API call يرجع للـ defaults.
