import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { GroupQueryDto } from './dto/query-group.dto.js';
import { GroupsPaymentService } from './groups-payment.service.js';
import { GroupsLifecycleService } from './groups-lifecycle.service.js';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: GroupsPaymentService,
    private readonly lifecycleService: GroupsLifecycleService,
  ) {}

  async create(dto: CreateGroupDto) {
    if (dto.minParticipants > dto.maxParticipants) {
      throw new BadRequestException('minParticipants cannot exceed maxParticipants');
    }

    if (dto.schedulingMode === 'fixed_date' && !dto.startTime) {
      throw new BadRequestException('startTime is required for fixed_date scheduling');
    }

    if (dto.paymentType === 'DEPOSIT' && dto.depositAmount === undefined) {
      throw new BadRequestException('depositAmount is required when paymentType is DEPOSIT');
    }

    let startTime: Date | undefined;
    let endTime: Date | undefined;

    if (dto.startTime) {
      startTime = new Date(dto.startTime);
      if (startTime <= new Date()) {
        throw new BadRequestException('Start time must be in the future');
      }
      endTime = new Date(startTime.getTime() + dto.durationMinutes * 60 * 1000);
    }

    return this.prisma.group.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMinutes: dto.durationMinutes,
        paymentDeadlineHours: dto.paymentDeadlineHours ?? 48,
        paymentType: dto.paymentType,
        depositAmount: dto.depositAmount,
        ...(dto.remainingDueDate !== undefined && {
          remainingDueDate: new Date(dto.remainingDueDate),
        }),
        schedulingMode: dto.schedulingMode,
        startTime,
        endTime,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        deliveryMode: dto.deliveryMode ?? 'in_person',
        location: dto.location,
        meetingLink: dto.meetingLink,
        isPublished: dto.isPublished ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
      },
    });
  }

  async findAll(query: GroupQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };

    if (query.practitionerId) where.practitionerId = query.practitionerId;
    if (query.status) where.status = query.status;
    if (query.deliveryMode) where.deliveryMode = query.deliveryMode;
    if (query.visibility === 'published') where.isPublished = true;
    if (query.visibility === 'draft') where.isPublished = false;
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: {
          practitioner: { select: { id: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.group.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
        enrollments: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
            payment: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException({ statusCode: 404, message: 'Group not found', error: 'NOT_FOUND' });
    }

    return group;
  }

  async getGroupsByPractitioner(practitionerId: string) {
    return this.prisma.group.findMany({
      where: { practitionerId, deletedAt: null },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.findOne(id);

    if (dto.minParticipants !== undefined && dto.maxParticipants !== undefined) {
      if (dto.minParticipants > dto.maxParticipants) {
        throw new BadRequestException('minParticipants cannot exceed maxParticipants');
      }
    }

    if (dto.paymentType === 'DEPOSIT' && dto.depositAmount === undefined && !group.depositAmount) {
      throw new BadRequestException('depositAmount is required when paymentType is DEPOSIT');
    }

    const isSettingDate = !!dto.startTime && !group.startTime;
    let startTime: Date | undefined;
    let endTime: Date | undefined;

    if (dto.startTime) {
      startTime = new Date(dto.startTime);
      if (startTime <= new Date()) {
        throw new BadRequestException('Start time must be in the future');
      }
      const duration = dto.durationMinutes ?? group.durationMinutes;
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    }

    const updated = await this.prisma.group.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMinutes: dto.durationMinutes,
        paymentDeadlineHours: dto.paymentDeadlineHours,
        paymentType: dto.paymentType,
        depositAmount: dto.depositAmount,
        ...(dto.remainingDueDate !== undefined && {
          remainingDueDate: new Date(dto.remainingDueDate),
        }),
        startTime,
        endTime,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        deliveryMode: dto.deliveryMode,
        location: dto.location,
        meetingLink: dto.meetingLink,
        isPublished: dto.isPublished,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: { practitioner: { select: { id: true, nameAr: true } } },
    });

    if (isSettingDate && group.schedulingMode === 'on_capacity' && group.currentEnrollment >= group.minParticipants) {
      await this.lifecycleService.confirmGroupAfterDateSet(id, group.paymentDeadlineHours, group.paymentType);
      const refetched = await this.findOne(id);
      return refetched;
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.group.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async cancel(id: string) {
    return this.lifecycleService.cancel(id);
  }

  async complete(id: string, attendedPatientIds: string[]) {
    return this.lifecycleService.complete(id, attendedPatientIds);
  }

  async triggerPaymentRequest(groupId: string) {
    return this.paymentService.triggerPaymentRequest(groupId);
  }

  async resendPaymentRequest(groupId: string, enrollmentId: string) {
    return this.paymentService.resendPaymentRequest(groupId, enrollmentId);
  }

  async confirmSchedule(groupId: string, dto: import('./dto/confirm-schedule.dto.js').ConfirmScheduleDto) {
    return this.lifecycleService.confirmSchedule(groupId, dto);
  }
}
