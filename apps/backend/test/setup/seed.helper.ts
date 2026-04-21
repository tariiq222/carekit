import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Default org id — matches the seed planted in the SaaS-01 migration.
// Keep every seed row under this org so per-org uniques remain deterministic.
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export async function seedUser(
  prisma: PrismaClient,
  overrides: Partial<{
    email: string;
    password: string;
    role: string;
    name: string;
    isActive: boolean;
  }> = {},
) {
  const email = overrides.email ?? `user-${Date.now()}@test.com`;
  const password = overrides.password ?? 'Test@1234';
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name: overrides.name ?? 'Test User',
      role: (overrides.role as never) ?? 'RECEPTIONIST',
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function seedClient(
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
  }> = {},
) {
  const name = overrides.name ?? 'Test Client';
  const [firstToken, ...rest] = name.split(' ');
  return prisma.client.create({
    data: {
      organizationId: DEFAULT_ORG_ID,
      name,
      firstName: overrides.firstName ?? firstToken ?? 'Test',
      lastName: overrides.lastName ?? (rest.join(' ') || 'Client'),
      phone: overrides.phone ?? `+9665${Date.now().toString().slice(-8)}`,
      isActive: overrides.isActive ?? true,
      source: 'WALK_IN',
    },
  });
}

export async function seedEmployee(
  prisma: PrismaClient,
  overrides: Partial<{ name: string; isActive: boolean }> = {},
) {
  return prisma.employee.create({
    data: {
      organizationId: DEFAULT_ORG_ID,
      name: overrides.name ?? 'Test Employee',
      isActive: overrides.isActive ?? true,
      employmentType: 'FULL_TIME',
    },
  });
}

export async function seedService(
  prisma: PrismaClient,
  overrides: Partial<{ nameAr: string; nameEn: string; durationMins: number; price: number }> = {},
) {
  return prisma.service.create({
    data: {
      nameAr: overrides.nameAr ?? 'Test Service',
      nameEn: overrides.nameEn,
      durationMins: overrides.durationMins ?? 60,
      price: overrides.price ?? 200,
      currency: 'SAR',
      isActive: true,
    },
  });
}

export async function seedBranch(
  prisma: PrismaClient,
  overrides: Partial<{ nameAr: string; nameEn: string }> = {},
) {
  return prisma.branch.create({
    data: {
      nameAr: overrides.nameAr ?? 'Main Branch',
      nameEn: overrides.nameEn,
      isActive: true,
    },
  });
}

export async function seedEmployeeService(
  prisma: PrismaClient,
  employeeId: string,
  serviceId: string,
) {
  return prisma.employeeService.create({
    data: {
      organizationId: DEFAULT_ORG_ID,
      employeeId,
      serviceId,
    },
  });
}

export async function seedBooking(
  prisma: PrismaClient,
  opts: {
    clientId: string;
    employeeId: string;
    serviceId: string;
    branchId: string;
    scheduledAt?: Date;
    status?: string;
  },
) {
  const scheduledAt = opts.scheduledAt ?? new Date(Date.now() + 86_400_000);
  const endsAt = new Date(scheduledAt.getTime() + 3_600_000);

  return prisma.booking.create({
    data: {
      clientId: opts.clientId,
      employeeId: opts.employeeId,
      serviceId: opts.serviceId,
      branchId: opts.branchId,
      scheduledAt,
      endsAt,
      durationMins: 60,
      price: 200,
      currency: 'SAR',
      status: (opts.status as never) ?? 'PENDING',
      bookingType: 'INDIVIDUAL',
    },
  });
}
