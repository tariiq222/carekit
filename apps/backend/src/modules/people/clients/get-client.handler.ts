import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetClientQuery {
  clientId: string;
  tenantId: string;
}

@Injectable()
export class GetClientHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetClientQuery) {
    const client = await this.prisma.client.findUnique({ where: { id: query.clientId } });
    if (!client || client.tenantId !== query.tenantId) throw new NotFoundException('Client not found');
    return client;
  }
}
