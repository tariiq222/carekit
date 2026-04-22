import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListVerticalsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.vertical.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
