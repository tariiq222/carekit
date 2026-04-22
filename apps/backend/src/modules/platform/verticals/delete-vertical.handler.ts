import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class DeleteVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: { id: string }) {
    try {
      return await this.prisma.vertical.delete({ where: { id: cmd.id } });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'P2025') {
        throw new NotFoundException(`Vertical '${cmd.id}' not found`);
      }
      throw err;
    }
  }
}
