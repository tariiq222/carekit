export const invoiceInclude = {
  payment: {
    include: {
      booking: {
        include: {
          patient: true,
          practitioner: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          service: true,
        },
      },
    },
  },
} as const;
