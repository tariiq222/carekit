import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateVacationDto } from './dto/create-vacation.dto.js';

@Injectable()
export class PractitionerVacationService {
  constructor(private readonly prisma: PrismaService) {}

  async getVacations(practitionerId: string) {
    await this.ensurePractitionerExists(practitionerId);

    return this.prisma.practitionerVacation.findMany({
      where: { practitionerId },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Alias for getVacations — unit tests use listVacations */
  async listVacations(practitionerId: string) {
    return this.getVacations(practitionerId);
  }

  async createVacation(
    practitionerId: string,
    dto: CreateVacationDto,
    currentUserId?: string,
  ) {
    const practitioner = await this.ensurePractitionerExists(practitionerId);

    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'startDate must be before endDate',
        error: 'VALIDATION_ERROR',
      });
    }

    // Check for overlapping vacations
    const existingVacations = await this.prisma.practitionerVacation.findMany({
      where: { practitionerId },
    });

    const hasOverlap = existingVacations.some((v: { startDate: Date; endDate: Date }) => {
      const existStart = new Date(v.startDate);
      const existEnd = new Date(v.endDate);
      return startDate <= existEnd && endDate >= existStart;
    });

    if (hasOverlap) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Vacation period overlaps with an existing vacation',
        error: 'VALIDATION_ERROR',
      });
    }

    return this.prisma.practitionerVacation.create({
      data: {
        practitionerId,
        startDate,
        endDate,
        reason: dto.reason,
      },
    });
  }

  async deleteVacation(
    practitionerId: string,
    vacationId: string,
    currentUserId?: string,
  ) {
    const practitioner = await this.ensurePractitionerExists(practitionerId);

    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    const vacation = await this.prisma.practitionerVacation.findUnique({
      where: { id: vacationId },
    });
    if (!vacation || vacation.practitionerId !== practitionerId) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Vacation not found',
        error: 'VACATION_NOT_FOUND',
      });
    }

    await this.prisma.practitionerVacation.delete({
      where: { id: vacationId },
    });
  }

  // --- Private helpers ---

  private async ensurePractitionerExists(practitionerId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }
    return practitioner;
  }

  private async checkOwnership(ownerUserId: string, currentUserId: string) {
    if (ownerUserId === currentUserId) return;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: { userRoles: { include: { role: true } } },
    });

    const roles = dbUser?.userRoles.map((ur: { role: { slug: string } }) => ur.role.slug) ?? [];
    const isAdmin = roles.includes('super_admin') || roles.includes('receptionist');

    if (!isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only edit your own profile',
        error: 'FORBIDDEN',
      });
    }
  }
}
