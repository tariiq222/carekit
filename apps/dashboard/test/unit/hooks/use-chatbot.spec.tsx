import { describe, expect, it } from "vitest"
import * as barrel from "@/hooks/use-chatbot"

// use-chatbot.ts is a barrel that re-exports four sibling files. The barrel
// exists for backwards compatibility — if exports ever regress, the callers
// break silently. Lock the re-exports here.

describe("use-chatbot barrel", () => {
  it("re-exports chat-sessions hooks", () => {
    expect(typeof barrel.useChatSessions).toBe("function")
    expect(typeof barrel.useChatSession).toBe("function")
  })

  it("re-exports chatbot-config hooks", () => {
    expect(typeof barrel.useChatbotConfig).toBe("function")
    expect(typeof barrel.useKnowledgeBase).toBe("function")
    expect(typeof barrel.useKnowledgeFiles).toBe("function")
  })

  it("re-exports chatbot-analytics stubs", () => {
    expect(typeof barrel.useChatbotAnalytics).toBe("function")
    expect(typeof barrel.useTopQuestions).toBe("function")
  })

  it("re-exports chatbot-mutations hook", () => {
    expect(typeof barrel.useChatbotMutations).toBe("function")
  })
})
