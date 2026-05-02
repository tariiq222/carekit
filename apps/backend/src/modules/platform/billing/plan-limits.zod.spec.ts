import { DEFAULT_PLAN_LIMITS, parsePlanLimits } from "./plan-limits.zod";

describe("parsePlanLimits (backend)", () => {
  it("accepts DEFAULT_PLAN_LIMITS", () => {
    expect(parsePlanLimits(DEFAULT_PLAN_LIMITS)).toEqual(DEFAULT_PLAN_LIMITS);
  });

  it("rejects a missing key", () => {
    const { coupons: _drop, ...partial } = DEFAULT_PLAN_LIMITS;
    void _drop;
    expect(() => parsePlanLimits(partial)).toThrow();
  });

  it("rejects a string where a boolean is expected", () => {
    expect(() =>
      parsePlanLimits({ ...DEFAULT_PLAN_LIMITS, zatca: "true" }),
    ).toThrow();
  });

  it("rejects maxBranches = -2", () => {
    expect(() =>
      parsePlanLimits({ ...DEFAULT_PLAN_LIMITS, maxBranches: -2 }),
    ).toThrow();
  });
});
