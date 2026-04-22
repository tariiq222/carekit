import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

type UpsertTerminologyOverrideCmd = {
  verticalId: string;
  tokenKey: string;
  valueAr: string;
  valueEn: string;
};

@Injectable()
export class UpsertTerminologyOverrideHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertTerminologyOverrideCmd) {
    const vertical = await this.prisma.vertical.findUnique({ where: { id: cmd.verticalId } });
    if (!vertical) {
      throw new NotFoundException(`Vertical '${cmd.verticalId}' not found`);
    }

    return this.prisma.verticalTerminologyOverride.upsert({
      where: {
        verticalId_tokenKey: { verticalId: cmd.verticalId, tokenKey: cmd.tokenKey },
      },
      create: {
        verticalId: cmd.verticalId,
        tokenKey: cmd.tokenKey,
        valueAr: cmd.valueAr,
        valueEn: cmd.valueEn,
      },
      update: {
        valueAr: cmd.valueAr,
        valueEn: cmd.valueEn,
      },
    });
  }
}
