import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

import { ActivityFeed, type ActivityItem } from "@/components/features/activity-feed"

const mockItems: ActivityItem[] = [
  { id: "1", type: "booking", messageKey: "activity.booking", timeAgo: "5 دقائق", initials: "أح" },
  { id: "2", type: "payment", messageKey: "activity.payment", timeAgo: "10 دقائق", initials: "مح" },
  { id: "3", type: "cancellation", messageKey: "activity.cancel", timeAgo: "ساعة", initials: "سل" },
]

describe("ActivityFeed", () => {
  it("renders title", () => {
    render(<ActivityFeed items={mockItems} />)
    expect(screen.getByText("dashboard.recentActivity")).toBeInTheDocument()
  })

  it("renders all items with initials and time", () => {
    render(<ActivityFeed items={mockItems} />)
    expect(screen.getByText("أح")).toBeInTheDocument()
    expect(screen.getByText("مح")).toBeInTheDocument()
    expect(screen.getByText("5 دقائق")).toBeInTheDocument()
  })

  it("renders translated message keys", () => {
    render(<ActivityFeed items={mockItems} />)
    expect(screen.getByText("activity.booking")).toBeInTheDocument()
    expect(screen.getByText("activity.payment")).toBeInTheDocument()
  })

  it("renders empty list", () => {
    const { container } = render(<ActivityFeed items={[]} />)
    expect(container.querySelectorAll("[class*='flex items-start']").length).toBe(0)
  })

  it("applies className", () => {
    const { container } = render(<ActivityFeed items={[]} className="extra" />)
    expect(container.querySelector(".extra")).toBeInTheDocument()
  })
})
