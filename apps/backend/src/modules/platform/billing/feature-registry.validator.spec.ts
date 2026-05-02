import { FeatureRegistryValidator } from "./feature-registry.validator";

describe("FeatureRegistryValidator", () => {
  it("passes for the live registry as shipped", () => {
    const validator = new FeatureRegistryValidator();
    expect(() => validator.validate()).not.toThrow();
  });
});
