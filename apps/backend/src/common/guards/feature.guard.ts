import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';

/** Restrict a route to requests where a specific feature flag is enabled. */
export const RequiresFeature = (feature: string) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);

/**
 * Feature guard — checks that the organization has the required feature
 * enabled via req.user.features (string[]) populated by JwtStrategy.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRES_FEATURE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!feature) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: { features: string[] } }>();

    if (!user) throw new ForbiddenException('No authenticated user');

    const enabled: string[] = user.features ?? [];

    if (!enabled.includes(feature)) {
      throw new ForbiddenException(`Feature "${feature}" is not enabled`);
    }

    return true;
  }
}
