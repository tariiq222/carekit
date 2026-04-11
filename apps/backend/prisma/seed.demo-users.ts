import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEMO_PATIENTS, DEMO_RECEPTIONIST, DEMO_ACCOUNTANT,
  DEMO_PRACTITIONERS, DEMO_PATIENT_PROFILES,
  DEMO_VACATIONS, DEMO_FAVORITES,
} from './seed.demo-data';

const PASSWORD_HASH = bcrypt.hashSync('Test@1234', 10);

export async function upsertUser(
  prisma: PrismaClient,
  data: { email: string; firstName: string; lastName: string; phone: string; gender: 'male' | 'female' },
  roleName: string,
) {
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: { phone: data.phone, firstName: data.firstName, lastName: data.lastName },
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

export async function seedStaffAndPatients(prisma: PrismaClient) {
  console.log('\n── Seeding users ──');

  // Staff
  await upsertUser(prisma, DEMO_RECEPTIONIST, 'receptionist');
  await upsertUser(prisma, DEMO_ACCOUNTANT, 'accountant');

  // Patients + profiles
  const patientIds: string[] = [];
  for (const p of DEMO_PATIENTS) {
    const user = await upsertUser(prisma, p, 'patient');
    patientIds.push(user.id);
  }

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
  console.log(`  ${patientIds.length} patients + profiles`);
  return patientIds;
}

export async function seedPractitioners(prisma: PrismaClient) {
  console.log('── Seeding practitioners ──');
  const practitionerIds: string[] = [];
  const practitionerUserIds: string[] = [];

  for (const doc of DEMO_PRACTITIONERS) {
    const user = await upsertUser(prisma, doc, 'practitioner');
    practitionerUserIds.push(user.id);

    // Resolve specialtyId from the seeded Specialty table
    const specialtyRecord = await prisma.specialty.findUnique({
      where: { nameEn: doc.specialtyEn },
    });
    const specialtyId = specialtyRecord?.id ?? null;

    const practitioner = await prisma.practitioner.upsert({
      where: { userId: user.id },
      update: {
        title: doc.title, nameAr: doc.nameAr,
        specialty: doc.specialtyEn, specialtyAr: doc.specialtyAr,
        specialtyId,
        bio: doc.bio, bioAr: doc.bioAr, experience: doc.experience,
        education: doc.education, educationAr: doc.educationAr,
      },
      create: {
        userId: user.id,
        title: doc.title, nameAr: doc.nameAr,
        specialty: doc.specialtyEn, specialtyAr: doc.specialtyAr,
        specialtyId,
        bio: doc.bio, bioAr: doc.bioAr,
        experience: doc.experience,
        education: doc.education, educationAr: doc.educationAr,
        rating: 0, reviewCount: 0,
        isActive: true, isAcceptingBookings: true,
      },
    });
    practitionerIds.push(practitioner.id);

    // Availability: Sun–Thu 09:00–17:00
    for (let day = 0; day <= 4; day++) {
      await prisma.practitionerAvailability.upsert({
        where: { id: `avail-${practitioner.id}-${day}` },
        update: {},
        create: {
          id: `avail-${practitioner.id}-${day}`,
          practitionerId: practitioner.id, dayOfWeek: day,
          startTime: '09:00', endTime: '17:00', isActive: true,
        },
      });
    }
    // Saturday half-day for first two practitioners
    if (practitionerIds.length <= 2) {
      await prisma.practitionerAvailability.upsert({
        where: { id: `avail-${practitioner.id}-6` },
        update: {},
        create: {
          id: `avail-${practitioner.id}-6`,
          practitionerId: practitioner.id, dayOfWeek: 6,
          startTime: '10:00', endTime: '14:00', isActive: true,
        },
      });
    }

    // Break: 12:00–13:00 Sun–Thu
    for (let day = 0; day <= 4; day++) {
      await prisma.practitionerBreak.upsert({
        where: { id: `break-${practitioner.id}-${day}` },
        update: {},
        create: {
          id: `break-${practitioner.id}-${day}`,
          practitionerId: practitioner.id, dayOfWeek: day,
          startTime: '12:00', endTime: '13:00',
        },
      });
    }
  }

  // Vacations — covers PractitionerVacation model
  for (let i = 0; i < DEMO_VACATIONS.length; i++) {
    const v = DEMO_VACATIONS[i];
    const pId = practitionerIds[v.practitionerIdx];
    if (!pId) continue;
    await prisma.practitionerVacation.upsert({
      where: { id: `vacation-demo-${i}` },
      update: {},
      create: {
        id: `vacation-demo-${i}`,
        practitionerId: pId,
        startDate: new Date(v.startDate),
        endDate: new Date(v.endDate),
        reason: v.reason,
      },
    });
  }

  console.log(`  ${practitionerIds.length} practitioners + availability + breaks + vacations`);
  return { practitionerIds, practitionerUserIds };
}

export async function seedFavorites(
  prisma: PrismaClient,
  patientIds: string[],
  practitionerIds: string[],
) {
  for (const fav of DEMO_FAVORITES) {
    const patientId = patientIds[fav.patientIdx];
    const practitionerId = practitionerIds[fav.practitionerIdx];
    if (!patientId || !practitionerId) continue;
    await prisma.favoritePractitioner.upsert({
      where: { patientId_practitionerId: { patientId, practitionerId } },
      update: {},
      create: { patientId, practitionerId },
    });
  }
  console.log(`  ${DEMO_FAVORITES.length} favorite practitioners`);
}
