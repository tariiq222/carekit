import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const {
  fetchFile,
  fetchFiles,
  deleteFile,
  fetchPresignedUrl,
} = vi.hoisted(() => ({
  fetchFile: vi.fn(),
  fetchFiles: vi.fn(),
  deleteFile: vi.fn(),
  fetchPresignedUrl: vi.fn(),
}))

vi.mock("@/lib/api/media", () => ({
  fetchFile,
  fetchFiles,
  deleteFile,
  fetchPresignedUrl,
}))

import {
  useMediaFile,
  useMediaFiles,
  useDeleteFile,
  usePresignedUrl,
} from "@/hooks/use-media"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useMediaFile", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches file by id", async () => {
    const mockFile = {
      id: "file-1",
      bucket: "deqah",
      storageKey: "uploads/file-1.jpg",
      filename: "photo.jpg",
      mimetype: "image/jpeg",
      size: 1024,
      visibility: "PRIVATE",
      isDeleted: false,
      createdAt: "2026-04-12T00:00:00Z",
      updatedAt: "2026-04-12T00:00:00Z",
    }
    fetchFile.mockResolvedValueOnce(mockFile)

    const { result } = renderHook(() => useMediaFile("file-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchFile).toHaveBeenCalledWith("file-1")
    expect(result.current.data).toEqual(mockFile)
  })

  it("does not fetch when id is empty", () => {
    const { result } = renderHook(() => useMediaFile(""), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe("idle")
    expect(fetchFile).not.toHaveBeenCalled()
  })
})

describe("useMediaFiles", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches files list", async () => {
    const mockFiles = {
      data: [
        {
          id: "file-1",
          bucket: "deqah",
          storageKey: "uploads/file-1.jpg",
          filename: "photo.jpg",
          mimetype: "image/jpeg",
          size: 1024,
          visibility: "PRIVATE",
          isDeleted: false,
          createdAt: "2026-04-12T00:00:00Z",
          updatedAt: "2026-04-12T00:00:00Z",
        },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }
    fetchFiles.mockResolvedValueOnce(mockFiles)

    const { result } = renderHook(() => useMediaFiles(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual(mockFiles)
  })
})

describe("useDeleteFile", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("deletes file by id", async () => {
    deleteFile.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useDeleteFile(), { wrapper: makeWrapper() })

    result.current.mutate("file-1")

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deleteFile).toHaveBeenCalledWith("file-1")
  })
})

describe("usePresignedUrl", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches presigned URL by file id", async () => {
    const mockResponse = {
      url: "https://cdn.example.com/presigned/file-1.jpg?token=abc",
      expiresAt: "2026-04-12T01:00:00Z",
    }
    fetchPresignedUrl.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => usePresignedUrl("file-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPresignedUrl).toHaveBeenCalledWith("file-1", {})
    expect(result.current.data).toEqual(mockResponse)
  })

  it("does not fetch when id is empty", () => {
    const { result } = renderHook(() => usePresignedUrl(""), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe("idle")
    expect(fetchPresignedUrl).not.toHaveBeenCalled()
  })
})
