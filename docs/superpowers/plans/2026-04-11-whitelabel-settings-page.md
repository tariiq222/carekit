# Whitelabel Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/settings/whitelabel` page in the leaderboard dashboard — form to edit clinic branding (names, logo, favicon, colors, font, domain) with save-to-apply behavior.

**Architecture:** Standard dashboard page (no live preview). Fetches config via `GET /whitelabel`, saves via `PUT /whitelabel`, uploads images via two new backend endpoints (`POST /whitelabel/logo`, `POST /whitelabel/favicon`). On successful save, calls `applyWhitelabel()` to reflect changes in DOM immediately.

**Tech Stack:** NestJS 11 (backend upload endpoints), Vite + React 19 + TanStack Router/Query, react-hook-form + zod, shadcn/ui, Tailwind 4, MinIO (storage).

---

## File Structure

**Backend (NestJS):**
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.controller.ts` — add two upload endpoints
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.service.ts` — add `uploadLogo()` and `uploadFavicon()` helpers
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.module.ts` — import `StorageModule` if not already

**API Client (shared package):**
- Modify: `packages/api-client/src/types/whitelabel.ts` — replace type with one matching real API shape
- Modify: `packages/api-client/src/modules/whitelabel.ts` — add `get()`, `update()`, `uploadLogo()`, `uploadFavicon()`

**Leaderboard (Vite + React):**
- Create: `apps/leaderboard/src/hooks/use-whitelabel.ts` — query + mutation hooks
- Create: `apps/leaderboard/src/lib/schemas/whitelabel.schema.ts` — zod schema + inferred type
- Create: `apps/leaderboard/src/routes/_dashboard/settings/whitelabel/index.tsx` — the page (< 350 lines)
- Auto-updated: `apps/leaderboard/src/routeTree.gen.ts` (TanStack Router codegen)

---

## Task 1: Backend — Upload Endpoints for Logo & Favicon

**Files:**
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.service.ts`
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.controller.ts`
- Modify: `apps/backend/src/modules/whitelabel/whitelabel.module.ts`

### - [ ] Step 1: Add `uploadLogo` and `uploadFavicon` methods to the service

Open `apps/backend/src/modules/whitelabel/whitelabel.service.ts`. Add the `StorageService` dependency and two methods:

```typescript
// Add to imports
import { StorageService } from '../../common/storage/storage.service.js';

// Update constructor
constructor(
  private readonly prisma: PrismaService,
  private readonly cache: CacheService,
  private readonly storage: StorageService,
) {}

// Add these methods at the end of the class, before the closing brace
async uploadLogo(file: Express.Multer.File): Promise<{ url: string }> {
  const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();
  if (!current.clinicCanEdit) {
    throw new ForbiddenException(
      'Whitelabel config is locked. Contact CareKit support.',
    );
  }
  const url = await this.storage.uploadPublic(file, 'whitelabel/logo');
  const updated = await this.prisma.whiteLabelConfig.update({
    where: { id: current.id },
    data: { logoUrl: url },
  });
  await this.invalidate();
  return { url: updated.logoUrl };
}

async uploadFavicon(file: Express.Multer.File): Promise<{ url: string }> {
  const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();
  if (!current.clinicCanEdit) {
    throw new ForbiddenException(
      'Whitelabel config is locked. Contact CareKit support.',
    );
  }
  const url = await this.storage.uploadPublic(file, 'whitelabel/favicon');
  const updated = await this.prisma.whiteLabelConfig.update({
    where: { id: current.id },
    data: { faviconUrl: url },
  });
  await this.invalidate();
  return { url: updated.faviconUrl };
}
```

**Note:** If `StorageService.uploadPublic(file, prefix)` does not exist, instead look at how `services/avatar.service.ts` uploads files (same repo, uses MinIO) and mirror its exact pattern. Open `apps/backend/src/modules/services/avatar.service.ts` and copy the upload call signature.

### - [ ] Step 2: Wire `StorageModule` into `whitelabel.module.ts`

Open `apps/backend/src/modules/whitelabel/whitelabel.module.ts`. Ensure `StorageModule` is imported (it may already be global — check `apps/backend/src/common/storage.module.ts`). If not global, add it to the `imports` array.

### - [ ] Step 3: Add controller endpoints

Open `apps/backend/src/modules/whitelabel/whitelabel.controller.ts`. Add these imports at the top:

```typescript
import {
  BadRequestException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
```

Then add these two endpoints below the `update()` method:

```typescript
@Post('logo')
@CheckPermissions({ module: 'whitelabel', action: 'edit' })
@ApiOperation({ summary: 'Upload clinic logo (jpeg, png, webp, svg; max 5MB)' })
@ApiResponse({ status: 201, description: 'Logo uploaded' })
@ApiStandardResponses()
@UseInterceptors(
  FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(
          file.mimetype,
        )
      ) {
        return cb(
          new BadRequestException('Only jpeg, png, webp, svg allowed'),
          false,
        );
      }
      cb(null, true);
    },
  }),
)
async uploadLogo(@UploadedFile() file: Express.Multer.File) {
  if (!file) throw new BadRequestException('No file uploaded');
  return this.whitelabelService.uploadLogo(file);
}

@Post('favicon')
@CheckPermissions({ module: 'whitelabel', action: 'edit' })
@ApiOperation({ summary: 'Upload clinic favicon (png, svg, ico; max 1MB)' })
@ApiResponse({ status: 201, description: 'Favicon uploaded' })
@ApiStandardResponses()
@UseInterceptors(
  FileInterceptor('image', {
    limits: { fileSize: 1 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (
        !['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(
          file.mimetype,
        )
      ) {
        return cb(
          new BadRequestException('Only png, svg, ico allowed'),
          false,
        );
      }
      cb(null, true);
    },
  }),
)
async uploadFavicon(@UploadedFile() file: Express.Multer.File) {
  if (!file) throw new BadRequestException('No file uploaded');
  return this.whitelabelService.uploadFavicon(file);
}
```

### - [ ] Step 4: Run backend build

Run: `cd apps/backend && npm run build`
Expected: `dist/` built with zero TypeScript errors.

### - [ ] Step 5: Commit

```bash
git add apps/backend/src/modules/whitelabel/
git commit -m "feat(whitelabel): add logo and favicon upload endpoints"
```

---

## Task 2: API Client — Update Types & Add Functions

**Files:**
- Modify: `packages/api-client/src/types/whitelabel.ts`
- Modify: `packages/api-client/src/modules/whitelabel.ts`

### - [ ] Step 1: Replace the whitelabel type

Open `packages/api-client/src/types/whitelabel.ts` and replace the entire contents with:

```typescript
export interface WhitelabelConfig {
  id: string
  systemName: string
  systemNameAr: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
  fontFamily: string | null
  domain: string | null
  clinicCanEdit: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicWhitelabelConfig {
  systemName: string
  systemNameAr: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
}

export interface UpdateWhitelabelPayload {
  systemName?: string
  systemNameAr?: string
  logoUrl?: string
  faviconUrl?: string
  primaryColor?: string
  secondaryColor?: string
  fontFamily?: string
  domain?: string
}

export interface UploadedImageResponse {
  url: string
}
```

### - [ ] Step 2: Update the whitelabel api module

Open `packages/api-client/src/modules/whitelabel.ts` and replace its entire contents with:

```typescript
import { apiRequest } from '../client.js'
import type {
  WhitelabelConfig,
  PublicWhitelabelConfig,
  UpdateWhitelabelPayload,
  UploadedImageResponse,
} from '../types/whitelabel.js'

export async function getPublic(): Promise<PublicWhitelabelConfig> {
  return apiRequest<PublicWhitelabelConfig>('/whitelabel/public')
}

export async function get(): Promise<WhitelabelConfig> {
  return apiRequest<WhitelabelConfig>('/whitelabel')
}

export async function update(
  payload: UpdateWhitelabelPayload,
): Promise<WhitelabelConfig> {
  return apiRequest<WhitelabelConfig>('/whitelabel', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function uploadLogo(file: File): Promise<UploadedImageResponse> {
  const formData = new FormData()
  formData.append('image', file)
  return apiRequest<UploadedImageResponse>('/whitelabel/logo', {
    method: 'POST',
    body: formData,
  })
}

export async function uploadFavicon(
  file: File,
): Promise<UploadedImageResponse> {
  const formData = new FormData()
  formData.append('image', file)
  return apiRequest<UploadedImageResponse>('/whitelabel/favicon', {
    method: 'POST',
    body: formData,
  })
}
```

### - [ ] Step 3: Check `apiRequest` handles FormData correctly

Open `packages/api-client/src/client.ts`. Verify that when `body` is a `FormData` instance, the function does **not** set `Content-Type: application/json` header (the browser must set the multipart boundary automatically).

If it unconditionally sets JSON content-type, modify it to skip that header when `body instanceof FormData`. Example fix:

```typescript
const isFormData = options?.body instanceof FormData
const headers: Record<string, string> = {
  ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(options?.headers as Record<string, string>),
}
```

Only make this change if needed. Leave the rest of `client.ts` untouched.

### - [ ] Step 4: Check existing callers of WhitelabelConfig

Run: `grep -rn "WhitelabelConfig" packages/api-client apps/leaderboard apps/mobile`

The old type had `clinicName`/`clinicNameAr`/`direction`/`locale`. If any caller still uses those, update them:
- `apps/leaderboard/src/lib/whitelabel/apply.ts` uses `config.clinicNameAr`, `config.clinicName`, `config.direction`, `config.locale`, `config.fontFamily`.

Update `apply.ts` to use `systemNameAr`/`systemName` and drop the `direction`/`locale` lines (they belong to the clinic, not whitelabel). New version:

```typescript
import type { WhitelabelConfig, PublicWhitelabelConfig } from '@carekit/api-client'

type BrandingConfig = WhitelabelConfig | PublicWhitelabelConfig

export function applyWhitelabel(config: BrandingConfig): void {
  const root = document.documentElement

  root.style.setProperty('--primary', config.primaryColor)
  root.style.setProperty('--accent', config.secondaryColor)

  const fontFamily = 'fontFamily' in config ? config.fontFamily : null
  if (fontFamily && fontFamily !== 'default') {
    loadGoogleFont(fontFamily)
    root.style.setProperty(
      '--font-sans',
      `'${fontFamily}', 'IBM Plex Sans Arabic', system-ui, sans-serif`,
    )
  }

  document.title = config.systemNameAr || config.systemName || 'CareKit'

  if (config.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = config.faviconUrl
  }
}

function loadGoogleFont(family: string): void {
  const encoded = encodeURIComponent(family)
  const id = `gfont-${encoded}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`
  document.head.appendChild(link)
}
```

### - [ ] Step 5: Type-check the packages

Run: `cd packages/api-client && npm run build 2>&1 || npx tsc --noEmit`
Expected: zero TypeScript errors.

Run: `cd apps/leaderboard && npm run typecheck`
Expected: zero TypeScript errors. If other files break due to the type change, update them minimally.

### - [ ] Step 6: Commit

```bash
git add packages/api-client/ apps/leaderboard/src/lib/whitelabel/apply.ts
git commit -m "feat(api-client): add whitelabel get/update/upload functions"
```

---

## Task 3: Leaderboard — Zod Schema

**Files:**
- Create: `apps/leaderboard/src/lib/schemas/whitelabel.schema.ts`

### - [ ] Step 1: Write the schema file

Create `apps/leaderboard/src/lib/schemas/whitelabel.schema.ts` with:

```typescript
import { z } from 'zod'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export const whitelabelFormSchema = z.object({
  systemName: z.string().min(1, 'الاسم مطلوب').max(255),
  systemNameAr: z.string().min(1, 'الاسم العربي مطلوب').max(255),
  logoUrl: z
    .string()
    .url('يجب أن يكون رابطًا صحيحًا')
    .max(2000)
    .optional()
    .or(z.literal('')),
  faviconUrl: z
    .string()
    .url('يجب أن يكون رابطًا صحيحًا')
    .max(2000)
    .optional()
    .or(z.literal('')),
  primaryColor: z
    .string()
    .regex(HEX_COLOR, 'استخدم صيغة HEX مثل #354FD8')
    .max(7),
  secondaryColor: z
    .string()
    .regex(HEX_COLOR, 'استخدم صيغة HEX مثل #82CC17')
    .max(7),
  fontFamily: z.string().max(100).optional().or(z.literal('')),
  domain: z.string().max(255).optional().or(z.literal('')),
})

export type WhitelabelFormValues = z.infer<typeof whitelabelFormSchema>
```

### - [ ] Step 2: Commit

```bash
git add apps/leaderboard/src/lib/schemas/whitelabel.schema.ts
git commit -m "feat(leaderboard): add whitelabel form zod schema"
```

---

## Task 4: Leaderboard — Query Hooks

**Files:**
- Create: `apps/leaderboard/src/hooks/use-whitelabel.ts`
- Modify: `apps/leaderboard/src/lib/query-keys.ts` (ensure `whitelabel.config` key exists — it already does)

### - [ ] Step 1: Write the hooks file

Create `apps/leaderboard/src/hooks/use-whitelabel.ts` with:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { whitelabelApi } from '@carekit/api-client'
import type { UpdateWhitelabelPayload } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useWhitelabel() {
  return useQuery({
    queryKey: QUERY_KEYS.whitelabel.config,
    queryFn: () => whitelabelApi.get(),
  })
}

export function useUpdateWhitelabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateWhitelabelPayload) =>
      whitelabelApi.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.whitelabel.config })
    },
  })
}

export function useUploadLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => whitelabelApi.uploadLogo(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.whitelabel.config })
    },
  })
}

export function useUploadFavicon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => whitelabelApi.uploadFavicon(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.whitelabel.config })
    },
  })
}
```

### - [ ] Step 2: Type-check

Run: `cd apps/leaderboard && npm run typecheck`
Expected: zero errors.

### - [ ] Step 3: Commit

```bash
git add apps/leaderboard/src/hooks/use-whitelabel.ts
git commit -m "feat(leaderboard): add whitelabel query hooks"
```

---

## Task 5: Leaderboard — Settings Whitelabel Page

**Files:**
- Create: `apps/leaderboard/src/routes/_dashboard/settings/whitelabel/index.tsx`

### - [ ] Step 1: Create the page file

Create `apps/leaderboard/src/routes/_dashboard/settings/whitelabel/index.tsx` with:

```tsx
import { useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdateWhitelabelPayload } from '@carekit/api-client'
import {
  useWhitelabel,
  useUpdateWhitelabel,
  useUploadLogo,
  useUploadFavicon,
} from '@/hooks/use-whitelabel'
import {
  whitelabelFormSchema,
  type WhitelabelFormValues,
} from '@/lib/schemas/whitelabel.schema'
import { applyWhitelabel } from '@/lib/whitelabel/apply'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HIcon } from '@/components/shared/hicon'

export const Route = createFileRoute('/_dashboard/settings/whitelabel/')({
  component: WhitelabelSettingsPage,
})

const FONT_OPTIONS = [
  { value: 'default', label: 'الافتراضي (IBM Plex Sans Arabic)' },
  { value: 'Cairo', label: 'Cairo' },
  { value: 'Tajawal', label: 'Tajawal' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' },
  { value: 'Almarai', label: 'Almarai' },
]

function WhitelabelSettingsPage() {
  const { data, isLoading } = useWhitelabel()
  const updateMutation = useUpdateWhitelabel()
  const uploadLogoMutation = useUploadLogo()
  const uploadFaviconMutation = useUploadFavicon()

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<WhitelabelFormValues>({
    resolver: zodResolver(whitelabelFormSchema),
    values: {
      systemName: data?.systemName ?? '',
      systemNameAr: data?.systemNameAr ?? '',
      logoUrl: data?.logoUrl ?? '',
      faviconUrl: data?.faviconUrl ?? '',
      primaryColor: data?.primaryColor ?? '#354FD8',
      secondaryColor: data?.secondaryColor ?? '#82CC17',
      fontFamily: data?.fontFamily ?? 'default',
      domain: data?.domain ?? '',
    },
  })

  if (isLoading) return <SkeletonPage />
  if (!data) {
    return (
      <p className="text-[var(--muted)] p-6">
        تعذر تحميل إعدادات العلامة التجارية
      </p>
    )
  }

  const locked = !data.clinicCanEdit

  const onSubmit = (values: WhitelabelFormValues) => {
    const payload: UpdateWhitelabelPayload = {
      systemName: values.systemName,
      systemNameAr: values.systemNameAr,
      logoUrl: values.logoUrl || undefined,
      faviconUrl: values.faviconUrl || undefined,
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
      fontFamily: values.fontFamily || undefined,
      domain: values.domain || undefined,
    }
    updateMutation.mutate(payload, {
      onSuccess: (updated) => {
        applyWhitelabel(updated)
      },
    })
  }

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadLogoMutation.mutate(file, {
      onSuccess: (res) => form.setValue('logoUrl', res.url, { shouldDirty: true }),
    })
  }

  const handleFaviconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadFaviconMutation.mutate(file, {
      onSuccess: (res) => form.setValue('faviconUrl', res.url, { shouldDirty: true }),
    })
  }

  const logoUrl = form.watch('logoUrl')
  const faviconUrl = form.watch('faviconUrl')

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <PageHeader
        title="إعدادات العلامة التجارية"
        description="اسم النظام، الشعار، الألوان، والخطوط"
        actions={
          <Button type="submit" disabled={locked || updateMutation.isPending}>
            <HIcon name="hgi-floppy-disk" className="me-2" />
            {updateMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Button>
        }
      />

      {locked && (
        <div className="rounded-[var(--radius-md)] border border-[var(--warning)]/30 bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning)]">
          إعدادات العلامة التجارية مقفلة. تواصل مع فريق CareKit لتفعيل التعديل.
        </div>
      )}

      {/* Identity */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-solid)] p-6 space-y-5">
        <h2 className="text-base font-semibold text-[var(--fg)]">الهوية البصرية</h2>

        <div className="space-y-2">
          <Label>الشعار</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="logo"
                className="size-14 rounded-[var(--radius-md)] object-contain border border-[var(--border-soft)] bg-[var(--surface)]"
              />
            ) : (
              <div className="size-14 rounded-[var(--radius-md)] border border-dashed border-[var(--border-soft)] bg-[var(--surface)] flex items-center justify-center text-[var(--muted)]">
                <HIcon name="hgi-image-02" />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={locked || uploadLogoMutation.isPending}
              onClick={() => logoInputRef.current?.click()}
            >
              <HIcon name="hgi-upload-02" className="me-2" />
              {uploadLogoMutation.isPending
                ? 'جارٍ الرفع...'
                : logoUrl
                  ? 'تغيير'
                  : 'رفع'}
            </Button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoFile}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>الفافيكون</Label>
          <div className="flex items-center gap-3">
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt="favicon"
                className="size-10 rounded-[var(--radius-sm)] object-contain border border-[var(--border-soft)] bg-[var(--surface)]"
              />
            ) : (
              <div className="size-10 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-soft)] bg-[var(--surface)] flex items-center justify-center text-[var(--muted)]">
                <HIcon name="hgi-image-02" />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={locked || uploadFaviconMutation.isPending}
              onClick={() => faviconInputRef.current?.click()}
            >
              <HIcon name="hgi-upload-02" className="me-2" />
              {uploadFaviconMutation.isPending
                ? 'جارٍ الرفع...'
                : faviconUrl
                  ? 'تغيير'
                  : 'رفع'}
            </Button>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/x-icon"
              className="hidden"
              onChange={handleFaviconFile}
            />
          </div>
        </div>
      </section>

      {/* Names */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-solid)] p-6 space-y-5">
        <h2 className="text-base font-semibold text-[var(--fg)]">الأسماء</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="systemNameAr">اسم النظام (عربي)</Label>
            <Input
              id="systemNameAr"
              disabled={locked}
              {...form.register('systemNameAr')}
            />
            {form.formState.errors.systemNameAr && (
              <p className="text-xs text-[var(--error)]">
                {form.formState.errors.systemNameAr.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemName">اسم النظام (إنجليزي)</Label>
            <Input
              id="systemName"
              disabled={locked}
              {...form.register('systemName')}
            />
            {form.formState.errors.systemName && (
              <p className="text-xs text-[var(--error)]">
                {form.formState.errors.systemName.message}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-solid)] p-6 space-y-5">
        <h2 className="text-base font-semibold text-[var(--fg)]">الألوان</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColorField
            label="اللون الأساسي"
            value={form.watch('primaryColor')}
            onChange={(v) =>
              form.setValue('primaryColor', v, { shouldDirty: true })
            }
            error={form.formState.errors.primaryColor?.message}
            disabled={locked}
          />
          <ColorField
            label="اللون الثانوي"
            value={form.watch('secondaryColor')}
            onChange={(v) =>
              form.setValue('secondaryColor', v, { shouldDirty: true })
            }
            error={form.formState.errors.secondaryColor?.message}
            disabled={locked}
          />
        </div>
      </section>

      {/* Font + Domain */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-solid)] p-6 space-y-5">
        <h2 className="text-base font-semibold text-[var(--fg)]">الخط والنطاق</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الخط</Label>
            <Select
              value={form.watch('fontFamily') || 'default'}
              onValueChange={(v) =>
                form.setValue('fontFamily', v, { shouldDirty: true })
              }
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">النطاق</Label>
            <Input
              id="domain"
              placeholder="clinic.carekit.app"
              disabled={locked}
              {...form.register('domain')}
            />
          </div>
        </div>
      </section>
    </form>
  )
}

function ColorField({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] cursor-pointer bg-transparent"
        />
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="w-32 font-mono uppercase"
        />
      </div>
      {error && <p className="text-xs text-[var(--error)]">{error}</p>}
    </div>
  )
}
```

### - [ ] Step 2: Verify file is under 350 lines

Run: `wc -l apps/leaderboard/src/routes/_dashboard/settings/whitelabel/index.tsx`
Expected: < 350.

### - [ ] Step 3: Ensure shadcn Select exists

Run: `ls apps/leaderboard/src/components/ui/select.tsx`
Expected: file exists. If not, the dashboard must already have it for other pages — check with `grep -rn "from '@/components/ui/select'" apps/leaderboard/src/routes`. Any existing usage confirms the component exists.

### - [ ] Step 4: Type-check the dashboard

Run: `cd apps/leaderboard && npm run typecheck`
Expected: zero TypeScript errors.

### - [ ] Step 5: Run the dev server and smoke-test

Run: `cd apps/leaderboard && npm run dev` in one terminal.
Navigate to `http://localhost:5101/settings/whitelabel` (backend must also be up on :5100).

Verify:
1. Page loads with current config pre-filled
2. Changing a color updates the hex input and color picker together
3. Clicking "رفع" on the logo opens a file picker; selecting an image uploads and shows thumbnail
4. Clicking "حفظ التغييرات" persists; on reload the values are still there
5. After save, the sidebar/topbar primary color updates immediately (via `applyWhitelabel`)

Stop the dev server when done.

### - [ ] Step 6: Commit

```bash
git add apps/leaderboard/src/routes/_dashboard/settings/whitelabel/ apps/leaderboard/src/routeTree.gen.ts
git commit -m "feat(leaderboard): add whitelabel settings page"
```

---

## Task 6: Sidebar Navigation Entry

**Files:**
- Modify: `apps/leaderboard/src/components/shared/sidebar/sidebar.tsx` (or wherever sidebar items are defined)

### - [ ] Step 1: Find the sidebar items definition

Run: `grep -rn "settings" apps/leaderboard/src/components/shared/sidebar/`

Locate the array of nav items. If a "Settings" section already exists, add a child item pointing to `/settings/whitelabel` with an appropriate icon (e.g., `hgi-paint-brush-02`). If no settings section exists yet, add a top-level "إعدادات العلامة التجارية" item pointing to `/settings/whitelabel`.

Keep the edit minimal — do not restructure the sidebar.

### - [ ] Step 2: Type-check

Run: `cd apps/leaderboard && npm run typecheck`
Expected: zero errors.

### - [ ] Step 3: Commit

```bash
git add apps/leaderboard/src/components/shared/sidebar/
git commit -m "feat(leaderboard): add whitelabel settings link in sidebar"
```

---

## Post-Implementation Checks

- [ ] `cd apps/backend && npm run build` — green
- [ ] `cd apps/leaderboard && npm run typecheck` — green
- [ ] `cd apps/leaderboard && npm run lint` — green
- [ ] Manual smoke test: fetch → edit → upload logo → save → refresh → reapply
