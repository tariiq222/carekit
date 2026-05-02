import { Injectable, Logger } from "@nestjs/common";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { FEATURE_KEY_MAP } from "./feature-key-map";
import { DEFAULT_PLAN_LIMITS } from "./plan-limits.zod";

/**
 * Boot-time self-check for the feature registry.
 *
 * Asserts that every value in the FeatureKey enum:
 *   1) has an entry in FEATURE_KEY_MAP (mapping enum → Plan.limits JSON key);
 *   2) the mapped JSON key exists as a property on DEFAULT_PLAN_LIMITS.
 *
 * Throws on the first mismatch — the process MUST refuse to boot when the
 * registry is wired inconsistently. Catching this in dev / CI is the whole
 * point of Phase 2's single-source-of-truth work.
 */
@Injectable()
export class FeatureRegistryValidator {
  private readonly logger = new Logger(FeatureRegistryValidator.name);

  validate(): void {
    const enumKeys = Object.values(FeatureKey) as readonly string[];
    const limitsKeys = new Set(Object.keys(DEFAULT_PLAN_LIMITS));
    const errors: string[] = [];

    for (const key of enumKeys) {
      const mapped = (FEATURE_KEY_MAP as Record<string, string | undefined>)[key];
      if (!mapped) {
        errors.push(
          `FeatureKey "${key}" is missing from FEATURE_KEY_MAP ` +
            "(apps/backend/src/modules/platform/billing/feature-key-map.ts).",
        );
        continue;
      }
      if (!limitsKeys.has(mapped)) {
        errors.push(
          `FeatureKey "${key}" maps to "${mapped}", which is not a key ` +
            "on DEFAULT_PLAN_LIMITS (plan-limits.zod.ts). Add it to the " +
            "schema or fix the mapping.",
        );
      }
    }

    if (errors.length > 0) {
      const message =
        "Feature registry self-check failed:\n  - " + errors.join("\n  - ");
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log(
      `Feature registry OK — ${enumKeys.length} keys verified against ` +
        "FEATURE_KEY_MAP and DEFAULT_PLAN_LIMITS.",
    );
  }
}
