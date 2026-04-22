import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateProblemReportDto } from './create-problem-report.dto';

export type CreateProblemReportCommand = CreateProblemReportDto;

@Injectable()
export class CreateProblemReportHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateProblemReportCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.problemReport.create({
      data: {
        organizationId,
        reporterId: cmd.reporterId,
        type: cmd.type,
        title: cmd.title,
        description: cmd.description,
      },
    });
  }
}
