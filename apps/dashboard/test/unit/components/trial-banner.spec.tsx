import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { TrialBanner } from "@/components/trial-banner"

const { useBilling, useLocale } = vi.hoisted(() => ({
  useBilling: vi.fn(),
  useLocale: vi.fn(),
}))

vi.mock("@/lib/billing/billing-context", () => ({
  useBilling,
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale,
}))

describe("TrialBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"))
    useLocale.mockReturnValue({
      t: (key: string) =>
        ({
          "trialBanner.trialing": "{days} days left in your free trial",
          "trialBanner.trialingWarning": "{days} days left — add a card before the trial ends",
          "trialBanner.trialingLastDay": "Last day of your free trial",
          "trialBanner.pastDue": "Your trial has ended — activate your subscription to continue",
          "trialBanner.suspended": "Your account has been suspended",
          "trialBanner.subscribe": "Subscribe now",
        })[key] ?? key,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mockTrial(daysLeft: number) {
    useBilling.mockReturnValue({
      status: "TRIALING",
      subscription: {
        trialEndsAt: new Date(Date.now() + daysLeft * 86_400_000).toISOString(),
      },
    })
  }

  it("uses the calm trial tone before the 3-day warning window", () => {
    mockTrial(7)

    const { container } = render(<TrialBanner />)

    expect(screen.getByText(/7 days left/)).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass("bg-primary/10")
  })

  it("uses the warning tone inside the 3-day window", () => {
    mockTrial(3)

    const { container } = render(<TrialBanner />)

    expect(screen.getByText(/3 days left/)).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass("bg-warning/10")
  })

  it("uses the blocking tone on the final day", () => {
    mockTrial(1)

    const { container } = render(<TrialBanner />)

    expect(screen.getByText(/Last day of your free trial/)).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass("bg-error/10")
  })

  it("keeps suspended accounts in the blocking tone", () => {
    useBilling.mockReturnValue({ status: "SUSPENDED", subscription: null })

    const { container } = render(<TrialBanner />)

    expect(screen.getByText(/Your account has been suspended/)).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass("bg-error/10")
  })
})
