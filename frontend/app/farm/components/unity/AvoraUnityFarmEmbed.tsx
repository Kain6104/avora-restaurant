'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AvoraUnityFarmEmbedProps {
  unityBuildPath?: string;
  onCurrencySync?: (coins: number, points: number) => void;
  onVoucherRedeemed?: (voucherCode: string, title: string) => void;
}

declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: any,
      onProgress?: (progress: number) => void
    ) => Promise<any>;
    unityInstance?: any;
    AvoraFarmHost?: {
      onFarmReady?: () => void;
      onSyncCurrency?: (coins: number, points: number) => void;
      onVoucherRedeemed?: (data: { voucherCode: string; title: string; redirectPath: string }) => void;
      navigateTo?: (path: string) => void;
    };
  }
}

export default function AvoraUnityFarmEmbed({
  unityBuildPath = '/unity-farm',
  onCurrencySync,
  onVoucherRedeemed,
}: AvoraUnityFarmEmbedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const router = useRouter();
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isUnityLoaded, setIsUnityLoaded] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gửi thông tin Auth sang Unity 6 _FarmManager
  const sendAuthToUnity = useCallback(async (unityInst: any) => {
    try {
      let userProfile = null;
      let token = '';

      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          userProfile = data.user || data.data || data;
          token = data.accessToken || data.token || '';
        }
      } catch (err) {
        console.warn('[AvoraUnityFarm] Không lấy được auth session online, dùng session dự phòng:', err);
      }

      const authPayload = {
        userId: userProfile?.id || 'usr_avora_web',
        secureToken: token,
        apiBaseUrl: window.location.origin + '/api',
        userProfile: userProfile ? {
          id: userProfile.id,
          fullName: userProfile.fullName || userProfile.name || 'AVORA Member',
          username: userProfile.username || 'AVORA',
          avatarUrl: userProfile.avatarUrl || '',
          points: userProfile.points || 320,
          currentPoints: userProfile.points || 320,
          membershipTierId: userProfile.tier || 'DIAMOND',
          memberCode: userProfile.memberCode || 'AVR-8899',
        } : null
      };

      console.log('[AvoraUnityFarm] Truyền Auth Payload vào Unity 6 _FarmManager:', authPayload);
      unityInst.SendMessage('_FarmManager', 'ReceiveAuthToken', JSON.stringify(authPayload));
    } catch (e) {
      console.error('[AvoraUnityFarm] Lỗi truyền Auth sang Unity:', e);
    }
  }, []);

  useEffect(() => {
    // 1. Đăng ký Web Bridge Hooks cho Unity gọi ra Javascript
    window.AvoraFarmHost = {
      onFarmReady: () => {
        console.log('[AvoraWebBridge] Unity Farm đã sẵn sàng!');
        if (window.unityInstance) {
          sendAuthToUnity(window.unityInstance);
        }
      },
      onSyncCurrency: (coins: number, points: number) => {
        if (onCurrencySync) onCurrencySync(coins, points);
        window.dispatchEvent(new CustomEvent('avora:header:sync', { detail: { coins, points } }));
      },
      onVoucherRedeemed: (data) => {
        toast.success(`🎉 Đã đổi thành công mã: ${data.voucherCode} (${data.title})`, { duration: 5000 });
        if (onVoucherRedeemed) onVoucherRedeemed(data.voucherCode, data.title);
      },
      navigateTo: (path: string) => {
        router.push(path);
      }
    };

    const handleCropHarvested = (e: any) => {
      console.log('[AvoraWebBridge] Event crop_harvested:', e.detail);
    };

    window.addEventListener('avora:farm:crop_harvested', handleCropHarvested);

    // 2. Tải Loader Script của Unity 6 WebGL
    const loaderUrl = `${unityBuildPath}/Build/unity-farm.loader.js`;
    let scriptElement: HTMLScriptElement | null = document.querySelector(`script[src="${loaderUrl}"]`);

    const initUnity = () => {
      if (!canvasRef.current || !window.createUnityInstance) return;

      const buildUrl = `${unityBuildPath}/Build`;
      const config = {
        dataUrl: `${buildUrl}/unity-farm.data`,
        frameworkUrl: `${buildUrl}/unity-farm.framework.js`,
        codeUrl: `${buildUrl}/unity-farm.wasm`,
        streamingAssetsUrl: "StreamingAssets",
        companyName: "AVORA Restaurant",
        productName: "AVORA Farm",
        productVersion: "1.0.0",
      };

      window.createUnityInstance(canvasRef.current, config, (progress: number) => {
        setLoadingProgress(Math.round(progress * 100));
      })
      .then((instance: any) => {
        window.unityInstance = instance;
        setIsUnityLoaded(true);
        sendAuthToUnity(instance);
      })
      .catch((err: any) => {
        console.error('[AvoraUnityFarm] Khởi tạo Unity WebGL lỗi:', err);
        setErrorMessage('Chưa tìm thấy bản build WebGL trong /unity-farm hoặc trình duyệt chưa bật WebGL.');
      });
    };

    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.src = loaderUrl;
      scriptElement.async = true;
      scriptElement.onload = () => {
        initUnity();
      };
      scriptElement.onerror = () => {
        setErrorMessage('Chưa có bản build WebGL tại /unity-farm. Hãy dùng menu Unity "AVORA Farm -> 3. Build WebGL Directly to avora-restaurant" để xuất bản!');
      };
      document.body.appendChild(scriptElement);
    } else if (window.createUnityInstance) {
      initUnity();
    }

    return () => {
      window.removeEventListener('avora:farm:crop_harvested', handleCropHarvested);
      delete window.AvoraFarmHost;
    };
  }, [unityBuildPath, sendAuthToUnity, onCurrencySync, onVoucherRedeemed, router]);

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-[#0c120f] overflow-hidden flex flex-col items-center justify-center">
      {/* Khung Canvas Game Unity 6 */}
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        className="w-full h-full block touch-none outline-none focus:outline-none"
        tabIndex={-1}
        style={{
          width: '100%',
          height: '100%',
          opacity: isUnityLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Màn hình Loading mượt mà khi Unity 6 WebAssembly đang tải */}
      {!isUnityLoaded && !errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1611] text-white z-20">
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="w-full h-full border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
            <span className="absolute text-2xl">🌱</span>
          </div>

          <h2 className="text-xl font-bold tracking-wider text-amber-200">
            AVORA FARM — UNITY 6 2D URP
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Đang tải dữ liệu thế giới nông trại trên mây ({loadingProgress}%)...
          </p>

          <div className="w-64 h-2 bg-slate-800 rounded-full mt-4 overflow-hidden border border-amber-500/30">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Thông báo hướng dẫn nếu chưa build WebGL */}
      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1611]/95 text-white p-6 text-center z-30">
          <div className="text-4xl mb-4">🎮</div>
          <h3 className="text-lg font-bold text-amber-300 mb-2">
            Sẵn sàng kết nối Unity 6 WebGL
          </h3>
          <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
            {errorMessage}
          </p>
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 text-xs text-left max-w-md font-mono text-amber-200/90 mb-4">
            1. Mở Unity 6 Editor (Dự án: E:\AvoraFarm\AvoraFarm)<br/>
            2. Chọn Menu: <b>AVORA Farm -&gt; 3. Build WebGL Directly to avora-restaurant</b><br/>
            3. Quay lại trình duyệt và tải lại trang này!
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            Tải lại trang
          </button>
        </div>
      )}
    </div>
  );
}

