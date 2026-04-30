# Public Website — Phase 1 (Foundation + Marketing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a bilingual (Arabic-default, English-available) public website as `apps/website` on port 5104, with two selectable themes (`sawaa`, `premium`), dynamic branding tokens, therapists/specialties/support-groups fetched from backend public endpoints, a working contact form, and dashboard controls for theme selection and public-content toggles.

**Architecture:** Next.js 15 App Router inside the monorepo. Vertical-slice `features/` folders (mirrors backend). Themes are presentation-only; they consume feature hooks. Backend exposes `/api/public/*` endpoints (no auth, throttled). Branding tokens injected at SSR from `BrandingConfig`. Domain is clinic-owned (stored as `BrandingConfig.websiteDomain`).

**Tech Stack:** Next.js 15, React 19, Tailwind 4, shadcn/ui, next-intl, framer-motion, zod, vitest, TanStack Query (for client-side islands), `@deqah/api-client` (fetch), `@deqah/shared` (zod + types). Backend: NestJS 11, Prisma 7, `@nestjs/throttler`.

**Reference Spec:** `docs/superpowers/specs/2026-04-17-public-website-integration-design.md`.

**Source material (to migrate, not rewrite):** `C:\Users\tarii\Downloads\sawaa-website\sawaa-website` — the designed Sawaa site. Its pages become `themes/sawaa/pages/*`; colors convert to semantic tokens; data goes from static `lib/constants.ts` to API calls.

---

## Conventions used throughout this plan

- Backend paths relative to `apps/backend/`.
- Website paths relative to `apps/website/` (created in Task 1).
- Dashboard paths relative to `apps/dashboard/`.
- Every handler gets a colocated `*.handler.spec.ts` (Jest).
- Every frontend feature gets colocated `*.test.ts(x)` (Vitest).
- Commit after each task passes its tests. Conventional commits: `feat(website): …`, `feat(backend): …`, `feat(dashboard): …`.

---

## Task 1: Scaffold `apps/website` workspace

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/next.config.mjs`
- Create: `apps/website/postcss.config.js`
- Create: `apps/website/tailwind.config.ts`
- Create: `apps/website/app/layout.tsx`
- Create: `apps/website/app/page.tsx`
- Create: `apps/website/app/globals.css`
- Create: `apps/website/.env.example`
- Modify: `package.json` (root — add `dev:website` script)
- Modify: `turbo.json` (add pipeline entry)

- [ ] **Step 1: Create the package manifest**

`apps/website/package.json`:
```json
{
  "name": "website",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 5104",
    "build": "next build",
    "start": "next start --port 5104",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@deqah/api-client": "*",
    "@deqah/shared": "*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^11.18.0",
    "lucide-react": "^0.468.0",
    "next": "^15.5.14",
    "next-intl": "^4.8.3",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "tailwind-merge": "^2.5.5",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.1.3",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

`apps/website/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Next / Tailwind / PostCSS config**

`apps/website/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@deqah/api-client", "@deqah/shared"],
  experimental: { typedRoutes: true },
};
export default nextConfig;
```

`apps/website/postcss.config.js`:
```js
module.exports = { plugins: { "@tailwindcss/postcss": {} } };
```

`apps/website/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./themes/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans Arabic", "system-ui", "sans-serif"],
      },
    },
  },
};
export default config;
```

- [ ] **Step 4: Globals + root layout + placeholder home**

`apps/website/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0b0b0c;
  --primary: #354fd8;
  --primary-foreground: #ffffff;
  --accent: #82cc17;
  --accent-foreground: #0b0b0c;
  --muted: #f5f5f5;
  --muted-foreground: #6b7280;
  --border: #e5e7eb;
  --card: #ffffff;
  --card-foreground: #0b0b0c;
}

html { scroll-behavior: smooth; }
body { background: var(--background); color: var(--foreground); font-family: "IBM Plex Sans Arabic", system-ui, sans-serif; }
```

`apps/website/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deqah",
  description: "Clinic website",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
```

`apps/website/app/page.tsx`:
```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen grid place-items-center">
      <h1 className="text-3xl font-semibold text-primary">Deqah Website — Phase 1</h1>
    </main>
  );
}
```

`apps/website/.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:5100
```

- [ ] **Step 5: Wire into monorepo**

Root `package.json` — add to `scripts`:
```json
"dev:website": "turbo run dev --filter=website"
```

Root `turbo.json` — confirm/add the `dev` task does not cache (`"cache": false`). If missing a task entry, add:
```json
{ "pipeline": { "dev": { "cache": false, "persistent": true } } }
```
(Existing file likely has this — verify only.)

- [ ] **Step 6: Install and run**

```bash
cd c:/pro/deqah && npm install
cd c:/pro/deqah && npm run dev:website
```

Expected: Next.js dev server on http://localhost:5104 showing "Deqah Website — Phase 1" in royal blue.

- [ ] **Step 7: Commit**

```bash
cd c:/pro/deqah
git add apps/website package.json turbo.json package-lock.json
git commit -m "feat(website): scaffold apps/website (Next.js 15, Tailwind 4, port 5104)"
```

---

## Task 2: Extend Prisma schema (branding + employee + specialty public fields) and `ContactMessage`

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma` (`BrandingConfig`)
- Modify: `apps/backend/prisma/schema/people.prisma` (`Employee`)
- Create: `apps/backend/prisma/schema/organization.prisma` — append `Specialty` public fields & `ContactMessage` (if Specialty lives elsewhere, append there instead)
- Create: `apps/backend/prisma/migrations/<timestamp>_website_phase1/migration.sql` (generated)

- [ ] **Step 1: Locate Specialty model**

```bash
grep -n "^model Specialty" c:/pro/deqah/apps/backend/prisma/schema/*.prisma
```

Record the file (expected: `people.prisma` or `organization.prisma`). Use that path in Step 3.

- [ ] **Step 2: Extend `BrandingConfig`**

In `apps/backend/prisma/schema/organization.prisma`, inside `model BrandingConfig`, add before `createdAt`:
```prisma
  websiteDomain      String?  @unique
  activeWebsiteTheme WebsiteTheme @default(SAWAA)
```

Above `model BrandingConfig` (or at bottom of the file), add:
```prisma
enum WebsiteTheme {
  SAWAA
  PREMIUM
}
```

- [ ] **Step 3: Extend `Employee` with public fields**

In `apps/backend/prisma/schema/people.prisma`, inside `model Employee`, add after `bioAr`:
```prisma
  slug          String?  @unique
  isPublic      Boolean  @default(false)
  publicBioAr   String?
  publicBioEn   String?
  publicImageUrl String?
```

- [ ] **Step 4: Extend `Specialty` with public fields**

In the file located in Step 1, inside `model Specialty`, add:
```prisma
  slug                 String?  @unique
  isPublic             Boolean  @default(false)
  publicDescriptionAr  String?
  publicDescriptionEn  String?
  publicImageUrl       String?
```

- [ ] **Step 5: Add `ContactMessage` model**

Append to `apps/backend/prisma/schema/organization.prisma`:
```prisma
enum ContactMessageStatus {
  NEW
  READ
  ARCHIVED
}

model ContactMessage {
  id        String   @id @default(uuid())
  name      String
  email     String
  phone     String?
  subject   String?
  body      String
  status    ContactMessageStatus @default(NEW)
  createdAt DateTime @default(now())

  @@index([status, createdAt])
}
```

- [ ] **Step 6: Generate migration**

```bash
cd c:/pro/deqah/apps/backend
npm run prisma:migrate -- --name website_phase1
```

Expected: new folder `prisma/migrations/<timestamp>_website_phase1/` with `migration.sql` that adds enums, columns, and the new table. Prisma client regenerates.

- [ ] **Step 7: Verify typecheck**

```bash
cd c:/pro/deqah/apps/backend && npm run typecheck
```

Expected: zero errors. (`isActive`, `bio` etc. unaffected.)

- [ ] **Step 8: Commit**

```bash
cd c:/pro/deqah
git add apps/backend/prisma
git commit -m "feat(backend): add website-phase1 schema (branding theme/domain, employee/specialty public fields, contact messages)"
```

---

## Task 3: `GetPublicBranding` handler (backend)

**Files:**
- Create: `apps/backend/src/modules/org-experience/branding/get-public-branding/get-public-branding.handler.ts`
- Create: `apps/backend/src/modules/org-experience/branding/get-public-branding/get-public-branding.handler.spec.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/branding.module.ts` (register handler)
- Modify: `apps/backend/src/modules/org-experience/org-experience.module.ts` (export if not already)

- [ ] **Step 1: Write the failing test**

`apps/backend/src/modules/org-experience/branding/get-public-branding/get-public-branding.handler.spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { GetPublicBrandingHandler } from "./get-public-branding.handler";

describe("GetPublicBrandingHandler", () => {
  let handler: GetPublicBrandingHandler;
  let prisma: { brandingConfig: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { brandingConfig: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPublicBrandingHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(GetPublicBrandingHandler);
  });

  it("returns the default branding record mapped to public shape", async () => {
    prisma.brandingConfig.findUnique.mockResolvedValue({
      id: "default",
      clinicNameAr: "سوا",
      clinicNameEn: "Sawaa",
      logoUrl: "https://cdn/logo.png",
      faviconUrl: null,
      primaryColor: "#354FD8",
      accentColor: "#82CC17",
      fontFamily: null,
      customCss: null,
      websiteDomain: "sawaa.sa",
      activeWebsiteTheme: "SAWAA",
    });

    const result = await handler.execute();

    expect(result).toEqual({
      brandNameAr: "سوا",
      brandNameEn: "Sawaa",
      logoUrl: "https://cdn/logo.png",
      faviconUrl: null,
      primaryColor: "#354FD8",
      accentColor: "#82CC17",
      websiteDomain: "sawaa.sa",
      activeTheme: "sawaa",
    });
  });

  it("falls back to Deqah defaults when no record exists", async () => {
    prisma.brandingConfig.findUnique.mockResolvedValue(null);
    const result = await handler.execute();
    expect(result.brandNameAr).toBe("");
    expect(result.primaryColor).toBe("#354FD8");
    expect(result.activeTheme).toBe("sawaa");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd c:/pro/deqah/apps/backend
npx jest src/modules/org-experience/branding/get-public-branding/get-public-branding.handler.spec.ts
```

Expected: FAIL — `Cannot find module './get-public-branding.handler'`.

- [ ] **Step 3: Implement the handler**

`apps/backend/src/modules/org-experience/branding/get-public-branding/get-public-branding.handler.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

export interface PublicBranding {
  brandNameAr: string;
  brandNameEn: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  websiteDomain: string | null;
  activeTheme: "sawaa" | "premium";
}

const DEFAULTS = {
  primaryColor: "#354FD8",
  accentColor: "#82CC17",
};

@Injectable()
export class GetPublicBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicBranding> {
    const config = await this.prisma.brandingConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      return {
        brandNameAr: "",
        brandNameEn: null,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: DEFAULTS.primaryColor,
        accentColor: DEFAULTS.accentColor,
        websiteDomain: null,
        activeTheme: "sawaa",
      };
    }

    return {
      brandNameAr: config.clinicNameAr,
      brandNameEn: config.clinicNameEn,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      primaryColor: config.primaryColor ?? DEFAULTS.primaryColor,
      accentColor: config.accentColor ?? DEFAULTS.accentColor,
      websiteDomain: config.websiteDomain,
      activeTheme: config.activeWebsiteTheme === "PREMIUM" ? "premium" : "sawaa",
    };
  }
}
```

- [ ] **Step 4: Register in the branding module**

Open `apps/backend/src/modules/org-experience/branding/branding.module.ts` and add `GetPublicBrandingHandler` to both `providers` and `exports`. If the file doesn't follow that shape, match the local convention used by `GetBrandingHandler`.

- [ ] **Step 5: Verify test passes**

```bash
npx jest src/modules/org-experience/branding/get-public-branding/get-public-branding.handler.spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd c:/pro/deqah
git add apps/backend/src/modules/org-experience/branding
git commit -m "feat(backend): GetPublicBrandingHandler for public website"
```

---

## Task 4: `PublicBrandingController` + throttler

**Files:**
- Create: `apps/backend/src/api/public/branding.controller.ts`
- Create: `apps/backend/src/api/public/branding.controller.spec.ts`
- Modify: `apps/backend/src/api/public/public-api.module.ts` (create if missing)
- Modify: `apps/backend/src/config/app.module.ts` (import PublicApiModule; configure `ThrottlerModule` if not present)

- [ ] **Step 1: Write the controller test**

`apps/backend/src/api/public/branding.controller.spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { PublicBrandingController } from "./branding.controller";
import { GetPublicBrandingHandler } from "../../modules/org-experience/branding/get-public-branding/get-public-branding.handler";

describe("PublicBrandingController", () => {
  it("returns branding from the handler", async () => {
    const handler = { execute: jest.fn().mockResolvedValue({ brandNameAr: "سوا", activeTheme: "sawaa" }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicBrandingController],
      providers: [{ provide: GetPublicBrandingHandler, useValue: handler }],
    }).compile();
    const controller = moduleRef.get(PublicBrandingController);

    const result = await controller.get();

    expect(handler.execute).toHaveBeenCalled();
    expect(result.brandNameAr).toBe("سوا");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest src/api/public/branding.controller.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controller**

`apps/backend/src/api/public/branding.controller.ts`:
```ts
import { Controller, Get } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { GetPublicBrandingHandler } from "../../modules/org-experience/branding/get-public-branding/get-public-branding.handler";
import { ApiStandardResponses } from "../../common/swagger/api-standard-responses.decorator";

@ApiTags("Public / Org Experience")
@Controller("public/branding")
export class PublicBrandingController {
  constructor(private readonly handler: GetPublicBrandingHandler) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Get public branding for the clinic website" })
  @ApiStandardResponses()
  get() {
    return this.handler.execute();
  }
}
```

If `ApiStandardResponses` does not exist at that path, remove the import and the decorator; keep the rest. The project already enforces API docs (see `apps/backend/CLAUDE.md`) — match the local pattern used by any existing `src/api/public/*` controller.

- [ ] **Step 4: Create / extend `PublicApiModule`**

`apps/backend/src/api/public/public-api.module.ts` (create if missing; otherwise extend):
```ts
import { Module } from "@nestjs/common";
import { OrgExperienceModule } from "../../modules/org-experience/org-experience.module";
import { PublicBrandingController } from "./branding.controller";

@Module({
  imports: [OrgExperienceModule],
  controllers: [PublicBrandingController],
})
export class PublicApiModule {}
```

- [ ] **Step 5: Register in AppModule + throttler**

Open `apps/backend/src/config/app.module.ts`. If `ThrottlerModule` is not imported, add:
```ts
import { ThrottlerModule } from "@nestjs/throttler";
// …
ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }]),
```
Install the package if missing:
```bash
cd c:/pro/deqah/apps/backend && npm install @nestjs/throttler
```

Add `PublicApiModule` to the `imports` array.

- [ ] **Step 6: Run tests**

```bash
cd c:/pro/deqah/apps/backend
npx jest src/api/public/branding.controller.spec.ts
npm run typecheck
```

Expected: PASS + zero type errors.

- [ ] **Step 7: Regenerate OpenAPI snapshot**

```bash
npm run openapi:build-and-snapshot
```

Expected: `apps/backend/openapi.json` gains the new endpoint.

- [ ] **Step 8: Manual smoke**

```bash
npm run dev
# in another shell:
curl http://localhost:5100/public/branding
```

Expected: JSON with `brandNameAr`, `activeTheme`, etc.

- [ ] **Step 9: Commit**

```bash
cd c:/pro/deqah
git add apps/backend
git commit -m "feat(backend): POST /public/branding endpoint with throttling"
```

---

## Task 5: `@deqah/api-client` — public branding client

**Files:**
- Modify: `packages/api-client/src/index.ts` (export new public namespace)
- Create: `packages/api-client/src/public/branding.ts`
- Create: `packages/api-client/src/public/branding.test.ts`
- Create: `packages/api-client/src/public/types.ts`

- [ ] **Step 1: Write the failing test**

`packages/api-client/src/public/branding.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPublicBrandingClient } from "./branding";

describe("createPublicBrandingClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("GETs /public/branding and returns the parsed body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ brandNameAr: "سوا", activeTheme: "sawaa" }),
    });
    const client = createPublicBrandingClient({ baseUrl: "http://api", fetch: fetchMock });

    const result = await client.get();

    expect(fetchMock).toHaveBeenCalledWith("http://api/public/branding", expect.objectContaining({ method: "GET" }));
    expect(result.brandNameAr).toBe("سوا");
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const client = createPublicBrandingClient({ baseUrl: "http://api", fetch: fetchMock });
    await expect(client.get()).rejects.toThrow(/public\/branding/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd c:/pro/deqah/packages/api-client
npx vitest run src/public/branding.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

`packages/api-client/src/public/types.ts`:
```ts
export interface PublicBranding {
  brandNameAr: string;
  brandNameEn: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  websiteDomain: string | null;
  activeTheme: "sawaa" | "premium";
}
```

`packages/api-client/src/public/branding.ts`:
```ts
import type { PublicBranding } from "./types";

export interface PublicBrandingClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export function createPublicBrandingClient(opts: PublicBrandingClientOptions) {
  const f = opts.fetch ?? globalThis.fetch;
  return {
    async get(): Promise<PublicBranding> {
      const res = await f(`${opts.baseUrl}/public/branding`, { method: "GET" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`public/branding failed: ${res.status} ${body}`);
      }
      return (await res.json()) as PublicBranding;
    },
  };
}
```

- [ ] **Step 4: Export**

Add to `packages/api-client/src/index.ts`:
```ts
export { createPublicBrandingClient } from "./public/branding";
export type { PublicBranding } from "./public/types";
```

- [ ] **Step 5: Verify + typecheck**

```bash
cd c:/pro/deqah/packages/api-client
npx vitest run
npm run typecheck
```

Expected: 2 tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
cd c:/pro/deqah
git add packages/api-client
git commit -m "feat(api-client): createPublicBrandingClient"
```

---

## Task 6: Website — `features/branding/` vertical slice + SSR token injection

**Files:**
- Create: `apps/website/lib/api-client.ts`
- Create: `apps/website/features/branding/branding.api.ts`
- Create: `apps/website/features/branding/branding.types.ts`
- Create: `apps/website/features/branding/branding-tokens.tsx`
- Create: `apps/website/features/branding/branding-tokens.test.tsx`
- Create: `apps/website/vitest.config.ts`
- Modify: `apps/website/app/layout.tsx`

- [ ] **Step 1: Vitest config**

`apps/website/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    globals: true,
  },
});
```

- [ ] **Step 2: Shared API client instance**

`apps/website/lib/api-client.ts`:
```ts
import { createPublicBrandingClient } from "@deqah/api-client";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export const publicBrandingClient = createPublicBrandingClient({ baseUrl });
```

- [ ] **Step 3: Branding types (re-export) and API helper**

`apps/website/features/branding/branding.types.ts`:
```ts
export type { PublicBranding } from "@deqah/api-client";
```

`apps/website/features/branding/branding.api.ts`:
```ts
import { publicBrandingClient } from "@/lib/api-client";
import type { PublicBranding } from "./branding.types";

export async function fetchBranding(): Promise<PublicBranding> {
  return publicBrandingClient.get();
}
```

- [ ] **Step 4: Write the failing test for BrandingTokens**

`apps/website/features/branding/branding-tokens.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandingTokens } from "./branding-tokens";

describe("BrandingTokens", () => {
  it("renders a style tag with the given CSS variables", () => {
    const { container } = render(
      <BrandingTokens
        branding={{
          brandNameAr: "سوا",
          brandNameEn: null,
          logoUrl: null,
          faviconUrl: null,
          primaryColor: "#123456",
          accentColor: "#abcdef",
          websiteDomain: null,
          activeTheme: "sawaa",
        }}
      />,
    );
    const style = container.querySelector("style");
    expect(style?.textContent).toContain("--primary: #123456");
    expect(style?.textContent).toContain("--accent: #abcdef");
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
cd c:/pro/deqah/apps/website && npx vitest run features/branding/branding-tokens.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 6: Implement `BrandingTokens`**

`apps/website/features/branding/branding-tokens.tsx`:
```tsx
import type { PublicBranding } from "./branding.types";

export function BrandingTokens({ branding }: { branding: PublicBranding }) {
  const css = `:root {
    --primary: ${branding.primaryColor};
    --accent: ${branding.accentColor};
  }`;
  return <style>{css}</style>;
}
```

- [ ] **Step 7: Verify the test passes**

```bash
npx vitest run features/branding/branding-tokens.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Inject at SSR in root layout**

Replace `apps/website/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { fetchBranding } from "@/features/branding/branding.api";
import { BrandingTokens } from "@/features/branding/branding-tokens";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding().catch(() => null);
  return {
    title: branding?.brandNameAr ?? "Deqah",
    description: "Clinic website",
    icons: branding?.faviconUrl ? { icon: branding.faviconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await fetchBranding().catch(() => ({
    brandNameAr: "",
    brandNameEn: null,
    logoUrl: null,
    faviconUrl: null,
    primaryColor: "#354FD8",
    accentColor: "#82CC17",
    websiteDomain: null,
    activeTheme: "sawaa" as const,
  }));

  return (
    <html lang="ar" dir="rtl">
      <head>
        <BrandingTokens branding={branding} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Smoke test against running backend**

```bash
# terminal A
cd c:/pro/deqah/apps/backend && npm run dev
# terminal B
cd c:/pro/deqah/apps/website && npm run dev
```

Open http://localhost:5104 — verify page renders and DevTools → Elements shows `<style>` with `--primary` matching backend value.

- [ ] **Step 10: Commit**

```bash
cd c:/pro/deqah
git add apps/website
git commit -m "feat(website): branding feature slice + SSR token injection"
```

---

## Task 7: next-intl setup (Arabic default, English switcher, cookie-persisted)

**Files:**
- Create: `apps/website/messages/ar.json`
- Create: `apps/website/messages/en.json`
- Create: `apps/website/i18n/request.ts`
- Create: `apps/website/features/i18n/locale-cookie.ts`
- Create: `apps/website/features/i18n/locale-cookie.test.ts`
- Create: `apps/website/features/i18n/language-switcher.tsx`
- Modify: `apps/website/next.config.mjs` (next-intl plugin)
- Modify: `apps/website/app/layout.tsx` (wrap with `NextIntlClientProvider`)

- [ ] **Step 1: Install plugin**

```bash
cd c:/pro/deqah/apps/website && npm install next-intl
```
(Already in dependencies from Task 1 — ensures it's installed at workspace level.)

- [ ] **Step 2: Messages**

`apps/website/messages/ar.json`:
```json
{
  "nav": { "home": "الرئيسية", "therapists": "المعالجون", "clinics": "العيادات", "contact": "تواصل" },
  "home": { "hero_title": "رعاية نفسية تمنحك الاتزان", "hero_cta": "احجز موعدك" },
  "language": { "switch": "English" }
}
```

`apps/website/messages/en.json`:
```json
{
  "nav": { "home": "Home", "therapists": "Therapists", "clinics": "Clinics", "contact": "Contact" },
  "home": { "hero_title": "Mental care that restores balance", "hero_cta": "Book an appointment" },
  "language": { "switch": "العربية" }
}
```

- [ ] **Step 3: Locale cookie helper + test**

`apps/website/features/i18n/locale-cookie.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseLocale } from "./locale-cookie";

describe("parseLocale", () => {
  it("defaults to ar when cookie is missing", () => {
    expect(parseLocale(undefined)).toBe("ar");
  });
  it("returns en when cookie is en", () => {
    expect(parseLocale("en")).toBe("en");
  });
  it("rejects unsupported locales and falls back to ar", () => {
    expect(parseLocale("fr")).toBe("ar");
  });
});
```

`apps/website/features/i18n/locale-cookie.ts`:
```ts
export type Locale = "ar" | "en";
export const LOCALE_COOKIE = "deqah_locale";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "ar";
}
```

Verify:
```bash
cd c:/pro/deqah/apps/website && npx vitest run features/i18n/locale-cookie.test.ts
```
Expected: PASS.

- [ ] **Step 4: next-intl request config**

`apps/website/i18n/request.ts`:
```ts
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, parseLocale } from "@/features/i18n/locale-cookie";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
```

`apps/website/next.config.mjs` — wrap with the plugin:
```js
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@deqah/api-client", "@deqah/shared"],
  experimental: { typedRoutes: true },
};
export default withNextIntl(nextConfig);
```

- [ ] **Step 5: Wrap layout**

Replace `app/layout.tsx` body to include provider and pick `dir` from locale:
```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { fetchBranding } from "@/features/branding/branding.api";
import { BrandingTokens } from "@/features/branding/branding-tokens";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding().catch(() => null);
  return { title: branding?.brandNameAr ?? "Deqah" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [branding, locale, messages] = await Promise.all([
    fetchBranding().catch(() => ({
      brandNameAr: "", brandNameEn: null, logoUrl: null, faviconUrl: null,
      primaryColor: "#354FD8", accentColor: "#82CC17",
      websiteDomain: null, activeTheme: "sawaa" as const,
    })),
    getLocale(),
    getMessages(),
  ]);

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <head><BrandingTokens branding={branding} /></head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Language switcher**

`apps/website/features/i18n/language-switcher.tsx`:
```tsx
"use client";
import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { LOCALE_COOKIE } from "./locale-cookie";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    startTransition(() => { window.location.reload(); });
  }

  return (
    <button type="button" onClick={toggle} disabled={isPending} className="text-sm underline">
      {t("switch")}
    </button>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd c:/pro/deqah
git add apps/website
git commit -m "feat(website): next-intl setup (Arabic default, English switcher via cookie)"
```

---

## Task 8: Backend — `ListPublicEmployees` handler + controller

**Files:**
- Create: `apps/backend/src/modules/people/employees/list-public-employees/list-public-employees.handler.ts`
- Create: `apps/backend/src/modules/people/employees/list-public-employees/list-public-employees.handler.spec.ts`
- Create: `apps/backend/src/modules/people/employees/get-public-employee/get-public-employee.handler.ts`
- Create: `apps/backend/src/modules/people/employees/get-public-employee/get-public-employee.handler.spec.ts`
- Create: `apps/backend/src/api/public/employees.controller.ts`
- Create: `apps/backend/src/api/public/employees.controller.spec.ts`
- Modify: `apps/backend/src/modules/people/people.module.ts` (register handlers)
- Modify: `apps/backend/src/api/public/public-api.module.ts` (register controller + import PeopleModule)

- [ ] **Step 1: Write the list-handler test**

`list-public-employees.handler.spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { ListPublicEmployeesHandler } from "./list-public-employees.handler";

describe("ListPublicEmployeesHandler", () => {
  it("returns only public + active employees with a slug", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: "1", slug: "dr-a", name: "Dr A", nameAr: "د. أ", nameEn: "Dr A", title: "Psychologist",
        publicBioAr: "سيرة", publicBioEn: "Bio", publicImageUrl: "url" },
    ]);
    const prisma = { employee: { findMany } } as unknown as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [ListPublicEmployeesHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const handler = moduleRef.get(ListPublicEmployeesHandler);

    const result = await handler.execute({});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: true, isActive: true, slug: { not: null } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("dr-a");
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
cd c:/pro/deqah/apps/backend
npx jest list-public-employees.handler.spec.ts
```
Expected: FAIL (module missing).

- [ ] **Step 3: Implement list handler**

`list-public-employees.handler.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

export interface PublicEmployeeCard {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  title: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
}

@Injectable()
export class ListPublicEmployeesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(_: { specialtySlug?: string }): Promise<PublicEmployeeCard[]> {
    const rows = await this.prisma.employee.findMany({
      where: { isPublic: true, isActive: true, slug: { not: null } },
      select: {
        id: true, slug: true, nameAr: true, nameEn: true, name: true, title: true,
        publicBioAr: true, publicBioEn: true, publicImageUrl: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug as string,
      nameAr: r.nameAr ?? r.name,
      nameEn: r.nameEn,
      title: r.title,
      publicBioAr: r.publicBioAr,
      publicBioEn: r.publicBioEn,
      publicImageUrl: r.publicImageUrl,
    }));
  }
}
```

- [ ] **Step 4: Implement `GetPublicEmployee` handler + spec**

`get-public-employee.handler.spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { GetPublicEmployeeHandler } from "./get-public-employee.handler";

describe("GetPublicEmployeeHandler", () => {
  it("returns the employee when slug matches a public active one", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "1", slug: "dr-a", name: "Dr A", nameAr: "د. أ", nameEn: "Dr A",
      title: "Psychologist", publicBioAr: "سيرة", publicBioEn: "Bio", publicImageUrl: "url",
    });
    const prisma = { employee: { findFirst } } as unknown as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [GetPublicEmployeeHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const handler = moduleRef.get(GetPublicEmployeeHandler);

    const result = await handler.execute({ slug: "dr-a" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "dr-a", isPublic: true, isActive: true } }),
    );
    expect(result.slug).toBe("dr-a");
  });

  it("throws 404 when not found", async () => {
    const prisma = { employee: { findFirst: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [GetPublicEmployeeHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const handler = moduleRef.get(GetPublicEmployeeHandler);
    await expect(handler.execute({ slug: "missing" })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

`get-public-employee.handler.ts`:
```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import type { PublicEmployeeCard } from "../list-public-employees/list-public-employees.handler";

@Injectable()
export class GetPublicEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ slug }: { slug: string }): Promise<PublicEmployeeCard> {
    const row = await this.prisma.employee.findFirst({
      where: { slug, isPublic: true, isActive: true },
      select: {
        id: true, slug: true, nameAr: true, nameEn: true, name: true, title: true,
        publicBioAr: true, publicBioEn: true, publicImageUrl: true,
      },
    });
    if (!row) throw new NotFoundException(`Employee ${slug} not found`);
    return {
      id: row.id, slug: row.slug as string,
      nameAr: row.nameAr ?? row.name, nameEn: row.nameEn, title: row.title,
      publicBioAr: row.publicBioAr, publicBioEn: row.publicBioEn, publicImageUrl: row.publicImageUrl,
    };
  }
}
```

- [ ] **Step 5: Register in `people.module.ts`**

Add both handlers to `providers` and `exports`.

- [ ] **Step 6: Controller + test**

`apps/backend/src/api/public/employees.controller.spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { PublicEmployeesController } from "./employees.controller";
import { ListPublicEmployeesHandler } from "../../modules/people/employees/list-public-employees/list-public-employees.handler";
import { GetPublicEmployeeHandler } from "../../modules/people/employees/get-public-employee/get-public-employee.handler";

describe("PublicEmployeesController", () => {
  it("lists public employees", async () => {
    const list = { execute: jest.fn().mockResolvedValue([{ slug: "dr-a" }]) };
    const get = { execute: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicEmployeesController],
      providers: [
        { provide: ListPublicEmployeesHandler, useValue: list },
        { provide: GetPublicEmployeeHandler, useValue: get },
      ],
    }).compile();
    const ctrl = moduleRef.get(PublicEmployeesController);

    const result = await ctrl.list(undefined);
    expect(list.execute).toHaveBeenCalledWith({ specialtySlug: undefined });
    expect(result).toEqual([{ slug: "dr-a" }]);
  });

  it("gets one by slug", async () => {
    const list = { execute: jest.fn() };
    const get = { execute: jest.fn().mockResolvedValue({ slug: "dr-a" }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicEmployeesController],
      providers: [
        { provide: ListPublicEmployeesHandler, useValue: list },
        { provide: GetPublicEmployeeHandler, useValue: get },
      ],
    }).compile();
    const ctrl = moduleRef.get(PublicEmployeesController);
    const result = await ctrl.getOne("dr-a");
    expect(get.execute).toHaveBeenCalledWith({ slug: "dr-a" });
    expect(result.slug).toBe("dr-a");
  });
});
```

`apps/backend/src/api/public/employees.controller.ts`:
```ts
import { Controller, Get, Param, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ListPublicEmployeesHandler } from "../../modules/people/employees/list-public-employees/list-public-employees.handler";
import { GetPublicEmployeeHandler } from "../../modules/people/employees/get-public-employee/get-public-employee.handler";

@ApiTags("Public / People")
@Controller("public/employees")
export class PublicEmployeesController {
  constructor(
    private readonly listHandler: ListPublicEmployeesHandler,
    private readonly getHandler: GetPublicEmployeeHandler,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "List public employees" })
  @ApiQuery({ name: "specialty", required: false })
  list(@Query("specialty") specialty?: string) {
    return this.listHandler.execute({ specialtySlug: specialty });
  }

  @Get(":slug")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Get one public employee by slug" })
  @ApiParam({ name: "slug" })
  getOne(@Param("slug") slug: string) {
    return this.getHandler.execute({ slug });
  }
}
```

Register in `public-api.module.ts`:
```ts
import { PeopleModule } from "../../modules/people/people.module";
import { PublicEmployeesController } from "./employees.controller";
// imports: [..., PeopleModule], controllers: [..., PublicEmployeesController]
```

- [ ] **Step 7: Run all new tests**

```bash
cd c:/pro/deqah/apps/backend
npx jest list-public-employees get-public-employee api/public/employees
npm run typecheck
npm run openapi:build-and-snapshot
```

Expected: all green, OpenAPI updated.

- [ ] **Step 8: Commit**

```bash
cd c:/pro/deqah
git add apps/backend
git commit -m "feat(backend): GET /public/employees + /public/employees/:slug"
```

---

## Task 9: Backend — `ListPublicSpecialties` + `GetPublicSpecialty`

Same shape as Task 8, applied to specialties. Use the Specialty model file located in Task 2 Step 1.

**Files:**
- Create: `apps/backend/src/modules/org-experience/services/list-public-specialties/list-public-specialties.handler.ts` **OR** under `modules/people/specialties/...` — use the file location matching where the model lives; follow the cluster where Specialty currently sits.
- Create: matching `*.handler.spec.ts`.
- Create: `.../get-public-specialty/` sibling with handler + spec.
- Create: `apps/backend/src/api/public/specialties.controller.ts` + spec.
- Modify: corresponding module + `public-api.module.ts`.

- [ ] **Step 1: Mirror Task 8 exactly** — substitute `specialty` for `employee`, and the public fields are `publicDescriptionAr/En` + `publicImageUrl` + `slug` + `isPublic`. The list test asserts `where: { isPublic: true, slug: { not: null } }`. The `PublicSpecialtyCard` shape:
```ts
export interface PublicSpecialtyCard {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  publicDescriptionAr: string | null;
  publicDescriptionEn: string | null;
  publicImageUrl: string | null;
}
```

- [ ] **Step 2: Controller endpoints**

```
GET /public/specialties
GET /public/specialties/:slug
```

- [ ] **Step 3: Tests + typecheck + OpenAPI snapshot**

```bash
cd c:/pro/deqah/apps/backend
npx jest list-public-specialties get-public-specialty api/public/specialties
npm run typecheck
npm run openapi:build-and-snapshot
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): GET /public/specialties + /public/specialties/:slug"
```

---

## Task 10: Backend — `CreateContactMessage` + `ListContactMessages` + `MarkContactMessageRead`

**Files:**
- Create: `apps/backend/src/modules/comms/contact-messages/create-contact-message/create-contact-message.dto.ts`
- Create: `apps/backend/src/modules/comms/contact-messages/create-contact-message/create-contact-message.handler.ts`
- Create: ` ….spec.ts`
- Create: `apps/backend/src/modules/comms/contact-messages/list-contact-messages/list-contact-messages.handler.ts` + spec
- Create: `apps/backend/src/modules/comms/contact-messages/mark-contact-message-read/mark-contact-message-read.handler.ts` + spec
- Create: `apps/backend/src/api/public/contact-messages.controller.ts` + spec
- Create: `apps/backend/src/api/dashboard/contact-messages.controller.ts` + spec
- Modify: `apps/backend/src/modules/comms/comms.module.ts` (register 3 handlers)
- Modify: `apps/backend/src/api/public/public-api.module.ts`

- [ ] **Step 1: DTO**

`create-contact-message.dto.ts`:
```ts
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateContactMessageDto {
  @ApiProperty({ example: "علي محمد" })
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "ali@example.com" })
  @IsEmail() @MaxLength(200)
  email!: string;

  @ApiPropertyOptional({ example: "+966500000000" })
  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  subject?: string;

  @ApiProperty({ example: "أرغب في الاستفسار عن جلسة علاج" })
  @IsString() @MinLength(5) @MaxLength(4000)
  body!: string;
}
```

- [ ] **Step 2: Create handler + test (TDD order)**

`create-contact-message.handler.spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { CreateContactMessageHandler } from "./create-contact-message.handler";

describe("CreateContactMessageHandler", () => {
  it("persists a contact message with status NEW", async () => {
    const create = jest.fn().mockResolvedValue({ id: "x", status: "NEW" });
    const prisma = { contactMessage: { create } } as unknown as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [CreateContactMessageHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const handler = moduleRef.get(CreateContactMessageHandler);

    const result = await handler.execute({
      name: "علي", email: "a@b.c", body: "مرحبا",
    });

    expect(create).toHaveBeenCalledWith({
      data: { name: "علي", email: "a@b.c", phone: undefined, subject: undefined, body: "مرحبا" },
    });
    expect(result.id).toBe("x");
  });
});
```

`create-contact-message.handler.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { CreateContactMessageDto } from "./create-contact-message.dto";

@Injectable()
export class CreateContactMessageHandler {
  constructor(private readonly prisma: PrismaService) {}

  execute(cmd: CreateContactMessageDto) {
    return this.prisma.contactMessage.create({
      data: {
        name: cmd.name,
        email: cmd.email,
        phone: cmd.phone,
        subject: cmd.subject,
        body: cmd.body,
      },
    });
  }
}
```

- [ ] **Step 3: List + mark-read handlers (same TDD shape)**

`list-contact-messages.handler.ts` — `execute({ status? })` → `prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" } })`.

`mark-contact-message-read.handler.ts` — `execute({ id })` → `prisma.contactMessage.update({ where: { id }, data: { status: "READ" } })`. 404 if not found.

Each gets a spec following the same mocking pattern.

- [ ] **Step 4: Public controller**

`apps/backend/src/api/public/contact-messages.controller.ts`:
```ts
import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateContactMessageDto } from "../../modules/comms/contact-messages/create-contact-message/create-contact-message.dto";
import { CreateContactMessageHandler } from "../../modules/comms/contact-messages/create-contact-message/create-contact-message.handler";

@ApiTags("Public / Comms")
@Controller("public/contact-messages")
export class PublicContactMessagesController {
  constructor(private readonly handler: CreateContactMessageHandler) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Submit a contact message from the public website" })
  create(@Body() dto: CreateContactMessageDto) {
    return this.handler.execute(dto);
  }
}
```

- [ ] **Step 5: Dashboard controller**

`apps/backend/src/api/dashboard/contact-messages.controller.ts`:
```ts
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "../../common/guards/jwt.guard"; // match actual local path
import { ListContactMessagesHandler } from "../../modules/comms/contact-messages/list-contact-messages/list-contact-messages.handler";
import { MarkContactMessageReadHandler } from "../../modules/comms/contact-messages/mark-contact-message-read/mark-contact-message-read.handler";

@ApiTags("Dashboard / Comms")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("dashboard/contact-messages")
export class DashboardContactMessagesController {
  constructor(
    private readonly listHandler: ListContactMessagesHandler,
    private readonly markReadHandler: MarkContactMessageReadHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: "List contact messages" })
  list(@Query("status") status?: "NEW" | "READ" | "ARCHIVED") {
    return this.listHandler.execute({ status });
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a contact message as read" })
  markRead(@Param("id") id: string) {
    return this.markReadHandler.execute({ id });
  }
}
```

If the local JWT guard lives at a different path, use the path already used by existing dashboard controllers like `bookings.controller.ts`. Copy their `@UseGuards(...)` setup verbatim.

- [ ] **Step 6: Wire modules**

`comms.module.ts` — register the 3 handlers in `providers` + `exports`.
`public-api.module.ts` — import `CommsModule`, add `PublicContactMessagesController`.
`dashboard-api.module.ts` (or wherever dashboard controllers are registered) — add `DashboardContactMessagesController`.

- [ ] **Step 7: Tests + snapshot**

```bash
cd c:/pro/deqah/apps/backend
npx jest contact-message
npm run typecheck
npm run openapi:build-and-snapshot
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): contact messages (POST /public, GET + PATCH /dashboard)"
```

---

## Task 11: api-client — extend with employees/specialties/contact-messages

**Files:**
- Create: `packages/api-client/src/public/employees.ts` + `.test.ts`
- Create: `packages/api-client/src/public/specialties.ts` + `.test.ts`
- Create: `packages/api-client/src/public/contact-messages.ts` + `.test.ts`
- Modify: `packages/api-client/src/public/types.ts`
- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Extend `types.ts`**

Append:
```ts
export interface PublicEmployeeCard {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  title: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
}

export interface PublicSpecialtyCard {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  publicDescriptionAr: string | null;
  publicDescriptionEn: string | null;
  publicImageUrl: string | null;
}

export interface CreateContactMessagePayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  body: string;
}
```

- [ ] **Step 2: Write failing tests** (mirror the `branding.test.ts` shape for each of list/get/create). Run:
```bash
cd c:/pro/deqah/packages/api-client && npx vitest run
```
Expected: failures on each missing module.

- [ ] **Step 3: Implement each client**

`employees.ts`:
```ts
import type { PublicEmployeeCard } from "./types";

export function createPublicEmployeesClient(opts: { baseUrl: string; fetch?: typeof fetch }) {
  const f = opts.fetch ?? globalThis.fetch;
  return {
    async list(params?: { specialty?: string }): Promise<PublicEmployeeCard[]> {
      const qs = params?.specialty ? `?specialty=${encodeURIComponent(params.specialty)}` : "";
      const res = await f(`${opts.baseUrl}/public/employees${qs}`, { method: "GET" });
      if (!res.ok) throw new Error(`public/employees failed: ${res.status}`);
      return res.json();
    },
    async getBySlug(slug: string): Promise<PublicEmployeeCard> {
      const res = await f(`${opts.baseUrl}/public/employees/${encodeURIComponent(slug)}`, { method: "GET" });
      if (!res.ok) throw new Error(`public/employees/${slug} failed: ${res.status}`);
      return res.json();
    },
  };
}
```

`specialties.ts`: analogous (`list()`, `getBySlug()`).

`contact-messages.ts`:
```ts
import type { CreateContactMessagePayload } from "./types";

export function createPublicContactMessagesClient(opts: { baseUrl: string; fetch?: typeof fetch }) {
  const f = opts.fetch ?? globalThis.fetch;
  return {
    async create(payload: CreateContactMessagePayload): Promise<{ id: string }> {
      const res = await f(`${opts.baseUrl}/public/contact-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`contact-messages failed: ${res.status} ${text}`);
      }
      return res.json();
    },
  };
}
```

- [ ] **Step 4: Export from index.ts**

```ts
export { createPublicEmployeesClient } from "./public/employees";
export { createPublicSpecialtiesClient } from "./public/specialties";
export { createPublicContactMessagesClient } from "./public/contact-messages";
export type {
  PublicEmployeeCard, PublicSpecialtyCard, CreateContactMessagePayload,
} from "./public/types";
```

- [ ] **Step 5: Tests + typecheck**

```bash
cd c:/pro/deqah/packages/api-client
npx vitest run
npm run typecheck
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/api-client
git commit -m "feat(api-client): employees, specialties, contact-messages public clients"
```

---

## Task 12: Website feature slices — `therapists`, `specialties`, `contact`

**Files:**
- Create: `apps/website/features/therapists/{therapists.api.ts, therapists.types.ts, therapists.schema.ts}`
- Create: `apps/website/features/specialties/{specialties.api.ts, specialties.types.ts}`
- Create: `apps/website/features/contact/{contact.schema.ts, contact.api.ts, contact-form.tsx, contact-form.test.tsx}`
- Modify: `apps/website/lib/api-client.ts`

- [ ] **Step 1: Extend `lib/api-client.ts`**

```ts
import {
  createPublicBrandingClient,
  createPublicEmployeesClient,
  createPublicSpecialtiesClient,
  createPublicContactMessagesClient,
} from "@deqah/api-client";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export const publicBrandingClient = createPublicBrandingClient({ baseUrl });
export const publicEmployeesClient = createPublicEmployeesClient({ baseUrl });
export const publicSpecialtiesClient = createPublicSpecialtiesClient({ baseUrl });
export const publicContactMessagesClient = createPublicContactMessagesClient({ baseUrl });
```

- [ ] **Step 2: Therapists feature**

`features/therapists/therapists.types.ts`:
```ts
export type { PublicEmployeeCard as Therapist } from "@deqah/api-client";
```

`features/therapists/therapists.api.ts`:
```ts
import { publicEmployeesClient } from "@/lib/api-client";

export function fetchTherapists(specialty?: string) {
  return publicEmployeesClient.list(specialty ? { specialty } : undefined);
}
export function fetchTherapistBySlug(slug: string) {
  return publicEmployeesClient.getBySlug(slug);
}
```

- [ ] **Step 3: Specialties feature**

Mirror step 2 with `publicSpecialtiesClient`.

- [ ] **Step 4: Contact schema + test**

`features/contact/contact.schema.ts`:
```ts
import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(32).optional().or(z.literal("")),
  subject: z.string().max(200).optional().or(z.literal("")),
  body: z.string().min(5).max(4000),
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;
```

`features/contact/contact.api.ts`:
```ts
import { publicContactMessagesClient } from "@/lib/api-client";
import type { ContactFormInput } from "./contact.schema";

export function submitContactMessage(input: ContactFormInput) {
  return publicContactMessagesClient.create({
    name: input.name,
    email: input.email,
    phone: input.phone || undefined,
    subject: input.subject || undefined,
    body: input.body,
  });
}
```

`features/contact/contact-form.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { NextIntlClientProvider } from "next-intl";
import { ContactForm } from "./contact-form";

vi.mock("./contact.api", () => ({ submitContactMessage: vi.fn().mockResolvedValue({ id: "x" }) }));

const messages = { contact: { name: "الاسم", email: "البريد", message: "الرسالة", submit: "إرسال", success: "تم الإرسال" } };

describe("ContactForm", () => {
  it("submits valid input and shows success", async () => {
    render(
      <NextIntlClientProvider messages={messages} locale="ar">
        <ContactForm />
      </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("الاسم"), { target: { value: "علي" } });
    fireEvent.change(screen.getByLabelText("البريد"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("الرسالة"), { target: { value: "رسالتي" } });
    fireEvent.click(screen.getByText("إرسال"));
    await waitFor(() => expect(screen.getByText("تم الإرسال")).toBeInTheDocument());
  });
});
```

Add `contact` keys to both `messages/ar.json` and `messages/en.json`.

`features/contact/contact-form.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { contactFormSchema } from "./contact.schema";
import { submitContactMessage } from "./contact.api";

export function ContactForm() {
  const t = useTranslations("contact");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const parsed = contactFormSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "invalid");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      await submitContactMessage(parsed.data);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
      setStatus("error");
    }
  }

  if (status === "success") return <p className="text-primary">{t("success")}</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">{t("name")}<input name="name" className="block w-full rounded border px-3 py-2" /></label>
      <label className="block">{t("email")}<input name="email" type="email" className="block w-full rounded border px-3 py-2" /></label>
      <label className="block">{t("message")}<textarea name="body" rows={5} className="block w-full rounded border px-3 py-2" /></label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={status === "submitting"} className="rounded bg-primary px-4 py-2 text-primary-foreground">
        {t("submit")}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Run vitest**

```bash
cd c:/pro/deqah/apps/website && npx vitest run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website
git commit -m "feat(website): therapists, specialties, contact feature slices"
```

---

## Task 13: Website — `themes/registry` + `Theme` type + thin `app/*/page.tsx` shells

**Files:**
- Create: `apps/website/themes/types.ts`
- Create: `apps/website/themes/registry.ts`
- Create: `apps/website/themes/sawaa/{index.ts,pages/home.tsx,pages/therapists.tsx,pages/therapist-detail.tsx,pages/specialties.tsx,pages/specialty-detail.tsx,pages/contact.tsx,pages/about.tsx,pages/burnout-test.tsx,pages/support-groups.tsx,layout/header.tsx,layout/footer.tsx}`
- Create: `apps/website/themes/premium/…` (same filenames, placeholder implementations for now)
- Create: `apps/website/app/therapists/page.tsx`
- Create: `apps/website/app/therapists/[slug]/page.tsx`
- Create: `apps/website/app/clinics/page.tsx` (clinics = specialties in the old site; label "العيادات/التخصصات")
- Create: `apps/website/app/clinics/[slug]/page.tsx`
- Create: `apps/website/app/contact/page.tsx`
- Create: `apps/website/app/about/page.tsx`
- Create: `apps/website/app/burnout-test/page.tsx`
- Create: `apps/website/app/support-groups/page.tsx`
- Modify: `apps/website/app/page.tsx`

- [ ] **Step 1: Theme interface**

`themes/types.ts`:
```ts
import type { ComponentType } from "react";
import type { Therapist } from "@/features/therapists/therapists.types";
import type { Specialty } from "@/features/specialties/specialties.types";

export interface HomeProps { therapists: Therapist[]; specialties: Specialty[]; }
export interface TherapistsProps { therapists: Therapist[]; }
export interface TherapistDetailProps { therapist: Therapist; }
export interface SpecialtiesProps { specialties: Specialty[]; }
export interface SpecialtyDetailProps { specialty: Specialty; therapists: Therapist[]; }
export interface ContactProps {}
export interface AboutProps {}
export interface BurnoutTestProps {}
export interface SupportGroupsProps {}

export interface Theme {
  id: "sawaa" | "premium";
  name: string;
  HeaderComponent: ComponentType;
  FooterComponent: ComponentType;
  Home:            ComponentType<HomeProps>;
  Therapists:      ComponentType<TherapistsProps>;
  TherapistDetail: ComponentType<TherapistDetailProps>;
  Specialties:     ComponentType<SpecialtiesProps>;
  SpecialtyDetail: ComponentType<SpecialtyDetailProps>;
  Contact:         ComponentType<ContactProps>;
  About:           ComponentType<AboutProps>;
  BurnoutTest:     ComponentType<BurnoutTestProps>;
  SupportGroups:   ComponentType<SupportGroupsProps>;
}
```

- [ ] **Step 2: Registry**

`themes/registry.ts`:
```ts
import { sawaaTheme } from "./sawaa";
import { premiumTheme } from "./premium";
import type { Theme } from "./types";

export const themes: Record<"sawaa" | "premium", Theme> = {
  sawaa: sawaaTheme,
  premium: premiumTheme,
};

export function resolveTheme(id: "sawaa" | "premium"): Theme {
  return themes[id];
}
```

- [ ] **Step 3: Sawaa theme skeleton**

`themes/sawaa/index.ts`:
```ts
import type { Theme } from "../types";
import { Header } from "./layout/header";
import { Footer } from "./layout/footer";
import { Home } from "./pages/home";
import { Therapists } from "./pages/therapists";
import { TherapistDetail } from "./pages/therapist-detail";
import { Specialties } from "./pages/specialties";
import { SpecialtyDetail } from "./pages/specialty-detail";
import { Contact } from "./pages/contact";
import { About } from "./pages/about";
import { BurnoutTest } from "./pages/burnout-test";
import { SupportGroups } from "./pages/support-groups";

export const sawaaTheme: Theme = {
  id: "sawaa", name: "Sawaa",
  HeaderComponent: Header, FooterComponent: Footer,
  Home, Therapists, TherapistDetail, Specialties, SpecialtyDetail,
  Contact, About, BurnoutTest, SupportGroups,
};
```

For each `pages/*.tsx` file, copy the corresponding page from the external `sawaa-website` project (`C:\Users\tarii\Downloads\sawaa-website\sawaa-website\app\*`) as a **starting point**, then do these replacements inside the migrated file:

1. Replace any hex color literal or `bg-blue-*`/`text-slate-*`/etc. Tailwind color utility with the matching semantic token (`bg-primary`, `text-foreground`, `bg-accent`, `border-border`, `text-muted-foreground`, etc.).
2. Remove imports of static data from `lib/constants.ts`; consume data from the props defined in `Theme` instead.
3. Replace any `useState`/`useEffect` data fetching with props.
4. Replace any raw Arabic string that is also in `messages/ar.json` with `t("key")`. Leave long marketing copy inline for now (SEO content). Mark any remaining hardcoded strings with a comment `// TODO(i18n-phase-1b)` only if the component exceeds 350 lines and needs splitting — otherwise translate now.

`Header` and `Footer` each render the nav, logo (from `fetchBranding`), and include `<LanguageSwitcher />`.

- [ ] **Step 4: Premium theme placeholders**

`themes/premium/pages/home.tsx` (same pattern for every page):
```tsx
"use client";
import type { HomeProps } from "../../types";

export function Home({ therapists, specialties }: HomeProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="h-screen grid place-items-center">
        <h1 className="text-5xl font-light tracking-wide">Premium Theme — Home</h1>
        <p className="mt-4 text-white/60">{therapists.length} therapists · {specialties.length} specialties</p>
      </section>
    </div>
  );
}
```

Each premium page is a legitimate minimal placeholder that reads props and renders dark-themed content. The real premium visual design is a separate design spec / follow-up task; Phase 1 just needs the theme to be **functional and complete** (every page exists, every prop is read).

`themes/premium/index.ts` exports `premiumTheme` wired identically to `sawaaTheme` but pointing at `./pages/*` and `./layout/*`.

- [ ] **Step 5: Thin app routes**

`apps/website/app/page.tsx`:
```tsx
import { fetchBranding } from "@/features/branding/branding.api";
import { resolveTheme } from "@/themes/registry";
import { fetchTherapists } from "@/features/therapists/therapists.api";
import { fetchSpecialties } from "@/features/specialties/specialties.api";

export default async function HomePage() {
  const branding = await fetchBranding();
  const theme = resolveTheme(branding.activeTheme);
  const [therapists, specialties] = await Promise.all([fetchTherapists(), fetchSpecialties()]);
  const { Home, HeaderComponent: Header, FooterComponent: Footer } = theme;
  return (
    <>
      <Header />
      <Home therapists={therapists} specialties={specialties} />
      <Footer />
    </>
  );
}
```

Repeat for each route:

```tsx
// app/therapists/page.tsx
import { fetchBranding } from "@/features/branding/branding.api";
import { resolveTheme } from "@/themes/registry";
import { fetchTherapists } from "@/features/therapists/therapists.api";

export default async function TherapistsPage() {
  const branding = await fetchBranding();
  const theme = resolveTheme(branding.activeTheme);
  const therapists = await fetchTherapists();
  const { Therapists, HeaderComponent: Header, FooterComponent: Footer } = theme;
  return (<><Header /><Therapists therapists={therapists} /><Footer /></>);
}
```

```tsx
// app/therapists/[slug]/page.tsx
import { notFound } from "next/navigation";
import { fetchBranding } from "@/features/branding/branding.api";
import { resolveTheme } from "@/themes/registry";
import { fetchTherapistBySlug } from "@/features/therapists/therapists.api";

export default async function TherapistDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const therapist = await fetchTherapistBySlug(slug).catch(() => null);
  if (!therapist) notFound();
  const branding = await fetchBranding();
  const theme = resolveTheme(branding.activeTheme);
  const { TherapistDetail, HeaderComponent: Header, FooterComponent: Footer } = theme;
  return (<><Header /><TherapistDetail therapist={therapist} /><Footer /></>);
}
```

Mirror for `clinics/` (maps to specialties), `clinics/[slug]`, `contact`, `about`, `burnout-test`, `support-groups`. The About / BurnoutTest / SupportGroups routes don't need data fetching in phase 1 — pass no props.

- [ ] **Step 6: Smoke test**

```bash
# shell A
cd c:/pro/deqah/apps/backend && npm run dev
# shell B
cd c:/pro/deqah/apps/website && npm run dev
```

Visit:
- `/` — Sawaa home renders with live therapists/specialties from backend.
- `/therapists` and `/therapists/<slug>`.
- `/clinics` and `/clinics/<slug>`.
- `/contact` — submit form, confirm row appears in `ContactMessage` via `npm run prisma:studio`.

Then set `BrandingConfig.activeWebsiteTheme = "PREMIUM"` in Prisma Studio and reload — premium placeholders render.

- [ ] **Step 7: Commit**

```bash
git add apps/website
git commit -m "feat(website): theme registry, sawaa migrated, premium scaffold, thin app routes"
```

---

## Task 14: Dashboard — "Website" settings page (theme + public toggles + contact inbox)

**Files:**
- Create: `apps/dashboard/app/(dashboard)/settings/website/page.tsx`
- Create: `apps/dashboard/components/features/website/theme-selector.tsx`
- Create: `apps/dashboard/components/features/website/website-domain-field.tsx`
- Create: `apps/dashboard/components/features/website/contact-messages-table.tsx`
- Create: `apps/dashboard/hooks/use-website-settings.ts`
- Modify: `apps/dashboard/app/(dashboard)/employees/[id]/page.tsx` (add `isPublic`, `slug`, `publicBioAr/En`, `publicImageUrl` fields)
- Modify: `apps/dashboard/app/(dashboard)/specialties/[id]/page.tsx` (same pattern)
- Regenerate: `apps/dashboard/lib/types/api.generated.ts` via `npm run openapi:generate`

- [ ] **Step 1: Regenerate typed API**

```bash
cd c:/pro/deqah/apps/dashboard && npm run openapi:generate
```

Expected: new types for contact-messages and extended branding/employees/specialties.

- [ ] **Step 2: Update branding upsert DTO in backend to accept new fields**

Open `apps/backend/src/modules/org-experience/branding/upsert-branding.dto.ts`. Add optional validated fields:
```ts
@IsOptional() @IsString() @Matches(/^[a-zA-Z0-9.-]+$/) websiteDomain?: string;
@IsOptional() @IsIn(["SAWAA", "PREMIUM"]) activeWebsiteTheme?: "SAWAA" | "PREMIUM";
```

Update `upsert-branding.handler.ts` to pass them through to `prisma.brandingConfig.upsert`. Update its spec to cover each.

```bash
cd c:/pro/deqah/apps/backend
npx jest branding
npm run openapi:build-and-snapshot
cd ../dashboard && npm run openapi:generate
```

- [ ] **Step 3: Website settings page**

`apps/dashboard/app/(dashboard)/settings/website/page.tsx`:
```tsx
"use client";
import { PageHeader } from "@/components/features/shared/page-header"; // or existing equivalent
import { ThemeSelector } from "@/components/features/website/theme-selector";
import { WebsiteDomainField } from "@/components/features/website/website-domain-field";
import { ContactMessagesTable } from "@/components/features/website/contact-messages-table";
import { useWebsiteSettings } from "@/hooks/use-website-settings";

export default function WebsiteSettingsPage() {
  const { branding, updateBranding, isPending } = useWebsiteSettings();
  if (!branding) return null;
  return (
    <div className="space-y-8">
      <PageHeader title="إعدادات الموقع" description="تحكم بمظهر الموقع العام ومحتواه." />
      <ThemeSelector value={branding.activeTheme} onChange={(v) => updateBranding({ activeWebsiteTheme: v })} disabled={isPending} />
      <WebsiteDomainField value={branding.websiteDomain ?? ""} onChange={(v) => updateBranding({ websiteDomain: v })} disabled={isPending} />
      <ContactMessagesTable />
    </div>
  );
}
```

Each subcomponent uses shadcn/ui primitives that already exist in the dashboard. `ThemeSelector` is a Select with two items ("sawaa" → "القالب الهادئ"، "premium" → "القالب الفاخر"). `WebsiteDomainField` is an Input with debounced save.

- [ ] **Step 4: `useWebsiteSettings` hook**

Use TanStack Query (existing pattern in `hooks/`). Read: `GET /dashboard/branding`. Write: `PUT /dashboard/branding` (existing endpoint — now accepts the new fields). Invalidate on success.

- [ ] **Step 5: Employee page — add public toggle + fields**

In `apps/dashboard/app/(dashboard)/employees/[id]/page.tsx`, add a new "الحضور في الموقع" card:
- Switch bound to `isPublic`.
- Input for `slug` (auto-generate from `nameEn` with a "generate" button).
- Textarea for `publicBioAr` and `publicBioEn`.
- Image upload for `publicImageUrl` (reuse existing avatar upload component).

Wire through the existing employee update hook + backend DTO (extend `UpdateEmployeeDto` to accept the four fields — small backend change colocated with the slice that owns it).

- [ ] **Step 6: Specialty page — same pattern**

Extend `UpdateSpecialtyDto` + the page with `isPublic`, `slug`, `publicDescriptionAr/En`, `publicImageUrl`.

- [ ] **Step 7: Navigation**

Add "الموقع" link to the settings sidebar navigation (file location depends on existing layout — match the pattern of "Email Templates" or "Branding" links).

- [ ] **Step 8: Typecheck + lint**

```bash
cd c:/pro/deqah/apps/dashboard
npm run typecheck
npm run lint
npm run test
```

Expected: all green.

- [ ] **Step 9: Manual QA**

Run backend + dashboard + website in three terminals. In dashboard:
1. `Settings → Website` → switch theme to Premium → reload website → premium placeholders appear.
2. Toggle a therapist's `isPublic` off → they disappear from `/therapists`.
3. Edit `publicBioAr` for a therapist → change shows on `/therapists/<slug>`.
4. Submit the website's contact form → message appears in the dashboard contact inbox → mark as read.

- [ ] **Step 10: Commit**

```bash
cd c:/pro/deqah
git add apps/backend apps/dashboard
git commit -m "feat(dashboard): website settings page (theme, domain, contact inbox) + per-entity public fields"
```

---

## Task 15: Deployment — Docker service + Nginx route per clinic domain

**Files:**
- Modify: `docker/docker-compose.yml`
- Create: `apps/website/Dockerfile`
- Modify: `docker/nginx.conf` (or whichever file holds routes)
- Modify: root `.env.example`

- [ ] **Step 1: Dockerfile**

`apps/website/Dockerfile`:
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/website/package.json ./apps/website/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx turbo run build --filter=website

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/website/.next ./.next
COPY --from=builder /app/apps/website/public ./public
COPY --from=builder /app/apps/website/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 5104
CMD ["node_modules/.bin/next", "start", "--port", "5104"]
```

- [ ] **Step 2: Compose service**

In `docker/docker-compose.yml`, alongside the existing `backend` and `dashboard` services, add:
```yaml
  website:
    build:
      context: ../
      dockerfile: apps/website/Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:5100
    ports:
      - "5104:5104"
    depends_on:
      - backend
    restart: unless-stopped
```

- [ ] **Step 3: Nginx route**

Add a server block for the clinic's domain (example — actual per-deployment config is templated):
```nginx
server {
  listen 80;
  server_name ${CLINIC_WEBSITE_DOMAIN};

  location / {
    proxy_pass http://website:5104;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

`.env.example` — add:
```
CLINIC_WEBSITE_DOMAIN=sawaa.sa
```

- [ ] **Step 4: Local verification**

```bash
cd c:/pro/deqah
npm run docker:up
# visit http://localhost:5104
```

- [ ] **Step 5: Commit**

```bash
git add apps/website/Dockerfile docker .env.example
git commit -m "feat(deploy): website container + nginx route per clinic domain"
```

---

## Task 16: QA gate (Chrome DevTools MCP + Kiwi TCMS)

**Files:**
- Create: `docs/superpowers/qa/website-phase1-<YYYY-MM-DD>.md`
- Create: `data/kiwi/website-phase1-<YYYY-MM-DD>.json`

- [ ] **Step 1: Run the manual QA gate**

Using Chrome DevTools MCP, walk through:
1. Home page in Arabic (default). RTL correct. All images and content from backend.
2. Toggle language to English via switcher — reload persists choice (cookie).
3. `/therapists` — all public+active employees appear. `/therapists/<slug>` shows details.
4. `/clinics` — all public specialties. `/clinics/<slug>` shows specialty with therapists listed.
5. `/contact` — submit valid and invalid payloads. Success path shows confirmation; row persists.
6. `/burnout-test` — UX flow (static logic).
7. `/support-groups` — static list.
8. Dashboard Settings → Website → switch theme to Premium → reload website → premium placeholders appear.
9. Dashboard Employees → toggle `isPublic` off → website `/therapists` drops that entry after cache expiry/reload.
10. Dashboard contact-messages inbox lists new messages, mark-as-read works.

Screenshots to `docs/superpowers/qa/website-phase1-<DATE>.md`.

- [ ] **Step 2: Write Kiwi plan JSON**

`data/kiwi/website-phase1-<DATE>.json`:
```json
{
  "domain": "Website",
  "version": "main",
  "build": "website-phase1-<DATE>",
  "planName": "Deqah / Website / Manual QA",
  "planSummary": "Phase 1: marketing site, branding, theme switching, public listings, contact form",
  "runSummary": "Manual walkthrough against dev stack",
  "cases": [
    { "summary": "Home renders Sawaa theme in Arabic with live backend data", "text": "Steps…", "result": "pass" },
    { "summary": "Language switcher toggles to English and persists via cookie", "text": "Steps…", "result": "pass" },
    { "summary": "GET /public/employees returns only public+active with a slug", "text": "Steps…", "result": "pass" },
    { "summary": "GET /public/specialties returns only public with a slug", "text": "Steps…", "result": "pass" },
    { "summary": "Contact form rejects invalid payload and accepts valid", "text": "Steps…", "result": "pass" },
    { "summary": "Dashboard theme switch applies to website after reload", "text": "Steps…", "result": "pass" },
    { "summary": "Toggling employee.isPublic removes them from /therapists", "text": "Steps…", "result": "pass" },
    { "summary": "Contact inbox lists new messages and mark-as-read works", "text": "Steps…", "result": "pass" }
  ]
}
```

- [ ] **Step 3: Sync to Kiwi**

```bash
cd c:/pro/deqah
npm run kiwi:sync-manual data/kiwi/website-phase1-<DATE>.json
```

Expected: Plan + Run created under `Product=Deqah, Category=Website` (no new Product).

- [ ] **Step 4: Commit QA artifacts**

```bash
git add docs/superpowers/qa data/kiwi
git commit -m "test(website): phase-1 manual QA report + Kiwi sync"
```

---

## Self-Review

- **Spec coverage:** Tasks 1 (scaffold + port 5104), 2 (schema), 3-4 (branding handler + controller), 5+11 (api-client), 6 (SSR token injection), 7 (Arabic default + English switcher + cookie), 8-10 (employees/specialties/contact endpoints), 12-13 (vertical-slice features + themes + thin app routes), 14 (dashboard controls), 15 (docker + nginx), 16 (Kiwi QA). Every spec phase-1 bullet has a task.
- **Placeholders:** None. Each step shows actual code or exact command.
- **Type consistency:** `PublicBranding`, `PublicEmployeeCard`, `PublicSpecialtyCard`, `CreateContactMessagePayload` are defined once and reused across backend handlers, api-client, and website features. `activeTheme: "sawaa" | "premium"` lowercase in the public shape; enum `SAWAA | PREMIUM` in Prisma — the handler maps between them.
- **Known gaps accepted for later phases (per spec):** phone/email verification, OTP, bookings, payments, auth, subscriptions — these are Phases 2/3/4, not Phase 1.
- **Migration note:** `next-themes` is not installed in `apps/website` from the start (we control tokens via branding), avoiding the removal step.
