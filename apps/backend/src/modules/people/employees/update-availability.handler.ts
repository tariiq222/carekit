import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface AvailabilityException {
  date: string;
  isOff: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface UpdateAvailabilityCommand {
  employeeId: string;
  tenantId: string;
  windows: AvailabilityWindow[];
  exceptions?: AvailabilityException[];
}

function validateTimeFormat(time: string): boolean {
  return /^\d{2}:\d{2}$/.test(time);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function validateWindows(windows: AvailabilityWindow[]): void {
  const seenDays = new Set<number>();
  for (const w of windows) {
    if (w.dayOfWeek < 0 || w.dayOfWeek > 6) {
      throw new BadRequestException(`dayOfWeek must be 0–6, got ${w.dayOfWeek}`);
    }
    if (!validateTimeFormat(w.startTime) || !validateTimeFormat(w.endTime)) {
      throw new BadRequestException(`Invalid time format — expected HH:MM`);
    }
    if (timeToMinutes(w.startTime) >= timeToMinutes(w.endTime)) {
      throw new BadRequestException(`startTime must be before endTime for dayOfWeek ${w.dayOfWeek}`);
    }
    if (seenDays.has(w.dayOfWeek)) {
      throw new BadRequestException(`Duplicate dayOfWeek ${w.dayOfWeek} in windows`);
    }
    seenDays.add(w.dayOfWeek);
  }
}

@Injectable()
export class UpdateAvailabilityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateAvailabilityCommand) {
    const { employeeId, tenantId, windows, exceptions = [] } = cmd;

    validateWindows(windows);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee || employee.tenantId !== tenantId) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const [createdWindows, updatedExceptions] = await this.prisma.$transaction(
      async (tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0]) => {
        await tx.employeeAvailability.deleteMany({ where: { employeeId } });

        await tx.employeeAvailability.createMany({
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
              where: { employeeId_date: { employeeId, date: new Date(e.date) } },
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

        return [windowRows, exceptionResults] as const;
      },
    );

    return { windows: createdWindows, exceptions: updatedExceptions };
  }
}
