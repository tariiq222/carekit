import { describe, expect, it } from "vitest"
import {
  createGroupSessionSchema,
  sessionStepInfoSchema,
  sessionStepSettingsSchema,
  sessionStepSchedulingSchema,
  setDateSchema,
} from "@/lib/schemas/group-sessions.schema"

const validBase = {
  nameAr: "يوجا",
  nameEn: "Yoga",
  practitionerId: "550e8400-e29b-41d4-a716-446655440000",
  minParticipants: 3,
  maxParticipants: 10,
  pricePerPersonHalalat: 500,
  durationMinutes: 60,
  schedulingMode: "fixed_date" as const,
  startTime: "2026-06-01T10:00:00Z",
}

describe("createGroupSessionSchema", () => {
  it("accepts valid full payload", () => {
    const result = createGroupSessionSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it("accepts on_capacity scheduling without startTime", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      schedulingMode: "on_capacity",
      startTime: undefined,
    })
    expect(result.success).toBe(true)
  })

  it("rejects fixed_date without startTime", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      startTime: undefined,
    })
    expect(result.success).toBe(false)
  })

  it("rejects minParticipants > maxParticipants", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      minParticipants: 15,
      maxParticipants: 10,
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty nameAr", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      nameAr: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty nameEn", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      nameEn: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid practitionerId", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      practitionerId: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects minParticipants less than 1", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      minParticipants: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects maxParticipants less than 1", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      maxParticipants: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative price", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      pricePerPersonHalalat: -1,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid schedulingMode", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      schedulingMode: "invalid",
    })
    expect(result.success).toBe(false)
  })

  it("accepts optional fields", () => {
    const result = createGroupSessionSchema.safeParse({
      ...validBase,
      descriptionAr: "وصف",
      descriptionEn: "Description",
      departmentId: "660e8400-e29b-41d4-a716-446655440001",
      paymentDeadlineHours: 48,
      isPublished: true,
      expiresAt: "2026-12-31T23:59:59Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("sessionStepInfoSchema", () => {
  it("accepts valid step 1 data", () => {
    const result = sessionStepInfoSchema.safeParse({
      nameAr: "يوجا",
      nameEn: "Yoga",
      practitionerId: "550e8400-e29b-41d4-a716-446655440000",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing nameAr", () => {
    const result = sessionStepInfoSchema.safeParse({
      nameEn: "Yoga",
      practitionerId: "550e8400-e29b-41d4-a716-446655440000",
    })
    expect(result.success).toBe(false)
  })
})

describe("sessionStepSettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = sessionStepSettingsSchema.safeParse({
      minParticipants: 3,
      maxParticipants: 10,
      pricePerPersonHalalat: 500,
      durationMinutes: 60,
    })
    expect(result.success).toBe(true)
  })

  it("accepts with optional paymentDeadlineHours", () => {
    const result = sessionStepSettingsSchema.safeParse({
      minParticipants: 3,
      maxParticipants: 10,
      pricePerPersonHalalat: 500,
      durationMinutes: 60,
      paymentDeadlineHours: 24,
    })
    expect(result.success).toBe(true)
  })
})

describe("sessionStepSchedulingSchema", () => {
  it("accepts valid scheduling data", () => {
    const result = sessionStepSchedulingSchema.safeParse({
      schedulingMode: "fixed_date",
      startTime: "2026-06-01T10:00:00Z",
    })
    expect(result.success).toBe(true)
  })

  it("accepts on_capacity without startTime", () => {
    const result = sessionStepSchedulingSchema.safeParse({
      schedulingMode: "on_capacity",
    })
    expect(result.success).toBe(true)
  })
})

describe("setDateSchema", () => {
  it("accepts valid datetime", () => {
    const result = setDateSchema.safeParse({
      startTime: "2026-06-01T10:00:00Z",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid datetime", () => {
    const result = setDateSchema.safeParse({
      startTime: "not-a-date",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing startTime", () => {
    const result = setDateSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
