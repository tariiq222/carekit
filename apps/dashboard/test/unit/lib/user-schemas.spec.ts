import { describe, expect, it } from "vitest"
import {
  userBaseSchema,
  userCreateSchema,
  userEditSchema,
  createRoleSchema,
} from "@/lib/schemas/user.schema"

describe("userBaseSchema", () => {
  it("accepts a valid user payload", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email format", () => {
    const result = userBaseSchema.safeParse({
      email: "not-an-email",
      firstName: "أحمد",
      lastName: "السالم",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty firstName", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      firstName: "",
      lastName: "السالم",
    })
    expect(result.success).toBe(false)
  })

  it("accepts optional E.164 phone", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
      phone: "+966501234567",
    })
    expect(result.success).toBe(true)
  })

  it("rejects non-E.164 phone", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
      phone: "0501234567",
    })
    expect(result.success).toBe(false)
  })
})

describe("userCreateSchema", () => {
  it("accepts a valid create payload with password and roleSlug", () => {
    const result = userCreateSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
      password: "securepass",
      roleSlug: "receptionist",
    })
    expect(result.success).toBe(true)
  })

  it("rejects password shorter than 8 characters", () => {
    const result = userCreateSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
      password: "short",
      roleSlug: "receptionist",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing roleSlug", () => {
    const result = userCreateSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
      password: "securepass",
    })
    expect(result.success).toBe(false)
  })
})

describe("userEditSchema", () => {
  it("accepts partial payload — roleSlug is optional", () => {
    const result = userEditSchema.safeParse({
      email: "user@example.com",
      firstName: "أحمد",
      lastName: "السالم",
    })
    expect(result.success).toBe(true)
  })
})

describe("createRoleSchema", () => {
  it("accepts a valid role name", () => {
    const result = createRoleSchema.safeParse({ name: "Receptionist" })
    expect(result.success).toBe(true)
  })

  it("rejects empty role name", () => {
    const result = createRoleSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })
})
