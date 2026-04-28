import { Test } from '@nestjs/testing';
import { UsageAggregatorService } from '../platform/billing/usage-aggregator.service';
import { OpsModule } from './ops.module';
import { BillingModule } from '../platform/billing/billing.module';

// P0: BillingModule's interceptor and OpsModule's cron must share ONE
// UsageAggregatorService instance. Re-providing the class in OpsModule's
// `providers` array would create a second in-memory Map and silently lose
// every interceptor increment from the cron's perspective.
//
// This test fails if anyone re-adds UsageAggregatorService to OpsModule.providers.

describe('UsageAggregator wiring (P0 — single shared instance)', () => {
  it('OpsModule does not redeclare UsageAggregatorService as a provider', () => {
    const mod = Reflect.getMetadata('providers', OpsModule) as unknown[];
    const names = mod.map((p) =>
      typeof p === 'function' ? (p as { name: string }).name : '',
    );
    expect(names).not.toContain(UsageAggregatorService.name);
  });

  it('OpsModule imports BillingModule so the exported singleton is reachable', () => {
    const imports = Reflect.getMetadata('imports', OpsModule) as unknown[];
    const flat = imports.flatMap((i) =>
      typeof i === 'function' ? [(i as { name: string }).name] : [],
    );
    expect(flat).toContain(BillingModule.name);
  });
});
