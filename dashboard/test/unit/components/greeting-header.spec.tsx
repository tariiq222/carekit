import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "dashboard.goodMorning": "صباح الخير",
        "dashboard.goodAfternoon": "مساء الخير",
        "dashboard.goodEvening": "مساء النور",
        "dashboard.todayOverview": "نظرة عامة على اليوم",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

import { GreetingHeader } from "@/components/features/greeting-header"

describe("GreetingHeader", () => {
  it("renders userName", () => {
    render(<GreetingHeader userName="أحمد" />)
    expect(screen.getByText(/أحمد/)).toBeInTheDocument()
  })

  it("renders today overview text", () => {
    render(<GreetingHeader userName="أحمد" />)
    expect(screen.getByText("نظرة عامة على اليوم")).toBeInTheDocument()
  })

  it("renders a greeting based on time", () => {
    render(<GreetingHeader userName="سارة" />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.textContent).toMatch(/(صباح الخير|مساء الخير|مساء النور).*سارة/)
  })
})
