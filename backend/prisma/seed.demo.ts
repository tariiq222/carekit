import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEMO_PATIENTS, DEMO_RECEPTIONIST, DEMO_ACCOUNTANT,
  DEMO_PRACTITIONERS, DEMO_CATEGORIES, DEMO_SERVICES,
  DEMO_BRANCHES, DEMO_COUPONS, DEMO_GIFT_CARDS,
  DEMO_WORKING_HOURS, DEMO_HOLIDAYS,
  DEMO_CHATBOT_CONFIG, DEMO_KNOWLEDGE_BASE,
  DEMO_PATIENT_PROFILES,
} from './seed.demo-data';
import { seedBookings, seedNotifications } from './seed.demo-bookings';

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

  // ─── 2b. Patient Profiles ───
  for (let i = 0; i < patientIds.length; i++) {
    const profile = DEMO_PATIENT_PROFILES[i];
    if (!profile) continue;
    await prisma.patientProfile.upsert({
      where: { userId: patientIds[i] },
      update: {},
      create: {
        userId: patientIds[i],
        nationalId: profile.nationalId,
        nationality: profile.nationality,
        dateOfBirth: new Date(profile.dateOfBirth),
        bloodType: profile.bloodType,
        allergies: profile.allergies ?? undefined,
        chronicConditions: profile.chronicConditions ?? undefined,
        emergencyName: profile.emergencyName,
        emergencyPhone: profile.emergencyPhone,
      },
    });
  }
  console.log(`  Created ${patientIds.length} patient profiles`);

  // ─── 3. Practitioners ───
  const practitionerIds: string[] = [];
  const practitionerUserIds: string[] = [];
  for (const doc of DEMO_PRACTITIONERS) {
    const user = await upsertUser(prisma, doc, 'practitioner');
    practitionerUserIds.push(user.id);

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
      update: {
        nameAr: s.nameAr, nameEn: s.nameEn, price: s.price, duration: s.duration,
        bufferMinutes: s.bufferMinutes, depositEnabled: s.depositEnabled,
        depositPercent: s.depositPercent, allowRecurring: s.allowRecurring,
        maxParticipants: s.maxParticipants, calendarColor: s.calendarColor,
      },
      create: {
        id: svcId, nameAr: s.nameAr, nameEn: s.nameEn,
        descriptionAr: s.descriptionAr, descriptionEn: s.descriptionEn,
        categoryId: categoryIds[s.categoryIdx], price: s.price, duration: s.duration,
        bufferMinutes: s.bufferMinutes, depositEnabled: s.depositEnabled,
        depositPercent: s.depositPercent, allowRecurring: s.allowRecurring,
        maxParticipants: s.maxParticipants, calendarColor: s.calendarColor,
      },
    });
    serviceIds.push(svc.id);
  }
  console.log(`  Created ${categoryIds.length} categories, ${serviceIds.length} services`);

  // ─── 4b. ServiceBookingType — General Checkup(0), Follow-up(1), Dermatology(4) ───
  // [svcIdx, type, price, duration]
  const sbtDefs: [number, string, number, number][] = [
    [0, 'clinic_visit', 30000, 30], [0, 'phone_consultation', 15000, 20], [0, 'video_consultation', 20000, 25],
    [1, 'clinic_visit', 15000, 15], [1, 'phone_consultation', 10000, 10], [1, 'video_consultation', 12000, 15],
    [4, 'clinic_visit', 40000, 30], [4, 'video_consultation', 30000, 25],
  ];
  for (const [sIdx, type, price, duration] of sbtDefs) {
    await prisma.serviceBookingType.upsert({
      where: { serviceId_bookingType: { serviceId: serviceIds[sIdx], bookingType: type as any } },
      update: { price, duration },
      create: { serviceId: serviceIds[sIdx], bookingType: type as any, price, duration },
    });
  }
  console.log(`  Created ${sbtDefs.length} service booking type entries`);

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
  const bsData = {
    paymentTimeoutMinutes: 60, freeCancelBeforeHours: 24, freeCancelRefundType: 'full',
    lateCancelRefundType: 'none', lateCancelRefundPercent: 0, adminCanDirectCancel: true,
    patientCanCancelPending: true, patientCanReschedule: true, rescheduleBeforeHours: 12,
    maxReschedulesPerBooking: 2, allowWalkIn: true, walkInPaymentRequired: false,
    allowRecurring: true, maxRecurrences: 12, maxRecurringWeeks: 12,
    allowedRecurringPatterns: ['weekly', 'biweekly'] as any,
    waitlistEnabled: true, waitlistMaxPerSlot: 5, waitlistAutoNotify: true, bufferMinutes: 0,
    autoCompleteAfterHours: 2, autoNoShowAfterMinutes: 30, noShowPolicy: 'keep_full',
    noShowRefundPercent: 0, cancellationReviewTimeoutHours: 48,
    cancellationPolicyAr: 'يمكن إلغاء الحجز مجاناً قبل 24 ساعة من الموعد. الإلغاء المتأخر يخضع لمراجعة الإدارة.',
    cancellationPolicyEn: 'Free cancellation up to 24 hours before the appointment. Late cancellations are subject to admin review.',
    reminder24hEnabled: true, reminder1hEnabled: true, reminderInteractive: false,
    suggestAlternativesOnConflict: true, suggestAlternativesCount: 3,
    minBookingLeadMinutes: 0, adminCanBookOutsideHours: false, maxAdvanceBookingDays: 60,
  };
  await prisma.bookingSettings.upsert({
    where: { id: 'default' },
    update: bsData,
    create: { id: 'default', ...bsData },
  });
  console.log('  Created booking settings');

  // ─── 14. Notifications ───
  await seedNotifications(prisma, patientIds, practitionerUserIds);
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

// seedBookings and seedNotifications are in seed.demo-bookings.ts
