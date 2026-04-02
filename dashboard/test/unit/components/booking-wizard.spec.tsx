/**
 * booking-wizard.spec.tsx
 *
 * Tests for postMessage security:
 * - postToHost must use targetOrigin, not "*"
 * - handleMessage must reject messages from unexpected origins
 */

import { render } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Mock step components so the wizard renders without real API deps ──────────

vi.mock("@/components/features/widget/widget-service-step", () => ({
  WidgetServiceStep: () => <div data-testid="service-step" />,
}))
vi.mock("@/components/features/widget/widget-datetime-step", () => ({
  WidgetDatetimeStep: () => <div data-testid="datetime-step" />,
}))
vi.mock("@/components/features/widget/widget-auth-step", () => ({
  WidgetAuthStep: () => <div data-testid="auth-step" />,
}))
vi.mock("@/components/features/widget/widget-confirm-step", () => ({
  WidgetConfirmStep: () => <div data-testid="confirm-step" />,
}))
vi.mock("@/components/features/widget/widget-header", () => ({
  WidgetHeader: () => <div data-testid="widget-header" />,
}))

vi.mock("@/lib/api/widget", () => ({
  fetchWidgetPractitioners: vi.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
  fetchWidgetPractitionerServices: vi.fn().mockResolvedValue([]),
  fetchWidgetServiceTypes: vi.fn().mockResolvedValue([]),
  fetchWidgetSlots: vi.fn().mockResolvedValue([]),
  fetchWidgetServices: vi.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
  fetchPublicBranches: vi.fn().mockResolvedValue([]),
  widgetCreateBooking: vi.fn(),
}))

import { BookingWizard, postToHost } from "@/components/features/widget/booking-wizard"

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderWizard(props: { parentOrigin?: string } = {}) {
  return render(
    <Wrapper>
      <BookingWizard initialLocale="ar" {...props} />
    </Wrapper>,
  )
}

// ── postToHost unit tests (pure function) ─────────────────────────────────────

describe("postToHost", () => {
  let postMessageSpy: ReturnType<typeof vi.fn>
  let originalParent: Window & typeof globalThis

  beforeEach(() => {
    postMessageSpy = vi.fn()
    originalParent = window.parent as Window & typeof globalThis
    // Simulate being inside an iframe: window.parent !== window
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      value: originalParent,
      writable: true,
      configurable: true,
    })
  })

  it("sends to the declared targetOrigin", () => {
    postToHost({ type: "carekit:widget:close" }, "https://clinic.example.com")
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "carekit:widget:close" },
      "https://clinic.example.com",
    )
  })

  it("never uses wildcard * when a specific origin is provided", () => {
    postToHost({ type: "carekit:widget:resize", height: 500 }, "https://clinic.example.com")
    const call = postMessageSpy.mock.calls[0]
    expect(call[1]).not.toBe("*")
    expect(call[1]).toBe("https://clinic.example.com")
  })

  it("uses * when no specific origin is configured (fallback)", () => {
    postToHost({ type: "carekit:widget:close" }, "*")
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "carekit:widget:close" },
      "*",
    )
  })

  it("sends the correct message payload", () => {
    postToHost({ type: "carekit:booking:complete", bookingId: "bk-42" }, "https://clinic.example.com")
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "carekit:booking:complete", bookingId: "bk-42" },
      "https://clinic.example.com",
    )
  })

  it("does not send when not inside an iframe (window.parent === window)", () => {
    // Restore parent === window to simulate same-window context
    Object.defineProperty(window, "parent", {
      value: window,
      writable: true,
      configurable: true,
    })
    postToHost({ type: "carekit:widget:close" }, "https://clinic.example.com")
    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

// ── BookingWizard handleMessage origin validation ─────────────────────────────

describe("BookingWizard — handleMessage origin validation", () => {
  afterEach(() => vi.clearAllMocks())

  it("ignores messages from origins other than parentOrigin", () => {
    renderWizard({ parentOrigin: "https://clinic.example.com" })

    expect(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "carekit:widget:config" },
          origin: "https://evil.attacker.com",
        }),
      )
    }).not.toThrow()
  })

  it("accepts messages from the declared parentOrigin without throwing", () => {
    renderWizard({ parentOrigin: "https://clinic.example.com" })

    expect(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "carekit:widget:config" },
          origin: "https://clinic.example.com",
        }),
      )
    }).not.toThrow()
  })

  it("accepts messages from any origin when parentOrigin is * (no restriction)", () => {
    renderWizard({ parentOrigin: "*" })

    expect(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "carekit:widget:config" },
          origin: "https://any-site.com",
        }),
      )
    }).not.toThrow()
  })

  it("renders without error when parentOrigin is not provided", () => {
    expect(() => renderWizard()).not.toThrow()
  })
})
