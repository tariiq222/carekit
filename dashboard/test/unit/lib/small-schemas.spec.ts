import { describe, expect, it } from "vitest"
import { createKbEntrySchema } from "@/lib/schemas/chatbot.schema"
import { resolveProblemReportSchema } from "@/lib/schemas/problem-report.schema"
import { zatcaOtpSchema } from "@/lib/schemas/invoice.schema"

describe("createKbEntrySchema", () => {
  it("accepts a valid KB entry", () => {
    const result = createKbEntrySchema.safeParse({ title: "FAQ", content: "Answer here" })
    expect(result.success).toBe(true)
  })

  it("rejects empty title", () => {
    const result = createKbEntrySchema.safeParse({ title: "", content: "Answer here" })
    expect(result.success).toBe(false)
  })

  it("rejects empty content", () => {
    const result = createKbEntrySchema.safeParse({ title: "FAQ", content: "" })
    expect(result.success).toBe(false)
  })

  it("accepts optional category", () => {
    const result = createKbEntrySchema.safeParse({ title: "FAQ", content: "Answer", category: "General" })
    expect(result.success).toBe(true)
  })
})

describe("resolveProblemReportSchema", () => {
  it("accepts resolved status", () => {
    const result = resolveProblemReportSchema.safeParse({ status: "resolved" })
    expect(result.success).toBe(true)
  })

  it("accepts dismissed status with notes", () => {
    const result = resolveProblemReportSchema.safeParse({ status: "dismissed", adminNotes: "Duplicate report" })
    expect(result.success).toBe(true)
  })

  it("rejects unknown status", () => {
    const result = resolveProblemReportSchema.safeParse({ status: "pending" })
    expect(result.success).toBe(false)
  })
})

describe("zatcaOtpSchema", () => {
  it("accepts a valid OTP", () => {
    const result = zatcaOtpSchema.safeParse({ otp: "123456" })
    expect(result.success).toBe(true)
  })

  it("rejects empty OTP", () => {
    const result = zatcaOtpSchema.safeParse({ otp: "" })
    expect(result.success).toBe(false)
  })
})
