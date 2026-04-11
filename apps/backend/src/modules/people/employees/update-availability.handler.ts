import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface UpdateAvailabilityCommand {
  employeeId: string;
  tenantId: string;
  windows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
  exceptions?: Array<{
    date: string;
    isOff: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }>;
}

@Injectable()
export class UpdateAvailabilityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateAvailabilityCommand) {
    const { employeeId, tenantId, windows, exceptions = [] } = cmd;

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const [createdWindows, updatedExceptions] = await this.prisma.$transaction(
      async (tx) => {
        await tx.employeeAvailability.deleteMany({ where: { employeeId } });

        const { count } = await tx.employeeAvailability.createMany({
          data: windows.map((w) => ({
            tenantId,
            employeeId,
            dayOfWeek: w.dayOfWeek,
            startTime: w.startTime,
            endTime: w.endTime,
            isActive: w.isActive ?? true,
          })),
        });

        const exceptionResults = await Promise.all(
          exceptions.map((e) =>
            tx.employeeAvailabilityException.upsert({
              where: {
                employeeId_date: {
                  employeeId,
                  date: new Date(e.date),
                },
              },
              create: {
                tenantId,
                employeeId,
                date: new Date(e.date),
                isOff: e.isOff,
                startTime: e.startTime ?? null,
                endTime: e.endTime ?? null,
                reason: e.reason ?? null,
              },
              update: {
                isOff: e.isOff,
                startTime: e.startTime ?? null,
                endTime: e.endTime ?? null,
                reason: e.reason ?? null,
              },
            }),
          ),
        );

        const windowRows = await tx.employeeAvailability.findMany({
          where: { employeeId },
          orderBy: { dayOfWeek: 'asc' },
        });

        void count;
        return [windowRows, exceptionResults] as const;
      },
    );

    return { windows: createdWindows, exceptions: updatedExceptions };
  }
}
