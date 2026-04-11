# Lighthouse CI — CareKit Dashboard

Performance audits for the Next.js admin dashboard using [LHCI](https://github.com/GoogleChrome/lighthouse-ci).

## Prerequisites

1. **Node.js 18+** installed
2. **Google Chrome** installed (LHCI drives a real browser)
3. **Dashboard running** on `http://localhost:5001`

```bash
# From repo root
npm run dev:dashboard
```

## Install LHCI

```bash
npm install -g @lhci/cli
```

Or use `npx` — the audit script falls back automatically if `lhci` is not on PATH.

## Run an Audit

```bash
# From repo root
bash performance/lighthouse/run-audit.sh
```

The script:
1. Verifies the dashboard is reachable on `:5001`
2. Runs `lhci autorun` — 3 Lighthouse passes per URL × 8 pages
3. Asserts all metrics against the thresholds in `lighthouserc.js`
4. Uploads reports to temporary public storage and prints the shareable URL
5. Exits non-zero if any assertion fails (safe for CI)

HTML reports are saved to `performance/lighthouse/results/`.

## Thresholds

| Metric | Budget |
|---|---|
| Performance score | ≥ 0.70 |
| Accessibility score | ≥ 0.80 |
| Best Practices score | ≥ 0.80 |
| SEO score | ≥ 0.70 |
| First Contentful Paint | < 3 000 ms |
| Largest Contentful Paint | < 4 000 ms |
| Total Blocking Time | < 300 ms |
| Cumulative Layout Shift | < 0.10 |
| Speed Index | < 4 000 ms |

## What Each Metric Means

**First Contentful Paint (FCP)** — Time until the browser renders the first text or image. Poor FCP means the page feels blank for too long. Fix: reduce server response time, eliminate render-blocking resources.

**Largest Contentful Paint (LCP)** — Time until the largest visible element is rendered. The most user-relevant loading metric. Fix: lazy-load below-fold images, preload hero images, use a CDN.

**Total Blocking Time (TBT)** — Sum of all periods where the main thread was blocked long enough to prevent input response. Fix: code-split large JS bundles, defer non-critical scripts.

**Cumulative Layout Shift (CLS)** — Measures unexpected visual shifts during page load. Fix: set explicit `width`/`height` on images and iframes, avoid injecting content above existing content.

**Speed Index** — How quickly content is visually populated. Lower is better. Fix: prioritise critical CSS, reduce render-blocking scripts.

## Audited Pages

| Route | Notes |
|---|---|
| `/` | Login / root redirect |
| `/bookings` | Main booking list |
| `/clients` | Client directory |
| `/employees` | Employee roster |
| `/services` | Service catalog |
| `/users` | Staff user list |
| `/reports` | Analytics dashboard |
| `/settings` | Clinic settings |

## Reading Results

Open any `.html` file in `performance/lighthouse/results/` in a browser for the full Lighthouse report with waterfall, screenshots, and per-audit details.

The `manifest.json` in the same folder lists all run summaries and is machine-readable for trend tracking.
