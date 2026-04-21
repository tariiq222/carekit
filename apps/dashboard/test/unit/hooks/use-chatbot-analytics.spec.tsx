import { describe, expect, it } from "vitest"
import { useChatbotAnalytics, useTopQuestions } from "@/hooks/use-chatbot-analytics"

// These hooks are stubs — no backend analytics endpoints yet. The tests lock
// the expected shape so callers' UI state machines don't drift silently.

describe("useChatbotAnalytics (stub)", () => {
  it("returns null stats and no loading/error on first render", () => {
    const out = useChatbotAnalytics()
    expect(out.stats).toBeNull()
    expect(out.loading).toBe(false)
    expect(out.error).toBeNull()
  })

  it("accepts an optional query argument without changing its return shape", () => {
    const out = useChatbotAnalytics({ range: "7d" } as Parameters<typeof useChatbotAnalytics>[0])
    expect(Object.keys(out).sort()).toEqual(["error", "loading", "stats"])
  })
})

describe("useTopQuestions (stub)", () => {
  it("returns an empty questions array and no loading/error", () => {
    const out = useTopQuestions()
    expect(out.questions).toEqual([])
    expect(out.loading).toBe(false)
    expect(out.error).toBeNull()
  })

  it("ignores the limit arg without changing its return shape", () => {
    const out = useTopQuestions(50)
    expect(Object.keys(out).sort()).toEqual(["error", "loading", "questions"])
    expect(out.questions).toEqual([])
  })
})
