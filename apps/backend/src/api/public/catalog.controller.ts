import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/guards/jwt.guard';
import { PrismaService } from '../../infrastructure/database';

@Controller('public/services')
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  async getCatalog() {
    const [departments, categories, services] = await Promise.all([
      this.prisma.department.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.service.findMany({
        where: { isActive: true, archivedAt: null },
        include: {
          durationOptions: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { nameAr: 'asc' },
      }),
    ]);

    return { departments, categories, services };
  }
}
