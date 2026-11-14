'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  checkPushCapabilities,
  fetchDeviceSubscriptionStatus,
  getBrowserName,
  getDeviceInstallationId,
  getPlatform,
  revokeWebPush,
  sendTestWebPush,
  subscribeToWebPush,
  updatePushPreferences,
  DEFAULT_PREFERENCES,
  DevicePlatform,
  WebPushPreferences,
} from './webPushManager';

export function useWebPush(branchId?: string) {
  const [loading, setLoading] = useState<boolean>(true);
  const [subscribing, setSubscribing] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('LOADING');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<WebPushPreferences>(DEFAULT_PREFERENCES);
  const [capabilities, setCapabilities] = useState<{
    supported: boolean;
    isIos: boolean;
    isIosStandalone: boolean;
    permission: string;
  }>({
    supported: false,
    isIos: false,
    isIosStandalone: false,
    permission: 'default',
  });
  const [deviceInfo, setDeviceInfo] = useState<{
    deviceInstallationId: string;
    platform: DevicePlatform;
    browser: string;
  }>({
    deviceInstallationId: '',
    platform: 'DESKTOP',
    browser: '',
  });

  const refreshStatus = useCallback(async () => {
    try {
      const caps = checkPushCapabilities();
      setCapabilities(caps);

      const deviceId = getDeviceInstallationId();
      const plat = getPlatform();
      const brow = getBrowserName();
      setDeviceInfo({
        deviceInstallationId: deviceId,
        platform: plat,
        browser: brow,
      });

      if (!caps.supported) {
        setStatus('UNSUPPORTED');
        setIsRegistered(false);
        setLoading(false);
        return;
      }

      if (caps.isIos && !caps.isIosStandalone) {
        setStatus('IOS_REQUIRED');
        setIsRegistered(false);
        setLoading(false);
        return;
      }

      if (caps.permission === 'denied') {
        setStatus('DENIED');
        setIsRegistered(false);
        setLoading(false);
        return;
      }

      const serverStatus = await fetchDeviceSubscriptionStatus();
      if (serverStatus && serverStatus.isRegistered) {
        setStatus(serverStatus.status);
        setIsRegistered(true);
        if (serverStatus.preferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...serverStatus.preferences });
        }
      } else {
        setStatus(serverStatus?.status || 'NOT_REGISTERED');
        setIsRegistered(false);
      }
    } catch (e: any) {
      console.warn('[useWebPush] Status fetch error:', e);
      setStatus('ERROR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();

    // Listen to push messages sent from waiter-sw.js while foregrounded
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'WEB_PUSH_RECEIVED') {
          console.log('[WebPush Foreground] Received push event:', event.data.payload);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [refreshStatus]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      await subscribeToWebPush({ branchId, preferences });
      toast.success('Kích hoạt thông báo đẩy Web Push thành công!');
      await refreshStatus();
    } catch (e: any) {
      if (e.message === 'IOS_HOME_SCREEN_REQUIRED') {
        toast.error('Trên iPhone, bạn cần Thêm vào Màn hình chính (Add to Home Screen) để bật thông báo');
        setStatus('IOS_REQUIRED');
      } else if (e.message === 'PERMISSION_DENIED') {
        toast.error('Bạn đã từ chối cấp quyền thông báo trên trình duyệt');
        setStatus('DENIED');
      } else {
        toast.error(e?.message || 'Không thể đăng ký thông báo đẩy');
      }
    } finally {
      setSubscribing(false);
    }
  };

  const handleRevoke = async () => {
    setSubscribing(true);
    try {
      await revokeWebPush();
      toast.success('Đã tắt thông báo đẩy trên thiết bị này');
      await refreshStatus();
    } catch (e: any) {
      toast.error('Lỗi khi tắt thông báo: ' + (e?.message || 'Không rõ'));
    } finally {
      setSubscribing(false);
    }
  };

  const handleToggleCategory = async (key: keyof WebPushPreferences) => {
    const nextPrefs = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(nextPrefs);

    if (isRegistered) {
      try {
        await updatePushPreferences(nextPrefs);
        toast.success('Đã lưu tùy chọn thông báo');
      } catch (e: any) {
        toast.error('Không thể lưu cài đặt: ' + e?.message);
        // revert
        setPreferences(preferences);
      }
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      await sendTestWebPush({
        title: '🔔 AVORA Waiter Web Push',
        body: 'Thông báo đẩy đã đến thiết bị của bạn thành công!',
      });
      toast.success('Đã gửi thông báo kiểm tra đến thiết bị của bạn!');
    } catch (e: any) {
      toast.error('Lỗi gửi thông báo thử: ' + (e?.message || 'Không rõ'));
    } finally {
      setTesting(false);
    }
  };

  return {
    loading,
    subscribing,
    testing,
    status,
    isRegistered,
    preferences,
    capabilities,
    deviceInfo,
    subscribe: handleSubscribe,
    revoke: handleRevoke,
    toggleCategory: handleToggleCategory,
    sendTest: handleSendTest,
    refreshStatus,
  };
}

