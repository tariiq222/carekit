import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  createChatSession,
  endChatSession,
  sendChatMessage,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
  updateChatbotConfig,
  seedChatbotDefaults,
  sendStaffMessage,
} = vi.hoisted(() => ({
  createChatSession: vi.fn(),
  endChatSession: vi.fn(),
  sendChatMessage: vi.fn(),
  createKnowledgeEntry: vi.fn(),
  updateKnowledgeEntry: vi.fn(),
  deleteKnowledgeEntry: vi.fn(),
  syncKnowledgeBase: vi.fn(),
  uploadKnowledgeFile: vi.fn(),
  processKnowledgeFile: vi.fn(),
  deleteKnowledgeFile: vi.fn(),
  updateChatbotConfig: vi.fn(),
  seedChatbotDefaults: vi.fn(),
  sendStaffMessage: vi.fn(),
}))

vi.mock("@/lib/api/chatbot", () => ({
  createChatSession,
  endChatSession,
  sendChatMessage,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
  updateChatbotConfig,
  seedChatbotDefaults,
  sendStaffMessage,
}))

import { useChatbotMutations } from "@/hooks/use-chatbot-mutations"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useChatbotMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createSessionMut calls createChatSession", async () => {
    createChatSession.mockResolvedValueOnce({ id: "sess-new" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createSessionMut.mutate(
        { clientId: "pat-1" } as Parameters<typeof createChatSession>[0],
      )
    })

    await waitFor(() =>
      expect(createChatSession).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "pat-1" }),
        expect.anything(),
      ),
    )
  })

  it("sendMessageMut calls sendChatMessage with sessionId and content", async () => {
    sendChatMessage.mockResolvedValueOnce({ id: "msg-1", content: "Hello" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.sendMessageMut.mutate({ sessionId: "sess-1", content: "Hello" })
    })

    await waitFor(() =>
      expect(sendChatMessage).toHaveBeenCalledWith("sess-1", "Hello"),
    )
  })

  it("endSessionMut calls endChatSession with sessionId", async () => {
    endChatSession.mockResolvedValueOnce({ id: "sess-1" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.endSessionMut.mutate("sess-1")
    })

    await waitFor(() =>
      expect(endChatSession).toHaveBeenCalledWith("sess-1", expect.anything()),
    )
  })

  it("createKbEntryMut calls createKnowledgeEntry", async () => {
    createKnowledgeEntry.mockResolvedValueOnce({ id: "kb-new" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createKbEntryMut.mutate(
        { title: "FAQ", content: "..." } as Parameters<typeof createKnowledgeEntry>[0],
      )
    })

    await waitFor(() =>
      expect(createKnowledgeEntry).toHaveBeenCalledWith(
        expect.objectContaining({ title: "FAQ" }),
        expect.anything(),
      ),
    )
  })

  it("deleteKbEntryMut calls deleteKnowledgeEntry with id", async () => {
    deleteKnowledgeEntry.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteKbEntryMut.mutate("kb-1") })

    await waitFor(() =>
      expect(deleteKnowledgeEntry).toHaveBeenCalledWith("kb-1", expect.anything()),
    )
  })

  it("updateKbEntryMut calls updateKnowledgeEntry with id and payload", async () => {
    updateKnowledgeEntry.mockResolvedValueOnce({ id: "kb-1" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateKbEntryMut.mutate({
        id: "kb-1",
        content: "updated",
      } as Parameters<typeof result.current.updateKbEntryMut.mutate>[0])
    })

    await waitFor(() =>
      expect(updateKnowledgeEntry).toHaveBeenCalledWith(
        "kb-1",
        expect.objectContaining({ content: "updated" }),
      ),
    )
  })

  it("staffMsgMut calls sendStaffMessage with sessionId and content", async () => {
    sendStaffMessage.mockResolvedValueOnce({ id: "msg-2" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.staffMsgMut.mutate({ sessionId: "sess-1", content: "Staff note" })
    })

    await waitFor(() =>
      expect(sendStaffMessage).toHaveBeenCalledWith("sess-1", "Staff note"),
    )
  })

  it("syncKbMut calls syncKnowledgeBase", async () => {
    syncKnowledgeBase.mockResolvedValueOnce({ synced: true })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.syncKbMut.mutate(undefined) })

    await waitFor(() => expect(syncKnowledgeBase).toHaveBeenCalled())
  })
})
