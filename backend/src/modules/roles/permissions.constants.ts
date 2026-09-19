export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage';

export type Resource =
  | 'dashboard'
  | 'client'
  | 'product'
  | 'tax'
  | 'quote'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'report'
  | 'user'
  | 'role'
  | 'notification'
  | 'audit'
  | 'settings'
  | 'system'
  | 'company';

export const RESOURCES: Resource[] = [
  'dashboard',
  'client',
  'product',
  'tax',
  'quote',
  'invoice',
  'payment',
  'expense',
  'report',
  'user',
  'role',
  'notification',
  'audit',
  'settings',
  'system',
  'company',
];

export const perm = (resource: Resource, action: Action): string =>
  `${resource}.${action}`;

export const readPerm = (resource: Resource) => perm(resource, 'read');

export const allPermissionsOf = (...resources: Resource[]): string[] =>
  resources.flatMap((r) =>
    ['read', 'create', 'update', 'delete'].map((a) => `${r}.${a}`),
  );

export const ALL_PERMISSIONS: string[] = RESOURCES.flatMap((r) => [
  `${r}.read`,
  `${r}.create`,
  `${r}.update`,
  `${r}.delete`,
  `${r}.manage`,
]);

export const ROLE_KEYS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
  VIEWER: 'viewer',
} as const;

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: ROLE_KEYS.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Platform owner with unrestricted access across the whole system.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    key: ROLE_KEYS.ADMIN,
    name: 'Administrator',
    description: 'Manages the workspace: users, roles, settings, reports and all billing data.',
    permissions: [
      ...allPermissionsOf('dashboard', 'client', 'product', 'tax', 'quote', 'invoice', 'payment', 'expense', 'report', 'user', 'role', 'notification', 'audit', 'settings', 'company'),
      'report.export',
      'notification.manage',
      'user.manage',
      'role.manage',
      'settings.manage',
    ],
    isSystem: true,
  },
  {
    key: ROLE_KEYS.MANAGER,
    name: 'Manager',
    description: 'Runs day-to-day billing operations. Cannot delete records or change system settings.',
    permissions: [
      ...allPermissionsOf('dashboard', 'client', 'product', 'tax', 'quote', 'invoice', 'payment', 'expense'),
      'report.read',
      'report.export',
      'notification.read',
      'notification.manage',
      'company.read',
      'settings.read',
    ],
    isSystem: true,
  },
  {
    key: ROLE_KEYS.ACCOUNTANT,
    name: 'Accountant',
    description: 'Handles invoicing, payments, expenses and reports.',
    permissions: [
      'dashboard.read',
      'client.read',
      'product.read',
      'tax.read',
      'quote.read',
      'quote.create',
      'quote.update',
      'invoice.create',
      'invoice.read',
      'invoice.update',
      'payment.create',
      'payment.read',
      'payment.update',
      'expense.create',
      'expense.read',
      'expense.update',
      'report.read',
      'report.export',
      'notification.read',
      'company.read',
    ],
    isSystem: true,
  },
  {
    key: ROLE_KEYS.VIEWER,
    name: 'Viewer',
    description: 'Read-only access across the workspace.',
    permissions: [
      'dashboard.read',
      'client.read',
      'product.read',
      'tax.read',
      'quote.read',
      'invoice.read',
      'payment.read',
      'expense.read',
      'report.read',
      'notification.read',
      'company.read',
    ],
    isSystem: true,
  },
];