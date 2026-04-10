import { PrismaService } from '../../database/prisma.service.js';

export interface UserRoleContext {
  isAdmin: boolean;
  isPractitioner: boolean;
  practitionerId: string | null;
  roles: string[];
}

const ADMIN_ROLES = ['super_admin', 'receptionist', 'accountant'];

/**
 * Resolves the user's role context in a single DB query.
 * Replaces the repeated pattern of fetching user+roles then practitioner
 * separately in controllers.
 */
export async function resolveUserRoleContext(
  prisma: PrismaService,
  userId: string,
): Promise<UserRoleContext> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: { select: { slug: true } } } },
      practitioner: { select: { id: true, deletedAt: true } },
    },
  });

  const roles = dbUser?.userRoles.map((ur) => ur.role.slug) ?? [];
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  const activePractitioner =
    dbUser?.practitioner?.deletedAt === null ? dbUser.practitioner : null;

  return {
    isAdmin,
    isPractitioner: !!activePractitioner,
    practitionerId: activePractitioner?.id ?? null,
    roles,
  };
}
