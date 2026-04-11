import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class FavoritePractitionersService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────
  //  Add favorite (idempotent)
  // ───────────────────────────────────────────────────────────────

  async addFavorite(patientId: string, practitionerId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId, isActive: true, deletedAt: null },
    });
    if (!practitioner) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'NOT_FOUND',
      });
    }

    const existing = await this.prisma.favoritePractitioner.findUnique({
      where: {
        patientId_practitionerId: { patientId, practitionerId },
      },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Practitioner is already in favorites',
        error: 'ALREADY_FAVORITED',
      });
    }

    return this.prisma.favoritePractitioner.create({
      data: { patientId, practitionerId },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Remove favorite
  // ───────────────────────────────────────────────────────────────

  async removeFavorite(patientId: string, practitionerId: string) {
    const existing = await this.prisma.favoritePractitioner.findUnique({
      where: {
        patientId_practitionerId: { patientId, practitionerId },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Favorite not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.favoritePractitioner.delete({
      where: { id: existing.id },
    });
    return { success: true };
  }

  // ───────────────────────────────────────────────────────────────
  //  Get all favorites for a patient
  // ───────────────────────────────────────────────────────────────

  async getFavorites(patientId: string) {
    const rows = await this.prisma.favoritePractitioner.findMany({
      where: { patientId },
      include: {
        practitioner: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten: return practitioner records with a favoriteId field
    return rows.map(({ practitioner, id: favoriteId, createdAt }) => ({
      ...practitioner,
      favoriteId,
      favoritedAt: createdAt,
    }));
  }
}
