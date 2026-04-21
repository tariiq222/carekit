import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TENANT_ERROR_CODES } from './tenant.constants';

export class TenantResolutionError extends BadRequestException {
  constructor(reason: string) {
    super({ code: TENANT_ERROR_CODES.RESOLUTION_FAILED, message: reason });
  }
}

export class CrossTenantAccessError extends ForbiddenException {
  constructor(resource: string, expectedOrgId: string, actualOrgId: string) {
    super({
      code: TENANT_ERROR_CODES.CROSS_TENANT_ACCESS,
      message: `Cross-tenant access attempt on ${resource}`,
      expectedOrgId,
      actualOrgId,
    });
  }
}

export class OrganizationSuspendedError extends ForbiddenException {
  constructor(organizationId: string) {
    super({
      code: TENANT_ERROR_CODES.ORG_SUSPENDED,
      message: 'Organization is suspended',
      organizationId,
    });
  }
}
