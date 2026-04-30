# Service Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add avatar support to services — either a HugeIcons icon with background color, or an uploaded image — displayed in the DataTable, detail sheet, and service forms.

**Architecture:** Three layers: (1) DB migration adds 3 nullable columns to `services`; (2) backend DTOs and service layer pass them through; (3) dashboard gets a `ServiceAvatar` display component and a `ServiceAvatarPicker` input component modeled after the existing `AvatarUpload`.

**Tech Stack:** NestJS + Prisma migration, `@hugeicons/core-free-icons` (2938 icons), MinIO for image upload via `FileInterceptor`, React Hook Form + Zod, shadcn Popover + Tabs.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema/services.prisma` | Modify | Add `iconName`, `iconBgColor`, `imageUrl` fields |
| `backend/prisma/migrations/[ts]_add_service_avatar/` | Create | New migration only |
| `backend/src/modules/services/dto/create-service.dto.ts` | Modify | Add 3 optional avatar fields |
| `backend/src/modules/services/dto/update-service.dto.ts` | Modify | Add 3 optional avatar fields |
| `backend/src/modules/services/services.service.ts` | Modify | Pass avatar fields in create/update |
| `backend/src/modules/services/services.controller.ts` | Modify | Add `POST /services/:id/avatar` image upload endpoint |
| `dashboard/lib/types/service.ts` | Modify | Add fields to `Service`, `CreateServicePayload`, `UpdateServicePayload` |
| `dashboard/lib/api/services.ts` | Modify | Add `uploadServiceImage` function |
| `dashboard/components/features/services/service-avatar.tsx` | Create | Read-only display component |
| `dashboard/components/features/services/service-avatar-picker.tsx` | Create | Interactive picker (Popover + icon grid + image upload) |
| `dashboard/components/features/services/create/form-schema.ts` | Modify | Add 3 avatar fields to Zod schema + defaults |
| `dashboard/components/features/services/create/basic-info-tab.tsx` | Modify | Add `ServiceAvatarPicker` at top of basic info card |
| `dashboard/components/features/services/edit-service-dialog.tsx` | Modify | Add avatar fields to schema + `ServiceAvatarPicker` |
| `dashboard/components/features/services/service-columns.tsx` | Modify | Add `ServiceAvatar` to name column |
| `dashboard/components/features/services/service-detail-sheet.tsx` | Modify | Add `ServiceAvatar` to header area |

---

## Task 1: DB Schema + Migration

**Files:**
- Modify: `backend/prisma/schema/services.prisma`
- Create: migration via `prisma migrate dev`

- [ ] **Step 1: Add fields to schema**

In `backend/prisma/schema/services.prisma`, add these 3 lines inside `model Service` after `calendarColor`:

```prisma
iconName    String?  @map("icon_name")
iconBgColor String?  @map("icon_bg_color")
imageUrl    String?  @map("image_url")
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npm run prisma:migrate
# When prompted for migration name, enter: add_service_avatar
```

Expected output: `The following migration(s) have been applied: .../add_service_avatar`

- [ ] **Step 3: Verify**

```bash
npx prisma studio
# Open services table — confirm icon_name, icon_bg_color, image_url columns exist and are nullable
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema/services.prisma backend/prisma/migrations/
git commit -m "feat(services): add avatar fields to service schema (icon_name, icon_bg_color, image_url)"
```

---

## Task 2: Backend DTOs

**Files:**
- Modify: `backend/src/modules/services/dto/create-service.dto.ts`
- Modify: `backend/src/modules/services/dto/update-service.dto.ts`

- [ ] **Step 1: Add fields to CreateServiceDto**

In `backend/src/modules/services/dto/create-service.dto.ts`, add this import at the top (merge with existing):

```typescript
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, IsUrl, Matches, Max, MaxLength, Min } from 'class-validator';
```

Then add these 3 fields after `calendarColor` (line ~67):

```typescript
@ApiPropertyOptional({ description: 'HugeIcon name, e.g. StethoscopeIcon' })
@IsOptional()
@IsString()
@MaxLength(100)
iconName?: string | null;

@ApiPropertyOptional({ description: 'Background color for icon, e.g. #354FD8' })
@IsOptional()
@IsString()
@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'iconBgColor must be a valid hex color' })
iconBgColor?: string | null;

@ApiPropertyOptional({ description: 'MinIO image URL — takes priority over icon' })
@IsOptional()
@IsUrl()
imageUrl?: string | null;
```

- [ ] **Step 2: Add fields to UpdateServiceDto**

In `backend/src/modules/services/dto/update-service.dto.ts`, add the same import update:

```typescript
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, IsUrl, Matches, Max, MaxLength, Min } from 'class-validator';
```

Then add after `calendarColor` (line ~66):

```typescript
@ApiPropertyOptional({ description: 'HugeIcon name, e.g. StethoscopeIcon' })
@IsOptional()
@IsString()
@MaxLength(100)
iconName?: string | null;

@ApiPropertyOptional({ description: 'Background color for icon, e.g. #354FD8' })
@IsOptional()
@IsString()
@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'iconBgColor must be a valid hex color' })
iconBgColor?: string | null;

@ApiPropertyOptional({ description: 'MinIO image URL — takes priority over icon' })
@IsOptional()
@IsUrl()
imageUrl?: string | null;
```

- [ ] **Step 3: Run tests**

```bash
cd backend
npm run test
```

Expected: all tests pass (no DTO-related failures).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/services/dto/
git commit -m "feat(services): add avatar fields to create/update DTOs"
```

---

## Task 3: Backend Service Layer + Image Upload Endpoint

**Files:**
- Modify: `backend/src/modules/services/services.service.ts`
- Modify: `backend/src/modules/services/services.controller.ts`

- [ ] **Step 1: Pass avatar fields in services.service.ts `create`**

In `services.service.ts`, inside the `serviceData` object (around line 48), add after `calendarColor`:

```typescript
iconName: dto.iconName ?? null,
iconBgColor: dto.iconBgColor ?? null,
imageUrl: dto.imageUrl ?? null,
```

- [ ] **Step 2: Pass avatar fields in `update`**

In the same file, find `prisma.service.update` call. Add to the `data` object:

```typescript
...(dto.iconName !== undefined && { iconName: dto.iconName }),
...(dto.iconBgColor !== undefined && { iconBgColor: dto.iconBgColor }),
...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
```

- [ ] **Step 3: Add image upload endpoint to controller**

In `backend/src/modules/services/services.controller.ts`, add these imports at the top:

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFile, Req } from '@nestjs/common';
```

And add this method to the controller class (after the `update` endpoint):

```typescript
@Post(':id/avatar')
@UseInterceptors(FileInterceptor('image', {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only jpeg, png, webp allowed'), false);
    }
    cb(null, true);
  },
}))
async uploadAvatar(
  @Param('id') id: string,
  @Req() req: Request & { file?: Express.Multer.File },
) {
  return this.servicesService.uploadAvatar(id, req.file!);
}
```

- [ ] **Step 4: Add `uploadAvatar` to ServicesService**

First, inject `MinioService`. In `services.module.ts`, import `StorageModule`:

```typescript
// In services.module.ts imports array, add:
StorageModule,
```

And in `services.service.ts` constructor, add:

```typescript
import { MinioService } from '../../common/services/minio.service.js';
// ...
constructor(
  private readonly prisma: PrismaService,
  private readonly cache: CacheService,
  private readonly intakeForms: IntakeFormsService,
  private readonly minio: MinioService,
) {}
```

Add this method to `ServicesService`:

```typescript
async uploadAvatar(id: string, file: Express.Multer.File) {
  const service = await this.prisma.service.findFirst({
    where: { id, deletedAt: null },
  });
  if (!service) {
    throw new NotFoundException({
      statusCode: 404,
      message: 'Service not found',
      error: 'NOT_FOUND',
    });
  }

  const ext = file.originalname.split('.').pop() ?? 'jpg';
  const objectName = `services/${id}/avatar-${Date.now()}.${ext}`;
  const imageUrl = await this.minio.uploadFile(
    'deqah',
    objectName,
    file.buffer,
    file.mimetype,
  );

  const updated = await this.prisma.service.update({
    where: { id },
    data: { imageUrl, iconName: null, iconBgColor: null },
    include: { category: true },
  });

  await this.invalidateServicesCache();
  return updated;
}
```

- [ ] **Step 5: Run tests**

```bash
cd backend
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/services/services.service.ts backend/src/modules/services/services.controller.ts backend/src/modules/services/services.module.ts
git commit -m "feat(services): pass avatar fields through service layer + add image upload endpoint"
```

---

## Task 4: Dashboard Types + API Function

**Files:**
- Modify: `dashboard/lib/types/service.ts`
- Modify: `dashboard/lib/api/services.ts`

- [ ] **Step 1: Add fields to Service interface**

In `dashboard/lib/types/service.ts`, inside the `Service` interface (after `calendarColor`):

```typescript
iconName: string | null
iconBgColor: string | null
imageUrl: string | null
```

- [ ] **Step 2: Add fields to CreateServicePayload**

In the same file, inside `CreateServicePayload` (after `calendarColor`):

```typescript
iconName?: string | null
iconBgColor?: string | null
imageUrl?: string | null
```

- [ ] **Step 3: Add fields to UpdateServicePayload**

In the same file, inside `UpdateServicePayload` (after `calendarColor`):

```typescript
iconName?: string | null
iconBgColor?: string | null
imageUrl?: string | null
```

- [ ] **Step 4: Add uploadServiceImage to API layer**

In `dashboard/lib/api/services.ts`, add this function (after the existing export functions):

```typescript
export async function uploadServiceImage(serviceId: string, file: File): Promise<Service> {
  const formData = new FormData()
  formData.append("image", file)

  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/services/${serviceId}/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? res.statusText)
  }

  return res.json()
}
```

Note: `API_BASE` is already defined at the top of `services.ts` as `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"`. Make sure `getAccessToken` and `Service` are already imported — they are.

- [ ] **Step 5: Run typecheck**

```bash
cd dashboard
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/types/service.ts dashboard/lib/api/services.ts
git commit -m "feat(services): add avatar fields to Service type and uploadServiceImage API function"
```

---

## Task 5: ServiceAvatar Display Component

**Files:**
- Create: `dashboard/components/features/services/service-avatar.tsx`

- [ ] **Step 1: Create the component**

Create `dashboard/components/features/services/service-avatar.tsx`:

```typescript
"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import * as HugeIcons from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

interface ServiceAvatarProps {
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  name?: string // used for placeholder initial
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = {
  sm: { outer: "h-8 w-8", text: "text-xs", icon: 14 },
  md: { outer: "h-12 w-12", text: "text-sm", icon: 20 },
  lg: { outer: "h-16 w-16", text: "text-base", icon: 28 },
}

export function ServiceAvatar({
  iconName,
  iconBgColor,
  imageUrl,
  name,
  size = "sm",
  className,
}: ServiceAvatarProps) {
  const s = sizes[size]
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "S"

  // Priority 1: image
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? "service"}
        className={cn("rounded-full object-cover shrink-0", s.outer, className)}
      />
    )
  }

  // Priority 2: icon + bg color
  if (iconName) {
    const icon = (HugeIcons as Record<string, unknown>)[iconName]
    return (
      <div
        className={cn("flex items-center justify-center rounded-full shrink-0", s.outer, className)}
        style={{ backgroundColor: iconBgColor ?? "var(--primary)" }}
      >
        {icon ? (
          <HugeiconsIcon
            icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={s.icon}
            color="white"
          />
        ) : (
          <span className={cn("font-semibold text-white", s.text)}>{initial}</span>
        )}
      </div>
    )
  }

  // Priority 3: placeholder
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full shrink-0 bg-primary",
        s.outer,
        className,
      )}
    >
      <span className={cn("font-semibold text-primary-foreground", s.text)}>{initial}</span>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/features/services/service-avatar.tsx
git commit -m "feat(services): add ServiceAvatar display component (icon, image, placeholder)"
```

---

## Task 6: ServiceAvatarPicker Component

**Files:**
- Create: `dashboard/components/features/services/service-avatar-picker.tsx`

- [ ] **Step 1: Get the list of all icon names**

The icon names come from `@hugeicons/core-free-icons`. They are exported as named constants like `StethoscopeIcon`. We build the list at module level:

```typescript
import * as HugeIcons from "@hugeicons/core-free-icons"

// All exported icon names (keys ending with "Icon" that are arrays — actual icon data)
const ALL_ICON_NAMES: string[] = Object.keys(HugeIcons).filter(
  (k) => k.endsWith("Icon") && Array.isArray((HugeIcons as Record<string, unknown>)[k])
)
```

- [ ] **Step 2: Create the full component**

Create `dashboard/components/features/services/service-avatar-picker.tsx`:

```typescript
"use client"

import { useRef, useState, useMemo } from "react"
import * as HugeIcons from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ServiceAvatar } from "./service-avatar"
import { cn } from "@/lib/utils"

/* ─── Icon list ─── */
const ALL_ICON_NAMES: string[] = Object.keys(HugeIcons).filter(
  (k) => k.endsWith("Icon") && Array.isArray((HugeIcons as Record<string, unknown>)[k])
)

/* ─── Color palette — same swatches as project design system ─── */
const BG_COLORS = [
  "#354FD8", "#82CC17", "#E04040", "#E07A10",
  "#9B59B6", "#1ABC9C", "#2980B9", "#F39C12",
  "#16A085", "#8E44AD", "#C0392B", "#27AE60",
]

/* ─── Props ─── */
interface ServiceAvatarPickerProps {
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  serviceName?: string
  onIconChange: (iconName: string, iconBgColor: string) => void
  onImageChange: (file: File) => void
  onClear: () => void
}

/* ─── Component ─── */
export function ServiceAvatarPicker({
  iconName,
  iconBgColor,
  imageUrl,
  serviceName,
  onIconChange,
  onImageChange,
  onClear,
}: ServiceAvatarPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<string | null>(iconName ?? null)
  const [selectedColor, setSelectedColor] = useState<string>(iconBgColor ?? BG_COLORS[0])
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl ?? undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasValue = !!(imageUrl || previewUrl || iconName || selectedIcon)

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_ICON_NAMES
    const q = search.toLowerCase()
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q))
  }, [search])

  const handleIconSelect = (name: string) => {
    setSelectedIcon(name)
    onIconChange(name, selectedColor)
  }

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (selectedIcon) onIconChange(selectedIcon, color)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setSelectedIcon(null)
    onImageChange(file)
    setOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIcon(null)
    setPreviewUrl(undefined)
    onClear()
  }

  const displayImageUrl = previewUrl ?? imageUrl ?? undefined
  const displayIconName = selectedIcon ?? iconName ?? undefined
  const displayBgColor = selectedColor ?? iconBgColor ?? undefined

  return (
    <div className="relative h-20 w-20 shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group h-20 w-20 cursor-pointer rounded-full border-2 border-dashed border-border bg-surface-muted overflow-hidden flex items-center justify-center"
          >
            <ServiceAvatar
              iconName={displayIconName}
              iconBgColor={displayBgColor}
              imageUrl={displayImageUrl}
              name={serviceName}
              size="lg"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="start">
          <Tabs defaultValue="icon">
            <TabsList className="w-full rounded-none border-b border-border">
              <TabsTrigger value="icon" className="flex-1">أيقونة</TabsTrigger>
              <TabsTrigger value="image" className="flex-1">صورة</TabsTrigger>
            </TabsList>

            {/* ── Icon Tab ── */}
            <TabsContent value="icon" className="p-3 space-y-3">
              <Input
                placeholder="ابحث عن أيقونة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />

              {/* Icon Grid */}
              <div className="h-48 overflow-y-auto">
                <div className="grid grid-cols-6 gap-1">
                  {filtered.slice(0, 200).map((name) => {
                    const icon = (HugeIcons as Record<string, unknown>)[name]
                    const isSelected = selectedIcon === name
                    return (
                      <button
                        key={name}
                        type="button"
                        title={name.replace("Icon", "")}
                        onClick={() => handleIconSelect(name)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <HugeiconsIcon
                          icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                          size={18}
                          color="currentColor"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color Swatches */}
              {selectedIcon && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">لون الخلفية</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          selectedColor === color
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { onClear(); setSelectedIcon(null); setPreviewUrl(undefined); setOpen(false) }}
              >
                مسح الأفاتار
              </Button>
            </TabsContent>

            {/* ── Image Tab ── */}
            <TabsContent value="image" className="p-3 space-y-3">
              {displayImageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImageUrl}
                    alt="preview"
                    className="h-24 w-24 mx-auto rounded-full object-cover border border-border"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { setPreviewUrl(undefined); onClear(); setOpen(false) }}
                  >
                    حذف الصورة
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <span className="text-sm">اضغط لرفع صورة</span>
                  <span className="text-xs opacity-60">PNG, JPG, WebP — حتى 5MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFile}
              />
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Badge button */}
      {hasValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md ring-2 ring-background hover:bg-destructive/80 transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background hover:bg-primary/80 transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd dashboard
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/services/service-avatar-picker.tsx
git commit -m "feat(services): add ServiceAvatarPicker with icon grid + image upload popover"
```

---

## Task 7: Form Schema + create basic-info-tab Integration

**Files:**
- Modify: `dashboard/components/features/services/create/form-schema.ts`
- Modify: `dashboard/components/features/services/create/basic-info-tab.tsx`

- [ ] **Step 1: Update form schema**

In `dashboard/components/features/services/create/form-schema.ts`, add to `createServiceSchema`:

```typescript
iconName: z.string().max(100).nullable().optional(),
iconBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
imageUrl: z.string().url().nullable().optional(),
```

And to `createServiceDefaults`:

```typescript
iconName: null,
iconBgColor: null,
imageUrl: null,
```

And update `CreateServiceFormData` type is auto-inferred — no manual change needed.

- [ ] **Step 2: Update basic-info-tab.tsx**

In `dashboard/components/features/services/create/basic-info-tab.tsx`:

Add import at top:

```typescript
import { ServiceAvatarPicker } from "@/components/features/services/service-avatar-picker"
```

Add these fields to the watched values (line ~41):

```typescript
const {
  isActive,
  isHidden,
  hidePriceOnBooking,
  hideDurationOnBooking,
  calendarColor,
  categoryId: watchedCategoryId,
  iconName,
  iconBgColor,
  imageUrl,
} = form.watch()
```

Add `ServiceAvatarPicker` at the top of the first `<CardContent>` (before the Name grid), with a `border-b pb-4 mb-2`:

```typescript
<CardContent className="space-y-5">
  {/* Avatar */}
  <div className="flex items-center gap-4 pb-4 mb-2 border-b border-border">
    <ServiceAvatarPicker
      iconName={iconName}
      iconBgColor={iconBgColor}
      imageUrl={imageUrl}
      serviceName={form.watch("nameAr") || form.watch("nameEn")}
      onIconChange={(name, color) => {
        form.setValue("iconName", name)
        form.setValue("iconBgColor", color)
        form.setValue("imageUrl", null)
      }}
      onImageChange={(file) => {
        // Store file in a ref — actual upload happens on form submit
        // Set a local preview URL as imageUrl for display
        const url = URL.createObjectURL(file)
        form.setValue("imageUrl", url)
        form.setValue("iconName", null)
        form.setValue("iconBgColor", null)
        // Store file for upload — we use a data attribute trick via hidden input
        // The parent (create-service-dialog) handles actual upload after create
      }}
      onClear={() => {
        form.setValue("iconName", null)
        form.setValue("iconBgColor", null)
        form.setValue("imageUrl", null)
      }}
    />
    <p className="text-sm text-muted-foreground">
      {t("services.create.avatarHint") || "اختر أيقونة أو ارفع صورة للخدمة"}
    </p>
  </div>

  {/* Name — primary locale field appears first (start side) */}
  ...existing code...
```

- [ ] **Step 3: Handle image upload in create-service-dialog**

The image upload (to MinIO) happens **after** the service is created (we need the service ID). Open `dashboard/components/features/services/create-service-dialog.tsx` and find the form submit handler. After `createService(payload)` resolves with the new service, check if `imageUrl` is a blob URL (starts with `blob:`) and if so call `uploadServiceImage`:

```typescript
import { uploadServiceImage } from "@/lib/api/services"

// In submit handler, after service is created:
const newService = await createService(payload)
if (payload.imageUrl?.startsWith("blob:")) {
  // Convert blob URL back to File — we need to store the File object
  // Use a ref in the dialog to hold the pending file
  if (pendingAvatarFile.current) {
    await uploadServiceImage(newService.id, pendingAvatarFile.current)
    pendingAvatarFile.current = null
  }
}
```

Add `pendingAvatarFile` ref to the dialog:

```typescript
const pendingAvatarFile = useRef<File | null>(null)
```

Update `onImageChange` passed to `BasicInfoTab` (via props threading or via a callback) to also store the file in `pendingAvatarFile.current`.

Note: Because `BasicInfoTab` currently takes `form` directly, the cleanest path is to add an `onImageSelect` callback prop to `BasicInfoTab`:

```typescript
// In BasicInfoTabProps, add:
onImageSelect?: (file: File) => void

// In ServiceAvatarPicker onImageChange:
onImageChange={(file) => {
  const url = URL.createObjectURL(file)
  form.setValue("imageUrl", url)
  form.setValue("iconName", null)
  form.setValue("iconBgColor", null)
  onImageSelect?.(file)
}}
```

- [ ] **Step 4: Run typecheck**

```bash
cd dashboard
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/features/services/create/
git commit -m "feat(services): integrate ServiceAvatarPicker into create service form"
```

---

## Task 8: Edit Service Dialog Integration

**Files:**
- Modify: `dashboard/components/features/services/edit-service-dialog.tsx`

- [ ] **Step 1: Add avatar fields to edit schema**

In `edit-service-dialog.tsx`, find `editServiceSchema` and add:

```typescript
iconName: z.string().max(100).nullable().optional(),
iconBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
imageUrl: z.string().url().nullable().optional(),
```

- [ ] **Step 2: Pre-populate avatar fields from service**

Find where form `defaultValues` are set (in `useEffect` or `reset`). Add:

```typescript
iconName: service.iconName,
iconBgColor: service.iconBgColor,
imageUrl: service.imageUrl,
```

- [ ] **Step 3: Add ServiceAvatarPicker to the edit form**

Add import:

```typescript
import { ServiceAvatarPicker } from "./service-avatar-picker"
import { uploadServiceImage } from "@/lib/api/services"
```

Add `pendingAvatarFile` ref:

```typescript
const pendingAvatarFile = useRef<File | null>(null)
```

Add `ServiceAvatarPicker` at top of the first form section (same pattern as create):

```typescript
const { iconName, iconBgColor, imageUrl } = form.watch()

// In JSX, before the name fields:
<div className="flex items-center gap-4 pb-4 mb-2 border-b border-border">
  <ServiceAvatarPicker
    iconName={iconName}
    iconBgColor={iconBgColor}
    imageUrl={imageUrl}
    serviceName={form.watch("nameAr") || form.watch("nameEn")}
    onIconChange={(name, color) => {
      form.setValue("iconName", name)
      form.setValue("iconBgColor", color)
      form.setValue("imageUrl", null)
      pendingAvatarFile.current = null
    }}
    onImageChange={(file) => {
      const url = URL.createObjectURL(file)
      form.setValue("imageUrl", url)
      form.setValue("iconName", null)
      form.setValue("iconBgColor", null)
      pendingAvatarFile.current = file
    }}
    onClear={() => {
      form.setValue("iconName", null)
      form.setValue("iconBgColor", null)
      form.setValue("imageUrl", null)
      pendingAvatarFile.current = null
    }}
  />
</div>
```

- [ ] **Step 4: Upload image on submit**

In the submit handler, after `updateService(service.id, payload)` resolves:

```typescript
if (pendingAvatarFile.current) {
  await uploadServiceImage(service.id, pendingAvatarFile.current)
  pendingAvatarFile.current = null
}
```

- [ ] **Step 5: Run typecheck**

```bash
cd dashboard
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/features/services/edit-service-dialog.tsx
git commit -m "feat(services): integrate ServiceAvatarPicker into edit service form"
```

---

## Task 9: Display in DataTable and Detail Sheet

**Files:**
- Modify: `dashboard/components/features/services/service-columns.tsx`
- Modify: `dashboard/components/features/services/service-detail-sheet.tsx`

- [ ] **Step 1: Add ServiceAvatar to service-columns.tsx**

Add import:

```typescript
import { ServiceAvatar } from "./service-avatar"
```

In the `"name"` column cell, wrap with a flex row:

```typescript
cell: ({ row }) => {
  const s = row.original
  return (
    <button type="button" onClick={() => onRowClick?.(s)} className="text-start flex items-center gap-2">
      <ServiceAvatar
        iconName={s.iconName}
        iconBgColor={s.iconBgColor}
        imageUrl={s.imageUrl}
        name={locale === "ar" ? s.nameAr : s.nameEn}
        size="sm"
      />
      <div>
        <p className="text-sm font-medium text-foreground">
          {locale === "ar" ? s.nameAr : s.nameEn}
        </p>
        {(locale === "ar" ? s.descriptionAr : s.descriptionEn) && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {locale === "ar" ? s.descriptionAr : s.descriptionEn}
          </p>
        )}
      </div>
    </button>
  )
},
```

- [ ] **Step 2: Add ServiceAvatar to service-detail-sheet.tsx**

Add import:

```typescript
import { ServiceAvatar } from "./service-avatar"
```

Find the `<DialogHeader>` section (around line 50+). Add `ServiceAvatar` next to the title:

```typescript
<DialogHeader>
  <div className="flex items-center gap-3">
    <ServiceAvatar
      iconName={service.iconName}
      iconBgColor={service.iconBgColor}
      imageUrl={service.imageUrl}
      name={locale === "ar" ? service.nameAr : service.nameEn}
      size="md"
    />
    <div>
      <DialogTitle>{locale === "ar" ? service.nameAr : service.nameEn}</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </div>
  </div>
</DialogHeader>
```

- [ ] **Step 3: Run typecheck + lint**

```bash
cd dashboard
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/services/service-columns.tsx dashboard/components/features/services/service-detail-sheet.tsx
git commit -m "feat(services): display ServiceAvatar in DataTable name column and detail sheet"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ DB: 3 nullable fields added (Task 1)
- ✅ Backend DTOs: iconName, iconBgColor, imageUrl in create + update (Task 2)
- ✅ Image upload endpoint POST /services/:id/avatar (Task 3)
- ✅ Priority logic: imageUrl > iconName > placeholder (Task 5 ServiceAvatar)
- ✅ Popover with icon tab + image tab (Task 6)
- ✅ Icon grid filtered search (Task 6)
- ✅ Color swatches appear after icon selection (Task 6)
- ✅ Clear button zeros all three fields (Task 6)
- ✅ Badge `+` / `×` identical to AvatarUpload (Task 6)
- ✅ Form integration: create (Task 7) + edit (Task 8)
- ✅ Display: DataTable (Task 9) + detail sheet (Task 9)
- ✅ Dashboard type file `service.ts` not `services.ts` (Task 4)

**Type consistency check:**
- `iconName`, `iconBgColor`, `imageUrl` used consistently across all tasks
- `ServiceAvatar` props match what `service-columns` and `service-detail-sheet` pass
- `ServiceAvatarPicker` callbacks match what `basic-info-tab` and `edit-service-dialog` use
- `uploadServiceImage` signature `(serviceId: string, file: File): Promise<Service>` used in Tasks 7 + 8
