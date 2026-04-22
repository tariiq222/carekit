import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateVerticalDto } from './dto/update-vertical.dto';

type UpdateVerticalCmd = { id: string } & UpdateVerticalDto;

@Injectable()
export class UpdateVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateVerticalCmd) {
    const { id, ...fields } = cmd;

    // Build only defined fields — never pass undefined to Prisma
    const data: Record<string, unknown> = {};
    if (fields.slug !== undefined) data['slug'] = fields.slug;
    if (fields.nameAr !== undefined) data['nameAr'] = fields.nameAr;
    if (fields.nameEn !== undefined) data['nameEn'] = fields.nameEn;
    if (fields.templateFamily !== undefined) data['templateFamily'] = fields.templateFamily;
    if (fields.descriptionAr !== undefined) data['descriptionAr'] = fields.descriptionAr;
    if (fields.descriptionEn !== undefined) data['descriptionEn'] = fields.descriptionEn;
    if (fields.iconUrl !== undefined) data['iconUrl'] = fields.iconUrl;
    if (fields.isActive !== undefined) data['isActive'] = fields.isActive;
    if (fields.sortOrder !== undefined) data['sortOrder'] = fields.sortOrder;

    try {
      return await this.prisma.vertical.update({ where: { id }, data });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'P2025') {
        throw new NotFoundException(`Vertical '${id}' not found`);
      }
      throw err;
    }
  }
}
