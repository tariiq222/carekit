import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../../modules/feature-flags/feature-flags.service.js';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const featureKey = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!featureKey || isPublic) return true;

    const enabled = await this.featureFlagsService.isEnabled(featureKey);
    if (!enabled) {
      throw new ForbiddenException({
        statusCode: 403,
        message: `Feature "${featureKey}" is not enabled`,
        error: 'FEATURE_NOT_ENABLED',
      });
    }

    return true;
  }
}
