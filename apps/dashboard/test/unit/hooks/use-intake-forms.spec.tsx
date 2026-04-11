import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
} = vi.hoisted(() => ({
  fetchIntakeForms: vi.fn(),
  fetchIntakeForm: vi.fn(),
  createIntakeForm: vi.fn(),
  updateIntakeForm: vi.fn(),
  deleteIntakeForm: vi.fn(),
  setIntakeFields: vi.fn(),
}))

vi.mock("@/lib/api/intake-forms", () => ({
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
}))

import {
  useIntakeForms,
  useIntakeForm,
  useIntakeFormMutations,
} from "@/hooks/use-intake-forms"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useIntakeForms", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches intake forms and returns items", async () => {
    const forms = [{ id: "f-1", title: "Pre-visit Form" }]
    fetchIntakeForms.mockResolvedValueOnce(forms)

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchIntakeForms).toHaveBeenCalledWith({})
    expect(result.current.forms).toEqual(forms)
  })

  it("returns loading state initially", () => {
    fetchIntakeForms.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.forms).toEqual([])
  })

  it("returns empty array when api returns no items", async () => {
    fetchIntakeForms.mockResolvedValueOnce([])

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.forms).toEqual([])
  })

  it("passes initial query to api", async () => {
    fetchIntakeForms.mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useIntakeForms({ serviceId: "svc-1" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchIntakeForms).toHaveBeenCalledWith({ serviceId: "svc-1" })
  })

  it("setQuery triggers re-fetch with new query", async () => {
    fetchIntakeForms.mockResolvedValue([])

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setQuery({ serviceId: "svc-2" }) })

    await waitFor(() =>
      expect(fetchIntakeForms).toHaveBeenCalledWith({ serviceId: "svc-2" }),
    )
  })
})

describe("useIntakeForm", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches a single intake form by id", async () => {
    const form = { id: "f-1", title: "Pre-visit Form", fields: [] }
    fetchIntakeForm.mockResolvedValueOnce(form)

    const { result } = renderHook(() => useIntakeForm("f-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchIntakeForm).toHaveBeenCalledWith("f-1")
    expect(result.current.data).toEqual(form)
  })

  it("does not fetch when formId is null", () => {
    renderHook(() => useIntakeForm(null), { wrapper: makeWrapper() })
    expect(fetchIntakeForm).not.toHaveBeenCalled()
  })
})

describe("useIntakeFormMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("create calls createIntakeForm", async () => {
    createIntakeForm.mockResolvedValueOnce({ id: "f-new" })

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.create({ title: "New Form", serviceId: "svc-1" } as Parameters<typeof createIntakeForm>[0])
    })

    await waitFor(() => expect(createIntakeForm).toHaveBeenCalled())
  })

  it("update calls updateIntakeForm with formId and payload", async () => {
    updateIntakeForm.mockResolvedValueOnce({ id: "f-1" })

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.update({ formId: "f-1", payload: { title: "Updated" } as Parameters<typeof updateIntakeForm>[1] })
    })

    await waitFor(() => expect(updateIntakeForm).toHaveBeenCalledWith("f-1", { title: "Updated" }))
  })

  it("delete calls deleteIntakeForm with formId", async () => {
    deleteIntakeForm.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.delete("f-1") })

    await waitFor(() => expect(deleteIntakeForm).toHaveBeenCalledWith("f-1"))
  })

  it("setFields calls setIntakeFields with formId and payload", async () => {
    setIntakeFields.mockResolvedValueOnce({ id: "f-1", fields: [] })

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.setFields({ formId: "f-1", payload: { fields: [] } as Parameters<typeof setIntakeFields>[1] })
    })

    await waitFor(() => expect(setIntakeFields).toHaveBeenCalledWith("f-1", { fields: [] }))
  })

  it("exposes loading state for create mutation", async () => {
    createIntakeForm.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.create({ title: "Loading" } as Parameters<typeof createIntakeForm>[0])
    })

    await waitFor(() => expect(result.current.createLoading).toBe(true))
  })
})
