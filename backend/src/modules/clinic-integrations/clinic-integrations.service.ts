import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateClinicIntegrationsDto } from './dto/update-clinic-integrations.dto.js';
import type { ClinicIntegrations } from '@prisma/client';

const MASKED_FIELDS: (keyof ClinicIntegrations)[] = [
  'moyasarSecretKey',
  'bankIban',
  'bankAccountHolder',
  'emailApiKey',
  'zoomClientSecret',
  'openrouterApiKey',
  'zatcaCsid',
  'zatcaSecret',
  'zatcaPrivateKey',
];

@Injectable()
export class ClinicIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<ClinicIntegrations> {
    const cached = await this.cache.get<ClinicIntegrations>(CACHE_KEYS.CLINIC_INTEGRATIONS);
    if (cached) return cached;

    const integrations = await this.prisma.clinicIntegrations.findFirstOrThrow();
    await this.cache.set(CACHE_KEYS.CLINIC_INTEGRATIONS, integrations, CACHE_TTL.CLINIC_INTEGRATIONS);
    return integrations;
  }

  async getMasked(): Promise<ClinicIntegrations> {
    const integrations = await this.get();
    return this.maskFields(integrations);
  }

  async update(dto: UpdateClinicIntegrationsDto): Promise<ClinicIntegrations> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== '***' && value !== undefined) {
        data[key] = value;
      }
    }

    const current = await this.prisma.clinicIntegrations.findFirstOrThrow();
    const updated = await this.prisma.clinicIntegrations.update({
      where: { id: current.id },
      data,
    });
    await this.invalidate();
    return this.maskFields(updated);
  }

  async getRaw(): Promise<ClinicIntegrations> {
    return this.get();
  }

  private maskFields(integrations: ClinicIntegrations): ClinicIntegrations {
    const masked = { ...integrations };
    for (const field of MASKED_FIELDS) {
      if (masked[field]) {
        (masked as Record<string, unknown>)[field] = '***';
      }
    }
    return masked;
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEYS.CLINIC_INTEGRATIONS);
  }
}
