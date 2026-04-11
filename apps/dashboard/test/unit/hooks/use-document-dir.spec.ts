import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("useDocumentDir", () => {
  beforeEach(() => {
    vi.resetModules()
    document.documentElement.dir = "rtl"
  })

  it("returns rtl by default", async () => {
    const { useDocumentDir } = await import("@/hooks/use-document-dir")
    const { result } = renderHook(() => useDocumentDir())
    expect(result.current).toBe("rtl")
  })

  it("returns ltr when document dir is ltr", async () => {
    document.documentElement.dir = "ltr"
    const { useDocumentDir } = await import("@/hooks/use-document-dir")
    const { result } = renderHook(() => useDocumentDir())
    expect(result.current).toBe("ltr")
  })
})
