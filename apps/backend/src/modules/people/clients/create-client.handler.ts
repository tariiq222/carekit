import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { ClientEnrolledEvent } from '../events/client-enrolled.event';
import type { CreateClientDto } from './create-client.dto';

@Injectable()
export class CreateClientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreateClientDto) {
    if (dto.phone) {
      const existing = await this.prisma.client.findUnique({
        where: { tenantId_phone: { tenantId: dto.tenantId, phone: dto.phone } },
      });
      if (existing) throw new ConflictException('Phone number already registered for this client');
    }

    const client = await this.prisma.client.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        avatarUrl: dto.avatarUrl,
        notes: dto.notes,
        source: dto.source,
        userId: dto.userId,
      },
    });

    const event = new ClientEnrolledEvent(client.tenantId, {
      clientId: client.id,
      tenantId: client.tenantId,
      name: client.name,
      phone: client.phone ?? undefined,
      email: client.email ?? undefined,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return client;
  }
}
