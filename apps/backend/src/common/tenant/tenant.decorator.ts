import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RequestContextStorage } from './request-context';

/**
 * Parameter decorator — injects the current tenantId from RequestContext.
 *
 * @example
 * async findAll(@TenantId() tenantId: string) { ... }
 */
export const TenantId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string => {
    return RequestContextStorage.getOrThrow().tenantId;
  },
);

/** Injects the authenticated user's ID from req.user (populated by JwtStrategy). */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    if (!req.user?.id) throw new Error('UserId: no authenticated user on request');
    return req.user.id;
  },
);
