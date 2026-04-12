import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateProblemReportDto } from './create-problem-report.dto';

export type CreateProblemReportCommand = CreateProblemReportDto & { tenantId: string };

@Injectable()
export class CreateProblemReportHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateProblemReportCommand) {
    return this.prisma.problemReport.create({
      data: {
        tenantId: cmd.tenantId,
        reporterId: cmd.reporterId,
        type: cmd.type,
        title: cmd.title,
        description: cmd.description,
      },
    });
  }
}
