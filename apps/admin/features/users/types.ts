export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}
