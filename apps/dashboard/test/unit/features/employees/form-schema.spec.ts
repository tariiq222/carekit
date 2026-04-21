import { describe, expect, it } from "vitest"
import {
  createEmployeeSchema,
  createEmployeeDefaults,
  EMPLOYEE_GENDERS,
  EMPLOYMENT_TYPES,
} from "@/components/features/employees/create/form-schema"

const valid = {
  nameEn: "Ali Hassan",
  nameAr: "علي حسن",
  email: "ali@clinic.test",
  specialty: "Cardiology",
  isActive: true,
}

describe("createEmployeeSchema", () => {
  it("accepts the minimum valid payload", () => {
    expect(createEmployeeSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects missing nameEn / nameAr / specialty", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, nameEn: "" }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...valid, nameAr: "" }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...valid, specialty: "" }).success).toBe(false)
  })

  it("rejects malformed email", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false)
  })

  it("accepts an empty phone string and a valid phone", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, phone: "" }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...valid, phone: "+966 50-123-4567" }).success).toBe(true)
  })

  it("rejects a phone with illegal characters", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, phone: "abc-def" }).success).toBe(false)
  })

  it("coerces numeric experience and rejects negatives", () => {
    const pos = createEmployeeSchema.safeParse({ ...valid, experience: "5" })
    expect(pos.success).toBe(true)
    if (pos.success) expect(pos.data.experience).toBe(5)
    expect(createEmployeeSchema.safeParse({ ...valid, experience: -1 }).success).toBe(false)
  })

  it("rejects unknown gender / employmentType enum values", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, gender: "OTHER" }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...valid, employmentType: "INTERN" }).success).toBe(false)
  })

  it("accepts the documented enum values", () => {
    for (const g of EMPLOYEE_GENDERS) {
      expect(createEmployeeSchema.safeParse({ ...valid, gender: g }).success).toBe(true)
    }
    for (const et of EMPLOYMENT_TYPES) {
      expect(createEmployeeSchema.safeParse({ ...valid, employmentType: et }).success).toBe(true)
    }
  })

  it("accepts empty avatarUrl string and a valid URL", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, avatarUrl: "" }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...valid, avatarUrl: "https://cdn.test/a.jpg" }).success).toBe(true)
  })

  it("rejects a malformed avatarUrl", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, avatarUrl: "not a url" }).success).toBe(false)
  })
})

describe("createEmployeeDefaults", () => {
  it("is itself invalid against the schema (placeholders lack required fields) — callers must fill in", () => {
    expect(createEmployeeSchema.safeParse(createEmployeeDefaults).success).toBe(false)
  })

  it("matches exactly the shape expected by the form reset", () => {
    expect(createEmployeeDefaults.employmentType).toBe("FULL_TIME")
    expect(createEmployeeDefaults.isActive).toBe(true)
    expect(createEmployeeDefaults.branchIds).toEqual([])
    expect(createEmployeeDefaults.serviceIds).toEqual([])
  })
})
