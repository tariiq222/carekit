import { ForbiddenException } from "@nestjs/common";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";

export interface FeatureNotEnabledBody {
  statusCode: 403;
  code: "FEATURE_NOT_ENABLED";
  featureKey: FeatureKey;
  planSlug: string;
  message: string;
}

export class FeatureNotEnabledException extends ForbiddenException {
  constructor(
    public readonly featureKey: FeatureKey,
    public readonly planSlug: string,
  ) {
    const body: FeatureNotEnabledBody = {
      statusCode: 403,
      code: "FEATURE_NOT_ENABLED",
      featureKey,
      planSlug,
      message: `Feature '${featureKey}' is not enabled for your plan`,
    };
    super(body);
  }
}
