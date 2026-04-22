import { TenantContextService } from './tenant-context.service';
import { TenantEnforcementMode } from './tenant.constants';

/**
 * Set of Prisma model names that carry `organizationId` and must be scoped.
 * Empty in Plan 01 — populated per-cluster in Plan 02 as each cluster's
 * schema gains the column. Until then the extension is a registered-but-no-op
 * hook: safe to mount, behavior-neutral.
 */
export type TenantScopedModelRegistry = Set<string>;

const SCOPED_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/**
 * The hook argument shape Prisma 7 passes to `$allOperations`. We don't import
 * `Prisma.Extension` from `@prisma/client` because Prisma 7's public type for
 * that symbol resolves to the _output_ of `defineExtension`, not the input —
 * unusable for factory functions like this one. Structural typing matches the
 * runtime shape 1:1.
 */
interface AllOperationsArgs {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

export interface TenantScopingExtension {
  name: string;
  query?: {
    $allModels: {
      $allOperations?: (args: AllOperationsArgs) => Promise<unknown>;
    };
  };
}

/**
 * Build a Prisma Client extension that auto-injects `organizationId` into
 * every `where` clause for registered models. Dormant when mode === 'off'.
 */
export function buildTenantScopingExtension(
  ctx: TenantContextService,
  mode: TenantEnforcementMode,
  scopedModels: TenantScopedModelRegistry,
): TenantScopingExtension {
  if (mode === 'off') {
    // No query hook — behavior-neutral.
    return { name: 'tenant-scoping:dormant' };
  }

  return {
    name: 'tenant-scoping:active',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !scopedModels.has(model)) return query(args);
          if (!SCOPED_OPERATIONS.has(operation)) return query(args);

          // External-entry bypass: payment-gateway webhooks, FCM DLQ, cron
          // triggered from outside the app arrive with no tenant. The
          // receiving handler opts in via `cls.set('systemContext', true)`
          // inside a `cls.run`, resolves the tenant from the payload, then
          // re-runs the rest of the work under a normal tenant context.
          if (ctx.isSystemContext()) return query(args);

          const current = ctx.get();
          // No tenant context (e.g., system jobs pre-context) — skip scoping.
          // Plan 02 tightens this: cluster rollout enables strict-mode crash.
          if (!current?.organizationId) return query(args);

          const existing = (args as { where?: Record<string, unknown> }).where ?? {};
          const scoped = { ...existing, organizationId: current.organizationId };
          return query({ ...(args as object), where: scoped });
        },
      },
    },
  };
}
