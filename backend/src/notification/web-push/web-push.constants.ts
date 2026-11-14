export const WEB_PUSH_STATUS = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type WebPushStatus = (typeof WEB_PUSH_STATUS)[keyof typeof WEB_PUSH_STATUS];

export const WEB_PUSH_PLATFORM = {
  IOS: 'IOS',
  ANDROID: 'ANDROID',
  DESKTOP: 'DESKTOP',
} as const;

export type WebPushPlatform = (typeof WEB_PUSH_PLATFORM)[keyof typeof WEB_PUSH_PLATFORM];

export const NOTIFICATION_CATEGORIES = {
  ORDERS: 'ORDERS',
  QR_ORDERS: 'QR_ORDERS',
  SERVICE_REQUESTS: 'SERVICE_REQUESTS',
  PAYMENTS: 'PAYMENTS',
  TABLES: 'TABLES',
  BUFFET: 'BUFFET',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[keyof typeof NOTIFICATION_CATEGORIES];

export interface WebPushCategoryPreferences {
  orders: boolean;
  qrOrders: boolean;
  serviceRequests: boolean;
  payments: boolean;
  tables: boolean;
  buffet: boolean;
}

export const DEFAULT_CATEGORY_PREFERENCES: WebPushCategoryPreferences = {
  orders: true,
  qrOrders: true,
  serviceRequests: true,
  payments: true,
  tables: true,
  buffet: true,
};

// Safe TTL in seconds
export const WEB_PUSH_TTL = {
  SERVICE_REQUESTS: 180, // 3 minutes for urgent waiter call
  BUFFET: 180,           // 3 minutes for buffet round orders
  ORDERS: 300,           // 5 minutes for new orders
  QR_ORDERS: 300,        // 5 minutes for QR incoming rounds
  PAYMENTS: 300,         // 5 minutes for payment requests
  TABLES: 600,           // 10 minutes for table transfers/updates
  DEFAULT: 300,
} as const;

