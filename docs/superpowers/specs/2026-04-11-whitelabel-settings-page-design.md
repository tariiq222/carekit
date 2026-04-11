# Whitelabel Settings Page — Design Spec
**Date**: 2026-04-11  
**Route**: `/_dashboard/settings/whitelabel/`  
**Access**: Super Admin, Owner, Admin

---

## Overview

A settings form page for editing the clinic's white-label branding configuration. Standard form with save button — no live preview. After a successful save, `applyWhitelabel(config)` is called to apply changes to the DOM immediately.

---

## Page Structure

Follows the standard dashboard page anatomy:

```
PageHeader: "إعدادات العلامة التجارية" + description | [حفظ التغييرات (primary)]
ErrorBanner (only on error)

Card: الهوية البصرية
  - Logo upload (file input → MinIO → URL stored in form) + thumbnail preview
  - Favicon upload (file input → MinIO → URL stored in form) + thumbnail preview

Card: الأسماء
  - systemNameAr (text input, required)
  - systemName   (text input, required)

Card: الألوان
  - primaryColor   (color picker + hex text input side by side)
  - secondaryColor (color picker + hex text input side by side)

Card: الخط والنطاق
  - fontFamily (shadcn Select, fixed list)
  - domain     (text input, optional)
```

---

## Data Flow

### Fetch
- `GET /whitelabel` — requires `whitelabel.view` permission
- Loaded via `useWhitelabel()` hook on mount
- While loading: `SkeletonPage`

### Submit
- `PUT /whitelabel` — requires `whitelabel.edit` permission
- Mutation via `useUpdateWhitelabel()` hook
- On success: call `applyWhitelabel(updatedConfig)` to reflect changes immediately in DOM
- On error: show `ErrorBanner`

### Image Upload
- User clicks upload button → triggers hidden `<input type="file" accept="image/*">`
- File posted to existing `/storage/upload` endpoint → returns `{ url: string }`
- URL stored in form state (react-hook-form field value)
- Thumbnail shown immediately using the returned URL (optimistic display)

---

## Fonts List (Fixed)

```ts
const FONT_OPTIONS = [
  { value: 'default', label: 'الافتراضي (IBM Plex Sans Arabic)' },
  { value: 'Cairo', label: 'Cairo' },
  { value: 'Tajawal', label: 'Tajawal' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' },
  { value: 'Almarai', label: 'Almarai' },
]
```

---

## Validation (Zod Schema)

```ts
const whitelabelSchema = z.object({
  systemName:     z.string().min(1).max(255),
  systemNameAr:   z.string().min(1).max(255),
  logoUrl:        z.string().url().max(2000).optional(),
  faviconUrl:     z.string().url().max(2000).optional(),
  primaryColor:   z.string().regex(/^#[0-9A-Fa-f]{6}$/).max(7),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).max(7),
  fontFamily:     z.string().max(100).optional(),
  domain:         z.string().max(255).optional(),
})
```

---

## Files

| File | Operation |
|------|-----------|
| `packages/api-client/src/types/whitelabel.ts` | Update type to match real API fields (`systemName`, `systemNameAr`, etc.) |
| `packages/api-client/src/modules/whitelabel.ts` | Add `get()` (authenticated) + `update(payload)` functions |
| `packages/api-client/src/index.ts` | Export `whitelabelApi` object |
| `apps/leaderboard/src/hooks/use-whitelabel.ts` | `useWhitelabel()` + `useUpdateWhitelabel()` hooks |
| `apps/leaderboard/src/lib/schemas/whitelabel.schema.ts` | Zod schema + inferred type |
| `apps/leaderboard/src/routes/_dashboard/settings/whitelabel/index.tsx` | Page component |
| `apps/leaderboard/src/routeTree.gen.ts` | Auto-updated by TanStack Router |

---

## Component Details

### Color Field
```tsx
<div className="flex items-center gap-2">
  <input type="color" value={field.value} onChange={...} className="size-9 rounded-md border-border cursor-pointer" />
  <Input {...field} maxLength={7} className="w-28 font-mono" />
</div>
```

### Image Upload Field
```tsx
<div className="flex items-center gap-3">
  {url && <img src={url} className="size-12 rounded-md object-contain border border-border" />}
  <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
    <HIcon name="hgi-upload-02" className="me-2" />
    {url ? 'تغيير' : 'رفع'}
  </Button>
  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
</div>
```

---

## Constraints

- No mock or live preview — save to see changes
- `clinicCanEdit` flag from API: if `false`, all fields are disabled and a warning banner is shown: "إعدادات العلامة التجارية مقفلة. تواصل مع فريق CareKit."
- RTL-first layout, DS tokens only, no hardcoded colors
- File max 350 lines — split into sub-components if needed
