import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_LIMITS } from "../../../features/plans/plan-limits";
import { parsePlanLimits } from "../../../features/plans/plan-limits.zod";

describe("parsePlanLimits", () => {
  it("accepts the DEFAULT_PLAN_LIMITS shape", () => {
    expect(parsePlanLimits(DEFAULT_PLAN_LIMITS)).toEqual(DEFAULT_PLAN_LIMITS);
  });

  it("rejects a missing required key", () => {
    const { coupons: _drop, ...partial } = DEFAULT_PLAN_LIMITS;
    void _drop;
    expect(() => parsePlanLimits(partial)).toThrow();
  });

  it("rejects a wrong-type value", () => {
    expect(() =>
      parsePlanLimits({ ...DEFAULT_PLAN_LIMITS, coupons: "yes" }),
    ).toThrow();
  });

  it("rejects negative quota below -1", () => {
    expect(() =>
      parsePlanLimits({ ...DEFAULT_PLAN_LIMITS, maxBranches: -2 }),
    ).toThrow();
  });
});
