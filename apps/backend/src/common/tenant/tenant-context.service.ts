import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DEFAULT_ORGANIZATION_ID, TENANT_CLS_KEY } from './tenant.constants';

export interface TenantContext {
  organizationId: string;
  membershipId: string;
  /**
   * User id. Named `id` (not `userId`) to match the shape
   * `JwtStrategy.validate()` already attaches to `req.user`.
   * Renaming would force a cascade rewrite of every guard and handler.
   */
  id: string;
  role: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  set(ctx: TenantContext): void {
    this.cls.set(TENANT_CLS_KEY, ctx);
  }

  get(): TenantContext | undefined {
    return this.cls.get<TenantContext | undefined>(TENANT_CLS_KEY);
  }

  getOrganizationId(): string | undefined {
    return this.get()?.organizationId;
  }

  getMembershipId(): string | undefined {
    return this.get()?.membershipId;
  }

  requireOrganizationId(): string {
    const id = this.getOrganizationId();
    if (!id) throw new Error('Tenant context not set — no organizationId available');
    return id;
  }

  /**
   * Returns the current tenant's organizationId, or falls back to
   * DEFAULT_ORGANIZATION_ID when no context is set. Use this from handlers
   * that must keep working under `TENANT_ENFORCEMENT=off` (no middleware
   * populates CLS in that mode) while still writing/reading a concrete
   * organizationId. Never returns undefined.
   */
  requireOrganizationIdOrDefault(): string {
    return this.getOrganizationId() ?? DEFAULT_ORGANIZATION_ID;
  }

  isSuperAdmin(): boolean {
    return this.get()?.isSuperAdmin === true;
  }

  clear(): void {
    this.cls.set(TENANT_CLS_KEY, undefined);
  }
}
