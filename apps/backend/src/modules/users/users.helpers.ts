export interface SanitizableUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  gender?: string | null;
  isActive: boolean;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userRoles?: Array<{
    role: {
      id?: string;
      name?: string;
      slug: string;
    };
  }>;
  passwordHash?: string | null;
  deletedAt?: Date | null;
  avatarUrl?: string | null;
}

export const userRolesInclude = {
  userRoles: { include: { role: true } },
} as const;

export function sanitizeUser(user: SanitizableUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? null,
    gender: user.gender ?? null,
    isActive: user.isActive,
    emailVerified: user.emailVerified ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: (user.userRoles ?? []).map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      slug: ur.role.slug,
    })),
  };
}
