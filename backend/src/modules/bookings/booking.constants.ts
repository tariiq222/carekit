/** Shared Prisma include for booking queries — single source of truth */
export const bookingInclude = {
  patient: true,
  practitioner: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      specialty: { select: { nameEn: true, nameAr: true } },
    },
  },
  service: true,
  practitionerService: true,
};
