import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { FEATURE_CATALOG } from "@deqah/shared";
import { FeatureRegistryValidator } from "./feature-registry.validator";

describe("FeatureRegistryValidator", () => {
  it("passes for the live registry as shipped", () => {
    const validator = new FeatureRegistryValidator();
    expect(() => validator.validate()).not.toThrow();
  });

  it("covers 31 FeatureKey values (16 existing + 15 from Phase 3)", () => {
    expect(Object.values(FeatureKey)).toHaveLength(31);
  });

  it("throws if a key is missing from FEATURE_CATALOG", () => {
    const original = (FEATURE_CATALOG as Record<string, unknown>)[FeatureKey.ZOOM_INTEGRATION];
    delete (FEATURE_CATALOG as Record<string, unknown>)[FeatureKey.ZOOM_INTEGRATION];
    const validator = new FeatureRegistryValidator();
    expect(() => validator.validate()).toThrow(/zoom_integration/);
    (FEATURE_CATALOG as Record<string, unknown>)[FeatureKey.ZOOM_INTEGRATION] = original;
  });
});
