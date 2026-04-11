import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateProblemReportDto } from './create-problem-report.dto';

@Injectable()
export class CreateProblemReportHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateProblemReportDto) {
    return this.prisma.problemReport.create({
      data: { tenantId: dto.tenantId, reporterId: dto.reporterId, type: dto.type, title: dto.title, description: dto.description },
    });
  }
}
