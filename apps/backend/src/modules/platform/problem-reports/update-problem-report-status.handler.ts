import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ProblemReportStatus } from '@prisma/client';

export interface UpdateProblemReportStatusCommand {
  id: string;
  tenantId: string;
  status: ProblemReportStatus;
  resolution?: string;
}

@Injectable()
export class UpdateProblemReportStatusHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateProblemReportStatusCommand) {
    return this.prisma.problemReport.update({
      where: { id: cmd.id },
      data: { status: cmd.status, resolution: cmd.resolution },
    });
  }
}
