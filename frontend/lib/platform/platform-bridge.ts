/**
 * AVORA Platform Bridge Abstraction (Directives 14, 18, 19, 27, 28)
 * Seamless bridge enabling 100% identical /admin/pos React code across:
 * 1. Standard Web Browser (Next.js)
 * 2. Windows Native Desktop App (WebView2 + C# Native Core)
 */

export interface UpdateManifestInfo {
  version: string;
  build: number;
  releaseDate: string;
  updateType: 'OPTIONAL' | 'RECOMMENDED' | 'MANDATORY';
  minimumSupportedVersion: string;
  downloadUrl: string;
  sha256?: string;
  fileSize?: number;
  releaseNotes: string[];
}

export interface UpdateCheckResultInfo {
  success: boolean;
  updateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string;
  currentBuild: number;
  manifest?: UpdateManifestInfo;
  error?: string;
}

export interface IPlatformBridge {
  readonly isDesktop: boolean;
  readonly platformName: 'DESKTOP_WINDOWS' | 'WEB_BROWSER';
  getVersion(): string;
  getBuild?(): number;
  setFullScreen(fullscreen: boolean): void;
  openExternalBrowser(url: string): void;
  logout?(): Promise<void>;
  checkUpdate?(): Promise<UpdateCheckResultInfo>;
  downloadUpdate?(manifest: UpdateManifestInfo): Promise<{ success: boolean; filePath?: string; error?: string }>;
  applyUpdate?(installerPath: string): Promise<void>;
  guidePinToTaskbar?(): Promise<{ success: boolean; message?: string }>;
  requestDesktopLaunchCode?(): Promise<{ success: boolean; code?: string; expiresIn?: number; error?: string }>;
  openDesktopWithLaunchCode?(code: string): void;
  exitApp?(): Promise<void>;
}

type NativeHostCallable = (arg?: string) => Promise<string | Record<string, unknown>>;
type NativeHostBridge = Record<string, NativeHostCallable>;

declare global {
  interface Window {
    IS_AVORA_DESKTOP?: boolean;
    AVORA_DESKTOP_VERSION?: string;
    chrome?: {
      webview?: {
        hostObjects?: {
          nativePrintService?: unknown;
          syncService?: unknown;
        };
      };
    };
  }
}

class DesktopPlatformBridge implements IPlatformBridge {
  public readonly isDesktop = true;
  public readonly platformName = 'DESKTOP_WINDOWS' as const;

  private get nativeBridge(): NativeHostBridge | null {
    if (typeof window !== 'undefined' && window.chrome?.webview?.hostObjects?.nativePrintService) {
      return window.chrome.webview.hostObjects.nativePrintService as unknown as NativeHostBridge;
    }
    return null;
  }

  public getVersion(): string {
    if (typeof window !== 'undefined' && window.AVORA_DESKTOP_VERSION) {
      return window.AVORA_DESKTOP_VERSION;
    }
    return '1.0.1';
  }

  public getBuild(): number {
    if (typeof window !== 'undefined' && (window as any).AVORA_DESKTOP_BUILD) {
      return parseInt((window as any).AVORA_DESKTOP_BUILD, 10) || 101;
    }
    return 101;
  }

  public setFullScreen(fullscreen: boolean): void {
    if (typeof document === 'undefined') return;
    if (fullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }

  public openExternalBrowser(url: string): void {
    let fullUrl = url;
    if (typeof window !== 'undefined' && !url.startsWith('http://') && !url.startsWith('https://')) {
      try {
        fullUrl = new URL(url, window.location.origin).href;
      } catch {
        fullUrl = `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
      }
    }

    // 1. Post message to WebView2
    try {
      if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
        (window as any).chrome.webview.postMessage({ type: 'OPEN_EXTERNAL', url: fullUrl });
      }
    } catch {}

    // 2. Call host object
    try {
      const bridge = this.nativeBridge;
      if (bridge && typeof bridge.OpenExternalBrowser === 'function') {
        bridge.OpenExternalBrowser(fullUrl);
        return;
      }
    } catch {}

    // 3. Try Local HTTP bridge if on desktop
    fetch('http://127.0.0.1:9123/api/open-browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fullUrl }),
    }).catch(() => {
      if (typeof window !== 'undefined') window.open(fullUrl, '_blank');
    });
  }

  public async logout(): Promise<void> {
    // 1. Post message to WebView2
    try {
      if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
        (window as any).chrome.webview.postMessage({ type: 'LOGOUT' });
      }
    } catch {}

    // 2. Call host object
    try {
      const bridge = this.nativeBridge;
      if (bridge && typeof bridge.RequestLogout === 'function') {
        await bridge.RequestLogout();
        return;
      }
    } catch (err) {
      console.error('Failed to invoke desktop RequestLogout:', err);
    }

    // 3. Fallback via local HTTP bridge
    try {
      await fetch('http://127.0.0.1:9123/api/logout', { method: 'POST' });
    } catch {}
  }

  public async exitApp(): Promise<void> {
    // 1. Call injected window.AVORA_EXIT_APP
    try {
      if (typeof window !== 'undefined' && typeof (window as any).AVORA_EXIT_APP === 'function') {
        (window as any).AVORA_EXIT_APP();
        return;
      }
    } catch {}

    // 2. Post message to WebView2
    try {
      if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
        (window as any).chrome.webview.postMessage({ type: 'EXIT_APP' });
        return;
      }
    } catch {}

    // 3. Call host object
    try {
      const bridge = this.nativeBridge;
      if (bridge) {
        await (bridge as any).RequestAppExit?.();
        return;
      }
    } catch (err) {
      console.error('Failed to invoke desktop RequestAppExit:', err);
    }

    // 4. Fallback via local HTTP bridge
    try {
      await fetch('http://127.0.0.1:9123/api/exit', { method: 'POST' });
    } catch {}
  }

  public async checkUpdate(): Promise<UpdateCheckResultInfo> {
    const bridge = this.nativeBridge;
    if (bridge && typeof bridge.CheckUpdateJson === 'function') {
      try {
        const res = await bridge.CheckUpdateJson();
        return typeof res === 'string' ? JSON.parse(res) : (res as unknown as UpdateCheckResultInfo);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra cập nhật';
        return { success: false, updateAvailable: false, isMandatory: false, currentVersion: this.getVersion(), currentBuild: 100, error: msg };
      }
    }

    // HTTP fallback to backend
    try {
      const res = await fetch('/api/pos-desktop/update/latest');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest: UpdateManifestInfo = await res.json();
      return {
        success: true,
        updateAvailable: manifest.version !== this.getVersion(),
        isMandatory: manifest.updateType === 'MANDATORY',
        currentVersion: this.getVersion(),
        currentBuild: 100,
        manifest,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ';
      return { success: false, updateAvailable: false, isMandatory: false, currentVersion: this.getVersion(), currentBuild: 100, error: msg };
    }
  }

  public async downloadUpdate(manifest: UpdateManifestInfo): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const bridge = this.nativeBridge;
    if (bridge && typeof bridge.DownloadUpdateJson === 'function') {
      try {
        const res = await bridge.DownloadUpdateJson(JSON.stringify(manifest));
        return typeof res === 'string' ? JSON.parse(res) : (res as unknown as { success: boolean; filePath?: string; error?: string });
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'Lỗi tải bản cập nhật' };
      }
    }
    return { success: false, error: 'Không hỗ trợ tải trực tiếp qua trình duyệt' };
  }

  public async applyUpdate(installerPath: string): Promise<void> {
    const bridge = this.nativeBridge;
    if (bridge && typeof bridge.ApplyUpdate === 'function') {
      await bridge.ApplyUpdate(installerPath);
    }
  }

  public async guidePinToTaskbar(): Promise<{ success: boolean; message?: string }> {
    const bridge = this.nativeBridge;
    if (bridge && typeof bridge.GuidePinToTaskbar === 'function') {
      const res = await bridge.GuidePinToTaskbar();
      return typeof res === 'string' ? JSON.parse(res) : (res as unknown as { success: boolean; message?: string });
    }
    return {
      success: true,
      message: 'Nhấp chuột phải vào biểu tượng AVORA POS trên màn hình Desktop -> Chọn "Ghim vào thanh tác vụ" (Pin to Taskbar).'
    };
  }
}

class WebPlatformBridge implements IPlatformBridge {
  public readonly isDesktop = false;
  public readonly platformName = 'WEB_BROWSER' as const;

  public getVersion(): string {
    return 'Web-1.0';
  }

  public setFullScreen(fullscreen: boolean): void {
    if (typeof document === 'undefined') return;
    if (fullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }

  public openExternalBrowser(url: string): void {
    window.open(url, '_blank');
  }

  public async logout(): Promise<void> {
    // Web handles logout through normal web router flow
  }

  public async exitApp(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.close();
    }
  }

  public async checkUpdate(): Promise<UpdateCheckResultInfo> {
    return {
      success: true,
      updateAvailable: false,
      isMandatory: false,
      currentVersion: 'Web-Latest',
      currentBuild: 100,
    };
  }

  public async requestDesktopLaunchCode(): Promise<{ success: boolean; code?: string; expiresIn?: number; error?: string }> {
    try {
      const res = await fetch('/api/auth/desktop/launch-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.message || 'Không thể tạo mã đăng nhập Desktop',
        };
      }
      return {
        success: true,
        code: data.code,
        expiresIn: data.expiresIn || 60,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Lỗi kết nối máy chủ',
      };
    }
  }

  public openDesktopWithLaunchCode(code: string): void {
    if (typeof window === 'undefined') return;
    const protocolUrl = `avora-pos://open?code=${encodeURIComponent(code)}`;
    window.location.href = protocolUrl;
  }
}

let desktopBridgeInstance: IPlatformBridge | null = null;
let webBridgeInstance: IPlatformBridge | null = null;

export function getPlatformBridge(): IPlatformBridge {
  const isDesktop =
    typeof window !== 'undefined' &&
    (window.IS_AVORA_DESKTOP === true ||
      Boolean(window.chrome?.webview?.hostObjects?.nativePrintService));

  if (isDesktop) {
    if (!desktopBridgeInstance) desktopBridgeInstance = new DesktopPlatformBridge();
    return desktopBridgeInstance;
  }

  if (!webBridgeInstance) webBridgeInstance = new WebPlatformBridge();
  return webBridgeInstance;
}

class PlatformBridgeProxy implements IPlatformBridge {
  private get active(): IPlatformBridge {
    return getPlatformBridge();
  }

  get isDesktop(): boolean {
    return this.active.isDesktop;
  }

  get platformName(): 'DESKTOP_WINDOWS' | 'WEB_BROWSER' {
    return this.active.platformName;
  }

  getVersion(): string {
    return this.active.getVersion();
  }

  getBuild(): number {
    return this.active.getBuild ? this.active.getBuild!() : 101;
  }

  setFullScreen(fullscreen: boolean): void {
    this.active.setFullScreen(fullscreen);
  }

  openExternalBrowser(url: string): void {
    this.active.openExternalBrowser(url);
  }

  logout(): Promise<void> {
    return this.active.logout ? this.active.logout() : Promise.resolve();
  }

  checkUpdate(): Promise<UpdateCheckResultInfo> {
    return this.active.checkUpdate
      ? this.active.checkUpdate()
      : Promise.resolve({ success: false, updateAvailable: false, isMandatory: false, currentVersion: '1.0.0', currentBuild: 100 });
  }

  downloadUpdate(manifest: UpdateManifestInfo): Promise<{ success: boolean; filePath?: string; error?: string }> {
    return this.active.downloadUpdate
      ? this.active.downloadUpdate(manifest)
      : Promise.resolve({ success: false, error: 'Không hỗ trợ trên nền tảng này' });
  }

  applyUpdate(installerPath: string): Promise<void> {
    return this.active.applyUpdate ? this.active.applyUpdate(installerPath) : Promise.resolve();
  }

  guidePinToTaskbar(): Promise<{ success: boolean; message?: string }> {
    return this.active.guidePinToTaskbar
      ? this.active.guidePinToTaskbar()
      : Promise.resolve({ success: true });
  }

  requestDesktopLaunchCode(): Promise<{ success: boolean; code?: string; expiresIn?: number; error?: string }> {
    return this.active.requestDesktopLaunchCode
      ? this.active.requestDesktopLaunchCode()
      : Promise.resolve({ success: false, error: 'Chỉ hỗ trợ trên trình duyệt web' });
  }

  openDesktopWithLaunchCode(code: string): void {
    this.active.openDesktopWithLaunchCode?.(code);
  }

  exitApp(): Promise<void> {
    return this.active.exitApp ? this.active.exitApp() : Promise.resolve();
  }
}

export const platformBridge: IPlatformBridge = new PlatformBridgeProxy();
