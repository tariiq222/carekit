import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * Shared ownership check — used by practitioners, availability, and vacation services.
 * Passes if currentUserId is the owner, or if the user has super_admin or receptionist role.
 */
export async function checkOwnership(
  prisma: PrismaService,
  ownerUserId: string,
  currentUserId: string,
): Promise<void> {
  if (ownerUserId === currentUserId) return;

  const dbUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { userRoles: { include: { role: true } } },
  });

  const roles =
    dbUser?.userRoles.map((ur: { role: { slug: string } }) => ur.role.slug) ??
    [];
  const isAdmin =
    roles.includes('super_admin') || roles.includes('receptionist');

  if (!isAdmin) {
    throw new ForbiddenException({
      statusCode: 403,
      message: 'You can only edit your own profile',
      error: 'FORBIDDEN',
    });
  }
}
