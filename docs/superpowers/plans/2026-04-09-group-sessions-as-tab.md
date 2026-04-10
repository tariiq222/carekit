# Group Sessions as Tab in Services Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move group-sessions from a standalone sidebar page into a tab inside the services page, and remove it from the sidebar navigation.

**Architecture:** `SessionsListContent` already exists as a self-contained component — it just needs to be wrapped in a tab inside `services/page.tsx`. The standalone `/group-sessions` route stays (for detail pages and create page), but the list page is replaced by the tab. The sidebar entry is removed entirely.

**Tech Stack:** Next.js 15 App Router, shadcn/ui Tabs, next-intl (AR/EN), TypeScript strict

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/components/sidebar-config.ts` | Modify | Remove `group-sessions` nav item from `clinicNav` |
| `dashboard/app/(dashboard)/services/page.tsx` | Modify | Add 4th tab `group-sessions`, wire add button + label |
| `dashboard/lib/translations/en.services.ts` | Modify | Add `services.tabs.groupSessions` key |
| `dashboard/lib/translations/ar.services.ts` | Modify | Add `services.tabs.groupSessions` key (Arabic) |

> `SessionsListContent` at `dashboard/components/features/group-sessions/sessions-list-content.tsx` — **no changes needed**, already reusable.
> `dashboard/app/(dashboard)/group-sessions/` — **keep as-is** (detail pages + create page still live there).

---

## Task 1: Remove group-sessions from sidebar

**Files:**
- Modify: `dashboard/components/sidebar-config.ts:47`

- [ ] **Step 1: Remove the nav item**

Open `dashboard/components/sidebar-config.ts`. Remove line 47:

```typescript
// DELETE this line:
{ titleKey: "nav.groupSessions", href: "/group-sessions", icon: UserGroupIcon, featureFlag: "group_sessions" },
```

Also remove `UserGroupIcon` from the import on line 19 since it will be unused:

```typescript
// BEFORE (line 1-20):
import {
  Home01Icon,
  Calendar03Icon,
  UserMultiple02Icon,
  Stethoscope02Icon,
  Settings02Icon,
  GridIcon,
  MoneyBag02Icon,
  Invoice02Icon,
  ShieldKeyIcon,
  AnalyticsUpIcon,
  AiChat02Icon,
  Notification03Icon,
  Coupon01Icon,
  Ticket02Icon,
  Building06Icon,
  DocumentValidationIcon,
  PaintBrush01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

// AFTER — remove UserGroupIcon:
import {
  Home01Icon,
  Calendar03Icon,
  UserMultiple02Icon,
  Stethoscope02Icon,
  Settings02Icon,
  GridIcon,
  MoneyBag02Icon,
  Invoice02Icon,
  ShieldKeyIcon,
  AnalyticsUpIcon,
  AiChat02Icon,
  Notification03Icon,
  Coupon01Icon,
  Ticket02Icon,
  Building06Icon,
  DocumentValidationIcon,
  PaintBrush01Icon,
} from "@hugeicons/core-free-icons"
```

And the `clinicNav` array becomes:

```typescript
export const clinicNav: NavItem[] = [
  { titleKey: "nav.bookings", href: "/bookings", icon: Calendar03Icon },
  { titleKey: "nav.patients", href: "/patients", icon: UserMultiple02Icon },
  { titleKey: "nav.practitioners", href: "/practitioners", icon: Stethoscope02Icon },
  { titleKey: "nav.services", href: "/services", icon: GridIcon },
  { titleKey: "nav.branches", href: "/branches", icon: Building06Icon },
  { titleKey: "nav.intakeForms", href: "/intake-forms", icon: DocumentValidationIcon },
]
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/sidebar-config.ts
git commit -m "feat(dashboard): remove group-sessions from sidebar nav"
```

---

## Task 2: Add translation keys for the new tab

**Files:**
- Modify: `dashboard/lib/translations/en.services.ts`
- Modify: `dashboard/lib/translations/ar.services.ts`

- [ ] **Step 1: Add English key**

Open `dashboard/lib/translations/en.services.ts`. Find the `services.tabs.*` block and add one line:

```typescript
// Add after the last services.tabs.* entry:
"services.tabs.groupSessions": "Group Sessions",
```

- [ ] **Step 2: Add Arabic key**

Open `dashboard/lib/translations/ar.services.ts`. Find the `services.tabs.*` block and add one line:

```typescript
// Add after the last services.tabs.* entry:
"services.tabs.groupSessions": "الجلسات الجماعية",
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/translations/en.services.ts dashboard/lib/translations/ar.services.ts
git commit -m "feat(dashboard): add group-sessions tab translation keys"
```

---

## Task 3: Add group-sessions tab to services page

**Files:**
- Modify: `dashboard/app/(dashboard)/services/page.tsx`

The file is currently 109 lines. After changes it will be ~120 lines — within the 120-line page limit.

- [ ] **Step 1: Add the import for SessionsListContent**

After the existing imports (around line 24), add:

```typescript
import { SessionsListContent } from "@/components/features/group-sessions/sessions-list-content"
```

- [ ] **Step 2: Wire the handleAddClick for the new tab**

Current `handleAddClick` (lines 35-39):

```typescript
const handleAddClick = () => {
  if (activeTab === "services") router.push("/services/create")
  else if (activeTab === "categories") setCreateCategoryOpen(true)
  else if (activeTab === "departments") setCreateDepartmentOpen(true)
}
```

Replace with:

```typescript
const handleAddClick = () => {
  if (activeTab === "services") router.push("/services/create")
  else if (activeTab === "categories") setCreateCategoryOpen(true)
  else if (activeTab === "departments") setCreateDepartmentOpen(true)
  else if (activeTab === "group-sessions") router.push("/group-sessions/create")
}
```

- [ ] **Step 3: Wire addLabel for the new tab**

Current `addLabel` (lines 41-45):

```typescript
const addLabel = () => {
  if (activeTab === "services") return t("services.addService")
  if (activeTab === "categories") return t("services.categories.addCategory")
  return t("departments.addDepartment")
}
```

Replace with:

```typescript
const addLabel = () => {
  if (activeTab === "services") return t("services.addService")
  if (activeTab === "categories") return t("services.categories.addCategory")
  if (activeTab === "departments") return t("departments.addDepartment")
  return t("groupSessions.addSession")
}
```

- [ ] **Step 4: Add the TabsTrigger**

Current `TabsList` (lines 82-86):

```tsx
<TabsList>
  <TabsTrigger value="departments">{t("services.tabs.departments")}</TabsTrigger>
  <TabsTrigger value="categories">{t("services.tabs.categories")}</TabsTrigger>
  <TabsTrigger value="services">{t("services.tabs.services")}</TabsTrigger>
</TabsList>
```

Replace with:

```tsx
<TabsList>
  <TabsTrigger value="departments">{t("services.tabs.departments")}</TabsTrigger>
  <TabsTrigger value="categories">{t("services.tabs.categories")}</TabsTrigger>
  <TabsTrigger value="services">{t("services.tabs.services")}</TabsTrigger>
  <TabsTrigger value="group-sessions">{t("services.tabs.groupSessions")}</TabsTrigger>
</TabsList>
```

- [ ] **Step 5: Add the TabsContent**

After the closing `</TabsContent>` for departments (line 102), before `</Tabs>` (line 103), add:

```tsx
<TabsContent value="group-sessions" className="flex flex-col gap-6 pt-4">
  <SessionsListContent />
</TabsContent>
```

- [ ] **Step 6: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Run lint**

```bash
cd dashboard && npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add dashboard/app/(dashboard)/services/page.tsx
git commit -m "feat(dashboard): add group-sessions as tab in services page"
```

---

## Task 4: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
cd /Users/tariq/Documents/my_programs/CareKit && npm run dev:dashboard
```

- [ ] **Step 2: Check services page tabs**

Navigate to `http://localhost:5101/services`

Expected:
- Tabs in order: الأقسام | الفئات | الخدمات | الجلسات الجماعية
- Clicking "الجلسات الجماعية" tab shows the sessions list
- Add button shows "إضافة جلسة" when on group-sessions tab
- Clicking add button navigates to `/group-sessions/create`

- [ ] **Step 3: Verify sidebar**

Expected: "الجلسات الجماعية" no longer appears in the sidebar navigation.

- [ ] **Step 4: Verify direct URL still works**

Navigate to `http://localhost:5101/services?tab=group-sessions`

Expected: Opens services page with group-sessions tab active.
