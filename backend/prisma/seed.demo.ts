import { PrismaClient } from '@prisma/client';
import { seedStaffAndPatients, seedPractitioners, seedFavorites } from './seed.demo-users';
import { seedServices, seedPractitionerServices, seedBranches, seedPromotions, seedWaitlist, seedIntakeForms, seedClinicConfig } from './seed.demo-clinic';
import { seedBookings, seedNotifications } from './seed.demo-bookings';

/** Orchestrates all demo data seeding — run after seed.ts */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  console.log('\n════ Seeding Demo Data ════');

  const patientIds                          = await seedStaffAndPatients(prisma);
  const { practitionerIds, practitionerUserIds } = await seedPractitioners(prisma);
  const serviceIds                          = await seedServices(prisma);
  const psIds                               = await seedPractitionerServices(prisma, practitionerIds, serviceIds);
  const branchIds                           = await seedBranches(prisma, practitionerIds);
  await seedPromotions(prisma, patientIds[0]);
  await seedWaitlist(prisma, patientIds, practitionerIds, serviceIds);
  await seedIntakeForms(prisma, serviceIds);
  await seedClinicConfig(prisma);
  await seedBookings(prisma, patientIds, practitionerIds, serviceIds, psIds);
  await seedFavorites(prisma, patientIds, practitionerIds);
  await seedNotifications(prisma, patientIds, practitionerUserIds);

  console.log('════ Demo seeding complete! ════\n');
}
