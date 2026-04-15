/** All system modules for RBAC permissions */
export const MODULES = {
  USERS: 'users',
  EMPLOYEES: 'employees',
  CLIENTS: 'clients',
  BOOKINGS: 'bookings',
  SERVICES: 'services',
  PAYMENTS: 'payments',
  INVOICES: 'invoices',
  RATINGS: 'ratings',
  ROLES: 'roles',
  NOTIFICATIONS: 'notifications',
  BRANDING: 'branding',
  REPORTS: 'reports',
  CHATBOT: 'chatbot',
} as const;

export type Module = (typeof MODULES)[keyof typeof MODULES];

/** RBAC actions */
export const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
