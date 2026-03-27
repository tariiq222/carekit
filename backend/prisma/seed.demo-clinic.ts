import { PrismaClient } from '@prisma/client';
import {
  DEMO_CATEGORIES, DEMO_SERVICES, DEMO_BRANCHES,
  DEMO_COUPONS, DEMO_GIFT_CARDS,
  DEMO_WORKING_HOURS, DEMO_HOLIDAYS,
  DEMO_CHATBOT_CONFIG, DEMO_KNOWLEDGE_BASE,
  DEMO_WAITLIST, DEMO_INTAKE_FORMS,
} from './seed.demo-data';

export const DEMO_CATEGORY_IDS = [
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
];

export const DEMO_SERVICE_IDS = [
  'b2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000003',
  'b2000000-0000-0000-0000-000000000004',
  'b2000000-0000-0000-0000-000000000005',
  'b2000000-0000-0000-0000-000000000006',
  'b2000000-0000-0000-0000-000000000007',
  'b2000000-0000-0000-0000-000000000008',
];

export const DEMO_PRACTITIONER_SERVICE_IDS = [
  'c3000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000002',
  'c3000000-0000-0000-0000-000000000003',
  'c3000000-0000-0000-0000-000000000004',
  'c3000000-0000-0000-0000-000000000005',
  'c3000000-0000-0000-0000-000000000006',
  'c3000000-0000-0000-0000-000000000007',
  'c3000000-0000-0000-0000-000000000008',
];

export const DEMO_BRANCH_IDS = [
  'd4000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000002',
];

// ─────────────────────────────────────────────

export async function seedServices(prisma: PrismaClient) {
  console.log('── Seeding services ──');

  const categoryIds: string[] = [];
  for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
    const cat = DEMO_CATEGORIES[i];
    const c = await prisma.serviceCategory.upsert({
      where: { id: DEMO_CATEGORY_IDS[i] },
      update: { nameAr: cat.nameAr, nameEn: cat.nameEn },
      create: { id: DEMO_CATEGORY_IDS[i], nameAr: cat.nameAr, nameEn: cat.nameEn, sortOrder: cat.sortOrder },
    });
    categoryIds.push(c.id);
  }

  const serviceIds: string[] = [];
  for (let i = 0; i < DEMO_SERVICES.length; i++) {
    const s = DEMO_SERVICES[i];
    const svc = await prisma.service.upsert({
      where: { id: DEMO_SERVICE_IDS[i] },
      update: {
        nameAr: s.nameAr, nameEn: s.nameEn, price: s.price, duration: s.duration,
        bufferMinutes: s.bufferMinutes, depositEnabled: s.depositEnabled,
        depositPercent: s.depositPercent, allowRecurring: s.allowRecurring,
        allowedRecurringPatterns: s.allowedRecurringPatterns as any,
        maxRecurrences: s.maxRecurrences, maxParticipants: s.maxParticipants,
        calendarColor: s.calendarColor,
        minLeadMinutes: s.minLeadMinutes, maxAdvanceDays: s.maxAdvanceDays,
        hidePriceOnBooking: s.hidePriceOnBooking,
        hideDurationOnBooking: s.hideDurationOnBooking,
      },
      create: {
        id: DEMO_SERVICE_IDS[i],
        nameAr: s.nameAr, nameEn: s.nameEn,
        descriptionAr: s.descriptionAr, descriptionEn: s.descriptionEn,
        categoryId: categoryIds[s.categoryIdx],
        price: s.price, duration: s.duration,
        bufferMinutes: s.bufferMinutes, depositEnabled: s.depositEnabled,
        depositPercent: s.depositPercent, allowRecurring: s.allowRecurring,
        allowedRecurringPatterns: s.allowedRecurringPatterns as any,
        maxRecurrences: s.maxRecurrences, maxParticipants: s.maxParticipants,
        calendarColor: s.calendarColor,
        minLeadMinutes: s.minLeadMinutes, maxAdvanceDays: s.maxAdvanceDays,
        hidePriceOnBooking: s.hidePriceOnBooking,
        hideDurationOnBooking: s.hideDurationOnBooking,
      },
    });
    serviceIds.push(svc.id);
  }

  // ServiceBookingType — per-type pricing for select services
  // [svcIdx, type, price, duration]
  const sbtDefs: [number, string, number, number][] = [
    [0, 'clinic_visit',        30000, 30], [0, 'phone_consultation', 15000, 20], [0, 'video_consultation', 20000, 25],
    [1, 'clinic_visit',        15000, 15], [1, 'phone_consultation', 10000, 10], [1, 'video_consultation', 12000, 15],
    [4, 'clinic_visit',        40000, 30], [4, 'video_consultation', 30000, 25],
    [5, 'clinic_visit',        80000, 45], [5, 'video_consultation', 50000, 30],
    [6, 'clinic_visit',        25000, 30], [6, 'video_consultation', 18000, 20],
  ];
  for (const [sIdx, type, price, duration] of sbtDefs) {
    await prisma.serviceBookingType.upsert({
      where: { serviceId_bookingType: { serviceId: serviceIds[sIdx], bookingType: type as any } },
      update: { price, duration },
      create: { serviceId: serviceIds[sIdx], bookingType: type as any, price, duration },
    });
  }

  // ServiceDurationOption — covers ServiceDurationOption model
  const sdoSvcIdx = 5; // Laser Treatment — multiple duration options
  const laserOptions = [
    { label: 'Small area',   labelAr: 'منطقة صغيرة',  durationMinutes: 20, price: 40000, isDefault: false },
    { label: 'Medium area',  labelAr: 'منطقة متوسطة', durationMinutes: 45, price: 80000, isDefault: true  },
    { label: 'Full session', labelAr: 'جلسة كاملة',   durationMinutes: 90, price: 150000, isDefault: false },
  ];
  for (let j = 0; j < laserOptions.length; j++) {
    const opt = laserOptions[j];
    await prisma.serviceDurationOption.upsert({
      where: { id: `sdo-laser-${j}` },
      update: {},
      create: {
        id: `sdo-laser-${j}`,
        serviceId: serviceIds[sdoSvcIdx],
        label: opt.label, labelAr: opt.labelAr,
        durationMinutes: opt.durationMinutes, price: opt.price,
        isDefault: opt.isDefault, sortOrder: j,
      },
    });
  }

  console.log(`  ${categoryIds.length} categories, ${serviceIds.length} services, ${sbtDefs.length} booking types, ${laserOptions.length} duration options`);
  return serviceIds;
}

export async function seedPractitionerServices(
  prisma: PrismaClient,
  practitionerIds: string[],
  serviceIds: string[],
) {
  console.log('── Seeding practitioner-service links ──');
  // pract 0 → services 0,1 | pract 1 → services 4,5 | pract 2 → services 2,3 | pract 3 → services 6,7
  const psMap: [number, number[]][] = [[0, [0, 1]], [1, [4, 5]], [2, [2, 3]], [3, [6, 7]]];
  const psIds: string[] = [];
  let counter = 0;
  for (const [pIdx, sIdxList] of psMap) {
    for (const sIdx of sIdxList) {
      const psId = DEMO_PRACTITIONER_SERVICE_IDS[counter++] ?? `ps-${pIdx}-${sIdx}`;
      await prisma.practitionerService.upsert({
        where: { id: psId },
        update: {},
        create: {
          id: psId,
          practitionerId: practitionerIds[pIdx],
          serviceId: serviceIds[sIdx],
          availableTypes: ['clinic_visit', 'phone_consultation', 'video_consultation'],
          bufferMinutes: sIdx < 2 ? 5 : 10,
        },
      });
      psIds.push(psId);

      // PractitionerServiceType — covers per-practitioner type override
      const types = sIdx < 2
        ? [['clinic_visit', null, null], ['phone_consultation', null, null], ['video_consultation', null, null]]
        : [['clinic_visit', null, null]];
      for (const [type, price, duration] of types as [string, number | null, number | null][]) {
        await prisma.practitionerServiceType.upsert({
          where: { practitionerServiceId_bookingType: { practitionerServiceId: psId, bookingType: type as any } },
          update: {},
          create: {
            practitionerServiceId: psId, bookingType: type as any,
            price, duration, useCustomOptions: false, isActive: true,
          },
        });
      }
    }
  }

  // PractitionerDurationOption — covers custom duration options for a practitioner
  const ps0Id = psIds[0]; // dr. abdulrahman → general checkup
  const pstResult = await prisma.practitionerServiceType.findFirst({
    where: { practitionerServiceId: ps0Id, bookingType: 'clinic_visit' },
  });
  if (pstResult) {
    const practDurationOptions = [
      { label: 'Brief (15 min)',    labelAr: 'مختصر ١٥ د',  durationMinutes: 15, price: 20000, isDefault: false },
      { label: 'Standard (30 min)', labelAr: 'معياري ٣٠ د', durationMinutes: 30, price: 30000, isDefault: true  },
      { label: 'Extended (60 min)', labelAr: 'موسّع ٦٠ د',  durationMinutes: 60, price: 50000, isDefault: false },
    ];
    for (let j = 0; j < practDurationOptions.length; j++) {
      const opt = practDurationOptions[j];
      await prisma.practitionerDurationOption.upsert({
        where: { id: `pdo-ps0-${j}` },
        update: {},
        create: {
          id: `pdo-ps0-${j}`,
          practitionerServiceTypeId: pstResult.id,
          label: opt.label, labelAr: opt.labelAr,
          durationMinutes: opt.durationMinutes, price: opt.price,
          isDefault: opt.isDefault, sortOrder: j,
        },
      });
    }
  }

  console.log(`  ${psIds.length} practitioner-service links + service types + duration options`);
  return psIds;
}

export async function seedBranches(prisma: PrismaClient, practitionerIds: string[]) {
  console.log('── Seeding branches ──');
  const branchIds: string[] = [];
  for (let i = 0; i < DEMO_BRANCHES.length; i++) {
    const b = DEMO_BRANCHES[i];
    const branch = await prisma.branch.upsert({
      where: { id: DEMO_BRANCH_IDS[i] },
      update: { nameAr: b.nameAr, nameEn: b.nameEn, address: b.address, phone: b.phone, email: b.email },
      create: {
        id: DEMO_BRANCH_IDS[i],
        nameAr: b.nameAr, nameEn: b.nameEn,
        address: b.address, phone: b.phone, email: b.email,
        isMain: b.isMain, timezone: b.timezone,
        isActive: true,
      },
    });
    branchIds.push(branch.id);
  }
  // All practitioners in main branch, first two also in Jeddah
  for (let i = 0; i < practitionerIds.length; i++) {
    await prisma.practitionerBranch.upsert({
      where: { practitionerId_branchId: { practitionerId: practitionerIds[i], branchId: branchIds[0] } },
      update: {},
      create: { practitionerId: practitionerIds[i], branchId: branchIds[0], isPrimary: true },
    });
    if (i < 2 && branchIds[1]) {
      await prisma.practitionerBranch.upsert({
        where: { practitionerId_branchId: { practitionerId: practitionerIds[i], branchId: branchIds[1] } },
        update: {},
        create: { practitionerId: practitionerIds[i], branchId: branchIds[1], isPrimary: false },
      });
    }
  }
  console.log(`  ${branchIds.length} branches + practitioner assignments`);
  return branchIds;
}

export async function seedPromotions(prisma: PrismaClient, patientId: string) {
  console.log('── Seeding coupons & gift cards ──');
  for (const c of DEMO_COUPONS) {
    const expires = new Date();
    expires.setDate(expires.getDate() + c.expiresInDays);
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        descriptionAr: c.descriptionAr, descriptionEn: c.descriptionEn,
        discountType: c.discountType, discountValue: c.discountValue,
        minAmount: c.minAmount ?? 0,
        maxUses: c.maxUses, maxUsesPerUser: c.maxUsesPerUser,
        expiresAt: expires, isActive: true,
      },
    });
  }
  for (const g of DEMO_GIFT_CARDS) {
    await prisma.giftCard.upsert({
      where: { code: g.code },
      update: {},
      create: {
        code: g.code,
        initialAmount: g.initialAmount, balance: g.balance,
        purchasedBy: patientId, isActive: true,
      },
    });
  }
  console.log(`  ${DEMO_COUPONS.length} coupons, ${DEMO_GIFT_CARDS.length} gift cards`);
}

export async function seedWaitlist(
  prisma: PrismaClient,
  patientIds: string[],
  practitionerIds: string[],
  serviceIds: string[],
) {
  console.log('── Seeding waitlist entries ──');
  for (let i = 0; i < DEMO_WAITLIST.length; i++) {
    const w = DEMO_WAITLIST[i];
    await prisma.waitlistEntry.upsert({
      where: { id: `waitlist-demo-${i}` },
      update: {},
      create: {
        id: `waitlist-demo-${i}`,
        patientId: patientIds[w.patientIdx],
        practitionerId: practitionerIds[w.practitionerIdx],
        serviceId: w.serviceIdx !== null ? serviceIds[w.serviceIdx] : undefined,
        preferredDate: w.preferredDate ? new Date(w.preferredDate) : undefined,
        preferredTime: w.preferredTime as any,
        status: w.status,
        notifiedAt: w.status === 'notified' ? new Date() : undefined,
      },
    });
  }
  console.log(`  ${DEMO_WAITLIST.length} waitlist entries`);
}

export async function seedIntakeForms(
  prisma: PrismaClient,
  serviceIds: string[],
) {
  console.log('── Seeding intake forms ──');
  for (let i = 0; i < DEMO_INTAKE_FORMS.length; i++) {
    const f = DEMO_INTAKE_FORMS[i];
    const formId = `intake-demo-${i}`;
    await prisma.intakeForm.upsert({
      where: { id: formId },
      update: {},
      create: {
        id: formId,
        nameAr: f.nameAr, nameEn: f.nameEn,
        type: f.type, scope: f.scope,
        serviceId: f.serviceIdx !== null ? serviceIds[f.serviceIdx] : undefined,
        isActive: true, submissionsCount: 0,
      },
    });
    for (let j = 0; j < f.fields.length; j++) {
      const field = f.fields[j];
      await prisma.intakeField.upsert({
        where: { id: `intakefield-${i}-${j}` },
        update: {},
        create: {
          id: `intakefield-${i}-${j}`,
          formId,
          labelAr: field.labelAr, labelEn: field.labelEn,
          fieldType: field.fieldType,
          options: (field as any).options ?? undefined,
          isRequired: field.isRequired,
          sortOrder: j,
        },
      });
    }
  }
  console.log(`  ${DEMO_INTAKE_FORMS.length} intake forms + fields`);
}

export async function seedClinicConfig(prisma: PrismaClient) {
  console.log('── Seeding clinic config ──');

  for (const wh of DEMO_WORKING_HOURS) {
    const existing = await prisma.clinicWorkingHours.findFirst({
      where: { dayOfWeek: wh.dayOfWeek, branchId: null },
    });
    if (existing) {
      await prisma.clinicWorkingHours.update({
        where: { id: existing.id },
        data: { startTime: wh.startTime, endTime: wh.endTime, isActive: wh.isActive },
      });
    } else {
      await prisma.clinicWorkingHours.create({ data: wh });
    }
  }
  for (const h of DEMO_HOLIDAYS) {
    await prisma.clinicHoliday.upsert({
      where: { date: new Date(h.date) },
      update: {},
      create: { date: new Date(h.date), nameAr: h.nameAr, nameEn: h.nameEn, isRecurring: h.isRecurring },
    });
  }

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

  const existingSettings = await prisma.bookingSettings.findFirst({ where: { branchId: null } });
  if (!existingSettings) {
    await prisma.bookingSettings.create({
      data: {
        paymentTimeoutMinutes: 60,
        freeCancelBeforeHours: 24, freeCancelRefundType: 'full',
        lateCancelRefundType: 'none', lateCancelRefundPercent: 0,
        adminCanDirectCancel: true, patientCanCancelPending: true,
        patientCanReschedule: true, rescheduleBeforeHours: 12,
        maxReschedulesPerBooking: 2,
        allowWalkIn: true, walkInPaymentRequired: false,
        allowRecurring: true, maxRecurrences: 12,
        allowedRecurringPatterns: ['weekly', 'biweekly'] as any,
        waitlistEnabled: true, waitlistMaxPerSlot: 5, waitlistAutoNotify: true,
        bufferMinutes: 0,
        autoCompleteAfterHours: 2, autoNoShowAfterMinutes: 30,
        noShowPolicy: 'keep_full', noShowRefundPercent: 0,
        cancellationReviewTimeoutHours: 48,
        cancellationPolicyAr: 'يمكن إلغاء الحجز مجاناً قبل 24 ساعة من الموعد. الإلغاء المتأخر يخضع لمراجعة الإدارة.',
        cancellationPolicyEn: 'Free cancellation up to 24 hours before the appointment. Late cancellations are subject to admin review.',
        reminder24hEnabled: true, reminder1hEnabled: true, reminderInteractive: false,
        suggestAlternativesOnConflict: true, suggestAlternativesCount: 3,
        minBookingLeadMinutes: 0, adminCanBookOutsideHours: false, maxAdvanceBookingDays: 60,
      },
    });
  }
  console.log('  working hours, holidays, chatbot config, knowledge base, booking settings');
}
