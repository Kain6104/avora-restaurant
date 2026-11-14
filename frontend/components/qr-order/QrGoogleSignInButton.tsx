'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { QrGoogleAuthConfig, QrGuest } from './qr-types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface QrGoogleSignInButtonProps {
  token: string;
  deviceSessionId: string;
  onSuccess: (guest: QrGuest) => void;
  disabled?: boolean;
  label?: string;
}

export const QrGoogleSignInButton: React.FC<QrGoogleSignInButtonProps> = ({
  token,
  deviceSessionId,
  onSuccess,
  disabled = false,
  label = 'Đăng nhập bằng Google',
}) => {
  const [config, setConfig] = useState<QrGoogleAuthConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [gisRendered, setGisRendered] = useState(false);
  const gisContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      try {
        const res = await fetch(`/api/qr-order/${token}/auth/google-config`);
        const data = await res.json();
        if (active && res.ok && data?.success) {
          setConfig({
            enabled: Boolean(data.enabled),
            clientId: data.clientId || null,
            oauthRedirectPath: data.oauthRedirectPath || '/api/auth/google',
          });
        }
      } catch {
        if (active) setConfig(null);
      } finally {
        if (active) setIsLoadingConfig(false);
      }
    };
    loadConfig();
    return () => {
      active = false;
    };
  }, [token]);

  const handleCredential = useCallback(
    async (idToken: string) => {
      if (!idToken || isAuthenticating) return;
      setIsAuthenticating(true);
      try {
        const res = await fetch(`/api/qr-order/${token}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            idToken,
            deviceSessionId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.guest) {
          throw new Error(data.message || data.error?.message || 'Đăng nhập Google thất bại');
        }

        const guestData: QrGuest = {
          id: data.guest.id,
          guestName: data.guest.guestName,
          userId: data.guest.userId ?? data.guest.user?.id ?? null,
          deviceSessionId: data.guest.deviceSessionId || deviceSessionId,
          memberVerified: Boolean(data.guest.memberVerified ?? true),
          user: data.guest.user ?? null,
        };
        toast.success(data.message || 'Đã liên kết tài khoản Google thành công!');
        onSuccess(guestData);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Không thể đăng nhập bằng Google');
      } finally {
        setIsAuthenticating(false);
      }
    },
    [deviceSessionId, isAuthenticating, onSuccess, token]
  );

  const handleCredentialRef = useRef(handleCredential);
  useEffect(() => {
    handleCredentialRef.current = handleCredential;
  }, [handleCredential]);

  useEffect(() => {
    if (!config?.enabled || !config.clientId || disabled) return;

    let cancelled = false;
    const clientId = config.clientId;

    const initGis = () => {
      if (cancelled || !window.google?.accounts?.id || !gisContainerRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            if (resp?.credential) {
              void handleCredentialRef.current(resp.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        gisContainerRef.current.innerHTML = '';
        const containerWidth = Math.min(340, Math.max(240, gisContainerRef.current.clientWidth || 300));
        window.google.accounts.id.renderButton(gisContainerRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: containerWidth,
          locale: 'vi',
        });
        setGisRendered(true);
      } catch {
        setGisRendered(false);
      }
    };

    if (window.google?.accounts?.id) {
      initGis();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-avora-gis="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', initGis);
      return () => {
        cancelled = true;
        existingScript.removeEventListener('load', initGis);
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-avora-gis', 'true');
    script.onload = initGis;
    script.onerror = () => {
      if (!cancelled) setGisRendered(false);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [config?.enabled, config?.clientId, disabled]);

  const handleOAuthRedirect = () => {
    if (!config?.oauthRedirectPath || disabled || isAuthenticating) return;
    const returnPath = `/qr/${token}?googleAuth=1`;
    window.location.href = `${config.oauthRedirectPath}?redirectURL=${encodeURIComponent(returnPath)}`;
  };

  if (isLoadingConfig || !config?.enabled || !config.clientId) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Official Google Identity Services button (renders cleanly on standard mobile/desktop browsers) */}
      <div className="relative">
        <div
          ref={gisContainerRef}
          className={`flex justify-center overflow-hidden rounded-xl ${
            gisRendered ? 'min-h-[42px]' : 'hidden'
          } ${isAuthenticating || disabled ? 'opacity-50 pointer-events-none' : ''}`}
        />

        {isAuthenticating && (
          <div className="mt-2 h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-[#DA251D]" />
            <span>Đang xác thực tài khoản Google...</span>
          </div>
        )}
      </div>

      {/* Direct OAuth redirect fallback for Safari/iOS WebViews or when GIS iframe is blocked */}
      {!gisRendered ? (
        <button
          type="button"
          onClick={handleOAuthRedirect}
          disabled={disabled || isAuthenticating}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 px-4 flex items-center justify-center gap-2.5 text-xs font-bold text-slate-800 transition-all cursor-pointer"
        >
          <GoogleMarkSvg />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOAuthRedirect}
          disabled={disabled || isAuthenticating}
          className="w-full text-[11px] text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 py-1 cursor-pointer"
        >
          <span>Đăng nhập bằng Google</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

const GoogleMarkSvg: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.08.72-2.46 1.15-4.23 1.15-3.25 0-6.01-2.19-7-5.14H1.01v3.14C3.03 21.14 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5 14c-.25-.72-.39-1.49-.39-2.28s.14-1.56.39-2.28V6.3H1.01A11.96 11.96 0 0 0 0 11.72c0 1.93.46 3.75 1.01 5.42L5 14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.58c1.79 0 3.4.62 4.67 1.83l3.5-3.5C18.07 1.02 15.3 0 12 0 7.21 0 3.03 2.86 1.01 6.86L5 10c.99-2.95 3.75-5.42 7-5.42Z"
    />
  </svg>
);

