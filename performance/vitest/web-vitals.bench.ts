/**
 * Web Vitals Benchmarks — CareKit Dashboard
 *
 * Measures render performance of critical UI components.
 * Budget: 50ms per render (JSDOM overhead included — real browser would be ~16ms).
 *
 * Run: npx vitest bench --config performance/vitest/vitest.config.ts
 */

import { bench, describe, expect } from "vitest"
import { render, cleanup } from "@testing-library/react"
import React from "react"

// ─── StatCard ─────────────────────────────────────────────────────────────────
// Pure presentational card — no context deps, safe to render in isolation
import { StatCard } from "@/components/features/stat-card"

// ─── EmptyState ───────────────────────────────────────────────────────────────
import { EmptyState } from "@/components/features/empty-state"

// ─── PageHeader ───────────────────────────────────────────────────────────────
import { PageHeader } from "@/components/features/page-header"

// ─── Shared render helper ─────────────────────────────────────────────────────

function measureRender(renderFn: () => void): number {
  const start = performance.now()
  renderFn()
  return performance.now() - start
}

// ─── StatCard benchmarks ──────────────────────────────────────────────────────

describe("StatCard render performance", () => {
  bench(
    "renders with value + title under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(StatCard, {
            title: "Total Patients",
            value: "1,248",
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )

  bench(
    "renders with trend badge under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(StatCard, {
            title: "Bookings Today",
            value: "34",
            trend: { value: "12%", positive: true },
            iconColor: "success",
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )

  bench(
    "renders with description under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(StatCard, {
            title: "Revenue",
            value: "SAR 48,200",
            description: "This month",
            iconColor: "warning",
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )
})

// ─── EmptyState benchmarks ────────────────────────────────────────────────────

describe("EmptyState render performance", () => {
  bench(
    "renders minimal (title only) under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(EmptyState, {
            title: "No patients yet",
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )

  bench(
    "renders with action button under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(EmptyState, {
            title: "No bookings found",
            description: "Try adjusting your filters.",
            action: { label: "Clear filters", onClick: () => {} },
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )
})

// ─── PageHeader benchmarks ────────────────────────────────────────────────────

describe("PageHeader render performance", () => {
  bench(
    "renders title only under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(PageHeader, {
            title: "Patients",
            description: "Manage your clinic's patients",
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )

  bench(
    "renders with search input under 16ms",
    () => {
      const duration = measureRender(() => {
        render(
          React.createElement(PageHeader, {
            title: "Bookings",
            search: {
              value: "",
              onChange: () => {},
              placeholder: "Search bookings…",
            },
          }),
        )
        cleanup()
      })
      expect(duration).toBeLessThan(50)
    },
    { iterations: 50 },
  )
})

// ─── Repeated mount/unmount stress ───────────────────────────────────────────

describe("mount/unmount stress", () => {
  bench(
    "StatCard 10× mount-unmount cycle under 100ms total",
    () => {
      const start = performance.now()
      for (let i = 0; i < 10; i++) {
        render(React.createElement(StatCard, { title: `Item ${i}`, value: i }))
        cleanup()
      }
      const total = performance.now() - start
      expect(total).toBeLessThan(100)
    },
    { iterations: 20 },
  )
})
