import { describe, expect, it } from "vitest"
import { createCategorySchema, editCategorySchema } from "@/lib/schemas/service.schema"

describe("createCategorySchema", () => {
  it("accepts valid bilingual category", () => {
    const result = createCategorySchema.safeParse({
      nameEn: "Physiotherapy",
      nameAr: "علاج طبيعي",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty nameEn", () => {
    const result = createCategorySchema.safeParse({ nameEn: "", nameAr: "علاج طبيعي" })
    expect(result.success).toBe(false)
  })

  it("rejects empty nameAr", () => {
    const result = createCategorySchema.safeParse({ nameEn: "Physio", nameAr: "" })
    expect(result.success).toBe(false)
  })

  it("coerces sortOrder string to number", () => {
    const result = createCategorySchema.safeParse({
      nameEn: "Physio",
      nameAr: "علاج",
      sortOrder: "5",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.sortOrder).toBe(5)
  })
})

describe("editCategorySchema", () => {
  it("accepts all-optional payload", () => {
    const result = editCategorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts isActive toggle", () => {
    const result = editCategorySchema.safeParse({ isActive: false })
    expect(result.success).toBe(true)
  })
})
