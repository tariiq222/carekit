# Website Phase 1 — Slim Manual QA Report

**Date:** 2026-04-17
**Branch:** `feat/website-phase-1`
**Scope:** Phase 1 ship criteria — centralized branding + themes
**Gate:** Slim (4 cases) — focused on the architectural contract

## Environment

- Backend: http://localhost:5100
- Dashboard: http://localhost:5103
- Website: http://localhost:5104 (started with `npx next dev` — turbopack panics with `os error 123` on this host; plain webpack dev works)

## Test cases

### Case 1 — API returns clean PublicBranding
- **Action:** `curl /api/v1/public/branding`
- **Expected:** shape matches PublicBranding, no internal fields leak
- **Observed:** response contains exactly `organizationNameAr`, `organizationNameEn`, `productTagline`, `logoUrl`, `faviconUrl`, `colorPrimary`, `colorPrimaryLight`, `colorPrimaryDark`, `colorAccent`, `colorAccentDark`, `colorBackground`, `fontFamily`, `fontUrl`, `websiteDomain`, `activeWebsiteTheme`. No `id`, `customCss`, `createdAt`, `updatedAt`.
- **Result:** PASS
- **Screenshot:** `screenshots/website-phase-1/01-api-response.png`

### Case 2 — Website renders Sawaa with identity strings
- **Action:** Reset DB to SAWAA, open http://localhost:5104
- **Expected:** Sawaa layout, organizationNameAr visible
- **Observed:** Arabic RTL nav (الرئيسية / المعالجون / التخصصات / تواصل معنا), H1 = "منظمتي" (organizationNameAr), footer "Sawaa theme · Deqah", "لماذا نحن" benefits grid.
- **Result:** PASS
- **Screenshot:** `screenshots/website-phase-1/02-sawaa-home.png`

### Case 3 — Theme switch Sawaa → Premium
- **Action:** Change Theme combobox on `/branding` from ساوا → بريميوم, Save, hard-refresh website
- **Expected:** website renders premium layout
- **Observed:** API `activeWebsiteTheme` → PREMIUM; website shows dark premium layout (black bg, thin typography, "BOOK A SESSION" CTA, "PREMIUM · CAREKIT" footer)
- **Result:** PASS
- **Screenshot:** `screenshots/website-phase-1/03-premium-home.png`

### Case 4 — Centralization (primary color propagates)
- **Action:** Set `colorPrimary` to `#DE0B5C` on `/branding`, Save
- **Expected:**
  - Dashboard chrome/preview reflects the new color without page reload
  - Website reflects the new color after refresh
- **Observed:**
  - Dashboard: preview swatch updates instantly on input; after Save the stored API value is `#DE0B5C`. TanStack Query cache invalidates on mutation success, no page reload.
  - Website `document.documentElement` computed style shows `--primary: #DE0B5C` after reload (verified via `evaluate_script`).
- **Result:** PASS
- **Screenshots:** `screenshots/website-phase-1/04-centralization-dashboard.png`, `screenshots/website-phase-1/05-centralization-website.png`

## Summary

- **4/4 passed**
- Centralization contract verified end-to-end (dashboard change → DB → `/api/v1/public/branding` → website CSS custom property)
- Deferred (covered by e2e in `branding-public.e2e-spec.ts`): API shape detail, websiteDomain persistence, tagline render

## Notes

- `apps/website` turbopack dev (`next dev --turbopack`) panics on Windows with `TurbopackInternalError: os error 123`. Ran with webpack dev (`next dev` from `apps/website`) as a workaround for this QA session. Follow-up ticket recommended.
- DB restored to defaults at end of session (`colorPrimary` NULL, `activeWebsiteTheme` SAWAA).

## Kiwi TCMS

- Plan: `Deqah / Website / Manual QA`
- Run: Kiwi sync deferred — `Category "Website" missing under Deqah`. Needs the "Website" category created under Product "Deqah" before the sync script can upload. Follow-up action for the QA maintainer.
