import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

interface PatientListQuery {
  page?: number;
  perPage?: number;
  search?: string;
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PatientListQuery = {}) {
    const { page = 1, perPage = 20, search } = query;
    const skip = (page - 1) * perPage;

    const where = {
      deletedAt: null,
      userRoles: {
        some: {
          role: { name: 'patient' },
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
      data: patients,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(id: string) {
    const patient = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        createdAt: true,
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
