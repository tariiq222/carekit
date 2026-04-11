import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useIsMobile } from "@/hooks/use-mobile"

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  })
}

describe("useIsMobile", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Reset matchMedia to a no-op stub
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        matches: false,
      }),
    })
  })

  it("returns false when window.innerWidth is at the breakpoint (768)", () => {
    setInnerWidth(768)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("returns false when window.innerWidth is above the breakpoint", () => {
    setInnerWidth(1280)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("returns true when window.innerWidth is below the breakpoint (767)", () => {
    setInnerWidth(767)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("returns true when window.innerWidth is 0", () => {
    setInnerWidth(0)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("updates when matchMedia change event fires", () => {
    let changeListener: (() => void) | null = null

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: (_: string, fn: () => void) => {
          changeListener = fn
        },
        removeEventListener: vi.fn(),
        matches: false,
      }),
    })

    setInnerWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      setInnerWidth(375)
      changeListener?.()
    })

    expect(result.current).toBe(true)
  })
})
