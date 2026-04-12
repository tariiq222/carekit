import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateClientDto } from './update-client.dto';

export type UpdateClientCommand = UpdateClientDto & { tenantId: string; clientId: string };

@Injectable()
export class UpdateClientHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateClientCommand) {
    const client = await this.prisma.client.findUnique({ where: { id: cmd.clientId } });
    if (!client || client.tenantId !== cmd.tenantId) throw new NotFoundException('Client not found');

    return this.prisma.client.update({
      where: { id: cmd.clientId },
      data: {
        name: cmd.name,
        phone: cmd.phone,
        email: cmd.email,
        gender: cmd.gender,
        dateOfBirth: cmd.dateOfBirth !== undefined ? (cmd.dateOfBirth ? new Date(cmd.dateOfBirth) : null) : undefined,
        avatarUrl: cmd.avatarUrl,
        notes: cmd.notes,
        source: cmd.source,
        isActive: cmd.isActive,
      },
    });
  }
}
