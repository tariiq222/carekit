import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';

interface PatientListQuery {
  page?: number;
  perPage?: number;
  search?: string;
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PatientListQuery = {}) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);
    const { search } = query;

    const where = {
      deletedAt: null,
      userRoles: {
        some: {
          role: { slug: 'patient' },
        },
      },
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
          _count: {
            select: { bookingsAsPatient: true },
          },
        },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: patients,
      meta: buildPaginationMeta(total, page, perPage),
    };
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
