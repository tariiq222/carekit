import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

export const REQUIRE_FEATURE_KEY = 'billing:require-feature';

export const RequireFeature = (key: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, key);
