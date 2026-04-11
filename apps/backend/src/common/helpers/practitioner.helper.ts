import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * Shared helper to verify a practitioner exists and is not soft-deleted.
 * Used across availability, vacation, and service sub-services.
 */
export async function ensurePractitionerExists(
  prisma: PrismaService,
  practitionerId: string,
) {
  const practitioner = await prisma.practitioner.findFirst({
    where: { id: practitionerId },
  });
  if (!practitioner || practitioner.deletedAt) {
    throw new NotFoundException({
      statusCode: 404,
      message: 'Practitioner not found',
      error: 'PRACTITIONER_NOT_FOUND',
    });
  }
  return practitioner;
}
