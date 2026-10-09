/**
 * farmPreferences.ts
 * Quản lý và lưu trữ bền vững (Persist) trạng thái UI của AVORA Farm.
 * Đảm bảo khôi phục tức thì khi F5/reload mà không bị flicker hay reset về default.
 */

export type FarmTheme = 'DAY' | 'NIGHT';

export interface FarmUIPreferences {
  theme: FarmTheme;
  isAudioEnabled: boolean;
  audioVolume: number; // 0.0 -> 1.0 (mặc định 0.6)
  isSfxMuted: boolean;
  cameraZoom?: number;
  cameraScrollX?: number;
  cameraScrollY?: number;
  prefersFullscreen?: boolean;
  lastUpdated?: number;
}

export const DEFAULT_FARM_UI_PREFERENCES: FarmUIPreferences = {
  theme: 'DAY',
  isAudioEnabled: false,
  audioVolume: 0.6,
  isSfxMuted: false,
  cameraZoom: undefined,
  cameraScrollX: undefined,
  cameraScrollY: undefined,
  prefersFullscreen: false,
};

const STORAGE_KEY = 'avora_farm_ui_preferences';
const EVENT_NAME = 'avora-farm-pref-changed';

/**
 * Đọc đồng bộ cấu hình UI preferences đã lưu từ localStorage.
 * Hoàn toàn an toàn trên Server-Side Rendering (SSR).
 */
export function getFarmUIPreferences(): FarmUIPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_FARM_UI_PREFERENCES };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Fallback kiểm tra các key cũ nếu có
      const legacySfx = localStorage.getItem('avora_farm_sfx_muted');
      return {
        ...DEFAULT_FARM_UI_PREFERENCES,
        isSfxMuted: legacySfx === 'true',
      };
    }

    const parsed = JSON.parse(raw);
    const validTheme: FarmTheme = parsed.theme === 'NIGHT' ? 'NIGHT' : 'DAY';

    return {
      theme: validTheme,
      isAudioEnabled: Boolean(parsed.isAudioEnabled),
      audioVolume:
        typeof parsed.audioVolume === 'number' && parsed.audioVolume >= 0 && parsed.audioVolume <= 1
          ? parsed.audioVolume
          : DEFAULT_FARM_UI_PREFERENCES.audioVolume,
      isSfxMuted: Boolean(parsed.isSfxMuted),
      cameraZoom:
        typeof parsed.cameraZoom === 'number' && parsed.cameraZoom >= 0.35 && parsed.cameraZoom <= 2.0
          ? parsed.cameraZoom
          : undefined,
      cameraScrollX: typeof parsed.cameraScrollX === 'number' ? parsed.cameraScrollX : undefined,
      cameraScrollY: typeof parsed.cameraScrollY === 'number' ? parsed.cameraScrollY : undefined,
      prefersFullscreen: Boolean(parsed.prefersFullscreen),
      lastUpdated: parsed.lastUpdated || Date.now(),
    };
  } catch (e) {
    console.warn('[FarmPreferences] Failed to read from localStorage:', e);
    return { ...DEFAULT_FARM_UI_PREFERENCES };
  }
}

/**
 * Cập nhật và lưu một phần hoặc toàn bộ UI preferences vào localStorage.
 * Đồng thời phát custom event để các component lắng nghe cập nhật tức thì.
 */
export function saveFarmUIPreferences(partial: Partial<FarmUIPreferences>): FarmUIPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_FARM_UI_PREFERENCES, ...partial };
  }

  try {
    const current = getFarmUIPreferences();
    const updated: FarmUIPreferences = {
      ...current,
      ...partial,
      lastUpdated: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Đồng bộ legacy key cho FarmSoundManager
    if (partial.isSfxMuted !== undefined) {
      localStorage.setItem('avora_farm_sfx_muted', String(partial.isSfxMuted));
    }

    // Phát custom event
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: updated,
      })
    );

    return updated;
  } catch (e) {
    console.warn('[FarmPreferences] Failed to write to localStorage:', e);
    return { ...DEFAULT_FARM_UI_PREFERENCES, ...partial };
  }
}

/**
 * Đăng ký lắng nghe thay đổi UI preferences từ các component khác hoặc tab khác.
 */
export function subscribeFarmUIPreferences(
  callback: (prefs: FarmUIPreferences) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<FarmUIPreferences>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch {}
    }
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
