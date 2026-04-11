export interface UserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  roles: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  permissions: string[];
}
