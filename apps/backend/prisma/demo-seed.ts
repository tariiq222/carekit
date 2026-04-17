/**
 * Demo seed for QA — creates 3 employees, 3 services, 3 clients, and 12 bookings
 * across various statuses/types/dates.
 *
 * Run:  cd apps/backend && npx tsx prisma/demo-seed.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const BRANCH_ID = 'main-branch';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const employees = [
    { id: '00000000-0000-4000-8000-000000000001', name: 'د. أحمد الغامدي', nameEn: 'Dr. Ahmed Alghamdi', nameAr: 'د. أحمد الغامدي', title: 'طبيب عام', specialty: 'General', specialtyAr: 'طب عام', gender: 'MALE' as const, email: 'ahmed@carekit-test.com', phone: '+966500000001' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'د. فاطمة القحطاني', nameEn: 'Dr. Fatima Alqahtani', nameAr: 'د. فاطمة القحطاني', title: 'أخصائية جلدية', specialty: 'Dermatology', specialtyAr: 'جلدية', gender: 'FEMALE' as const, email: 'fatima@carekit-test.com', phone: '+966500000002' },
    { id: '00000000-0000-4000-8000-000000000003', name: 'د. خالد السبيعي', nameEn: 'Dr. Khalid Alsubaie', nameAr: 'د. خالد السبيعي', title: 'أخصائي أسنان', specialty: 'Dentistry', specialtyAr: 'أسنان', gender: 'MALE' as const, email: 'khalid@carekit-test.com', phone: '+966500000003' },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      create: { ...e, employmentType: 'FULL_TIME', onboardingStatus: 'COMPLETED', isActive: true, updatedAt: new Date() },
      update: {},
    });
    await prisma.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: e.id, branchId: BRANCH_ID } },
      create: { employeeId: e.id, branchId: BRANCH_ID },
      update: {},
    });
  }

  const services = [
    { id: '00000000-0000-4000-8000-000000000011', nameAr: 'كشف عام', nameEn: 'General consultation', durationMins: 30, price: '120.00' },
    { id: '00000000-0000-4000-8000-000000000012', nameAr: 'تنظيف أسنان', nameEn: 'Dental cleaning', durationMins: 45, price: '250.00' },
    { id: '00000000-0000-4000-8000-000000000013', nameAr: 'استشارة جلدية', nameEn: 'Dermatology consult', durationMins: 30, price: '200.00' },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      create: { ...s, price: s.price as any, currency: 'SAR', isActive: true, updatedAt: new Date() },
      update: {},
    });

    // Every service is bookable IN_PERSON by default — the wizard's step-4
    // reads these rows to know which booking types to offer.
    await prisma.serviceBookingConfig.upsert({
      where: { serviceId_bookingType: { serviceId: s.id, bookingType: 'in_person' } },
      create: {
        id: `${s.id}-in-person`,
        serviceId: s.id,
        bookingType: 'in_person',
        price: s.price as any,
        durationMins: s.durationMins,
        isActive: true,
        updatedAt: new Date(),
      },
      update: {},
    });
  }

  // link services to employees (EmployeeService)
  const empService = [
    { employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011' },
    { employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013' },
    { employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012' },
    { employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000013' },
  ];
  for (const es of empService) {
    await prisma.employeeService.upsert({
      where: { employeeId_serviceId: es },
      create: es,
      update: {},
    });
  }

  // 25 clients total so the dashboard paginates (perPage=20).
  // Mix of FULL / WALK_IN accounts and a couple of email-verified rows so the
  // dashboard's Walk-In badge + ✓ verified indicator have real data to render.
  const baseClients = [
    { id: '00000000-0000-4000-8000-000000000021', name: 'محمد الحربي',      firstName: 'محمد',    lastName: 'الحربي',     phone: '+966511111111', email: 'mohammed@example.com', gender: 'MALE' as const,   accountType: 'FULL'    as const, emailVerified: true,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000022', name: 'نورة العتيبي',    firstName: 'نورة',   lastName: 'العتيبي',    phone: '+966522222222', email: 'noura@example.com',    gender: 'FEMALE' as const, accountType: 'FULL'    as const, emailVerified: true,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000023', name: 'سارة الدوسري',    firstName: 'سارة',   lastName: 'الدوسري',    phone: '+966533333333', email: 'sara@example.com',     gender: 'FEMALE' as const, accountType: 'FULL'    as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000024', name: 'خالد الزهراني',   firstName: 'خالد',   lastName: 'الزهراني',   phone: '+966544444444', email: 'khalid@example.com',   gender: 'MALE' as const,   accountType: 'FULL'    as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000025', name: 'ريم السبيعي',     firstName: 'ريم',    lastName: 'السبيعي',    phone: '+966555555555', email: 'reem@example.com',     gender: 'FEMALE' as const, accountType: 'WALK_IN' as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000026', name: 'عبدالله القحطاني', firstName: 'عبدالله', lastName: 'القحطاني',   phone: '+966566666666', email: null,                    gender: 'MALE' as const,   accountType: 'WALK_IN' as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000027', name: 'منى الشهري',      firstName: 'منى',    lastName: 'الشهري',     phone: '+966577777777', email: null,                    gender: 'FEMALE' as const, accountType: 'WALK_IN' as const, emailVerified: false, isActive: false },
    { id: '00000000-0000-4000-8000-000000000028', name: 'يوسف العمري',    firstName: 'يوسف',   lastName: 'العمري',     phone: '+966588888888', email: 'yousef@example.com',   gender: 'MALE' as const,   accountType: 'FULL'    as const, emailVerified: false, isActive: false },
  ];

  // 17 more clients so total = 25 (triggers pagination beyond page 1).
  const bulkClients = Array.from({ length: 17 }, (_, i) => {
    const n = i + 29; // continue numeric suffix after 28
    const paddedN = String(n).padStart(2, '0');
    const id = `00000000-0000-4000-8000-0000000000${paddedN}`;
    return {
      id,
      name: `عميل رقم ${n}`,
      firstName: `عميل`,
      lastName: `رقم ${n}`,
      phone: `+9666${String(10000000 + n).slice(-8)}`,
      email: `client${n}@example.com`,
      gender: (n % 2 === 0 ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE',
      accountType: 'FULL' as const,
      emailVerified: false,
      isActive: true,
    };
  });

  const clients = [...baseClients, ...bulkClients];

  for (const c of clients) {
    await prisma.client.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        emailVerified: c.emailVerified,
        gender: c.gender,
        source: 'ONLINE' as any,
        accountType: c.accountType as any,
        isActive: c.isActive,
        updatedAt: new Date(),
      },
      update: {
        emailVerified: c.emailVerified,
        accountType: c.accountType as any,
        isActive: c.isActive,
      },
    });
  }

  // Bookings — various statuses & dates around 2026-04-17
  const today = new Date('2026-04-17T00:00:00Z');
  const mk = (offsetDays: number, hour: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  const bookings = [
    { id: 'bkg-1',  clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'PENDING',   type: 'INDIVIDUAL', at: mk(0, 9),  durationMins: 30, price: '120.00' },
    { id: 'bkg-2',  clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'CONFIRMED', type: 'INDIVIDUAL', at: mk(0, 10), durationMins: 30, price: '200.00' },
    { id: 'bkg-3',  clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'COMPLETED', type: 'INDIVIDUAL', at: mk(-1, 11),durationMins: 45, price: '250.00' },
    { id: 'bkg-4',  clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'CANCELLED', type: 'ONLINE',     at: mk(1, 14), durationMins: 30, price: '200.00' },
    { id: 'bkg-5',  clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'NO_SHOW',   type: 'INDIVIDUAL', at: mk(-2, 15),durationMins: 30, price: '120.00' },
    { id: 'bkg-6',  clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'AWAITING_PAYMENT', type: 'INDIVIDUAL', at: mk(0, 12), durationMins: 30, price: '120.00' },
    { id: 'bkg-7',  clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'CONFIRMED', type: 'WALK_IN',    at: mk(0, 13), durationMins: 45, price: '250.00' },
    { id: 'bkg-8',  clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'PENDING',   type: 'ONLINE',     at: mk(2, 10), durationMins: 30, price: '200.00' },
    { id: 'bkg-9',  clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'CONFIRMED', type: 'INDIVIDUAL', at: mk(3, 9),  durationMins: 30, price: '120.00' },
    { id: 'bkg-10', clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'PENDING',   type: 'INDIVIDUAL', at: mk(4, 11), durationMins: 45, price: '250.00' },
    { id: 'bkg-11', clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'EXPIRED', type:'INDIVIDUAL', at: mk(-3, 14), durationMins: 30, price: '200.00' },
    { id: 'bkg-12', clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'CANCEL_REQUESTED', type: 'INDIVIDUAL', at: mk(1, 10), durationMins: 30, price: '120.00' },
    // Extra bookings so more clients (خالد, ريم, عبدالله) show real lastBooking/nextBooking.
    { id: 'bkg-13', clientId: '00000000-0000-4000-8000-000000000024', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'COMPLETED', type: 'INDIVIDUAL', at: mk(-5, 10), durationMins: 30, price: '120.00' },
    { id: 'bkg-14', clientId: '00000000-0000-4000-8000-000000000024', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'CONFIRMED', type: 'INDIVIDUAL', at: mk(5, 11),  durationMins: 30, price: '200.00' },
    { id: 'bkg-15', clientId: '00000000-0000-4000-8000-000000000025', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'COMPLETED', type: 'WALK_IN',    at: mk(-7, 12), durationMins: 45, price: '250.00' },
    { id: 'bkg-16', clientId: '00000000-0000-4000-8000-000000000025', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'PENDING',   type: 'WALK_IN',    at: mk(6, 9),   durationMins: 45, price: '250.00' },
    { id: 'bkg-17', clientId: '00000000-0000-4000-8000-000000000026', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'COMPLETED', type: 'WALK_IN',    at: mk(-3, 15), durationMins: 30, price: '120.00' },
  ];

  for (const b of bookings) {
    const endsAt = new Date(b.at.getTime() + b.durationMins * 60_000);
    await prisma.booking.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        branchId: BRANCH_ID,
        clientId: b.clientId,
        employeeId: b.employeeId,
        serviceId: b.serviceId,
        bookingType: b.type as any,
        status: b.status as any,
        scheduledAt: b.at,
        endsAt,
        durationMins: b.durationMins,
        price: b.price as any,
        currency: 'SAR',
        payAtClinic: false,
        updatedAt: new Date(),
      },
      update: {},
    });
  }

  await prisma.$disconnect();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  3 employees, 3 services, 3 clients, ${bookings.length} bookings seeded`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
