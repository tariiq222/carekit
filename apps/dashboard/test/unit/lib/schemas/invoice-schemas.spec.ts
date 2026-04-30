import { describe, expect, it } from "vitest"
import {
  zatcaOnboardSchema,
  zatcaOtpSchema,
} from "@/lib/schemas/invoice.schema"

describe("zatcaOnboardSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      zatcaOnboardSchema.safeParse({
        vatRegistrationNumber: "300000000000003",
        sellerName: "Deqah Clinic",
      }).success,
    ).toBe(true)
  })

  it("rejects empty vatRegistrationNumber", () => {
    expect(zatcaOnboardSchema.safeParse({ vatRegistrationNumber: "", sellerName: "S" }).success).toBe(false)
  })

  it("rejects empty sellerName", () => {
    expect(zatcaOnboardSchema.safeParse({ vatRegistrationNumber: "x", sellerName: "" }).success).toBe(false)
  })

  it("zatcaOtpSchema is an alias of zatcaOnboardSchema", () => {
    expect(zatcaOtpSchema).toBe(zatcaOnboardSchema)
  })
})
