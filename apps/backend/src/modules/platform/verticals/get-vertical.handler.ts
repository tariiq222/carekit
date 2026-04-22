import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: { slug: string }) {
    const vertical = await this.prisma.vertical.findFirst({
      where: { slug: cmd.slug, isActive: true },
      include: {
        seedDepartments: { orderBy: { sortOrder: 'asc' } },
        seedServiceCategories: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!vertical) throw new NotFoundException(`Vertical '${cmd.slug}' not found`);
    return vertical;
  }
}
