import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ViewToggle } from "@/components/features/view-toggle"
import type { ViewMode } from "@/components/features/view-toggle"

describe("ViewToggle", () => {
  it("renders two buttons", () => {
    render(<ViewToggle viewMode="grid" onViewModeChange={vi.fn()} />)
    expect(screen.getAllByRole("button")).toHaveLength(2)
  })

  it("calls onViewModeChange with 'grid' when grid clicked", async () => {
    const onChange = vi.fn()
    render(<ViewToggle viewMode="list" onViewModeChange={onChange} />)

    const buttons = screen.getAllByRole("button")
    await userEvent.click(buttons[0])
    expect(onChange).toHaveBeenCalledWith("grid")
  })

  it("calls onViewModeChange with 'list' when list clicked", async () => {
    const onChange = vi.fn()
    render(<ViewToggle viewMode="grid" onViewModeChange={onChange} />)

    const buttons = screen.getAllByRole("button")
    await userEvent.click(buttons[1])
    expect(onChange).toHaveBeenCalledWith("list")
  })
})
