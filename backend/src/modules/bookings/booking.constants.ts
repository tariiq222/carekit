/** Shared Prisma include for booking queries — single source of truth */
export const bookingInclude = {
  patient: true,
  practitioner: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  service: true,
  practitionerService: true,
  payment: true,
  rescheduledFrom: { select: { id: true, date: true, startTime: true } },
};
