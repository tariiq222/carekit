import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AttentionAlerts, type AlertItem } from "@/components/features/attention-alerts"

const FakeIcon = () => <svg data-testid="alert-icon" />

const mockAlerts: AlertItem[] = [
  { id: "1", titleKey: "alerts.waiting", descriptionKey: "alerts.waitingDesc", icon: FakeIcon as never, severity: "warning", count: 3, href: "/bookings?status=pending" },
  { id: "2", titleKey: "alerts.failed", descriptionKey: "alerts.failedDesc", icon: FakeIcon as never, severity: "error", count: 1, href: "/payments?failed=true" },
]

describe("AttentionAlerts", () => {
  it("renders nothing when alerts array is empty", () => {
    const { container } = render(<AttentionAlerts alerts={[]} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders alerts with title and count", () => {
    render(<AttentionAlerts alerts={mockAlerts} />)
    expect(screen.getByText("alerts.waiting")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("alerts.failed")).toBeInTheDocument()
  })

  it("renders alert descriptions", () => {
    render(<AttentionAlerts alerts={mockAlerts} />)
    expect(screen.getByText("alerts.waitingDesc")).toBeInTheDocument()
    expect(screen.getByText("alerts.failedDesc")).toBeInTheDocument()
  })

  it("renders links with correct hrefs", () => {
    render(<AttentionAlerts alerts={mockAlerts} />)
    const links = screen.getAllByRole("link")
    expect(links[0]).toHaveAttribute("href", "/bookings?status=pending")
    expect(links[1]).toHaveAttribute("href", "/payments?failed=true")
  })
})
