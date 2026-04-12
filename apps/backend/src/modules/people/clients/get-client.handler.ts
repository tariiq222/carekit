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
    const client = await this.prisma.client.findFirst({
      where: { id: query.clientId, tenantId: query.tenantId },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }
}
