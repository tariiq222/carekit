import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { PatientListQueryDto } from './dto/patient-list-query.dto.js';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PatientListQueryDto = {}) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);
    const { search, isActive } = query;

    const where = {
      deletedAt: null,
      userRoles: {
        some: {
          role: { slug: 'patient' },
        },
      },
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, patients] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gender: true,
          createdAt: true,
          isActive: true,
          avatarUrl: true,
          accountType: true,
          claimedAt: true,
          bookingsAsPatient: {
            where: { deletedAt: null },
            orderBy: { date: 'desc' },
            take: 1,
            select: { id: true, date: true, status: true },
          },
        },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const now = new Date();
    const patientIds = patients.map(p => p.id);
    const upcomingBookings = await this.prisma.booking.findMany({
      where: {
        patientId: { in: patientIds },
        deletedAt: null,
        date: { gte: now },
        status: { notIn: ['cancelled', 'completed'] },
      },
      orderBy: { date: 'asc' },
      select: { patientId: true, id: true, date: true, status: true },
      distinct: ['patientId'],
    });

    const upcomingMap = new Map(upcomingBookings.map(b => [b.patientId, b]));

    const items = patients.map(p => ({
      ...p,
      lastBooking: p.bookingsAsPatient[0] ?? null,
      nextBooking: upcomingMap.get(p.id) ?? null,
    }));

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async getListStats() {
    const patientWhere = {
      deletedAt: null,
      userRoles: { some: { role: { slug: 'patient' } } },
    };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, inactive, newThisMonth] = await Promise.all([
      this.prisma.user.count({ where: patientWhere }),
      this.prisma.user.count({ where: { ...patientWhere, isActive: true } }),
      this.prisma.user.count({ where: { ...patientWhere, isActive: false } }),
      this.prisma.user.count({
        where: { ...patientWhere, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return { total, active, inactive, newThisMonth };
  }

  async updatePatient(id: string, dto: UpdatePatientDto) {
    const patient = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    // Profile fields that live in PatientProfile
    const profileFields = {
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.nationality !== undefined && { nationality: dto.nationality }),
      ...(dto.nationalId !== undefined && { nationalId: dto.nationalId }),
      ...(dto.emergencyName !== undefined && { emergencyName: dto.emergencyName }),
      ...(dto.emergencyPhone !== undefined && { emergencyPhone: dto.emergencyPhone }),
      ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
      ...(dto.allergies !== undefined && { allergies: dto.allergies }),
      ...(dto.chronicConditions !== undefined && { chronicConditions: dto.chronicConditions }),
    };

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.middleName !== undefined && { middleName: dto.middleName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
        },
        select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, gender: true, isActive: true, updatedAt: true },
      }),
      ...(Object.keys(profileFields).length > 0
        ? [this.prisma.patientProfile.upsert({
            where: { userId: id },
            update: profileFields,
            create: { userId: id, ...profileFields },
          })]
        : []),
    ]);
    return user;
  }

  async findOne(id: string) {
    const patient = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        isActive: true,
        updatedAt: true,
        createdAt: true,
        avatarUrl: true,
        accountType: true,
        claimedAt: true,
        patientProfile: {
          select: {
            nationalId: true, nationality: true, dateOfBirth: true,
            emergencyName: true, emergencyPhone: true,
            bloodType: true, allergies: true, chronicConditions: true,
          },
        },
        bookingsAsPatient: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            service: { select: { nameAr: true, nameEn: true } },
            practitioner: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
            payment: {
              select: { totalAmount: true, status: true, method: true },
            },
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async getPatientBookings(id: string, pagination: { page?: number; perPage?: number } = {}) {
    const patient = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const { page, perPage, skip } = parsePaginationParams(pagination.page, pagination.perPage ?? 50);

    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where: { patientId: id, deletedAt: null } }),
      this.prisma.booking.findMany({
        where: { patientId: id, deletedAt: null },
        orderBy: { date: 'desc' },
        skip,
        take: perPage,
        include: {
          service: { select: { nameAr: true, nameEn: true } },
          practitioner: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
          payment: {
            select: { totalAmount: true, status: true, method: true },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, perPage) };
  }

  async getPatientStats(id: string) {
    const patient = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const [bookingCounts, paymentStats] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { patientId: id, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          booking: { patientId: id, deletedAt: null },
          status: 'paid',
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const totalBookings = bookingCounts.reduce(
      (acc, g) => acc + g._count._all,
      0,
    );

    return {
      totalBookings,
      byStatus: Object.fromEntries(
        bookingCounts.map((g) => [g.status, g._count._all]),
      ),
      totalPaid: paymentStats._sum.totalAmount ?? 0,
      completedPayments: paymentStats._count.id,
    };
  }
}
