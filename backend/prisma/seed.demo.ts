import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEMO_PATIENTS, DEMO_RECEPTIONIST, DEMO_ACCOUNTANT,
  DEMO_PRACTITIONERS, DEMO_CATEGORIES, DEMO_SERVICES,
  DEMO_BRANCHES, DEMO_COUPONS, DEMO_GIFT_CARDS,
  DEMO_WORKING_HOURS, DEMO_HOLIDAYS,
  DEMO_CHATBOT_CONFIG, DEMO_KNOWLEDGE_BASE,
} from './seed.demo-data';

/* ─── Fixed UUIDs for demo data (stable across re-seeds) ─── */
const DEMO_CATEGORY_IDS = [
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
];

const DEMO_SERVICE_IDS = [
  'b2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000003',
  'b2000000-0000-0000-0000-000000000004',
  'b2000000-0000-0000-0000-000000000005',
  'b2000000-0000-0000-0000-000000000006',
  'b2000000-0000-0000-0000-000000000007',
  'b2000000-0000-0000-0000-000000000008',
  'b2000000-0000-0000-0000-000000000009',
  'b2000000-0000-0000-0000-000000000010',
];

const DEMO_PRACTITIONER_SERVICE_IDS = [
  'c3000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000002',
  'c3000000-0000-0000-0000-000000000003',
  'c3000000-0000-0000-0000-000000000004',
  'c3000000-0000-0000-0000-000000000005',
  'c3000000-0000-0000-0000-000000000006',
  'c3000000-0000-0000-0000-000000000007',
  'c3000000-0000-0000-0000-000000000008',
];

const DEMO_BRANCH_IDS = [
  'd4000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000002',
];

const PASSWORD_HASH = bcrypt.hashSync('Test@1234', 10);

/** Seed demo data into a clean database (run after seed.ts) */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  console.log('\n── Seeding demo data ──');

  // ─── 1. Staff users (receptionist + accountant) ───
  const receptionistUser = await upsertUser(prisma, DEMO_RECEPTIONIST, 'receptionist');
  const accountantUser = await upsertUser(prisma, DEMO_ACCOUNTANT, 'accountant');
  console.log(`  Staff: receptionist=${receptionistUser.id}, accountant=${accountantUser.id}`);

  // ─── 2. Patient users ───
  const patientIds: string[] = [];
  for (const p of DEMO_PATIENTS) {
    const user = await upsertUser(prisma, p, 'patient');
    patientIds.push(user.id);
  }
  console.log(`  Created ${patientIds.length} patients`);

  // ─── 3. Practitioners ───
  const practitionerIds: string[] = [];
  for (const doc of DEMO_PRACTITIONERS) {
    const user = await upsertUser(prisma, doc, 'practitioner');

    const practitioner = await prisma.practitioner.upsert({
      where: { userId: user.id },
      update: { bio: doc.bio, bioAr: doc.bioAr, experience: doc.experience, specialty: doc.specialtyEn, specialtyAr: doc.specialtyAr },
      create: {
        userId: user.id, specialty: doc.specialtyEn, specialtyAr: doc.specialtyAr,
        bio: doc.bio, bioAr: doc.bioAr,
        experience: doc.experience, education: doc.education, educationAr: doc.educationAr,
        priceClinic: doc.priceClinic, pricePhone: doc.pricePhone, priceVideo: doc.priceVideo,
        rating: 0, reviewCount: 0, isActive: true,
      },
    });
    practitionerIds.push(practitioner.id);

    // Availability: Sun-Thu 09:00-17:00
    for (let day = 0; day <= 4; day++) {
      await prisma.practitionerAvailability.upsert({
        where: { id: `avail-${practitioner.id}-${day}` },
        update: {},
        create: { id: `avail-${practitioner.id}-${day}`, practitionerId: practitioner.id, dayOfWeek: day, startTime: '09:00', endTime: '17:00' },
      });
    }
    // Break: 12:00-13:00 Sun-Thu
    for (let day = 0; day <= 4; day++) {
      await prisma.practitionerBreak.upsert({
        where: { id: `break-${practitioner.id}-${day}` },
        update: {},
        create: { id: `break-${practitioner.id}-${day}`, practitionerId: practitioner.id, dayOfWeek: day, startTime: '12:00', endTime: '13:00' },
      });
    }
  }
  console.log(`  Created ${practitionerIds.length} practitioners with availability & breaks`);

  // ─── 4. Service Categories & Services ───
  const categoryIds: string[] = [];
  for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
    const cat = DEMO_CATEGORIES[i];
    const catId = DEMO_CATEGORY_IDS[i] ?? `cat-${cat.sortOrder}`;
    const c = await prisma.serviceCategory.upsert({
      where: { id: catId },
      update: { nameAr: cat.nameAr, nameEn: cat.nameEn },
      create: { id: catId, nameAr: cat.nameAr, nameEn: cat.nameEn, sortOrder: cat.sortOrder },
    });
    categoryIds.push(c.id);
  }

  const serviceIds: string[] = [];
  for (let i = 0; i < DEMO_SERVICES.length; i++) {
    const s = DEMO_SERVICES[i];
    const svcId = DEMO_SERVICE_IDS[i] ?? `svc-${i}`;
    const svc = await prisma.service.upsert({
      where: { id: svcId },
      update: { nameAr: s.nameAr, nameEn: s.nameEn, price: s.price, duration: s.duration },
      create: {
        id: svcId, nameAr: s.nameAr, nameEn: s.nameEn,
        descriptionAr: s.descriptionAr, descriptionEn: s.descriptionEn,
        categoryId: categoryIds[s.categoryIdx], price: s.price, duration: s.duration,
      },
    });
    serviceIds.push(svc.id);
  }
  console.log(`  Created ${categoryIds.length} categories, ${serviceIds.length} services`);

  // ─── 5. PractitionerService links ───
  // Map: pract 0 → services 0,1 | pract 1 → services 4,5 | pract 2 → services 2,3 | pract 3 → services 6,7
  const psMap: [number, number[]][] = [[0, [0, 1]], [1, [4, 5]], [2, [2, 3]], [3, [6, 7]]];
  const psIds: string[] = [];
  let psCounter = 0;
  for (const [pIdx, sIdxList] of psMap) {
    for (const sIdx of sIdxList) {
      const psId = DEMO_PRACTITIONER_SERVICE_IDS[psCounter++] ?? `ps-${pIdx}-${sIdx}`;
      await prisma.practitionerService.upsert({
        where: { id: psId },
        update: {},
        create: {
          id: psId,
          practitionerId: practitionerIds[pIdx], serviceId: serviceIds[sIdx],
          availableTypes: ['clinic_visit', 'phone_consultation', 'video_consultation'],
        },
      });
      psIds.push(psId);
    }
  }
  console.log(`  Linked ${psIds.length} practitioner-service relations`);

  // ─── 6. Bookings (all statuses) ───
  await seedBookings(prisma, patientIds, practitionerIds, serviceIds, psIds);

  // ─── 7. Branches ───
  const branchIds: string[] = [];
  for (let i = 0; i < DEMO_BRANCHES.length; i++) {
    const b = DEMO_BRANCHES[i];
    const branch = await prisma.branch.upsert({
      where: { id: DEMO_BRANCH_IDS[i] ?? `branch-${i}` },
      update: {},
      create: { id: DEMO_BRANCH_IDS[i] ?? `branch-${i}`, nameAr: b.nameAr, nameEn: b.nameEn, address: b.address, phone: b.phone, email: b.email, isMain: b.isMain },
    });
    branchIds.push(branch.id);
  }
  // Link practitioners to main branch
  for (const pId of practitionerIds) {
    await prisma.practitionerBranch.upsert({
      where: { practitionerId_branchId: { practitionerId: pId, branchId: branchIds[0] } },
      update: {},
      create: { practitionerId: pId, branchId: branchIds[0], isPrimary: true },
    });
  }
  console.log(`  Created ${branchIds.length} branches`);

  // ─── 8. Coupons ───
  for (const c of DEMO_COUPONS) {
    const expires = new Date();
    expires.setDate(expires.getDate() + c.expiresInDays);
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, descriptionAr: c.descriptionAr, descriptionEn: c.descriptionEn, discountType: c.discountType, discountValue: c.discountValue, maxUses: c.maxUses, expiresAt: expires },
    });
  }
  console.log(`  Created ${DEMO_COUPONS.length} coupons`);

  // ─── 9. Gift Cards ───
  for (const g of DEMO_GIFT_CARDS) {
    await prisma.giftCard.upsert({
      where: { code: g.code },
      update: {},
      create: { code: g.code, initialAmount: g.initialAmount, balance: g.balance, purchasedBy: patientIds[0] },
    });
  }
  console.log(`  Created ${DEMO_GIFT_CARDS.length} gift cards`);

  // ─── 10. Working Hours & Holidays ───
  for (const wh of DEMO_WORKING_HOURS) {
    await prisma.clinicWorkingHours.upsert({
      where: { dayOfWeek: wh.dayOfWeek },
      update: { startTime: wh.startTime, endTime: wh.endTime, isActive: wh.isActive },
      create: wh,
    });
  }
  for (const h of DEMO_HOLIDAYS) {
    const d = new Date(h.date);
    await prisma.clinicHoliday.upsert({
      where: { date: d },
      update: {},
      create: { date: d, nameAr: h.nameAr, nameEn: h.nameEn, isRecurring: h.isRecurring },
    });
  }
  console.log('  Created working hours & holidays');

  // ─── 12. Chatbot Config & Knowledge Base ───
  for (const cfg of DEMO_CHATBOT_CONFIG) {
    await prisma.chatbotConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: { key: cfg.key, category: cfg.category, value: cfg.value },
    });
  }
  for (let i = 0; i < DEMO_KNOWLEDGE_BASE.length; i++) {
    const kb = DEMO_KNOWLEDGE_BASE[i];
    await prisma.knowledgeBase.upsert({
      where: { id: `kb-${i}` },
      update: {},
      create: { id: `kb-${i}`, title: kb.title, content: kb.content, category: kb.category, source: kb.source },
    });
  }
  console.log('  Created chatbot config & knowledge base');

  // ─── 13. Booking Settings ───
  await prisma.bookingSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      paymentTimeoutMinutes: 60, freeCancelBeforeHours: 24,
      cancellationPolicyAr: 'يمكن إلغاء الحجز مجاناً قبل 24 ساعة من الموعد. الإلغاء المتأخر يخضع لمراجعة الإدارة.',
      cancellationPolicyEn: 'Free cancellation up to 24 hours before the appointment. Late cancellations are subject to admin review.',
    },
  });
  console.log('  Created booking settings');

  // ─── 14. Notifications ───
  await seedNotifications(prisma, patientIds, practitionerIds);
  console.log('  Created notifications');

  console.log('── Demo data seeding complete! ──\n');
}

// ═══════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════

async function upsertUser(
  prisma: PrismaClient,
  data: { email: string; firstName: string; lastName: string; phone: string; gender: 'male' | 'female' },
  roleName: string,
) {
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      email: data.email, passwordHash: PASSWORD_HASH,
      firstName: data.firstName, lastName: data.lastName,
      phone: data.phone, gender: data.gender,
      isActive: true, emailVerified: true,
    },
  });

  const role = await prisma.role.findFirst({ where: { slug: roleName } });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  return user;
}

async function seedBookings(
  prisma: PrismaClient,
  patientIds: string[], practitionerIds: string[],
  serviceIds: string[], psIds: string[],
) {
  const today = new Date();
  const bookingDefs = buildBookingDefs(today, patientIds, practitionerIds, serviceIds, psIds);

  for (const b of bookingDefs) {
    const existing = await prisma.booking.findUnique({ where: { id: b.id as string } });
    if (existing) continue;

    // Separate internal metadata from Prisma-safe booking data
    const { _payMethod, _rating, _problemReport, _receiptStatus, ...bookingData } = b;

    const booking = await prisma.booking.create({ data: bookingData });

    // Status log
    await prisma.bookingStatusLog.create({
      data: { bookingId: booking.id, fromStatus: null, toStatus: bookingData.status, changedBy: 'system', reason: 'Seed data' },
    });

    // Payment for confirmed/completed/cancelled bookings
    if (['confirmed', 'completed', 'cancelled', 'pending_cancellation', 'no_show'].includes(bookingData.status)) {
      const payStatus = bookingData.status === 'completed' ? 'paid' : bookingData.status === 'cancelled' ? 'refunded' : 'paid';
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: bookingData.bookedPrice ?? 30000,
          vatAmount: Math.round((bookingData.bookedPrice ?? 30000) * 0.15),
          totalAmount: Math.round((bookingData.bookedPrice ?? 30000) * 1.15),
          method: _payMethod ?? 'moyasar',
          status: payStatus,
          moyasarPaymentId: _payMethod === 'moyasar' ? `moy_${booking.id.slice(0, 8)}` : null,
        } as any,
      });

      // Invoice
      await prisma.invoice.create({
        data: {
          paymentId: payment.id,
          invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vatAmount: payment.vatAmount,
          vatRate: 15,
        },
      });

      // Bank transfer receipt for bank_transfer payments
      if (_payMethod === 'bank_transfer') {
        await prisma.bankTransferReceipt.create({
          data: {
            paymentId: payment.id,
            receiptUrl: '/uploads/receipts/demo-receipt.jpg',
            aiVerificationStatus: _receiptStatus ?? 'matched',
            aiConfidence: 0.95,
            aiNotes: 'Demo receipt — auto-verified',
            extractedAmount: bookingData.bookedPrice ?? 30000,
          },
        });
      }
    }

    // Rating for completed bookings
    if (bookingData.status === 'completed' && _rating) {
      await prisma.rating.create({
        data: {
          bookingId: booking.id,
          patientId: bookingData.patientId!,
          practitionerId: bookingData.practitionerId,
          stars: _rating.stars,
          comment: _rating.comment,
        },
      });
    }

    // Problem report
    if (_problemReport) {
      await prisma.problemReport.create({
        data: {
          bookingId: booking.id,
          patientId: bookingData.patientId!,
          type: _problemReport.type as any,
          description: _problemReport.description,
          status: _problemReport.status as any,
        },
      });
    }
  }

  console.log(`  Created ${bookingDefs.length} bookings with payments, invoices, ratings`);
}

function buildBookingDefs(
  today: Date,
  patientIds: string[], practitionerIds: string[],
  serviceIds: string[], psIds: string[],
) {
  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt;
  };

  return [
    // ── Pending
    { id: 'bk-01', patientId: patientIds[0], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'clinic_visit' as const, date: d(1), startTime: '09:00', endTime: '09:30', status: 'pending' as const, bookedPrice: 30000, bookedDuration: 30 },
    { id: 'bk-02', patientId: patientIds[1], practitionerId: practitionerIds[1], serviceId: serviceIds[4], practitionerServiceId: psIds[2], type: 'video_consultation' as const, date: d(2), startTime: '10:00', endTime: '10:30', status: 'pending' as const, bookedPrice: 40000, bookedDuration: 30 },

    // ── Confirmed
    { id: 'bk-03', patientId: patientIds[2], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'clinic_visit' as const, date: d(0), startTime: '11:00', endTime: '11:30', status: 'confirmed' as const, bookedPrice: 30000, bookedDuration: 30, confirmedAt: d(0), _payMethod: 'moyasar' as const },
    { id: 'bk-04', patientId: patientIds[3], practitionerId: practitionerIds[2], serviceId: serviceIds[2], practitionerServiceId: psIds[4], type: 'clinic_visit' as const, date: d(0), startTime: '14:00', endTime: '14:45', status: 'confirmed' as const, bookedPrice: 25000, bookedDuration: 45, confirmedAt: d(0), _payMethod: 'bank_transfer' as const, _receiptStatus: 'matched' as const },

    // ── Completed (with ratings)
    { id: 'bk-05', patientId: patientIds[4], practitionerId: practitionerIds[0], serviceId: serviceIds[1], practitionerServiceId: psIds[1], type: 'clinic_visit' as const, date: d(-3), startTime: '09:00', endTime: '09:15', status: 'completed' as const, bookedPrice: 15000, bookedDuration: 15, completedAt: d(-3), _payMethod: 'moyasar' as const, _rating: { stars: 5, comment: 'ممتاز! دكتور محترف جداً' } },
    { id: 'bk-06', patientId: patientIds[5], practitionerId: practitionerIds[1], serviceId: serviceIds[5], practitionerServiceId: psIds[3], type: 'clinic_visit' as const, date: d(-5), startTime: '10:00', endTime: '10:45', status: 'completed' as const, bookedPrice: 80000, bookedDuration: 45, completedAt: d(-5), _payMethod: 'moyasar' as const, _rating: { stars: 4, comment: 'Very good laser session' } },
    { id: 'bk-07', patientId: patientIds[6], practitionerId: practitionerIds[3], serviceId: serviceIds[6], practitionerServiceId: psIds[6], type: 'clinic_visit' as const, date: d(-7), startTime: '11:00', endTime: '11:30', status: 'completed' as const, bookedPrice: 25000, bookedDuration: 30, completedAt: d(-7), _payMethod: 'bank_transfer' as const, _receiptStatus: 'approved' as const, _rating: { stars: 3, comment: 'جيد لكن وقت الانتظار طويل' } },

    // ── Completed with problem report
    { id: 'bk-08', patientId: patientIds[7], practitionerId: practitionerIds[2], serviceId: serviceIds[3], practitionerServiceId: psIds[5], type: 'clinic_visit' as const, date: d(-2), startTime: '15:00', endTime: '16:00', status: 'completed' as const, bookedPrice: 40000, bookedDuration: 60, completedAt: d(-2), _payMethod: 'moyasar' as const, _rating: { stars: 2, comment: 'انتظرت طويلاً' }, _problemReport: { type: 'wait_time', description: 'انتظرت أكثر من 45 دقيقة', status: 'in_review' } },

    // ── Cancelled
    { id: 'bk-09', patientId: patientIds[8], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'phone_consultation' as const, date: d(-1), startTime: '13:00', endTime: '13:30', status: 'cancelled' as const, bookedPrice: 15000, bookedDuration: 30, cancelledAt: d(-1), cancellationReason: 'ظرف طارئ', cancelledBy: 'patient', _payMethod: 'moyasar' as const },

    // ── Pending Cancellation
    { id: 'bk-10', patientId: patientIds[9], practitionerId: practitionerIds[1], serviceId: serviceIds[4], practitionerServiceId: psIds[2], type: 'clinic_visit' as const, date: d(3), startTime: '09:00', endTime: '09:30', status: 'pending_cancellation' as const, bookedPrice: 40000, bookedDuration: 30, cancellationReason: 'لا أستطيع الحضور', _payMethod: 'moyasar' as const },

    // ── No-Show
    { id: 'bk-11', patientId: patientIds[0], practitionerId: practitionerIds[3], serviceId: serviceIds[7], practitionerServiceId: psIds[7], type: 'clinic_visit' as const, date: d(-4), startTime: '16:00', endTime: '16:15', status: 'no_show' as const, bookedPrice: 10000, bookedDuration: 15, noShowAt: d(-4), _payMethod: 'moyasar' as const },

    // ── Expired
    { id: 'bk-12', patientId: patientIds[1], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'clinic_visit' as const, date: d(-10), startTime: '10:00', endTime: '10:30', status: 'expired' as const, bookedPrice: 30000, bookedDuration: 30 },

    // ── Checked-in (today)
    { id: 'bk-13', patientId: patientIds[2], practitionerId: practitionerIds[2], serviceId: serviceIds[2], practitionerServiceId: psIds[4], type: 'clinic_visit' as const, date: d(0), startTime: '09:30', endTime: '10:15', status: 'checked_in' as const, bookedPrice: 25000, bookedDuration: 45, checkedInAt: d(0), _payMethod: 'moyasar' as const },

    // ── In-Progress (today)
    { id: 'bk-14', patientId: patientIds[3], practitionerId: practitionerIds[3], serviceId: serviceIds[6], practitionerServiceId: psIds[6], type: 'clinic_visit' as const, date: d(0), startTime: '10:00', endTime: '10:30', status: 'in_progress' as const, bookedPrice: 25000, bookedDuration: 30, checkedInAt: d(0), inProgressAt: d(0), _payMethod: 'moyasar' as const },

    // ── Walk-in
    { id: 'bk-15', patientId: patientIds[4], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'walk_in' as const, date: d(0), startTime: '15:00', endTime: '15:30', status: 'confirmed' as const, bookedPrice: 30000, bookedDuration: 30, isWalkIn: true, confirmedAt: d(0), _payMethod: 'moyasar' as const },

    // ── Video consultation with Zoom
    { id: 'bk-16', patientId: patientIds[5], practitionerId: practitionerIds[1], serviceId: serviceIds[4], practitionerServiceId: psIds[2], type: 'video_consultation' as const, date: d(4), startTime: '11:00', endTime: '11:30', status: 'confirmed' as const, bookedPrice: 40000, bookedDuration: 30, confirmedAt: d(0), zoomMeetingId: 'zoom-demo-123', zoomJoinUrl: 'https://zoom.us/j/demo123', zoomHostUrl: 'https://zoom.us/s/demo123', _payMethod: 'moyasar' as const },

    // ── Phone consultation
    { id: 'bk-17', patientId: patientIds[6], practitionerId: practitionerIds[0], serviceId: serviceIds[1], practitionerServiceId: psIds[1], type: 'phone_consultation' as const, date: d(5), startTime: '14:00', endTime: '14:15', status: 'pending' as const, bookedPrice: 15000, bookedDuration: 15 },

    // ── Bank transfer pending review
    { id: 'bk-18', patientId: patientIds[7], practitionerId: practitionerIds[2], serviceId: serviceIds[3], practitionerServiceId: psIds[5], type: 'clinic_visit' as const, date: d(6), startTime: '10:00', endTime: '11:00', status: 'confirmed' as const, bookedPrice: 40000, bookedDuration: 60, confirmedAt: d(0), _payMethod: 'bank_transfer' as const, _receiptStatus: 'pending' as const },
  ];
}

async function seedNotifications(
  prisma: PrismaClient,
  patientIds: string[], practitionerIds: string[],
) {
  const notifs = [
    { userId: patientIds[0], titleAr: 'تم تأكيد حجزك', titleEn: 'Booking Confirmed', bodyAr: 'تم تأكيد حجزك يوم الأحد الساعة 9:00', bodyEn: 'Your booking on Sunday at 9:00 AM is confirmed', type: 'booking_confirmed' as const, isRead: true },
    { userId: patientIds[1], titleAr: 'تذكير بموعدك', titleEn: 'Appointment Reminder', bodyAr: 'لديك موعد غداً الساعة 10:00', bodyEn: 'You have an appointment tomorrow at 10:00 AM', type: 'reminder' as const, isRead: false },
    { userId: patientIds[2], titleAr: 'تم إلغاء الحجز', titleEn: 'Booking Cancelled', bodyAr: 'تم إلغاء حجزك وسيتم إرجاع المبلغ', bodyEn: 'Your booking is cancelled and refund is processing', type: 'booking_cancelled' as const, isRead: false },
    { userId: patientIds[3], titleAr: 'تم استلام الدفع', titleEn: 'Payment Received', bodyAr: 'تم استلام دفعتك بنجاح — 250 ر.س', bodyEn: 'Payment of 250 SAR received successfully', type: 'payment_received' as const, isRead: true },
    { userId: patientIds[4], titleAr: 'تقييم جديد', titleEn: 'New Rating', bodyAr: 'شكراً لتقييمك! رأيك يساعدنا', bodyEn: 'Thanks for your rating! Your feedback helps us', type: 'new_rating' as const, isRead: false },
    { userId: patientIds[5], titleAr: 'بلاغ مشكلة', titleEn: 'Problem Report', bodyAr: 'تم استلام بلاغك وسيتم مراجعته', bodyEn: 'Your report has been received and is under review', type: 'problem_report' as const, isRead: false },
    { userId: patientIds[0], titleAr: 'تنبيه النظام', titleEn: 'System Alert', bodyAr: 'تم تحديث سياسة الإلغاء', bodyEn: 'Cancellation policy has been updated', type: 'system_alert' as const, isRead: false },
    { userId: patientIds[8], titleAr: 'طلب إلغاء مرفوض', titleEn: 'Cancellation Rejected', bodyAr: 'تم رفض طلب إلغاء حجزك', bodyEn: 'Your cancellation request was rejected', type: 'cancellation_rejected' as const, isRead: false },
  ];

  for (let i = 0; i < notifs.length; i++) {
    const n = notifs[i];
    await prisma.notification.upsert({
      where: { id: `notif-${i}` },
      update: {},
      create: { id: `notif-${i}`, ...n },
    });
  }
}
