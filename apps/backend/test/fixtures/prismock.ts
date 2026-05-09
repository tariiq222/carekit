import { PrismockClient } from 'prismock';
import type { PrismaService } from '../../src/infrastructure/database';

type PrismockInstance = InstanceType<typeof PrismockClient>;

let prismockInstance: PrismockInstance | null = null;

export function getPrismock(): PrismockInstance {
  if (!prismockInstance) {
    prismockInstance = new PrismockClient() as PrismockInstance;
  }
  return prismockInstance;
}

export function resetPrismock(): void {
  prismockInstance = null;
}

export function createPrismockService(): PrismaService {
  return getPrismock() as unknown as PrismaService;
}

export function buildPrismaOverride(overrides: Partial<PrismockInstance>) {
  const base = getPrismock();
  return { ...base, ...overrides } as unknown as PrismaService;
}
