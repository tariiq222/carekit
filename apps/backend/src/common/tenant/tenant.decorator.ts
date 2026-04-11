import { createParamDecorator, ExecutionContext } from '@nestjs/common';
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
