export * from './permissions-registry';

import { RoleType } from '@prisma/client';
import {
  PERMISSIONS as REGISTRY_PERMISSIONS,
  DEFAULT_SYSTEM_ROLE_PERMISSIONS,
} from './permissions-registry';

export const PERMISSIONS = {
  ...REGISTRY_PERMISSIONS,
  // Legacy aliases for existing code
  DASHBOARD_VIEW: 'dashboard.view',
  REPORTS_VIEW: 'reports.view',
  USERS_VIEW: 'staff.view',
  USERS_CREATE: 'staff.create',
  USERS_UPDATE: 'staff.update',
  USERS_DELETE: 'customers.delete',
  ORDERS_VIEW: 'orders.view',
  ORDERS_UPDATE: 'orders.status.update',
  ORDERS_UPDATE_STATUS: 'orders.status.update',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_EXPORT: 'products.export',
  PRODUCTS_IMPORT: 'products.import',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',
  PROMOTIONS_VIEW: 'vouchers.view',
  PROMOTIONS_CREATE: 'vouchers.create',
  PROMOTIONS_UPDATE: 'vouchers.update',
  PROMOTIONS_DELETE: 'vouchers.delete',
  ARTICLES_VIEW: 'articles.view',
  ARTICLES_CREATE: 'articles.create',
  ARTICLES_UPDATE: 'articles.update',
  ARTICLES_DELETE: 'articles.delete',
  ARTICLES_PUBLISH: 'articles.publish',
  ARTICLES_NOTIFY: 'article_campaigns.send',
  SETTINGS_VIEW: 'settings.general.view',
  SETTINGS_UPDATE: 'settings.general.update',
};

export const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  ADMIN: DEFAULT_SYSTEM_ROLE_PERMISSIONS.ADMIN,
  MANAGER: DEFAULT_SYSTEM_ROLE_PERMISSIONS.BRANCH_MANAGER,
  CHEF: DEFAULT_SYSTEM_ROLE_PERMISSIONS.BRANCH_KITCHEN,
  WAITER: DEFAULT_SYSTEM_ROLE_PERMISSIONS.BRANCH_WAITER,
  USER: [],
};
