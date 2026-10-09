'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import FarmCanvas from './components/canvas/FarmCanvas';
import FarmHeaderHUD from './components/hud/FarmHeaderHUD';
import FarmBottomNav from './components/hud/FarmBottomNav';
import FarmBootLoader from './components/hud/FarmBootLoader';
import FarmQuickActions from './components/hud/FarmQuickActions';
import RotateScreen from './components/RotateScreen';
import MaintenanceScreen from './components/MaintenanceScreen';
import { useFarmDisplayMode } from './hooks/useFarmDisplayMode';

// Native Game Interaction UI (Chuẩn game app bản địa)
import GameToast from './components/game-ui/GameToast';
import PlotActionBubble from './components/game-ui/PlotActionBubble';
import SeedTray from './components/game-ui/SeedTray';
import CropInfoCard from './components/game-ui/CropInfoCard';
import FertilizerTray from './components/game-ui/FertilizerTray';
import UnlockLandPanel from './components/game-ui/UnlockLandPanel';
import GameConfirmPanel from './components/game-ui/GameConfirmPanel';
import FloatingExpOverlay from './components/game-ui/FloatingExpOverlay';
import LevelUpReveal from './components/game-ui/LevelUpReveal';
import FarmMarket from './components/game-ui/FarmMarket';
import QuestBoard from './components/game-ui/QuestBoard';
import { farmSound } from './game/services/FarmSoundManager';
import { Droplet } from 'lucide-react';
import MysteryCropReveal from './components/game-ui/MysteryCropReveal';

// System Overlays
import InventoryModal from './components/modals/InventoryModal';
import CollectionModal from './components/modals/CollectionModal';
import FriendsModal from './components/modals/FriendsModal';
import MutationRevealModal from './components/modals/MutationRevealModal';
import MissionsModal from './components/modals/MissionsModal';
import FarmLevelUpModal from './components/modals/FarmLevelUpModal';
import SeedInfoModal from './components/modals/SeedInfoModal';
import FarmTutorialModal from './components/modals/FarmTutorialModal';
import AvoraRewardsModal from './components/modals/AvoraRewardsModal';
import VisitFarmModal from './components/modals/VisitFarmModal';
import LuckyEnvelopeModal from './components/modals/LuckyEnvelopeModal';
import FarmHistoryModal from './components/modals/FarmHistoryModal';
import FarmMailboxModal from './components/modals/FarmMailboxModal';
import EnergyDetailModal from './components/modals/EnergyDetailModal';
import IOSFullscreenGuideModal from './components/modals/IOSFullscreenGuideModal';
import VisitHeaderHUD from './components/hud/VisitHeaderHUD';
import VisitBottomDock from './components/hud/VisitBottomDock';

import { farmEventBus } from './game/services/farmEventBus';
import { setDynamicAssetOverrides } from './game/services/PlantAssetResolver';
import type * as Phaser from 'phaser';

import FarmVideoBackground from './components/background/FarmVideoBackground';
import {
  getFarmUIPreferences,
  saveFarmUIPreferences,
  type FarmTheme,
  type FarmUIPreferences,
} from './utils/farmPreferences';

export default function FarmClientRoot() {
  // Centralized Display & Orientation Controller
  const displayMode = useFarmDisplayMode();

  // Centralized UI Preferences (Theme, Sound, Camera, Fullscreen)
  const [uiPreferences, setUiPreferences] = useState<FarmUIPreferences>(() => getFarmUIPreferences());

  // 1. Data State
  const [state, setState] = useState<any>(null);
  const stateRef = useRef<any>(null);
  stateRef.current = state;
  const [loading, setLoading] = useState(true);
  const [currentWeather, setCurrentWeather] = useState(uiPreferences.theme === 'NIGHT' ? 'NIGHT' : 'SUNNY');

  // Centralized Boot Manager State
  const [bootState, setBootState] = useState<'INITIALIZING' | 'LOADING' | 'READY'>('INITIALIZING');
  const [bootProgress, setBootProgress] = useState({ percent: 0, loaded: 0, total: 58 });
  const isAssetsPreloadedRef = useRef(false);
  const isFarmStateLoadedRef = useRef(false);
  const isVideoReadyRef = useRef(false);
  const isBootReadyRef = useRef(false);

  const checkAndTriggerBootReady = useCallback(() => {
    if (isBootReadyRef.current) return;
    if (isAssetsPreloadedRef.current && isFarmStateLoadedRef.current && isVideoReadyRef.current) {
      isBootReadyRef.current = true;
      setBootState('READY');
      setLoading(false);
    }
  }, []);

  const handleVideoReady = useCallback(() => {
    isVideoReadyRef.current = true;
    checkAndTriggerBootReady();
  }, [checkAndTriggerBootReady]);

  // Sub-data for system panels
  const [inventory, setInventory] = useState<any[]>([]);
  const [unseenInventoryCount, setUnseenInventoryCount] = useState<number>(0);
  const [collection, setCollection] = useState<any[]>([]);
  const [shopCatalog, setShopCatalog] = useState<any>(null);
  const [rewardsCatalog, setRewardsCatalog] = useState<any[]>([]);
  const [isShopLoading, setIsShopLoading] = useState(false);
  const [missions, setMissions] = useState<any[]>([]);
  const [missionsSummary, setMissionsSummary] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [visitingState, setVisitingState] = useState<any | null>(null);
  const visitingStateRef = useRef<any | null>(null);
  visitingStateRef.current = visitingState;

  // Số lượng nhiệm vụ có thể nhận thưởng (cho badge)
  const unclaimedMissionsCount = useMemo(() => {
    if (missionsSummary?.unclaimedCount !== undefined) {
      return missionsSummary.unclaimedCount;
    }
    return missions.filter((m) => m.isCompleted && !m.isClaimed).length;
  }, [missionsSummary, missions]);

  // 2. Maintenance State
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [maintenanceEndTime, setMaintenanceEndTime] = useState<string | null>(null);

  // 3. Orientation State (Landscape Guard)
  const [isPortraitOnMobile, setIsPortraitOnMobile] = useState(false);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  // 4. Native Game UI Selection States (Sửa triệt để bug Plot 5 / Cây thần bằng selectedPlotIndex và Single Source of Truth)
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const selectedPlot = useMemo(() => {
    if (selectedPlotIndex === null) return null;
    const plots = visitingState?.plots || state?.plots;
    return plots?.find((p: any) => p.plotIndex === selectedPlotIndex) ?? null;
  }, [visitingState?.plots, state?.plots, selectedPlotIndex]);

  const setSelectedPlot = useCallback((p: any) => {
    if (!p) {
      setSelectedPlotIndex(null);
    } else if (typeof p === 'number') {
      setSelectedPlotIndex(p);
    } else if (typeof p.plotIndex === 'number') {
      setSelectedPlotIndex(p.plotIndex);
    }
  }, []);

  // Quick Water Mode
  const [isWaterMode, setIsWaterMode] = useState(false);
  const isWaterModeRef = useRef(false);
  isWaterModeRef.current = isWaterMode;

  // Mystery Crop Reveal State
  const [mysteryRevealData, setMysteryRevealData] = useState<{
    isOpen: boolean;
    crop: any;
    isMutated?: boolean;
    mutation?: any;
    isNewDiscovery?: boolean;
  } | null>(null);

  // Target Seed to focus in Shop from Album
  const [shopTargetItemCode, setShopTargetItemCode] = useState<string | null>(null);
  const [plotScreenPos, setPlotScreenPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSeedTrayOpen, setIsSeedTrayOpen] = useState(false);
  const [isFertilizerTrayOpen, setIsFertilizerTrayOpen] = useState(false);
  const [isUprootConfirmOpen, setIsUprootConfirmOpen] = useState(false);
  const [uprootTargetPlot, setUprootTargetPlot] = useState<any | null>(null);
  const busyPlotsRef = useRef<Set<number>>(new Set());
  const plantingLockRef = useRef<boolean>(false);

  // System Drawer / Book Overlays
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [revealedMutation, setRevealedMutation] = useState<any>(null);

  // Video Background Audio & New Modals State
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => uiPreferences.isAudioEnabled);
  const [socialOverview, setSocialOverview] = useState<any>(null);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [selectedSeedDetail, setSelectedSeedDetail] = useState<any | null>(null);
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const [visitedFriendUserId, setVisitedFriendUserId] = useState<string | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isLuckyEnvelopeModalOpen, setIsLuckyEnvelopeModalOpen] = useState(false);
  const [lastLuckyEnvelopeReward, setLastLuckyEnvelopeReward] = useState<any | null>(null);

  // Mailbox & History modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [isEnergyDetailOpen, setIsEnergyDetailOpen] = useState(false);
  const [isIOSGuideOpen, setIsIOSGuideOpen] = useState(false);

  const fetchUnreadMailCount = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/mails/unread-count', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.unreadCount !== undefined) {
          setUnreadMailCount(json.data.unreadCount);
        }
      }
    } catch {}
  }, []);

  // ==========================================
  // BOOT PROGRESS & PRELOAD EVENT LISTENERS
  // ==========================================
  useEffect(() => {
    const handleProgress = (data: { percent: number; loaded: number; total: number }) => {
      setBootProgress({
        percent: data.percent,
        loaded: data.loaded,
        total: data.total,
      });
      setBootState((prev) => (prev === 'INITIALIZING' ? 'LOADING' : prev));
    };

    const handlePreloadComplete = () => {
      isAssetsPreloadedRef.current = true;
      checkAndTriggerBootReady();
    };

    farmEventBus.on('LOAD_PROGRESS', handleProgress);
    farmEventBus.on('PRELOAD_COMPLETE', handlePreloadComplete);

    // Fallback timer: only trigger ready when both farm state & assets are confirmed or after safe delay
    const fallbackTimer = setTimeout(() => {
      if (isFarmStateLoadedRef.current && isAssetsPreloadedRef.current && !isBootReadyRef.current) {
        isBootReadyRef.current = true;
        setBootState('READY');
        setLoading(false);
      }
    }, 12000);

    return () => {
      farmEventBus.off('LOAD_PROGRESS', handleProgress);
      farmEventBus.off('PRELOAD_COMPLETE', handlePreloadComplete);
      clearTimeout(fallbackTimer);
    };
  }, [checkAndTriggerBootReady]);

  // Đồng bộ thời tiết sang Phaser EffectsScene khi theme thay đổi
  useEffect(() => {
    farmEventBus.emit('WEATHER_CHANGED', uiPreferences.theme === 'NIGHT' ? 'NIGHT' : 'SUNNY');
  }, [uiPreferences.theme]);

  // Pause / Resume Phaser scene based on Orientation guard
  useEffect(() => {
    if (displayMode.isTouchDevice && displayMode.isPortrait) {
      if (phaserGameRef.current) {
        const scene = phaserGameRef.current.scene.getScene('FarmScene');
        if (scene) {
          scene.scene.pause();
          scene.input.enabled = false;
        }
      }
    } else {
      if (phaserGameRef.current) {
        const scene = phaserGameRef.current.scene.getScene('FarmScene');
        if (scene) {
          scene.scene.resume();
          scene.input.enabled = true;
        }
      }
    }
  }, [displayMode.isTouchDevice, displayMode.isPortrait]);

  // ==========================================
  // API DATA FETCHERS
  // ==========================================
  const fetchFarmState = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/state', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        // Giữ nguyên Theme người dùng đã lưu, tránh default 'SUNNY' của backend ghi đè
        const activeTheme = getFarmUIPreferences().theme;
        const resolvedWeather = activeTheme === 'NIGHT' ? 'NIGHT' : 'SUNNY';
        setCurrentWeather(resolvedWeather);
        farmEventBus.emit('WEATHER_CHANGED', resolvedWeather);
        if (json.data?.unseenInventoryCount !== undefined) {
          setUnseenInventoryCount(json.data.unseenInventoryCount);
        }
        if (json.data?.inventory) {
          setInventory(json.data.inventory);
        }
        // Chỉ phát dữ liệu đồng bộ xuống Phaser Engine nếu KHÔNG ở chế độ Ghé thăm bạn bè!
        if (!visitingStateRef.current) {
          farmEventBus.emit('SYNC_STATE', { plots: json.data.plots });
          farmEventBus.emit('SYNC_LUCKY_ENVELOPES', {
            count: json.data?.farm?.luckyEnvelopeTickets || 0,
          });
        }
        if (json.data?.farm && json.data.farm.hasCompletedTutorial === false) {
          setIsTutorialOpen(true);
        }
        fetchUnreadMailCount();
      }
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu nông trại:', e);
    } finally {
      isFarmStateLoadedRef.current = true;
      checkAndTriggerBootReady();
    }
  }, [fetchUnreadMailCount, checkAndTriggerBootReady]);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/inventory', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setInventory(json.data);
        const unseen = (json.data as any[]).filter((i: any) => !i.isSeen).length;
        setUnseenInventoryCount(unseen);
      }
    } catch (e) {
      console.error('Lỗi khi tải kho đồ:', e);
    }
  }, []);

  const fetchCollection = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/collection', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setCollection(json.data);
      }
    } catch (e) {
      console.error('Lỗi khi tải bộ sưu tập:', e);
    }
  }, []);

  const fetchShop = useCallback(async () => {
    try {
      setIsShopLoading(true);
      const [shopRes, rewardRes] = await Promise.all([
        fetch('/api/farm/shop/catalog', { credentials: 'include' }),
        fetch('/api/farm/rewards/catalog', { credentials: 'include' }),
      ]);
      const shopJson = await shopRes.json();
      const rewardJson = await rewardRes.json();

      if (shopRes.ok && shopJson.success) setShopCatalog(shopJson.data);
      if (rewardRes.ok && rewardJson.success) {
        const rawRewards = rewardJson.data;
        setRewardsCatalog(Array.isArray(rawRewards) ? rawRewards : (rawRewards?.rewards || []));
      }
    } catch (e) {
      console.error('Lỗi khi tải cửa hàng:', e);
    } finally {
      setIsShopLoading(false);
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    try {
      const rewardRes = await fetch('/api/farm/rewards/catalog', { credentials: 'include' });
      const rewardJson = await rewardRes.json();
      if (rewardRes.ok && rewardJson.success) {
        const rawRewards = rewardJson.data;
        setRewardsCatalog(Array.isArray(rawRewards) ? rawRewards : (rawRewards?.rewards || []));
      }
    } catch (e) {
      console.error('Lỗi khi tải danh mục đổi thưởng:', e);
    }
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/missions', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        if (Array.isArray(json.data)) {
          setMissions(json.data);
        } else if (json.data?.missions) {
          setMissions(json.data.missions);
          if (json.data.summary) {
            setMissionsSummary(json.data.summary);
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi tải nhiệm vụ:', e);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/social/friends', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setFriends(json.data);
      }
    } catch (e) {
      console.error('Lỗi khi tải bạn bè:', e);
    }
  }, []);

  const fetchSocialOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/friends/social-overview', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setSocialOverview(json.data);
      }
    } catch (e) {
      console.error('Lỗi khi tải thông tin bạn bè:', e);
    }
  }, []);

  const fetchFarmAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/assets', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setDynamicAssetOverrides(json.data);
        }
      }
    } catch (e) {
      console.warn('Lỗi khi nạp cấu hình asset cây trồng:', e);
    }
  }, []);

  // Global Garden Layout State
  const [gardenLayout, setGardenLayout] = useState<any>(null);
  const gardenLayoutRef = useRef<any>(null);
  gardenLayoutRef.current = gardenLayout;

  const fetchGardenLayout = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/layout/active', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setGardenLayout(json.data);
          farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: json.data, editorMode: false });
        }
      }
    } catch (err) {
      console.warn('Lỗi khi nạp bố cục khu vườn toàn cục:', err);
    }
  }, []);

  // Khởi tạo ban đầu
  useEffect(() => {
    fetchFarmState();
    fetchInventory();
    fetchMissions();
    fetchFarmAssets();
    fetchGardenLayout();
  }, [fetchFarmState, fetchInventory, fetchMissions, fetchFarmAssets, fetchGardenLayout]);

  // ==========================================
  // INPUT PRIORITY BLOCKER (UI OVERLAYS -> PHASER WORLD)
  // ==========================================
  const isAnyUiActive = Boolean(
    isShopOpen ||
      isMissionsOpen ||
      isInventoryOpen ||
      isCollectionOpen ||
      isFriendsOpen ||
      selectedPlot ||
      isSeedTrayOpen ||
      isFertilizerTrayOpen ||
      revealedMutation ||
      isLevelUpModalOpen ||
      isTutorialOpen ||
      selectedSeedDetail
  );

  useEffect(() => {
    farmEventBus.emit('SET_WORLD_INPUT_ACTIVE', !isAnyUiActive);
  }, [isAnyUiActive]);

  // Bộ đếm ô đất cần tưới và ô đất sẵn sàng thu hoạch (phục vụ Quick Action FABs)
  const thirstyPlotsCount = useMemo(() => {
    const plots = visitingState?.plots || state?.plots;
    return (
      plots?.filter(
        (p: any) =>
          p.cropInstance &&
          p.status !== 'WATERED' &&
          p.status !== 'READY' &&
          p.status !== 'LOCKED'
      )?.length ?? 0
    );
  }, [visitingState?.plots, state?.plots]);

  const readyPlotsCount = useMemo(() => {
    const plots = visitingState?.plots || state?.plots;
    return (
      plots?.filter((p: any) => p.status === 'READY' || (p.cropInstance && p.isReady))?.length ?? 0
    );
  }, [visitingState?.plots, state?.plots]);

  // ==========================================
  // WEBSOCKET REALTIME SYNC
  // ==========================================
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io('/farm', { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });

      socket.on('farm:plotUpdated', (data: any) => {
        fetchFarmState();
      });

      socket.on('farm:maintenance', (data: any) => {
        setIsMaintenance(data.isMaintenance);
        setMaintenanceMessage(data.message);
        setMaintenanceEndTime(data.estimatedEndTime);
      });

      const handleLayoutUpdate = (data: any) => {
        console.log('🌸 Nhận tín hiệu WebSocket FARM_LAYOUT_UPDATED từ Admin:', data);
        if (data) {
          setGardenLayout(data);
          farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: data, editorMode: false });
          fetchGardenLayout();
          fetchFarmState();
          farmEventBus.emit('GAME_TOAST', {
            type: 'info',
            message: '🌸 Bố Cục Đảo Mới',
            subMessage: 'Bố cục khu vườn vừa được Admin cập nhật trực tiếp!',
          });
        }
      };

      socket.on('FARM_LAYOUT_UPDATED', handleLayoutUpdate);
      socket.on('farm:layout_updated', handleLayoutUpdate);
    } catch (e) {
      console.warn('Socket connection fallback:', e);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [fetchFarmState]);

  // ==========================================
  // EVENT BUS BINDINGS (PHASER -> REACT)
  // ==========================================
  useEffect(() => {
    const unsubPlotClick = farmEventBus.on('PLOT_CLICKED', (plotData: any) => {
      // Nếu đang trong chế độ Ghé thăm nông trại bạn bè
      if (visitingStateRef.current) {
        if (plotData.canGather) {
          handleStealFriendCrop(plotData.plotIndex);
        } else if (plotData.canWater || plotData.needWater) {
          handleWaterFriendCrop(plotData.plotIndex);
        } else if (plotData.hasUserWatered) {
          farmEventBus.emit('GAME_TOAST', {
            type: 'info',
            message: '💧 Bạn đã tưới nước cho cây này rồi!',
            subMessage: 'Mỗi cây có thể được tưới từ 2 bạn bè khác nhau.',
          });
        } else if ((plotData.wateredUsersCount ?? 0) >= 2) {
          farmEventBus.emit('GAME_TOAST', {
            type: 'info',
            message: '💧 Cây đã được 2 bạn bè tưới nước đầy đủ!',
            subMessage: 'Cây đang phát triển rất tốt, không cần tưới thêm.',
          });
        } else if (plotData.isProtected) {
          farmEventBus.emit('GAME_TOAST', {
            type: 'info',
            message: `🛡️ Cây đang được bảo vệ! Còn ${plotData.protectionRemainingSec || 0}s`,
          });
        } else if (plotData.cropInstance && !plotData.isReady) {
          handleWaterFriendCrop(plotData.plotIndex);
        } else {
          farmEventBus.emit('GAME_TOAST', {
            type: 'info',
            message: 'Ô đất này của bạn bè hiện đang để trống.',
          });
        }
        return;
      }

      // Nếu đang trong chế độ Tưới nhanh (Water Mode)
      if (isWaterModeRef.current) {
        handleQuickWater(plotData.plotIndex);
        return;
      }

      setSelectedPlotIndex(plotData.plotIndex);
      setPlotScreenPos({ x: plotData.screenX || 0, y: plotData.screenY || 0 });

      // Nếu ô đất trống: mở khay hạt giống trượt từ dưới
      if (plotData.status === 'EMPTY') {
        fetchInventory();
        setIsSeedTrayOpen(true);
      } else {
        setIsSeedTrayOpen(false);
      }
    });

    const unsubSceneReady = farmEventBus.on('SCENE_READY', () => {
      const currentState = stateRef.current;
      if (currentState?.plots) {
        farmEventBus.emit('SYNC_STATE', { plots: currentState.plots });
      }
      const tickets = currentState?.farm?.luckyEnvelopeTickets ?? 0;
      farmEventBus.emit('SYNC_LUCKY_ENVELOPES', { count: tickets });
      if (gardenLayoutRef.current) {
        farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: gardenLayoutRef.current, editorMode: false });
      }
    });

    const unsubReqLayout = farmEventBus.on('REQUEST_GARDEN_LAYOUT', () => {
      if (gardenLayoutRef.current) {
        farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: gardenLayoutRef.current, editorMode: false });
      }
    });

    const unsubGrowthStage = farmEventBus.on('PLOT_GROWTH_STAGE_CHANGED', (data: { plotIndex: number; newStage: number; isReady: boolean }) => {
      setState((prev: any) => {
        if (!prev?.plots) return prev;
        const newPlots = prev.plots.map((p: any) => {
          if (p.plotIndex === data.plotIndex) {
            return {
              ...p,
              status: data.isReady ? 'READY' : p.status,
              isReady: data.isReady,
              growthState: {
                ...(p.growthState || {}),
                stage: data.newStage,
                isReady: data.isReady,
                secondsRemaining: data.isReady ? 0 : p.growthState?.secondsRemaining,
              },
            };
          }
          return p;
        });
        return { ...prev, plots: newPlots };
      });
    });

    return () => {
      unsubPlotClick();
      unsubSceneReady();
      unsubReqLayout();
      unsubGrowthStage();
    };
  }, [state, fetchInventory]);

  // Bộ đếm thời gian thực (Real-time Growth Tick) đếm lùi thời gian sinh trưởng của các cây
  // Đảm bảo CropInfoCard và PlotActionBubble cập nhật từng giây và nhảy stage mượt mà
  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev: any) => {
        if (!prev?.plots) return prev;
        let hasChanges = false;
        const now = Date.now();

        const updatedPlots = prev.plots.map((plot: any) => {
          if (!plot.cropInstance || plot.status === 'LOCKED' || plot.status === 'EMPTY') {
            return plot;
          }

          const cropInst = plot.cropInstance;
          const readyAt = cropInst.readyAt ? new Date(cropInst.readyAt).getTime() : 0;
          const stage3At = cropInst.stage3At ? new Date(cropInst.stage3At).getTime() : 0;
          const stage2At = cropInst.stage2At ? new Date(cropInst.stage2At).getTime() : 0;
          const stage1At = cropInst.stage1At ? new Date(cropInst.stage1At).getTime() : 0;
          const plantedAt = cropInst.plantedAt ? new Date(cropInst.plantedAt).getTime() : 0;

          let calculatedStage = 0;
          let isReady = false;
          let secondsRemaining = 0;

          if (readyAt > 0) {
            secondsRemaining = Math.max(0, Math.ceil((readyAt - now) / 1000));
            if (now >= readyAt) {
              calculatedStage = 5;
              isReady = true;
            } else if (stage3At > 0 && now >= stage3At) {
              calculatedStage = 4;
            } else if (stage2At > 0 && now >= stage2At) {
              calculatedStage = 3;
            } else if (stage1At > 0 && now >= stage1At) {
              calculatedStage = 2;
            } else if (plantedAt > 0 && now >= plantedAt) {
              calculatedStage = 1;
            }
          }

          const currentStage = plot.growthState?.stage ?? 0;
          const currentRemaining = plot.growthState?.secondsRemaining ?? 0;

          if (currentStage !== calculatedStage || currentRemaining !== secondsRemaining) {
            hasChanges = true;
            return {
              ...plot,
              status: isReady ? 'READY' : plot.status,
              isReady,
              growthState: {
                ...(plot.growthState || {}),
                stage: calculatedStage,
                secondsRemaining,
                isReady,
              },
            };
          }
          return plot;
        });

        return hasChanges ? { ...prev, plots: updatedPlots } : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Đồng bộ số lượng Lì Xì May Mắn trên Cây Thần mỗi khi state thay đổi
  useEffect(() => {
    if (!visitingState && state?.farm?.luckyEnvelopeTickets !== undefined) {
      farmEventBus.emit('SYNC_LUCKY_ENVELOPES', {
        count: state.farm.luckyEnvelopeTickets,
      });
    }
  }, [state?.farm?.luckyEnvelopeTickets, visitingState]);

  // Đồng bộ tọa độ Screen Space khi người chơi Drag/Zoom camera (Sử dụng RAF tối ưu, không re-render khi đứng yên)
  useEffect(() => {
    let animId: number;
    const trackAnchor = () => {
      if (selectedPlot && typeof window !== 'undefined' && (window as any).__AVORA_FARM_SCENE) {
        const scene = (window as any).__AVORA_FARM_SCENE;
        if (selectedPlot.worldX !== undefined && selectedPlot.worldY !== undefined) {
          const currentPos = scene.worldToScreen(selectedPlot.worldX, selectedPlot.worldY);
          setPlotScreenPos((prev) => {
            if (Math.abs(prev.x - currentPos.x) > 1 || Math.abs(prev.y - currentPos.y) > 1) {
              return currentPos;
            }
            return prev;
          });
        }
      }
      animId = requestAnimationFrame(trackAnchor);
    };

    if (selectedPlot) {
      animId = requestAnimationFrame(trackAnchor);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [selectedPlot]);

  // ==========================================
  // NATIVE GAMEPLAY ACTION HANDLERS
  // ==========================================
  const handleToggleWaterMode = useCallback(() => {
    farmSound.playTap();
    const next = !isWaterModeRef.current;
    isWaterModeRef.current = next;
    setIsWaterMode(next);

    if (next) {
      setSelectedPlotIndex(null);
      setIsSeedTrayOpen(false);
      const dryPlots = stateRef.current?.plots
        ?.filter((p: any) => p.cropInstance && p.status !== 'WATERED' && p.status !== 'READY')
        ?.map((p: any) => p.plotIndex) ?? [];
      farmEventBus.emit('WATER_MODE_START', { dryPlotIndexes: dryPlots });
      farmEventBus.emit('GAME_TOAST', {
        type: 'info',
        message: '💧 Chế độ tưới nhanh đang BẬT. Chạm vào các cây để tưới!',
      });
    } else {
      farmEventBus.emit('WATER_MODE_END');
    }
  }, []);

  const handleQuickWater = useCallback(async (plotIndex: number) => {
    const currentPlots = stateRef.current?.plots;
    const target = currentPlots?.find((p: any) => p.plotIndex === plotIndex);
    if (!target || target.status === 'LOCKED' || target.status === 'EMPTY' || target.status === 'READY') {
      return;
    }
    if (target.status === 'WATERED' || target.waterLevel >= 80) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'info',
        message: `🌱 Ô #${plotIndex + 1} đất đã đủ nước rồi!`,
      });
      return;
    }
    farmEventBus.emit('WATER_SPLASH', { plotIndex });
    await handleWater(plotIndex);
  }, []);

  const handlePlant = async (cropCode: string, targetPlotIndex?: number) => {
    const plotIdx = targetPlotIndex ?? selectedPlotIndex;
    if (plotIdx === null || plotIdx === undefined) return;
    if (plantingLockRef.current || busyPlotsRef.current.has(plotIdx)) return;
    plantingLockRef.current = true;
    busyPlotsRef.current.add(plotIdx);

    try {
      farmSound.playPlant();
      const res = await fetch('/api/farm/plots/plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex: plotIdx, cropCode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.expGained || 5;
        farmEventBus.emit('XP_GAINED', {
          amount: expGained,
          x: plotScreenPos?.x,
          y: plotScreenPos?.y,
        });
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', { newLevel: json.data?.levelAfter });
        }
        farmEventBus.emit('CLEAR_PLANT_PREVIEW');

        // Quét tìm ô đất trống tiếp theo để người chơi gieo liên tục không cần đóng khay
        const currentPlots = stateRef.current?.plots || [];
        const remainingEmptyPlots = currentPlots.filter(
          (p: any) =>
            p.plotIndex !== plotIdx &&
            p.status === 'EMPTY' &&
            !p.cropInstance &&
            !busyPlotsRef.current.has(p.plotIndex)
        );

        if (remainingEmptyPlots.length > 0) {
          // Ưu tiên ô kế tiếp theo thứ tự sau plotIdx, nếu tới cuối thì vòng lại ô đầu
          const nextPlotsAfter = remainingEmptyPlots.filter((p: any) => p.plotIndex > plotIdx);
          const nextPlot = nextPlotsAfter.length > 0 ? nextPlotsAfter[0] : remainingEmptyPlots[0];

          setSelectedPlotIndex(nextPlot.plotIndex);
          farmEventBus.emit('GAME_TOAST', {
            type: 'success',
            message: `🌱 Đã gieo! Tiếp tục gieo Ô #${nextPlot.plotIndex + 1}`,
          });
        } else {
          // Đã gieo kín tất cả các ô đất trống
          setSelectedPlotIndex(null);
          setIsSeedTrayOpen(false);
          farmEventBus.emit('GAME_TOAST', {
            type: 'success',
            message: '🎉 Tuyệt vời! Bạn đã gieo kín tất cả các ô đất!',
          });
        }

        fetchFarmState();
        fetchInventory();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể gieo hạt',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi gieo hạt',
      });
    } finally {
      busyPlotsRef.current.delete(plotIdx);
      plantingLockRef.current = false;
    }
  };

  const handlePlantMystery = async (targetPlotIndex: number, packCode: string = 'MYSTERY_SEED_PACK') => {
    if (plantingLockRef.current || busyPlotsRef.current.has(targetPlotIndex)) return;
    plantingLockRef.current = true;
    busyPlotsRef.current.add(targetPlotIndex);

    try {
      farmSound.playPlant();
      const res = await fetch('/api/farm/plots/plant-mystery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex: targetPlotIndex, packCode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.expGained || 10;
        farmEventBus.emit('XP_GAINED', {
          amount: expGained,
          x: plotScreenPos?.x,
          y: plotScreenPos?.y,
        });
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', { newLevel: json.data?.levelAfter });
        }

        // Mở màn hình reveal animation chuẩn game
        setMysteryRevealData({
          isOpen: true,
          crop: json.data?.rolledCrop,
          isMutated: json.data?.isMutated,
          mutation: json.data?.mutation,
          isNewDiscovery: json.data?.isNewDiscovery,
        });

        setSelectedPlotIndex(null);
        setIsSeedTrayOpen(false);
        farmEventBus.emit('CLEAR_PLANT_PREVIEW');
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể gieo Gói Hạt Bí Ẩn',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi kết nối khi gieo Gói Hạt Bí Ẩn',
      });
    } finally {
      busyPlotsRef.current.delete(targetPlotIndex);
      plantingLockRef.current = false;
    }
  };

  const handleWater = async (plotIndex: number) => {
    try {
      farmEventBus.emit('PLAY_WATERING_ANIM', plotIndex);
      farmSound.playWater();

      const res = await fetch('/api/farm/plots/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.expGained || 2;
        farmEventBus.emit('XP_GAINED', {
          amount: expGained,
          x: plotScreenPos?.x,
          y: plotScreenPos?.y,
        });
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', { newLevel: json.data?.levelAfter });
        }
        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: '💧 Đã tưới nước!',
          subMessage: `+${expGained} EXP • Tăng tốc độ sinh trưởng`,
        });
        fetchFarmState();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể tưới nước',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi tưới nước',
      });
    }
  };

  const handleFertilize = async (plotIndex: number) => {
    setIsFertilizerTrayOpen(true);
  };

  const handleApplyFertilizer = async (plotIndex: number, type: string) => {
    try {
      farmSound.playMutation();
      const res = await fetch('/api/farm/plots/fertilize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex, fertilizerType: type, fertilizerCode: type }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.expGained || 5;
        farmEventBus.emit('XP_GAINED', {
          amount: expGained,
          x: plotScreenPos?.x,
          y: plotScreenPos?.y,
        });
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', { newLevel: json.data?.levelAfter });
        }
        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: '🧪 Đã bón phân thành công!',
          subMessage: `+${expGained} EXP • Hiệu quả kích thích sinh trưởng đã kích hoạt`,
        });
        setIsFertilizerTrayOpen(false);
        fetchFarmState();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể bón phân',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi bón phân',
      });
    }
  };

  const handleHarvest = async (plotIndex: number) => {
    if (busyPlotsRef.current.has(plotIndex)) return;
    busyPlotsRef.current.add(plotIndex);

    try {
      farmSound.playHarvest();

      const res = await fetch('/api/farm/plots/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('PLAY_HARVEST_ANIM', plotIndex);
        farmSound.playCoin();
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.expGained || json.data?.expReward || 20;
        farmEventBus.emit('XP_GAINED', {
          amount: expGained,
          x: plotScreenPos?.x,
          y: plotScreenPos?.y,
        });
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', {
            newLevel: json.data?.levelAfter || json.data?.newLevel,
          });
        }
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🌾 Thu hoạch thành công: ${json.data?.cropName || 'Nông sản'}!`,
          subMessage: `+${expGained} EXP • +${json.data?.coinReward || 15} Xu • Sản lượng: x${json.data?.yield || 1}`,
        });

        if (json.data?.isMutated && json.data?.mutation) {
          farmSound.playMutation();
          farmEventBus.emit('MUTATION_REVEAL', {
            plotIndex,
            mutationCode: json.data.mutation.code,
          });
        }

        setSelectedPlot(null);
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        const isAlreadyHarvested =
          res.status === 409 ||
          json.message?.includes?.('ALREADY_HARVESTED') ||
          json.message?.includes?.('thu hoạch trước');

        farmEventBus.emit('GAME_TOAST', {
          type: isAlreadyHarvested ? 'warning' : 'error',
          message: isAlreadyHarvested
            ? 'Cây đã được thu hoạch trước đó!'
            : (json.message || 'Cây chưa sẵn sàng thu hoạch'),
        });

        if (isAlreadyHarvested) {
          setSelectedPlot(null);
          fetchFarmState();
        }
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi máy chủ khi thu hoạch',
      });
    } finally {
      busyPlotsRef.current.delete(plotIndex);
    }
  };

  const handleUproot = async (plotIndex: number) => {
    if (busyPlotsRef.current.has(plotIndex)) return;
    busyPlotsRef.current.add(plotIndex);

    try {
      const res = await fetch('/api/farm/plots/uproot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('PLAY_UPROOT_ANIM', plotIndex);
        farmSound.playTap();
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: '🚜 Đã nhổ bỏ cây trồng!',
          subMessage: 'Ô đất đã sẵn sàng để gieo hạt giống mới',
        });
        setSelectedPlot(null);
        setIsUprootConfirmOpen(false);
        fetchFarmState();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể đào bỏ cây',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi đào bỏ cây',
      });
    } finally {
      busyPlotsRef.current.delete(plotIndex);
    }
  };

  const handleUnlockPlot = async (plotIndex: number) => {
    try {
      farmSound.playUnlock();
      const res = await fetch('/api/farm/plots/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.expGained || 30;
        farmEventBus.emit('XP_GAINED', {
          amount: expGained,
          x: plotScreenPos?.x,
          y: plotScreenPos?.y,
        });
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', { newLevel: json.data?.levelAfter });
        }
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🎉 Mở khóa thành công ô đất #${plotIndex + 1}!`,
          subMessage: `+${expGained} EXP • Đã sẵn sàng canh tác nông sản mới`,
        });
        setSelectedPlot(null);
        fetchFarmState();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể mở khóa ô đất',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi mở khóa ô đất',
      });
    }
  };

  const handleBatchWaterAll = async () => {
    const dryPlots = (visitingState?.plots || stateRef.current?.plots)
      ?.filter(
        (p: any) =>
          p.cropInstance &&
          p.status !== 'WATERED' &&
          p.status !== 'READY' &&
          p.status !== 'LOCKED'
      )
      ?.map((p: any) => p.plotIndex) ?? [];

    if (dryPlots.length === 0) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'info',
        message: '💧 Tất cả các cây hiện đều đã đủ nước!',
      });
      return;
    }

    try {
      farmSound.playWater();
      const res = await fetch('/api/farm/plots/water-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plotIndexes: dryPlots }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        dryPlots.forEach((pIdx: number) => {
          farmEventBus.emit('WATER_SPLASH', { plotIndex: pIdx });
          farmEventBus.emit('PLAY_WATERING_ANIM', pIdx);
        });
        const count = json.data?.wateredCount ?? dryPlots.length;
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `💧 Đã tưới nhanh ${count} cây thành công!`,
          subMessage: 'Tất cả các cây đã đủ độ ẩm và phát triển tốt',
        });
        fetchFarmState();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể tưới nhanh',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi thực hiện tưới nhanh',
      });
    }
  };

  const handleHarvestAll = async () => {
    try {
      farmSound.playHarvest();
      const res = await fetch('/api/farm/plots/harvest-all', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmSound.playCoin();
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🌟 Thu hoạch toàn bộ thành công: ${json.data.harvestedCount} ô đất!`,
          subMessage: 'Nông sản đã được chuyển vào túi đồ',
        });
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Chưa có ô đất nào sẵn sàng',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi thu hoạch tất cả',
      });
    }
  };

  const handleSellCrop = async (itemCode: string, quantity: number) => {
    try {
      farmSound.playCoin();
      const res = await fetch('/api/farm/shop/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemCode, quantity }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const earned = json.data?.earnedCoins ?? json.data?.totalEarned ?? 0;
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `💰 Đã bán nhận +${earned} Xu nông trại!`,
        });
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể bán nông sản',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi bán nông sản',
      });
    }
  };

  const handleQuickSell = async (items: Array<{ itemId: string; quantity: number }>) => {
    try {
      farmSound.playCoin();
      const res = await fetch('/api/farm/inventory/quick-sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `💰 Bán nhanh thành công ${json.data.totalSold} loại nông sản!`,
          subMessage: `+${json.data.totalCoinsEarned?.toLocaleString('vi-VN')} Xu đã được cộng vào tài khoản`,
        });
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Lỗi khi bán nhanh vật phẩm',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi bán nhanh vật phẩm',
      });
    }
  };

  const handleToggleInventoryLock = async (itemId: string) => {
    try {
      const res = await fetch('/api/farm/inventory/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setInventory((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, isLocked: json.data.isLocked } : item,
          ),
        );
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: json.data.message,
        });
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể thay đổi trạng thái khóa',
        });
      }
    } catch (e) {
      console.error('Lỗi khi khóa/mở khóa vật phẩm:', e);
    }
  };

  const handleMarkInventorySeen = async (itemIds?: string[]) => {
    try {
      const res = await fetch('/api/farm/inventory/mark-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemIds }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUnseenInventoryCount(0);
        setInventory((prev) => prev.map((item) => ({ ...item, isSeen: true })));
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: '✓ Đã đánh dấu tất cả vật phẩm là đã xem',
        });
      }
    } catch (e) {
      console.error('Lỗi khi đánh dấu đã xem kho đồ:', e);
    }
  };

  const handlePurchaseSeed = async (itemCode: string, quantity: number) => {
    try {
      farmSound.playCoin();
      const res = await fetch('/api/farm/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemCode, quantity }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: `📦 Mua thành công x${quantity} hạt giống!`,
        });
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể mua hạt giống',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi mua hạt giống',
      });
    }
  };

  const handleRedeemReward = async (rewardCodeOrId: string) => {
    try {
      farmSound.playUnlock();
      const res = await fetch('/api/farm/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rewardCode: rewardCodeOrId,
          rewardId: rewardCodeOrId,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: '🎁 Đổi quà thành công!',
          subMessage: json.data?.message || json.message || 'Vui lòng kiểm tra mã ưu đãi trong tài khoản của bạn',
        });
        fetchFarmState();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.error?.message || json.message || 'Không thể đổi quà',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi đổi quà',
      });
    }
  };

  const handleClaimMission = async (missionCodeOrId: string) => {
    try {
      farmSound.playUnlock();
      const res = await fetch('/api/farm/missions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ missionCode: missionCodeOrId, missionId: missionCodeOrId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        const expGained = json.data?.rewardExp || json.data?.expGained || 0;
        if (expGained > 0) {
          farmEventBus.emit('XP_GAINED', {
            amount: expGained,
            x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
            y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
          });
        }
        if (json.data?.leveledUp) {
          farmEventBus.emit('FARM_LEVEL_UP', {
            newLevel: json.data?.levelAfter,
          });
        }
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: '🏆 Nhận thưởng nhiệm vụ thành công!',
          subMessage: `+${expGained} EXP • +${json.data?.rewardFarmCoin || 0} Xu`,
        });
        if (json.data?.luckyEnvelopeTicketsGranted > 0) {
          farmEventBus.emit('SYNC_LUCKY_ENVELOPES', {
            count: json.data.luckyEnvelopeTickets,
          });
          farmEventBus.emit('GAME_TOAST', {
            type: 'reward',
            message: `🎁 +${json.data.luckyEnvelopeTicketsGranted} Bao Lì Xì May Mắn trên Cây Thần!`,
            subMessage: 'Chạm vào bao lì xì trên cây để mở quà ngay!',
          });
        }
        fetchMissions();
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể nhận thưởng',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi nhận thưởng',
      });
    }
  };

  const handleClaimAllMissions = async () => {
    try {
      farmSound.playUnlock();
      const res = await fetch('/api/farm/missions/claim-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.farm) {
          setState((prev: any) => ({
            ...prev,
            farm: { ...prev?.farm, ...json.data.farm },
          }));
        }
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🏆 Nhận tất cả thành công: ${json.data?.claimedCount || 0} nhiệm vụ!`,
          subMessage: `+${json.data?.totalExpGained || 0} EXP • +${json.data?.totalFarmCoinGained || 0} Xu`,
        });
        if (json.data?.totalLuckyTicketsGained > 0) {
          farmEventBus.emit('SYNC_LUCKY_ENVELOPES', {
            count: json.data.farm?.luckyEnvelopeTickets,
          });
          farmEventBus.emit('GAME_TOAST', {
            type: 'reward',
            message: `🎁 +${json.data.totalLuckyTicketsGained} Bao Lì Xì May Mắn trên Cây Thần!`,
            subMessage: 'Chạm vào bao lì xì trên cây để mở quà ngay!',
          });
        }
        fetchMissions();
        fetchFarmState();
        fetchInventory();
        fetchCollection();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không có nhiệm vụ nào cần nhận',
        });
      }
    } catch (e) {
      console.error('Lỗi khi nhận tất cả nhiệm vụ:', e);
    }
  };

  const handleOpenLuckyEnvelope = async () => {
    try {
      farmSound.playTap();
      const res = await fetch('/api/farm/lucky-envelope/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const remainingTickets = json.data?.tickets?.remainingTickets ?? 0;
        setState((prev: any) => ({
          ...prev,
          farm: {
            ...prev?.farm,
            luckyEnvelopeTickets: remainingTickets,
            totalLuckyEnvelopesOpened: json.data?.tickets?.totalOpened,
            ...(json.data?.progression?.expAfter !== undefined
              ? {
                  level: json.data.progression.levelAfter,
                  exp: json.data.progression.expAfter,
                  pendingLevelUp: json.data.progression.canLevelUp,
                }
              : {}),
            ...(json.data?.reward?.rewardType === 'COIN'
              ? {
                  farmCoin: (prev?.farm?.farmCoin || 0) + (json.data.reward.rewardAmount || 0),
                }
              : {}),
            ...(json.data?.reward?.rewardType === 'ENERGY'
              ? {
                  energy: (prev?.farm?.energy || 0) + (json.data.reward.rewardAmount || 0),
                }
              : {}),
          },
        }));

        farmEventBus.emit('SYNC_LUCKY_ENVELOPES', { count: remainingTickets });

        if (json.data?.progression?.expGained > 0) {
          farmEventBus.emit('XP_GAINED', {
            amount: json.data.progression.expGained,
            x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
            y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
          });
        }

        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🎁 Nhận lì xì: ${json.data.reward.name}!`,
          subMessage: `+${json.data.reward.rewardAmount} (${json.data.reward.rarity})`,
        });

        if (['SEED', 'FERTILIZER', 'MUTATION_CROP', 'ITEM', 'TOOL'].includes(json.data?.reward?.rewardType)) {
          fetchInventory();
        }

        setLastLuckyEnvelopeReward(json.data?.reward);
        return json.data;
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể mở bao lì xì',
        });
        return null;
      }
    } catch (e) {
      console.error('Lỗi khi mở lì xì:', e);
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi kết nối khi mở bao lì xì',
      });
      return null;
    }
  };

  // Lắng nghe tín hiệu chạm vào bao lì xì từ Engine Phaser: Tự động mở hiển thị quà luôn
  useEffect(() => {
    const unbind = farmEventBus.on('OPEN_LUCKY_ENVELOPE', async () => {
      const tickets = stateRef.current?.farm?.luckyEnvelopeTickets || 0;
      if (tickets <= 0) {
        farmSound.playTap();
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: '🧧 Bạn chưa có bao lì xì may mắn nào!',
          subMessage: 'Hãy chăm chỉ làm nhiệm vụ hoặc ghé nhà hàng AVORA để nhận thêm',
        });
        return;
      }
      farmSound.playTap();
      const res = await handleOpenLuckyEnvelope();
      if (res && res.reward) {
        setLastLuckyEnvelopeReward(res.reward);
        setIsLuckyEnvelopeModalOpen(true);
      }
    });
    return () => unbind();
  }, []);

  const handleWaterFriend = async (friendUserId: string, plotIndex: number) => {
    try {
      farmSound.playWater();
      const res = await fetch('/api/farm/social/water-friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendUserId, plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: '💧 Đã tưới nước giúp bạn bè!',
          subMessage: `+${json.data.rewardExp} EXP tình bạn`,
        });
        fetchFriends();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể tưới nước giúp bạn bè',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi tưới nước',
      });
    }
  };

  const handleGatherFriend = async (friendUserId: string, plotIndex: number) => {
    try {
      farmSound.playHarvest();
      const res = await fetch('/api/farm/social/gather-friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendUserId, plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmSound.playCoin();
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🌾 Hái trộm thành công +${json.data.gatheredYield} nông sản!`,
        });
        fetchFriends();
        fetchInventory();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể hái trộm',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi hái trộm',
      });
    }
  };

  const handleToggleAudio = () => {
    const next = !uiPreferences.isAudioEnabled;
    setIsAudioEnabled(next);
    const updated = saveFarmUIPreferences({ isAudioEnabled: next });
    setUiPreferences(updated);
  };

  const handleToggleTheme = () => {
    const nextTheme: FarmTheme = uiPreferences.theme === 'NIGHT' ? 'DAY' : 'NIGHT';
    const updated = saveFarmUIPreferences({ theme: nextTheme });
    setUiPreferences(updated);
    const weather = nextTheme === 'NIGHT' ? 'NIGHT' : 'SUNNY';
    setCurrentWeather(weather);
    farmEventBus.emit('WEATHER_CHANGED', weather);

    fetch('/api/farm/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ weather }),
    }).catch(() => {});
  };

  const handleToggleFullscreen = async () => {
    const willBeFullscreen = !displayMode.isFullscreen;
    saveFarmUIPreferences({ prefersFullscreen: willBeFullscreen });
    await displayMode.toggleFullscreen();

    // Đối với iOS Safari: nếu mở toàn màn hình (và chưa Add to Home Screen), gợi ý hướng dẫn PWA
    if (displayMode.isIOS && !displayMode.isStandalone && willBeFullscreen) {
      const hasDismissed =
        typeof window !== 'undefined' &&
        localStorage.getItem('avora_farm_seen_ios_fullscreen_guide') === 'true';
      if (!hasDismissed) {
        setIsIOSGuideOpen(true);
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: '📱 Đã bật Toàn màn hình iOS (Thêm vào MH chính để chơi 100% không viền)',
        });
      }
    }
  };

  const handleAddFriend = async (friendUserId: string) => {
    try {
      const res = await fetch('/api/farm/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendUserId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: json.data?.message || '🤝 Đã gửi lời mời kết bạn!',
          subMessage: 'Đang chờ đối phương đồng ý',
        });
        fetchSocialOverview();
        fetchFriends();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể kết bạn',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi kết bạn',
      });
    }
  };

  const handleAcceptFriend = async (requesterUserId: string) => {
    try {
      const res = await fetch('/api/farm/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requesterUserId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: '🎉 Đã trở thành bạn bè!',
          subMessage: 'Đã mở khóa 10 lượt hái trộm và hỗ trợ lẫn nhau',
        });
        fetchSocialOverview();
        fetchFriends();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể đồng ý kết bạn',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi đồng ý kết bạn',
      });
    }
  };

  const handleRejectFriend = async (requesterUserId: string) => {
    try {
      const res = await fetch('/api/farm/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requesterUserId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: 'Đã từ chối lời mời kết bạn',
        });
        fetchSocialOverview();
      }
    } catch (e) {}
  };

  const handleVisitFarm = async (friendUserId: string) => {
    try {
      setIsFriendsOpen(false);
      setIsVisitModalOpen(false);
      setSelectedPlot(null);
      setIsSeedTrayOpen(false);

      const res = await fetch(`/api/farm/friends/${friendUserId}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setVisitingState(json.data);
        farmEventBus.emit('ENTER_VISIT_MODE', {
          plots: json.data.plots,
          friendUser: json.data.user,
          isFriend: json.data.isFriend,
          remainingSteals: json.data.remainingSteals,
          dailyStealsMax: json.data.dailyStealsMax,
        });
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: `🌾 Đang ghé thăm trang trại của ${json.data.user?.fullName || 'bạn bè'}!`,
          subMessage: json.data.isFriend ? 'Hạn mức: 10 lượt trộm/ngày' : 'Hạn mức: 3 lượt trộm/ngày',
        });
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể tải nông trại của đối phương',
        });
      }
    } catch (e: any) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi ghé thăm trang trại',
      });
    }
  };

  const handleExitVisitFarm = () => {
    setVisitingState(null);
    farmEventBus.emit('EXIT_VISIT_MODE');
    if (state?.plots) {
      farmEventBus.emit('SYNC_STATE', { plots: state.plots });
    }
  };

  const handleStealFriendCrop = async (plotIndex: number) => {
    if (!visitingStateRef.current) return;
    const friendUserId = visitingStateRef.current.user.id;
    try {
      const res = await fetch('/api/farm/friends/gather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendUserId, plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('PLAY_HARVEST_ANIM', plotIndex);
        try { farmSound.playHarvest(); } catch {}

        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: `🖐️ Hái trộm thành công 1x ${json.data?.cropName || 'Nông sản'}!`,
          subMessage: `+${json.data?.coinsEarned || 0} Xu Nông Trại`,
        });

        // Tải lại state nông trại bạn bè để cập nhật ô đất & số lượt trộm
        const updatedFriendRes = await fetch(`/api/farm/friends/${friendUserId}`, { credentials: 'include' });
        const updatedFriendJson = await updatedFriendRes.json();
        if (updatedFriendRes.ok && updatedFriendJson.success) {
          setVisitingState(updatedFriendJson.data);
          farmEventBus.emit('ENTER_VISIT_MODE', {
            plots: updatedFriendJson.data.plots,
            friendUser: updatedFriendJson.data.user,
            isFriend: updatedFriendJson.data.isFriend,
            remainingSteals: updatedFriendJson.data.remainingSteals,
            dailyStealsMax: updatedFriendJson.data.dailyStealsMax,
          });
        }
        fetchFarmState();
        fetchSocialOverview();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể hái trộm nông sản',
        });
      }
    } catch (e: any) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi kết nối khi hái trộm',
      });
    }
  };

  const handleWaterFriendCrop = async (plotIndex: number) => {
    if (!visitingStateRef.current) return;
    const friendUserId = visitingStateRef.current.user.id;
    try {
      const res = await fetch('/api/farm/friends/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendUserId, plotIndex }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('PLAY_WATERING_ANIM', plotIndex);
        try { farmSound.playWater(); } catch {}

        farmEventBus.emit('GAME_TOAST', {
          type: 'success',
          message: '💧 Đã tưới nước giúp bạn bè!',
          subMessage: `+${json.data?.rewardExp || 10} EXP, +${json.data?.rewardCoin || 15} Xu`,
        });

        const updatedFriendRes = await fetch(`/api/farm/friends/${friendUserId}`, { credentials: 'include' });
        const updatedFriendJson = await updatedFriendRes.json();
        if (updatedFriendRes.ok && updatedFriendJson.success) {
          setVisitingState(updatedFriendJson.data);
          farmEventBus.emit('ENTER_VISIT_MODE', {
            plots: updatedFriendJson.data.plots,
            friendUser: updatedFriendJson.data.user,
            isFriend: updatedFriendJson.data.isFriend,
            remainingSteals: updatedFriendJson.data.remainingSteals,
            dailyStealsMax: updatedFriendJson.data.dailyStealsMax,
          });
        }
        fetchFarmState();
        fetchSocialOverview();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể tưới nước',
        });
      }
    } catch (e: any) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi kết nối khi tưới nước',
      });
    }
  };

  const handleExchangePoints = async (coinsAmount: number) => {
    try {
      const res = await fetch('/api/farm/rewards/exchange-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ coinsAmount }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `⚡ Quy đổi thành công! +${json.data.earnedPoints} Điểm AVORA`,
          subMessage: `Số dư Xu còn lại: ${json.data.newCoins}`,
        });
        fetchFarmState();
        fetchRewards();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể quy đổi điểm',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi khi quy đổi điểm',
      });
    }
  };

  const handleExchangeProduce = async (exchangeCode: string) => {
    try {
      farmSound.playUnlock();
      const res = await fetch('/api/farm/shop/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ exchangeCode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: '✨ Đổi nông sản thành công!',
          subMessage: json.data?.message || 'Vật phẩm đã được thêm vào kho đồ',
        });
        fetchFarmState();
        fetchInventory();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Không thể đổi nông sản',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi máy chủ khi đổi nông sản',
      });
    }
  };

  const handleLevelUpSuccess = (data: any) => {
    if (data?.farm) {
      setState((prev: any) => ({
        ...prev,
        farm: { ...prev?.farm, ...data.farm },
      }));
    }
    farmEventBus.emit('FARM_LEVEL_UP', {
      newLevel: data?.newLevel || data?.farm?.level,
    });
    farmEventBus.emit('GAME_TOAST', {
      type: 'reward',
      message: `🎉 Trang trại đạt Cấp ${data?.newLevel || data?.farm?.level}!`,
      subMessage: 'Mở rộng hiệu suất canh tác và quyền lợi mới',
    });
    fetchFarmState();
    fetchInventory();
  };

  const handleWeatherChange = async (weather: string) => {
    try {
      const nextTheme: FarmTheme = weather === 'NIGHT' ? 'NIGHT' : 'DAY';
      const updated = saveFarmUIPreferences({ theme: nextTheme });
      setUiPreferences(updated);
      setCurrentWeather(weather);
      farmEventBus.emit('WEATHER_CHANGED', weather);

      const res = await fetch('/api/farm/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weather }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'info',
          message: `🌤️ Đã đổi thời tiết sang: ${weather}`,
        });
      }
    } catch (e) {
      console.error('Lỗi khi đổi thời tiết:', e);
    }
  };

  // Màn hình Bảo trì Nông trại
  if (isMaintenance) {
    return (
      <MaintenanceScreen
        message={maintenanceMessage || undefined}
        estimatedEndTime={maintenanceEndTime || undefined}
      />
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden select-none font-sans bg-[#111b15]">
      {/* ========================================================= */}
      {/* 0. FIXED VIEWPORT VIDEO BACKGROUND ENVIRONMENT            */}
      {/* Double-buffered, stable memoized, seamless loop & crossfade*/}
      {/* ========================================================= */}
      <FarmVideoBackground
        theme={uiPreferences.theme}
        isAudioEnabled={uiPreferences.isAudioEnabled}
        audioVolume={uiPreferences.audioVolume}
        onVideoReady={handleVideoReady}
      />

      {/* Centralized Fullscreen Boot Loading Screen (No Theme Flicker) */}
      <FarmBootLoader
        progress={bootProgress}
        isReady={bootState === 'READY'}
        theme={uiPreferences.theme}
      />

      {/* 0. Mobile Landscape Orientation Guard */}
      {displayMode.isTouchDevice && displayMode.isPortrait && (
        <RotateScreen onRequestLandscapeFullscreen={displayMode.requestLandscapeFullscreen} />
      )}

      {/* 0.1 In-game Floating XP Text & Level-Up Reveal */}
      {bootState === 'READY' && (
        <>
          <FloatingExpOverlay />
          <LevelUpReveal />
          <GameToast />
        </>
      )}

      {/* 1. Game Top Header HUD: Tùy biến linh hoạt theo chế độ Ghé Thăm hay Vườn Nhà */}
      {bootState === 'READY' && (
        visitingState ? (
          <VisitHeaderHUD
            visitingState={visitingState}
            onBack={handleExitVisitFarm}
          />
        ) : (
          <FarmHeaderHUD
            user={state?.user}
            farm={state?.farm}
            theme={uiPreferences.theme}
            onToggleTheme={handleToggleTheme}
            currentWeather={currentWeather}
            onWeatherChange={handleWeatherChange}
            isAudioEnabled={uiPreferences.isAudioEnabled}
            onToggleAudio={handleToggleAudio}
            onOpenLevelUpModal={() => setIsLevelUpModalOpen(true)}
            luckyTickets={state?.farm?.luckyEnvelopeTickets || 0}
            onOpenLuckyEnvelope={() => setIsLuckyEnvelopeModalOpen(true)}
            onOpenMailbox={() => setIsMailboxOpen(true)}
            unreadMailCount={unreadMailCount}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenEnergyDetail={() => setIsEnergyDetailOpen(true)}
            isFullscreen={displayMode.isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            isMobileLandscape={displayMode.isMobileLandscape}
          />
        )
      )}

      {/* 2. Main 2.5D Isometric Phaser Canvas (Transparent background on top of video) */}
      <FarmCanvas
        theme={uiPreferences.theme}
        layoutData={gardenLayout}
        onGameReady={(game) => {
          phaserGameRef.current = game;
          if (gardenLayout) {
            farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: gardenLayout, editorMode: false });
          }
          if (state?.plots) {
            farmEventBus.emit('SYNC_STATE', { plots: state.plots });
          }
        }}
      />

      {/* 3. Bottom HUD Navigation Dock: Thay thế bằng Carousel Danh Sách Bạn Bè khi đang Ghé Thăm (Khớp Hình 3 gốc) */}
      {bootState === 'READY' && (
        visitingState ? (
          <VisitBottomDock
            visitingState={visitingState}
            socialOverview={socialOverview}
            onSelectFriend={handleVisitFarm}
            onBack={handleExitVisitFarm}
          />
        ) : (
          <FarmBottomNav
            onOpenInventory={() => {
              fetchInventory();
              setIsInventoryOpen(true);
            }}
            onOpenCollection={() => {
              fetchCollection();
              setIsCollectionOpen(true);
            }}
            onOpenShop={() => {
              fetchShop();
              setIsShopOpen(true);
            }}
            onOpenRewards={() => {
              fetchRewards();
              setIsRewardsOpen(true);
            }}
            onOpenMissions={() => {
              fetchMissions();
              setIsMissionsOpen(true);
            }}
            onOpenFriends={() => {
              fetchFriends();
              fetchSocialOverview();
              setIsFriendsOpen(true);
            }}
            onHarvestAll={handleHarvestAll}
            isWaterMode={isWaterMode}
            onToggleWaterMode={handleToggleWaterMode}
            farmLevel={state?.farm?.level ?? 1}
            unclaimedMissionsCount={unclaimedMissionsCount}
            unseenInventoryCount={unseenInventoryCount}
            isMobileLandscape={displayMode.isMobileLandscape}
            isUltraCompact={displayMode.isUltraCompact}
          />
        )
      )}

      {/* 3B. NÚT NỔI THAO TÁC NHANH (TƯỚI NHANH & THU HOẠCH NHANH) */}
      {bootState === 'READY' && !visitingState && (
        <FarmQuickActions
          thirstyPlotsCount={thirstyPlotsCount}
          readyPlotsCount={readyPlotsCount}
          onQuickWaterAll={handleBatchWaterAll}
          onQuickHarvestAll={handleHarvestAll}
          isMobileLandscape={displayMode.isMobileLandscape}
          isUltraCompact={displayMode.isUltraCompact}
          userEnergy={state?.farm?.energy ?? 0}
        />
      )}

      {/* Water Mode Active Banner */}
      {isWaterMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-sky-600/95 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-full shadow-[0_4px_20px_rgba(2,132,199,0.5)] border-2 border-sky-300 backdrop-blur-md flex items-center gap-2 animate-bounce">
          <Droplet className="w-4 h-4 fill-white text-white" />
          <span>Chế độ tưới nhanh đang BẬT: Chạm vào các cây để tưới</span>
          <button
            onClick={handleToggleWaterMode}
            className="ml-2 px-2.5 py-0.5 rounded-full bg-white/25 hover:bg-white/40 text-xs font-black cursor-pointer"
          >
            Thoát
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. NATIVE GAME INTERACTION UI (WORLD-ANCHORED NO WEB MODALS) */}
      {/* Strictly gated behind bootState === READY                 */}
      {/* ========================================================= */}
      {bootState === 'READY' && (
        <>
          {/* A. Ô đất trống: Bong bóng hành động hoặc Khay hạt giống trượt từ đáy */}
          {selectedPlot && selectedPlot.status === 'EMPTY' && !isSeedTrayOpen && (
            <PlotActionBubble
              plot={selectedPlot}
              screenPos={plotScreenPos}
              onOpenSeedTray={() => setIsSeedTrayOpen(true)}
              onClose={() => setSelectedPlot(null)}
            />
          )}

          {/* B. Khay chọn hạt giống trượt nhẹ từ cạnh đáy màn hình (Hỗ trợ Drag & Drop & Hạt bí ẩn) */}
          <SeedTray
            isOpen={isSeedTrayOpen && selectedPlot?.status === 'EMPTY'}
            inventory={inventory}
            plotIndex={selectedPlot?.plotIndex ?? null}
            validEmptyPlots={
              state?.plots
                ?.filter((p: any) => p.status === 'EMPTY')
                ?.map((p: any) => p.plotIndex) ?? []
            }
            onPlant={handlePlant}
            onPlantMystery={handlePlantMystery}
            onClose={() => {
              setIsSeedTrayOpen(false);
              setSelectedPlot(null);
              farmEventBus.emit('CLEAR_PLANT_PREVIEW');
            }}
            userEnergy={state?.farm?.energy ?? 100}
            onOpenSeedInfo={(crop) => setSelectedSeedDetail(crop)}
          />

          {/* C. Cây đang sinh trưởng hoặc đã chín: Thẻ thông tin nhỏ bám cạnh cây */}
          {selectedPlot &&
            selectedPlot.status !== 'EMPTY' &&
            selectedPlot.status !== 'LOCKED' && (
              <CropInfoCard
                plot={selectedPlot}
                screenPos={plotScreenPos}
                onWater={handleWater}
                onFertilize={handleFertilize}
                onHarvest={handleHarvest}
                onRequestUproot={(plotIdx) => {
                  setUprootTargetPlot(selectedPlot);
                  setIsUprootConfirmOpen(true);
                }}
                onClose={() => setSelectedPlot(null)}
                userEnergy={state?.farm?.energy ?? 100}
              />
            )}

          {/* Xác nhận Đào Cây (Nhổ Cây) - Hộp thoại gỗ phong cách Nhật Bản */}
          <GameConfirmPanel
            isOpen={isUprootConfirmOpen}
            message={`Nhổ ${uprootTargetPlot?.cropInstance?.cropNameSnapshot || 'cây trồng'} khỏi ô đất số ${(uprootTargetPlot?.plotIndex ?? 0) + 1}?`}
            subMessage="Cây trồng sẽ bị loại bỏ hoàn toàn khỏi khu vườn và không thể khôi phục."
            confirmLabel="Nhổ cây"
            cancelLabel="Hủy bỏ"
            onConfirm={() => {
              if (uprootTargetPlot) {
                handleUproot(uprootTargetPlot.plotIndex);
              }
              setIsUprootConfirmOpen(false);
            }}
            onCancel={() => setIsUprootConfirmOpen(false)}
          />

          {/* D. Dải chọn phân bón nhanh trượt từ cạnh đáy */}
          <FertilizerTray
            isOpen={isFertilizerTrayOpen}
            plotIndex={selectedPlot?.plotIndex ?? null}
            onApply={handleApplyFertilizer}
            onClose={() => setIsFertilizerTrayOpen(false)}
          />

          {/* E. Vùng đất bị khóa: Bảng biển cắm trên đất hoang hiển thị điều kiện mở */}
          {selectedPlot && selectedPlot.status === 'LOCKED' && (
            <UnlockLandPanel
              plot={selectedPlot}
              screenPos={plotScreenPos}
              farmLevel={state?.farm?.level ?? 1}
              farmCoin={state?.farm?.farmCoin ?? 0}
              onUnlock={handleUnlockPlot}
              onClose={() => setSelectedPlot(null)}
            />
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* 5. SYSTEM DRAWER & BOOK OVERLAYS (NATIVE GAME UI)          */}
      {/* ========================================================= */}

      {/* Rương đồ & Sổ kho nông trại (Side Drawer) */}
      {isInventoryOpen && (
        <InventoryModal
          inventory={inventory}
          unseenCount={unseenInventoryCount}
          onClose={() => setIsInventoryOpen(false)}
          onSellCrop={handleSellCrop}
          onQuickSell={handleQuickSell}
          onToggleLock={handleToggleInventoryLock}
          onMarkSeen={handleMarkInventorySeen}
        />
      )}

      {/* Sách sưu tập thực vật cổ điển (Botanical Codex) */}
      {isCollectionOpen && (
        <CollectionModal
          collection={collection}
          userLevel={state?.farm?.level ?? 1}
          inventory={inventory}
          onClose={() => setIsCollectionOpen(false)}
          onRefresh={() => {
            fetchCollection();
            fetchFarmState();
          }}
          onNavigateToShop={(cropCode) => {
            setIsCollectionOpen(false);
            setShopTargetItemCode(cropCode);
            fetchShop();
            setIsShopOpen(true);
          }}
        />
      )}

      {/* Gian hàng nông trại gỗ lợp ngói - Farm Market */}
      {isShopOpen && (
        <FarmMarket
          shopCatalog={shopCatalog}
          rewardsCatalog={rewardsCatalog}
          userCoin={state?.farm?.farmCoin ?? 0}
          userPoints={state?.user?.loyaltyPoints ?? state?.user?.points ?? 0}
          userLevel={state?.farm?.level ?? 1}
          inventory={inventory}
          targetItemCode={shopTargetItemCode}
          isLoading={isShopLoading}
          onClose={() => {
            setIsShopOpen(false);
            setShopTargetItemCode(null);
          }}
          onPurchaseSeed={handlePurchaseSeed}
          onRedeemReward={handleRedeemReward}
          onExchangeProduce={handleExchangeProduce}
          onOpenSeedInfo={(crop) => setSelectedSeedDetail(crop)}
        />
      )}

      {/* Mystery Seed Reveal Overlay */}
      {mysteryRevealData?.isOpen && (
        <MysteryCropReveal
          isOpen={mysteryRevealData.isOpen}
          crop={mysteryRevealData.crop}
          isMutated={mysteryRevealData.isMutated}
          mutation={mysteryRevealData.mutation}
          isNewDiscovery={mysteryRevealData.isNewDiscovery}
          onClose={() => setMysteryRevealData(null)}
        />
      )}

      {/* Bảng nhiệm vụ thành tựu theo chương & hàng ngày */}
      {isMissionsOpen && (
        <MissionsModal
          missions={missions}
          summary={missionsSummary}
          onClose={() => setIsMissionsOpen(false)}
          onClaimReward={handleClaimMission}
          onClaimAllRewards={handleClaimAllMissions}
          onRefreshMissions={fetchMissions}
        />
      )}

      {/* Bảng giao lưu nông hữu */}
      {isFriendsOpen && (
        <FriendsModal
          overview={socialOverview}
          friends={friends}
          onClose={() => setIsFriendsOpen(false)}
          onVisitFarm={handleVisitFarm}
          onWaterFriend={handleWaterFriend}
          onGatherFriend={handleGatherFriend}
          onAddFriend={handleAddFriend}
          onAcceptFriend={handleAcceptFriend}
          onRejectFriend={handleRejectFriend}
        />
      )}

      {/* Trung tâm Đổi Thưởng AVORA */}
      <AvoraRewardsModal
        isOpen={isRewardsOpen}
        onClose={() => setIsRewardsOpen(false)}
        userCoin={state?.farm?.farmCoin ?? 0}
        userPoints={state?.user?.points ?? 0}
        farmLevel={state?.farm?.level ?? 1}
        rewardsCatalog={rewardsCatalog}
        onRedeemReward={handleRedeemReward}
        onExchangePoints={handleExchangePoints}
        onRefreshFarms={() => {
          fetchFarmState();
          fetchRewards();
        }}
      />

      {/* Ghé thăm nông trại bạn bè (Đã chuyển sang chế độ hiển thị vườn thật trực tiếp) */}

      {/* Nâng cấp Cấp độ Nông trại Thủ công */}
      <FarmLevelUpModal
        isOpen={isLevelUpModalOpen}
        onClose={() => setIsLevelUpModalOpen(false)}
        farm={state?.farm}
        userInventory={inventory}
        onLevelUpSuccess={handleLevelUpSuccess}
      />

      {/* Chi tiết Hạt giống */}
      <SeedInfoModal
        isOpen={Boolean(selectedSeedDetail)}
        onClose={() => setSelectedSeedDetail(null)}
        crop={selectedSeedDetail}
      />

      {/* Hướng dẫn Tân thủ */}
      <FarmTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onCompleted={() => {
          fetchFarmState();
          fetchInventory();
        }}
      />

      {/* Hoạt cảnh phát hiện đột biến */}
      {revealedMutation && (
        <MutationRevealModal
          data={revealedMutation}
          onClose={() => setRevealedMutation(null)}
        />
      )}

      {/* Bao Lì Xì May Mắn Cung Đình */}
      <LuckyEnvelopeModal
        isOpen={isLuckyEnvelopeModalOpen}
        onClose={() => {
          setIsLuckyEnvelopeModalOpen(false);
          setLastLuckyEnvelopeReward(null);
        }}
        availableTickets={state?.farm?.luckyEnvelopeTickets || 0}
        onOpenEnvelope={handleOpenLuckyEnvelope}
        lastReward={lastLuckyEnvelopeReward}
      />

      {/* Sổ cái Lịch sử Giao dịch Nông Trại Full-Screen */}
      <FarmHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        userCoin={state?.farm?.farmCoin ?? 0}
        userPoints={state?.user?.currentPoints ?? state?.user?.points ?? 0}
      />

      {/* Hòm Thư Nông Trại */}
      <FarmMailboxModal
        isOpen={isMailboxOpen}
        onClose={() => {
          setIsMailboxOpen(false);
          fetchUnreadMailCount();
        }}
        onRefreshFarms={() => {
          fetchFarmState();
          fetchUnreadMailCount();
        }}
        onMailClaimed={() => {
          fetchFarmState();
          fetchUnreadMailCount();
        }}
      />

      {/* Chi Tiết Năng Lượng Trang Trại & Hồi Phục 1⚡/3 Phút */}
      <EnergyDetailModal
        isOpen={isEnergyDetailOpen}
        onClose={() => setIsEnergyDetailOpen(false)}
        energy={state?.farm?.energy ?? 30}
        maxEnergy={state?.farm?.maxEnergy ?? 30}
        lastEnergyRecoveryAt={state?.farm?.lastEnergyRecoveryAt}
      />

      {/* Hướng Dẫn Kích Hoạt Toàn Màn Hình 100% Native Game App Trên iOS */}
      <IOSFullscreenGuideModal
        isOpen={isIOSGuideOpen}
        onClose={() => setIsIOSGuideOpen(false)}
      />
    </div>
  );
}
