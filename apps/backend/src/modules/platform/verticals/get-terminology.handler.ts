import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { BASE_PACKS, mergeOverrides, TerminologyPack } from '@carekit/shared/terminology';

@Injectable()
export class GetTerminologyHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: { verticalSlug: string }): Promise<TerminologyPack> {
    const vertical = await this.prisma.vertical.findFirst({
      where: { slug: cmd.verticalSlug },
      include: { terminologyOverrides: true },
    });
    if (!vertical) throw new NotFoundException(`Vertical '${cmd.verticalSlug}' not found`);
    const basePack = BASE_PACKS[vertical.templateFamily];
    return mergeOverrides(basePack, vertical.terminologyOverrides);
  }
}
