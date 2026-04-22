import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateVerticalDto } from './dto/create-vertical.dto';

@Injectable()
export class CreateVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateVerticalDto) {
    return this.prisma.vertical.create({
      data: {
        slug: cmd.slug,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        templateFamily: cmd.templateFamily,
        descriptionAr: cmd.descriptionAr,
        descriptionEn: cmd.descriptionEn,
        iconUrl: cmd.iconUrl,
        isActive: cmd.isActive ?? true,
        sortOrder: cmd.sortOrder ?? 0,
      },
    });
  }
}
