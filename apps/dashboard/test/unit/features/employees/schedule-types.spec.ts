import { describe, expect, it } from "vitest"
import {
  DAY_NAMES_EN,
  DAY_NAMES_AR,
  nextBreakKey,
} from "@/components/features/employees/create/schedule-types"

describe("DAY_NAMES_EN / DAY_NAMES_AR", () => {
  it("are 7-tuples starting at Sunday", () => {
    expect(DAY_NAMES_EN).toHaveLength(7)
    expect(DAY_NAMES_AR).toHaveLength(7)
    expect(DAY_NAMES_EN[0]).toBe("Sunday")
    expect(DAY_NAMES_AR[0]).toBe("الأحد")
  })

  it("AR and EN align index-by-index on the same weekday", () => {
    const expectedAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    DAY_NAMES_AR.forEach((name, i) => {
      expect(name).toBe(expectedAr[i])
    })
  })
})

describe("nextBreakKey", () => {
  it("produces monotonically distinct keys", () => {
    const keys = new Set<string>()
    for (let i = 0; i < 5; i++) keys.add(nextBreakKey())
    expect(keys.size).toBe(5)
    for (const k of keys) expect(k).toMatch(/^brk-\d+$/)
  })
})
