import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuickActions } from "@/components/features/quick-actions"
import { Calendar01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => k,
    toggleLocale: vi.fn(),
  }),
}))

describe("QuickActions", () => {
  const actions = [
    {
      titleKey: "actions.newBooking",
      descriptionKey: "actions.newBookingDesc",
      icon: Calendar01Icon,
      href: "/bookings/create",
      color: "primary" as const,
    },
    {
      titleKey: "actions.newClient",
      descriptionKey: "actions.newClientDesc",
      icon: UserAdd01Icon,
      href: "/clients/create",
      color: "success" as const,
    },
  ]

  it("renders all action titles via t()", () => {
    render(<QuickActions actions={actions} />)
    expect(screen.getByText("actions.newBooking")).toBeInTheDocument()
    expect(screen.getByText("actions.newClient")).toBeInTheDocument()
  })

  it("renders all action descriptions via t()", () => {
    render(<QuickActions actions={actions} />)
    expect(screen.getByText("actions.newBookingDesc")).toBeInTheDocument()
    expect(screen.getByText("actions.newClientDesc")).toBeInTheDocument()
  })

  it("renders correct number of action links", () => {
    render(<QuickActions actions={actions} />)
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
  })

  it("links point to correct hrefs", () => {
    render(<QuickActions actions={actions} />)
    const links = screen.getAllByRole("link")
    expect(links[0]).toHaveAttribute("href", "/bookings/create")
    expect(links[1]).toHaveAttribute("href", "/clients/create")
  })

  it("renders icons for each action", () => {
    const { container } = render(<QuickActions actions={actions} />)
    const svgs = container.querySelectorAll("svg")
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })

  it("renders empty grid when no actions", () => {
    render(<QuickActions actions={[]} />)
    expect(screen.queryByRole("link")).toBeNull()
  })
})
