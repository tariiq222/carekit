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
}))

import {
  fetchEmailTemplates,
  fetchEmailTemplate,
  updateEmailTemplate,
} from "@/lib/api/email-templates"

describe("email-templates api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchEmailTemplates calls /email-templates", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchEmailTemplates()
    expect(getMock).toHaveBeenCalledWith("/email-templates")
  })

  it("fetchEmailTemplate calls /email-templates/:slug", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchEmailTemplate("booking-confirmed")
    expect(getMock).toHaveBeenCalledWith("/email-templates/booking-confirmed")
  })

  it("updateEmailTemplate patches /email-templates/:id", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateEmailTemplate("tpl-1", { subjectAr: "موضوع" } as Parameters<typeof updateEmailTemplate>[1])
    expect(patchMock).toHaveBeenCalledWith("/email-templates/tpl-1", expect.anything())
  })

})
