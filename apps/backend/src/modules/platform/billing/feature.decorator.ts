import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { FeatureGuard } from './feature.guard';

export const REQUIRE_FEATURE_KEY = 'billing:require-feature';

export const RequireFeature = (key: FeatureKey) =>
  applyDecorators(
    SetMetadata(REQUIRE_FEATURE_KEY, key),
    UseGuards(FeatureGuard),
  );
