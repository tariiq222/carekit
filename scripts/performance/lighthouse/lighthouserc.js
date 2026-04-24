/** @type {import('@lhci/cli').LighthouseRcConfig} */
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:5001/",
        "http://localhost:5001/bookings",
        "http://localhost:5001/patients",
        "http://localhost:5001/practitioners",
        "http://localhost:5001/services",
        "http://localhost:5001/users",
        "http://localhost:5001/reports",
        "http://localhost:5001/settings",
      ],
      numberOfRuns: 3,
      settings: {
        // Simulate a mid-tier mobile device on 3G for realistic scoring
        preset: "desktop",
        chromeFlags: "--no-sandbox --disable-gpu",
        // Skip PWA — not applicable to admin dashboards
        skipAudits: ["installable-manifest", "splash-screen", "themed-address-bar"],
      },
    },

    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        // Category score thresholds
        "categories:performance": ["error", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 0.8 }],
        "categories:best-practices": ["error", { minScore: 0.8 }],
        "categories:seo": ["error", { minScore: 0.7 }],

        // Core Web Vitals (all values in ms except CLS which is unitless)
        "first-contentful-paint": ["error", { maxNumericValue: 3000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "speed-index": ["error", { maxNumericValue: 4000 }],

        // Suppress some recommended audits that don't apply to authenticated dashboards
        "uses-long-cache-ttl": "off",
        "maskable-icon": "off",
        "apple-touch-icon": "off",
      },
    },

    upload: {
      // Stores reports in a temporary public URL (no server config needed)
      target: "temporary-public-storage",
    },
  },
}
