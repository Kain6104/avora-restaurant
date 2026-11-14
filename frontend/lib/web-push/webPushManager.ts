/**
 * AVORA WAITER - ENTERPRISE WEB PUSH NOTIFICATION MANAGER
 * Pure W3C Push API + VAPID Authentication (Zero Firebase)
 * Supports iOS 16.4+ Home Screen PWA, Android Chrome PWA, Desktop
 */

import { getApiBaseUrl, getAuthHeaders } from '../auth';

export interface WebPushPreferences {
  orders: boolean;
  qrOrders: boolean;
  serviceRequests: boolean;
  payments: boolean;
  tables: boolean;
  buffet: boolean;
}

export const DEFAULT_PREFERENCES: WebPushPreferences = {
  orders: true,
  qrOrders: true,
  serviceRequests: true,
  payments: true,
  tables: true,
  buffet: true,
};

export type DevicePlatform = 'IOS' | 'ANDROID' | 'DESKTOP';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported' | 'ios_home_screen_required';

const DEVICE_ID_KEY = 'avora_waiter_device_installation_id';
const LOCAL_PUSH_STATUS_KEY = 'avora_waiter_push_enabled';

/**
 * Get or create persistent device installation identity (UUID)
 */
export function getDeviceInstallationId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || id.trim() === '') {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      }
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'fallback-device-id';
  }
}

/**
 * Detect client platform
 */
export function getPlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'DESKTOP';
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPod|iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'IOS';
  if (/Android/i.test(ua)) return 'ANDROID';
  return 'DESKTOP';
}

/**
 * Detect browser name
 */
export function getBrowserName(): string {
  if (typeof window === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return 'Edge';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/Firefox/i.test(ua)) return 'Firefox';
  return 'Mobile Browser';
}

/**
 * Check if running as iOS Home Screen Standalone PWA
 */
export function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isIOS = getPlatform() === 'IOS';
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && isStandalone;
}

/**
 * Check if the browser supports standard Web Push
 */
export function checkPushCapabilities(): {
  supported: boolean;
  isIos: boolean;
  isIosStandalone: boolean;
  permission: NotificationPermission | 'unsupported';
} {
  if (typeof window === 'undefined') {
    return { supported: false, isIos: false, isIosStandalone: false, permission: 'unsupported' };
  }

  const isIos = getPlatform() === 'IOS';
  const standalone = isIosStandalone();
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  const supported = hasServiceWorker && hasPushManager && hasNotification;
  const permission = hasNotification ? Notification.permission : 'unsupported';

  return {
    supported,
    isIos,
    isIosStandalone: standalone,
    permission,
  };
}

/**
 * Helper to convert Base64 URL-safe string to Uint8Array for applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Fetch VAPID Public Key from backend
 */
export async function fetchVapidPublicKey(): Promise<string> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/notifications/web-push/public-key`, {
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await res.json();
  if (!data?.success || !data?.data?.publicKey) {
    throw new Error(data?.message || 'Không thể tải VAPID Public Key từ máy chủ');
  }
  return data.data.publicKey;
}

/**
 * Fetch subscription status from backend for this device
 */
export async function fetchDeviceSubscriptionStatus(): Promise<any> {
  const deviceInstallationId = getDeviceInstallationId();
  const apiBase = getApiBaseUrl();
  const res = await fetch(
    `${apiBase}/api/notifications/web-push/status?deviceInstallationId=${encodeURIComponent(deviceInstallationId)}`,
    {
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data || null;
}

/**
 * Subscribe current device to Web Push
 */
export async function subscribeToWebPush(options?: {
  branchId?: string;
  preferences?: WebPushPreferences;
}): Promise<any> {
  const capabilities = checkPushCapabilities();

  // iOS check: iOS requires Home Screen PWA before Push API is enabled
  if (capabilities.isIos && !capabilities.isIosStandalone) {
    throw new Error('IOS_HOME_SCREEN_REQUIRED');
  }

  if (!capabilities.supported) {
    throw new Error('Trình duyệt hoặc thiết bị này không hỗ trợ W3C Web Push');
  }

  // 1. Request permission in user-gesture click handler
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  // 2. Ensure Service Worker is registered and ready
  const registration = await navigator.serviceWorker.ready;
  if (!registration) {
    throw new Error('Service Worker của AVORA Waiter chưa sẵn sàng');
  }

  // 3. Retrieve VAPID Public Key
  const vapidPublicKey = await fetchVapidPublicKey();
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  // 4. Check if existing subscription exists
  let subscription = await registration.pushManager.getSubscription();

  // If already subscribed, check if endpoint matches or re-subscribe
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as BufferSource,
    });
  }

  const subJson = subscription.toJSON();
  if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
    throw new Error('Không thể khởi tạo khóa mã hóa Web Push trên thiết bị');
  }

  // 5. Register with backend
  const deviceInstallationId = getDeviceInstallationId();
  const platform = getPlatform();
  const browser = getBrowserName();
  const apiBase = getApiBaseUrl();

  const payload = {
    endpoint: subJson.endpoint,
    keys: {
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    deviceInstallationId,
    platform,
    browser,
    userAgent: navigator.userAgent,
    branchId: options?.branchId,
    categoryPreferences: options?.preferences || DEFAULT_PREFERENCES,
  };

  const res = await fetch(`${apiBase}/api/notifications/web-push/subscribe`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const resData = await res.json();
  if (!res.ok || !resData.success) {
    throw new Error(resData.message || 'Máy chủ không thể lưu đăng ký Web Push');
  }

  // Mark local status
  try {
    localStorage.setItem(LOCAL_PUSH_STATUS_KEY, 'ACTIVE');
  } catch {}

  return resData.data;
}

/**
 * Revoke Web Push subscription for this device
 */
export async function revokeWebPush(): Promise<void> {
  const deviceInstallationId = getDeviceInstallationId();
  const apiBase = getApiBaseUrl();

  // 1. Unsubscribe at browser level
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
    } catch (e) {
      console.warn('[WebPush] Browser unsubscribe error:', e);
    }
  }

  // 2. Notify backend
  try {
    await fetch(`${apiBase}/api/notifications/web-push/revoke`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ deviceInstallationId }),
    });
  } catch (e) {
    console.warn('[WebPush] Backend revoke error:', e);
  }

  // 3. Clear local marker
  try {
    localStorage.removeItem(LOCAL_PUSH_STATUS_KEY);
  } catch {}
}

/**
 * Update category preferences
 */
export async function updatePushPreferences(preferences: WebPushPreferences): Promise<any> {
  const deviceInstallationId = getDeviceInstallationId();
  const apiBase = getApiBaseUrl();

  const res = await fetch(`${apiBase}/api/notifications/web-push/preferences`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({
      deviceInstallationId,
      categoryPreferences: preferences,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Lỗi cập nhật tùy chỉnh thông báo');
  }
  return json.data;
}

/**
 * Send test push notification
 */
export async function sendTestWebPush(custom?: { title?: string; body?: string }): Promise<any> {
  const deviceInstallationId = getDeviceInstallationId();
  const apiBase = getApiBaseUrl();

  const res = await fetch(`${apiBase}/api/notifications/web-push/test`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({
      deviceInstallationId,
      title: custom?.title,
      body: custom?.body,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Lỗi gửi thông báo kiểm tra');
  }
  return json.data;
}
