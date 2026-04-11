import { describe, expect, it } from "vitest"
import { cn, formatCurrency } from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    const result = cn("p-4", "p-8")
    expect(result).toBe("p-8")
  })

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end")
  })
})

describe("formatCurrency", () => {
  it("converts halalat to SAR (divides by 100)", () => {
    expect(formatCurrency(10000, "ar")).toBe("100")
  })

  it("returns zero for 0 halalat", () => {
    expect(formatCurrency(0, "en")).toBe("0")
  })

  it("respects decimal places parameter", () => {
    expect(formatCurrency(1050, "ar", 2)).toBe("10.50")
  })

  it("rounds to specified decimals", () => {
    expect(formatCurrency(1055, "ar", 1)).toBe("10.6")
  })
})
