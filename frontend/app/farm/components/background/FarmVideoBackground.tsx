'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { FarmTheme } from '../../utils/farmPreferences';

interface FarmVideoBackgroundProps {
  theme: FarmTheme;
  isAudioEnabled: boolean;
  audioVolume?: number;
  onVideoReady?: () => void;
}

const DAY_VIDEO = '/game/farm/backgrounds/avora-farm-day-loop.mp4';
const NIGHT_VIDEO = '/game/farm/backgrounds/avora-farm-day-loop_night.mp4';

const DAY_POSTER = '/game/farm/backgrounds/avora-farm-day.webp';
const NIGHT_POSTER = '/game/farm/backgrounds/avora-farm-night.webp';

/**
 * FarmVideoBackground
 * Kiến trúc Double-Buffer Video Background siêu mượt và chống nhảy theme:
 * - 2 Video Layer (A & B) độc lập, hoán đổi qua crossfade.
 * - CẢ HAI LAYER LUÔN LUÔN đồng bộ cùng một theme (DAY hoặc NIGHT).
 * - Tuyệt đối không để Layer A giữ Day còn Layer B giữ Night khiến ping-pong bị đổi sáng tối liên tục.
 * - Ping-pong loop seamless ở giây thứ 9.4 -> 10.0 xóa bỏ hoàn toàn điểm nối giật/khựng.
 * - Quản lý visibility (pause khi ẩn tab, resume đúng timestamp khi quay lại).
 * - Fallback ảnh tĩnh chất lượng cao tương ứng khi mạng yếu hoặc trình duyệt lỗi codec.
 */
function FarmVideoBackgroundComponent({
  theme,
  isAudioEnabled,
  audioVolume = 0.6,
  onVideoReady,
}: FarmVideoBackgroundProps) {
  const targetVideo = theme === 'NIGHT' ? NIGHT_VIDEO : DAY_VIDEO;
  const currentPoster = theme === 'NIGHT' ? NIGHT_POSTER : DAY_POSTER;

  // Layer A và Layer B refs
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);

  // Lưu theme hiện tại vào ref để hàm loop kiểm tra đồng bộ tức thì
  const themeRef = useRef<FarmTheme>(theme);
  themeRef.current = theme;

  // Active layer: 'A' | 'B'
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const activeLayerRef = useRef<'A' | 'B'>('A');
  activeLayerRef.current = activeLayer;

  // Opacity của 2 layer (điều khiển crossfade)
  const [opacityA, setOpacityA] = useState(1);
  const [opacityB, setOpacityB] = useState(0);

  // Nguồn video của từng layer - Luôn khởi tạo theo theme hiện tại
  const [srcA, setSrcA] = useState(targetVideo);
  const [srcB, setSrcB] = useState(targetVideo);

  // Fallback poster khi video lỗi
  const [videoError, setVideoError] = useState(false);

  // Trạng thái chuyển đổi theme hoặc loop
  const isThemeTransitioningRef = useRef(false);
  const isLoopTransitioningRef = useRef(false);
  const themeTransitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loopTransitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loopIntervalRef = useRef<number | null>(null);
  const wasPlayingBeforeHiddenRef = useRef(false);
  const hasTriggeredInitialReadyRef = useRef(false);

  // Thông báo Video đã sẵn sàng cho BootLoader
  const notifyReady = useCallback(() => {
    if (!hasTriggeredInitialReadyRef.current) {
      hasTriggeredInitialReadyRef.current = true;
      if (onVideoReady) {
        onVideoReady();
      }
    }
  }, [onVideoReady]);

  // =========================================================================
  // 1. KHỞI TẠO AUDIO KHI MOUNT HOẶC THAY ĐỔI SETTINGS
  // =========================================================================
  useEffect(() => {
    const activeVideo = activeLayerRef.current === 'A' ? videoRefA.current : videoRefB.current;
    if (activeVideo) {
      activeVideo.muted = !isAudioEnabled;
      activeVideo.volume = audioVolume;
      if (isAudioEnabled && activeVideo.paused) {
        activeVideo.play().catch(() => {});
      }
    }
  }, [isAudioEnabled, audioVolume]);

  // =========================================================================
  // 2. CHUYỂN ĐỔI THEME VỚI DOUBLE-BUFFER & PRELOAD (DAY ↔ NIGHT)
  // =========================================================================
  useEffect(() => {
    const currentActive = activeLayerRef.current;
    const activeVideo = currentActive === 'A' ? videoRefA.current : videoRefB.current;
    const standbyVideo = currentActive === 'A' ? videoRefB.current : videoRefA.current;

    // Kiểm tra xem active video đã đúng theme mới chưa
    if (activeVideo && activeVideo.src && activeVideo.src.endsWith(targetVideo)) {
      // Đã đúng theme, chỉ cần đảm bảo standby cũng cùng theme
      if (standbyVideo && (!standbyVideo.src || !standbyVideo.src.endsWith(targetVideo))) {
        standbyVideo.src = targetVideo;
        standbyVideo.load();
      }
      return;
    }

    if (!standbyVideo) return;

    // Hủy các timer chuyển đổi đang chờ
    if (themeTransitionTimerRef.current) {
      clearTimeout(themeTransitionTimerRef.current);
      themeTransitionTimerRef.current = null;
    }
    if (loopTransitionTimerRef.current) {
      clearTimeout(loopTransitionTimerRef.current);
      loopTransitionTimerRef.current = null;
    }
    isLoopTransitioningRef.current = false;
    isThemeTransitioningRef.current = true;

    // Đặt source cho Standby Layer sang theme mới
    standbyVideo.src = targetVideo;
    standbyVideo.muted = !isAudioEnabled;
    standbyVideo.volume = audioVolume;
    standbyVideo.currentTime = 0;
    standbyVideo.load();

    if (currentActive === 'A') {
      setSrcB(targetVideo);
    } else {
      setSrcA(targetVideo);
    }

    let isExecuted = false;
    const executeThemeCrossfade = () => {
      if (isExecuted) return;
      isExecuted = true;

      standbyVideo
        .play()
        .then(() => {
          // Crossfade opacity mượt mà trong 800ms
          if (currentActive === 'A') {
            setOpacityB(1);
            setOpacityA(0);
          } else {
            setOpacityA(1);
            setOpacityB(0);
          }

          themeTransitionTimerRef.current = setTimeout(() => {
            if (activeVideo) {
              activeVideo.pause();
              activeVideo.currentTime = 0;
              // QUAN TRỌNG: Cập nhật activeVideo cũ sang cùng targetVideo để vòng lặp sau không bị lệch theme!
              activeVideo.src = targetVideo;
              activeVideo.load();
            }

            const nextActive = currentActive === 'A' ? 'B' : 'A';
            setActiveLayer(nextActive);
            activeLayerRef.current = nextActive;
            setSrcA(targetVideo);
            setSrcB(targetVideo);
            isThemeTransitioningRef.current = false;
            notifyReady();
          }, 850);
        })
        .catch((err) => {
          console.warn('[FarmVideoBackground] Play failed on standby layer:', err);
          const nextActive = currentActive === 'A' ? 'B' : 'A';
          setActiveLayer(nextActive);
          activeLayerRef.current = nextActive;
          isThemeTransitioningRef.current = false;
          notifyReady();
        });
    };

    standbyVideo.addEventListener('canplay', executeThemeCrossfade, { once: true });
    standbyVideo.addEventListener('playing', executeThemeCrossfade, { once: true });

    const safetyTimer = setTimeout(() => {
      if (!isExecuted) {
        executeThemeCrossfade();
      }
    }, 2000);

    return () => {
      clearTimeout(safetyTimer);
      standbyVideo.removeEventListener('canplay', executeThemeCrossfade);
      standbyVideo.removeEventListener('playing', executeThemeCrossfade);
    };
  }, [targetVideo, isAudioEnabled, audioVolume, notifyReady]);

  // =========================================================================
  // 3. SEAMLESS PING-PONG LOOP GIỮA 2 LAYER (CÙNG CHUNG 1 THEME)
  // =========================================================================
  useEffect(() => {
    const checkLoopTransition = () => {
      // Đang chuyển theme hoặc đang crossfade loop thì bỏ qua
      if (isThemeTransitioningRef.current || isLoopTransitioningRef.current) return;

      const currentActive = activeLayerRef.current;
      const activeVideo = currentActive === 'A' ? videoRefA.current : videoRefB.current;
      const standbyVideo = currentActive === 'A' ? videoRefB.current : videoRefA.current;

      if (!activeVideo || !standbyVideo) return;
      if (activeVideo.paused || !activeVideo.duration || isNaN(activeVideo.duration)) return;

      const currentTarget = themeRef.current === 'NIGHT' ? NIGHT_VIDEO : DAY_VIDEO;

      // Khi video đang phát gần hết (còn lại 0.6s trước khi kết thúc)
      const timeLeft = activeVideo.duration - activeVideo.currentTime;
      if (timeLeft <= 0.6 && timeLeft > 0.05) {
        isLoopTransitioningRef.current = true;

        // BẢO VỆ TUYỆT ĐỐI: Standby layer PHẢI cùng nguồn video với theme hiện tại
        if (!standbyVideo.src || !standbyVideo.src.endsWith(currentTarget)) {
          standbyVideo.src = currentTarget;
          standbyVideo.load();
        }

        standbyVideo.currentTime = 0;
        standbyVideo.muted = !isAudioEnabled;
        standbyVideo.volume = audioVolume;

        standbyVideo
          .play()
          .then(() => {
            // Crossfade 500ms giữa 2 layer cùng theme để xóa sạch vết giật khựng
            if (currentActive === 'A') {
              setOpacityB(1);
              setOpacityA(0);
            } else {
              setOpacityA(1);
              setOpacityB(0);
            }

            loopTransitionTimerRef.current = setTimeout(() => {
              if (activeVideo) {
                activeVideo.pause();
                activeVideo.currentTime = 0;
              }
              const nextActive = currentActive === 'A' ? 'B' : 'A';
              setActiveLayer(nextActive);
              activeLayerRef.current = nextActive;
              isLoopTransitioningRef.current = false;
            }, 550);
          })
          .catch(() => {
            // Nếu standby không play được, fallback reset active video
            isLoopTransitioningRef.current = false;
            if (activeVideo.currentTime >= activeVideo.duration - 0.1) {
              activeVideo.currentTime = 0;
            }
          });
      }
    };

    const interval = window.setInterval(checkLoopTransition, 150);
    loopIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      if (loopTransitionTimerRef.current) {
        clearTimeout(loopTransitionTimerRef.current);
      }
    };
  }, [isAudioEnabled, audioVolume]);

  // =========================================================================
  // 4. TAB VISIBILITY CHANGE (Tiết kiệm CPU/Pin khi ẩn tab)
  // =========================================================================
  useEffect(() => {
    const handleVisibility = () => {
      const activeVideo = activeLayerRef.current === 'A' ? videoRefA.current : videoRefB.current;
      if (!activeVideo) return;

      if (document.hidden) {
        if (!activeVideo.paused) {
          wasPlayingBeforeHiddenRef.current = true;
          activeVideo.pause();
        }
      } else {
        if (wasPlayingBeforeHiddenRef.current) {
          activeVideo.play().catch(() => {});
          wasPlayingBeforeHiddenRef.current = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Xử lý lỗi video -> Fallback sang poster
  const handleError = () => {
    console.warn('[FarmVideoBackground] Video load error, activating fallback image.');
    setVideoError(true);
    notifyReady();
  };

  return (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none select-none bg-[#111b15]">
      {/* 0. Fallback Poster Image Layer (Luôn nằm dưới cùng làm bệ đỡ) */}
      <img
        src={currentPoster}
        alt="AVORA Farm Background Poster"
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${
          videoError ? 'opacity-100' : 'opacity-90'
        }`}
      />

      {/* 1. Video Layer A (Double-buffered) */}
      <video
        ref={videoRefA}
        src={srcA}
        autoPlay
        playsInline
        preload="auto"
        muted={activeLayer !== 'A' || !isAudioEnabled}
        poster={currentPoster}
        onCanPlay={notifyReady}
        onError={handleError}
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none transition-opacity duration-800 ease-in-out will-change-[opacity]"
        style={{
          opacity: opacityA,
          visibility:
            opacityA === 0 && !isThemeTransitioningRef.current && !isLoopTransitioningRef.current
              ? 'hidden'
              : 'visible',
        }}
      />

      {/* 2. Video Layer B (Double-buffered) */}
      <video
        ref={videoRefB}
        src={srcB}
        autoPlay
        playsInline
        preload="auto"
        muted={activeLayer !== 'B' || !isAudioEnabled}
        poster={currentPoster}
        onCanPlay={notifyReady}
        onError={handleError}
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none transition-opacity duration-800 ease-in-out will-change-[opacity]"
        style={{
          opacity: opacityB,
          visibility:
            opacityB === 0 && !isThemeTransitioningRef.current && !isLoopTransitioningRef.current
              ? 'hidden'
              : 'visible',
        }}
      />
    </div>
  );
}

/**
 * Sử dụng React.memo để ngăn ngừa triệt để việc background video bị rerender hay restart
 * khi các modal (Inventory, Shop, Album, Mail...) đóng/mở hoặc các HUD state khác thay đổi.
 */
export const FarmVideoBackground = React.memo(
  FarmVideoBackgroundComponent,
  (prev, next) =>
    prev.theme === next.theme &&
    prev.isAudioEnabled === next.isAudioEnabled &&
    prev.audioVolume === next.audioVolume
);

export default FarmVideoBackground;
