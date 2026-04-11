import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
  getAccessToken: vi.fn(() => null),
}))

import {
  fetchChatSessions,
  fetchChatSession,
  createChatSession,
  endChatSession,
  sendChatMessage,
  fetchChatbotConfig,
  fetchChatbotConfigByCategory,
  updateChatbotConfig,
  seedChatbotDefaults,
  fetchChatbotAnalytics,
  fetchTopQuestions,
  sendStaffMessage,
  fetchKnowledgeBase,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  fetchKnowledgeFiles,
  processKnowledgeFile,
  deleteKnowledgeFile,
} from "@/lib/api/chatbot"

describe("chatbot api — sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchChatSessions calls /chatbot/sessions", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchChatSessions({ page: 1 })
    expect(getMock).toHaveBeenCalledWith("/chatbot/sessions", expect.objectContaining({ page: 1 }))
  })

  it("fetchChatSession calls /chatbot/sessions/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "s-1" })
    await fetchChatSession("s-1")
    expect(getMock).toHaveBeenCalledWith("/chatbot/sessions/s-1")
  })

  it("createChatSession posts to /chatbot/sessions", async () => {
    postMock.mockResolvedValueOnce({ sessionId: "s-1" })
    await createChatSession()
    expect(postMock).toHaveBeenCalledWith("/chatbot/sessions", expect.anything())
  })

  it("endChatSession posts to /chatbot/sessions/:id/end", async () => {
    postMock.mockResolvedValueOnce({ id: "s-1" })
    await endChatSession("s-1")
    expect(postMock).toHaveBeenCalledWith("/chatbot/sessions/s-1/end")
  })

  it("sendChatMessage posts to /chatbot/sessions/:id/messages", async () => {
    postMock.mockResolvedValueOnce({ reply: "Hello" })
    await sendChatMessage("s-1", "Hi")
    expect(postMock).toHaveBeenCalledWith("/chatbot/sessions/s-1/messages", { content: "Hi" })
  })

  it("sendStaffMessage posts to /chatbot/sessions/:id/staff-messages", async () => {
    postMock.mockResolvedValueOnce({})
    await sendStaffMessage("s-1", "Staff reply")
    expect(postMock).toHaveBeenCalledWith("/chatbot/sessions/s-1/staff-messages", { content: "Staff reply" })
  })
})

describe("chatbot api — config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchChatbotConfig calls /chatbot/config", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchChatbotConfig()
    expect(getMock).toHaveBeenCalledWith("/chatbot/config")
  })

  it("fetchChatbotConfigByCategory calls /chatbot/config/:category", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchChatbotConfigByCategory("general")
    expect(getMock).toHaveBeenCalledWith("/chatbot/config/general")
  })

  it("updateChatbotConfig puts to /chatbot/config", async () => {
    putMock.mockResolvedValueOnce([])
    await updateChatbotConfig({ configs: [] } as Parameters<typeof updateChatbotConfig>[0])
    expect(putMock).toHaveBeenCalledWith("/chatbot/config", expect.anything())
  })

  it("seedChatbotDefaults posts to /chatbot/config/seed", async () => {
    postMock.mockResolvedValueOnce({ seeded: 5 })
    await seedChatbotDefaults()
    expect(postMock).toHaveBeenCalledWith("/chatbot/config/seed")
  })
})

describe("chatbot api — analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchChatbotAnalytics calls /chatbot/analytics", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchChatbotAnalytics({ from: "2026-01-01" })
    expect(getMock).toHaveBeenCalledWith("/chatbot/analytics", expect.objectContaining({ from: "2026-01-01" }))
  })

  it("fetchTopQuestions calls /chatbot/analytics/questions", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchTopQuestions(10)
    expect(getMock).toHaveBeenCalledWith("/chatbot/analytics/questions", { limit: 10 })
  })
})

describe("chatbot-kb api — knowledge base", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchKnowledgeBase calls /chatbot/knowledge-base", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchKnowledgeBase({ page: 1 })
    expect(getMock).toHaveBeenCalledWith("/chatbot/knowledge-base", expect.objectContaining({ page: 1 }))
  })

  it("createKnowledgeEntry posts to /chatbot/knowledge-base", async () => {
    postMock.mockResolvedValueOnce({ id: "kb-1" })
    await createKnowledgeEntry({ title: "Q?", content: "Answer here" } as Parameters<typeof createKnowledgeEntry>[0])
    expect(postMock).toHaveBeenCalledWith("/chatbot/knowledge-base", expect.anything())
  })

  it("updateKnowledgeEntry patches /chatbot/knowledge-base/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "kb-1" })
    await updateKnowledgeEntry("kb-1", { question: "Q2?" } as Parameters<typeof updateKnowledgeEntry>[1])
    expect(patchMock).toHaveBeenCalledWith("/chatbot/knowledge-base/kb-1", expect.anything())
  })

  it("deleteKnowledgeEntry deletes /chatbot/knowledge-base/:id", async () => {
    deleteMock.mockResolvedValueOnce({ deleted: true })
    await deleteKnowledgeEntry("kb-1")
    expect(deleteMock).toHaveBeenCalledWith("/chatbot/knowledge-base/kb-1")
  })

  it("syncKnowledgeBase posts to /chatbot/knowledge-base/sync", async () => {
    postMock.mockResolvedValueOnce({ synced: 3 })
    await syncKnowledgeBase()
    expect(postMock).toHaveBeenCalledWith("/chatbot/knowledge-base/sync")
  })

  it("fetchKnowledgeFiles calls /chatbot/knowledge-base/files", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchKnowledgeFiles({ page: 1 })
    expect(getMock).toHaveBeenCalledWith("/chatbot/knowledge-base/files", expect.objectContaining({ page: 1 }))
  })

  it("processKnowledgeFile posts to /chatbot/knowledge-base/files/:id/process", async () => {
    postMock.mockResolvedValueOnce({ processed: true })
    await processKnowledgeFile("f-1")
    expect(postMock).toHaveBeenCalledWith("/chatbot/knowledge-base/files/f-1/process")
  })

  it("deleteKnowledgeFile deletes /chatbot/knowledge-base/files/:id", async () => {
    deleteMock.mockResolvedValueOnce({ deleted: true })
    await deleteKnowledgeFile("f-1")
    expect(deleteMock).toHaveBeenCalledWith("/chatbot/knowledge-base/files/f-1")
  })
})
