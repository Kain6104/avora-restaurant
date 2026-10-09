'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import {
  Layers,
  Sparkles,
  Save,
  Send,
  RotateCcw,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Copy,
  Sun,
  Moon,
  Smartphone,
  Monitor,
  Maximize2,
  Sliders,
  Image as ImageIcon,
  Compass,
  AlertTriangle,
  History,
  CheckCircle2,
  X,
  UploadCloud,
  Search,
  FolderPlus,
  Move,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  Flame,
  Wind,
  Droplets,
  HelpCircle,
  Clock,
  Award,
  TrendingUp,
  Coins,
  Zap,
} from 'lucide-react';
import AdminFarmNav from '../components/AdminFarmNav';
import { farmEventBus } from '@/app/farm/game/services/farmEventBus';

// Dynamic import FarmCanvas so Phaser only runs in browser
const FarmCanvas = dynamic(
  () => import('@/app/farm/components/canvas/FarmCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0e1712] text-white">
        <div className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-amber-200 font-medium">Đang khởi tạo Visual Island Canvas...</p>
      </div>
    ),
  }
);

interface GardenAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  originalUrl?: string;
  avifUrl?: string;
  webpUrl?: string;
  fallbackUrl: string;
  originalFormat: string;
  mimeType: string;
  originalFileSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  defaultAnchorX: number;
  defaultAnchorY: number;
  defaultScale: number;
  isActive: boolean;
  usedCount: number;
}

interface GardenObject {
  id?: string;
  objectKey: string;
  layoutVersionId?: string;
  objectType: 'PLOT' | 'DECORATION' | 'TREE' | 'EFFECT';
  assetId?: string | null;
  parentId?: string | null;
  plotIndex?: number | null;
  name?: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  anchorX: number;
  anchorY: number;
  flipX: boolean;
  flipY: boolean;
  isVisible: boolean;
  isLocked: boolean;
  displayMode: 'ALWAYS' | 'DAY_ONLY' | 'NIGHT_ONLY';
  deviceMode: 'ALL' | 'DESKTOP_ONLY' | 'MOBILE_ONLY';
  animationConfig?: any;
  styleConfig?: any;
  startAt?: string | null;
  endAt?: string | null;
  asset?: GardenAsset | null;
}

interface LayoutVersion {
  id: string;
  layoutId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  revision: number;
  createdByUserId: string;
  publishedByUserId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  layout?: {
    id: string;
    code: string;
    name: string;
  };
  createdByUser?: { fullName: string; email: string };
  publishedByUser?: { fullName: string; email: string };
  objects: GardenObject[];
}

const ASSET_CATEGORIES = [
  'ALL',
  'TREE',
  'FLOWER',
  'GRASS',
  'STONE',
  'FENCE',
  'LANTERN',
  'ENVELOPE',
  'FIREFLY',
  'BUTTERFLY',
  'PETAL',
  'CLOUD',
  'MIST',
  'LIGHT_RAY',
  'POND',
  'WATERFALL',
  'EVENT',
];

const CATEGORY_NAMES_VN: Record<string, string> = {
  ALL: 'Tất cả',
  TREE: 'Cây cối',
  FLOWER: 'Hoa tươi',
  GRASS: 'Cỏ cây',
  STONE: 'Đá cuội',
  FENCE: 'Hàng rào',
  LANTERN: 'Đèn lồng',
  ENVELOPE: 'Bao lì xì',
  FIREFLY: 'Đom đóm',
  BUTTERFLY: 'Bướm hoa',
  PETAL: 'Cánh hoa',
  CLOUD: 'Mây trôi',
  MIST: 'Sương mù',
  LIGHT_RAY: 'Tia sáng',
  POND: 'Hồ nước',
  WATERFALL: 'Thác nước',
  EVENT: 'Sự kiện',
};

const getObjectBaseDimensions = (obj: GardenObject) => {
  if (obj.objectType === 'PLOT') {
    return { baseW: 264, baseH: 168 };
  }
  if (obj.objectKey === 'prop_avora_tree' || obj.objectType === 'TREE') {
    return { baseW: 412, baseH: 550 };
  }
  return {
    baseW: obj.asset?.width || 200,
    baseH: obj.asset?.height || 200,
  };
};

const ANIMATION_PRESETS = [
  { key: 'NONE', label: 'Tĩnh (Không hoạt ảnh)' },
  { key: 'SWAY', label: 'Lắc lư tự nhiên (Gốc tĩnh)' },
  { key: 'SWAY_SOFT', label: 'Đung đưa nhẹ thoảng gió' },
  { key: 'SWAY_WIND', label: 'Gió mạnh đu đưa' },
  { key: 'LANTERN_SWAY', label: 'Đèn lồng lắc lư quả lắc' },
  { key: 'FLOAT', label: 'Bay bồng bềnh lơ lửng' },
  { key: 'FLOAT_RANDOM', label: 'Bồng bềnh ngẫu nhiên' },
  { key: 'FIREFLY', label: 'Đom đóm lượn đêm' },
  { key: 'BUTTERFLY', label: 'Bươm bướm dập dờn' },
  { key: 'PULSE', label: 'Nhịp đập phóng to thu nhỏ' },
  { key: 'BREATHING', label: 'Thở nhẹ êm dịu' },
  { key: 'GLOW', label: 'Hào quang nhấp nháy' },
  { key: 'TWINKLE', label: 'Ánh sao lấp lánh' },
  { key: 'SPARKLE', label: 'Tia sáng bung tỏa' },
  { key: 'PETAL_FALL', label: 'Cánh hoa đào rơi' },
  { key: 'LEAF_FALL', label: 'Lá phong rụng' },
  { key: 'WATER_FLOW', label: 'Dòng nước cuộn sóng' },
  { key: 'WATER_SHIMMER', label: 'Mặt nước phản chiếu nắng' },
  { key: 'FLAME', label: 'Ngọn lửa bập bùng' },
];

export default function AdminGardenLayoutPage() {
  // State phiên bản bố cục
  const [currentVersion, setCurrentVersion] = useState<LayoutVersion | null>(null);
  const [layoutList, setLayoutList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Chế độ xem & preview
  const [themeMode, setThemeMode] = useState<'DAY' | 'NIGHT'>('DAY');
  const [deviceMode, setDeviceMode] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Tabs thanh bên trái
  const [activeLeftTab, setActiveLeftTab] = useState<'assets' | 'plots' | 'layers' | 'levels' | 'history'>('assets');
  const [assetSearchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Thư viện Assets
  const [assets, setAssets] = useState<GardenAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadCode, setUploadCode] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('TREE');
  const [uploading, setUploading] = useState(false);

  // Danh mục Nông sản & Quản trị Cấp độ (Levels)
  const [availableCrops, setAvailableCrops] = useState<any[]>([]);
  const [farmLevels, setFarmLevels] = useState<any[]>([]);
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(1);
  const [editingLevel, setEditingLevel] = useState<any>(null);
  const [savingLevel, setSavingLevel] = useState(false);
  const [newPlotReqCropCode, setNewPlotReqCropCode] = useState('');
  const [newPlotReqCropQty, setNewPlotReqCropQty] = useState(1);
  const [newLevelCropCode, setNewLevelCropCode] = useState('');
  const [newLevelCropQty, setNewLevelCropQty] = useState(1);

  // Selection & Inspector
  const [selectedObjectKey, setSelectedObjectKey] = useState<string | null>(null);
  const [isAspectLocked, setIsAspectLocked] = useState(true);
  const [applyScope, setApplyScope] = useState<'CURRENT' | 'ALL_PLOTS' | 'SAME_TYPE' | 'DESKTOP_ONLY' | 'MOBILE_ONLY' | 'ALL_DEVICES'>('CURRENT');

  // Modal Áp dụng làm kích thước mặc định (Toàn hệ thống FarmPlantAsset)
  const [isDefaultScaleModalOpen, setIsDefaultScaleModalOpen] = useState(false);
  const [defaultScaleScope, setDefaultScaleScope] = useState<'SELECTED_CROP_ALL_STAGES' | 'SPECIFIC_STAGE' | 'MUTATIONS' | 'ALL_CROPS'>('SELECTED_CROP_ALL_STAGES');
  const [defaultScaleCropCode, setDefaultScaleCropCode] = useState<string>('CORN');
  const [defaultScaleStageIndex, setDefaultScaleStageIndex] = useState<number>(5);
  const [defaultScaleValue, setDefaultScaleValue] = useState<number>(1.0);
  const [isApplyingDefaultScale, setIsApplyingDefaultScale] = useState(false);

  // History stack for Undo / Redo
  const [undoStack, setUndoStack] = useState<GardenObject[][]>([]);
  const [redoStack, setRedoStack] = useState<GardenObject[][]>([]);

  // Plot usage verification modal
  const [plotSafetyWarning, setPlotSafetyWarning] = useState<{
    plotIndex: number;
    activeCropsCount: number;
    objectId: string;
  } | null>(null);

  // Rollback modal
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);

  // Ref lưu objects phục vụ undo / redo
  const objectsRef = useRef<GardenObject[]>([]);
  objectsRef.current = currentVersion?.objects || [];

  // 1. Tải danh sách Layout và active version
  const fetchLayoutData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/garden-layout', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setLayoutList(json.data || []);

        // Tải layout active hoặc version đầu tiên
        const activeRes = await fetch('/api/admin/farm/garden-layout/active', { credentials: 'include' });
        if (activeRes.ok) {
          const activeJson = await activeRes.json();
          if (activeJson.data) {
            setCurrentVersion(activeJson.data);
            setUndoStack([]);
            setRedoStack([]);
          }
        }
      } else {
        toast.error('Không thể tải dữ liệu bố cục nông trại');
      }
    } catch (e) {
      toast.error('Lỗi mạng khi kết nối tới máy chủ');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Tải thư viện Garden Assets
  const fetchGardenAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      const res = await fetch('/api/admin/farm/garden-assets', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data || []);
      }
    } catch {
      toast.error('Không thể nạp thư viện ảnh trang trí');
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  // 3. Tải danh mục Nông sản
  const fetchCrops = useCallback(async () => {
    try {
      const res = await fetch('/api/farm/crops', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const cropsList = json.data || [];
        setAvailableCrops(cropsList);
        if (cropsList.length > 0) {
          setNewPlotReqCropCode((prev) => prev || cropsList[0].code);
          setNewLevelCropCode((prev) => prev || cropsList[0].code);
        }
      }
    } catch {
      // silent
    }
  }, []);

  // 4. Tải danh mục Cấp độ (Levels)
  const fetchLevels = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/farm/levels', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const lvList = json.data || [];
        setFarmLevels(lvList);
        if (lvList.length > 0) {
          setEditingLevel((prev: any) => {
            if (prev) {
              const matched = lvList.find((l: any) => l.level === prev.level);
              return matched || prev;
            }
            return lvList[0];
          });
          setSelectedLevelNum((prev) => prev || lvList[0].level);
        }
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchLayoutData();
    fetchGardenAssets();
    fetchCrops();
    fetchLevels();
  }, [fetchLayoutData, fetchGardenAssets, fetchCrops, fetchLevels]);

  // Lắng nghe các sự kiện từ Phaser Scene qua farmEventBus
  useEffect(() => {
    const unsubSelect = farmEventBus.on('GARDEN_OBJECT_SELECTED', (key: string | null) => {
      setSelectedObjectKey(key);
    });

    const unsubDragging = farmEventBus.on('GARDEN_OBJECT_DRAGGING', (data: { objectKey: string; positionX: number; positionY: number }) => {
      // Cập nhật tọa độ real-time trong state mà không ghi undo stack
      setCurrentVersion((prev) => {
        if (!prev) return prev;
        const newObjs = prev.objects.map((obj) => {
          if (obj.objectKey === data.objectKey) {
            return { ...obj, positionX: data.positionX, positionY: data.positionY };
          }
          return obj;
        });
        return { ...prev, objects: newObjs };
      });
    });

    const unsubTransformed = farmEventBus.on('GARDEN_OBJECT_TRANSFORMED', (data: { objectKey: string; positionX: number; positionY: number }) => {
      // Khi kéo xong, lưu snapshot vào undo stack
      pushUndoState();
      setCurrentVersion((prev) => {
        if (!prev) return prev;
        const newObjs = prev.objects.map((obj) => {
          if (obj.objectKey === data.objectKey) {
            return { ...obj, positionX: data.positionX, positionY: data.positionY };
          }
          return obj;
        });
        return { ...prev, objects: newObjs };
      });
    });

    const unsubResizing = farmEventBus.on('GARDEN_OBJECT_RESIZING', (data: { objectKey: string; width: number; height: number; scaleX: number; scaleY: number }) => {
      setCurrentVersion((prev) => {
        if (!prev) return prev;
        const newObjs = prev.objects.map((obj) => {
          if (obj.objectKey === data.objectKey) {
            return {
              ...obj,
              width: data.width,
              height: data.height,
              scaleX: data.scaleX,
              scaleY: data.scaleY,
            };
          }
          return obj;
        });
        return { ...prev, objects: newObjs };
      });
    });

    const unsubResized = farmEventBus.on('GARDEN_OBJECT_RESIZED', (data: { objectKey: string; width: number; height: number; scaleX: number; scaleY: number }) => {
      pushUndoState();
      setCurrentVersion((prev) => {
        if (!prev) return prev;
        const newObjs = prev.objects.map((obj) => {
          if (obj.objectKey === data.objectKey) {
            return {
              ...obj,
              width: data.width,
              height: data.height,
              scaleX: data.scaleX,
              scaleY: data.scaleY,
            };
          }
          return obj;
        });
        return { ...prev, objects: newObjs };
      });
    });

    return () => {
      unsubSelect();
      unsubDragging();
      unsubTransformed();
      unsubResizing();
      unsubResized();
    };
  }, []);

  // Helper push state vào Undo stack
  const pushUndoState = useCallback(() => {
    if (objectsRef.current.length > 0) {
      setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(objectsRef.current))]);
      setRedoStack([]); // Clear redo
    }
  }, []);

  // Xử lý Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !currentVersion) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(currentVersion.objects))]);
    setUndoStack((prev) => prev.slice(0, -1));

    setCurrentVersion((prev) => (prev ? { ...prev, objects: previousState } : prev));
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: { ...currentVersion, objects: previousState }, editorMode: !isPreviewMode });
    toast.success('Đã hoàn tác (Undo)', { duration: 1200 });
  }, [undoStack, currentVersion, isPreviewMode]);

  // Xử lý Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !currentVersion) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(currentVersion.objects))]);
    setRedoStack((prev) => prev.slice(0, -1));

    setCurrentVersion((prev) => (prev ? { ...prev, objects: nextState } : prev));
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: { ...currentVersion, objects: nextState }, editorMode: !isPreviewMode });
    toast.success('Đã làm lại (Redo)', { duration: 1200 });
  }, [redoStack, currentVersion, isPreviewMode]);

  // Phím tắt Keyboard (Ctrl+Z, Ctrl+Y, Delete, Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang gõ text trong input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedObjectKey) {
          handleDuplicateObject(selectedObjectKey);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectKey) {
          handleDeleteObjectClick(selectedObjectKey);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedObjectKey]);

  // Đối tượng đang được chọn
  const selectedObject = useMemo(() => {
    if (!currentVersion || !selectedObjectKey) return null;
    return currentVersion.objects.find((o) => o.objectKey === selectedObjectKey) || null;
  }, [currentVersion, selectedObjectKey]);

  // Cập nhật thuộc tính một đối tượng (hỗ trợ Scope: CURRENT, ALL_PLOTS, SAME_TYPE, DESKTOP_ONLY, MOBILE_ONLY, ALL_DEVICES)
  const handleUpdateObjectProps = useCallback(
    (key: string, updates: Partial<GardenObject>, customScope?: string) => {
      pushUndoState();
      const effectiveScope = customScope || applyScope;

      setCurrentVersion((prev) => {
        if (!prev) return prev;
        const targetObj = prev.objects.find((o) => o.objectKey === key);
        if (!targetObj) return prev;

        const updatedObjs = prev.objects.map((o) => {
          let shouldUpdate = false;
          if (effectiveScope === 'CURRENT') {
            shouldUpdate = o.objectKey === key;
          } else if (effectiveScope === 'ALL_PLOTS') {
            shouldUpdate = o.objectType === 'PLOT';
          } else if (effectiveScope === 'SAME_TYPE') {
            shouldUpdate = o.objectType === targetObj.objectType;
          } else if (effectiveScope === 'DESKTOP_ONLY') {
            shouldUpdate = o.objectKey === key;
            updates = { ...updates, deviceMode: 'DESKTOP_ONLY' };
          } else if (effectiveScope === 'MOBILE_ONLY') {
            shouldUpdate = o.objectKey === key;
            updates = { ...updates, deviceMode: 'MOBILE_ONLY' };
          } else if (effectiveScope === 'ALL_DEVICES') {
            shouldUpdate = o.objectKey === key;
            updates = { ...updates, deviceMode: 'ALL' };
          } else {
            shouldUpdate = o.objectKey === key;
          }

          if (shouldUpdate) {
            return { ...o, ...updates };
          }
          return o;
        });

        const newVersion = { ...prev, objects: updatedObjs };
        farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: newVersion, editorMode: !isPreviewMode });
        return newVersion;
      });
    },
    [pushUndoState, isPreviewMode, applyScope]
  );

  // Sao chép kích thước sang tất cả ô đất
  const handleCopySizeToAllPlots = useCallback(
    (sourceObj: GardenObject) => {
      if (!currentVersion || sourceObj.objectType !== 'PLOT') return;
      pushUndoState();
      setCurrentVersion((prev) => {
        if (!prev) return prev;
        const updatedObjs = prev.objects.map((o) => {
          if (o.objectType === 'PLOT') {
            return {
              ...o,
              width: sourceObj.width,
              height: sourceObj.height,
              scaleX: sourceObj.scaleX,
              scaleY: sourceObj.scaleY,
              styleConfig: {
                ...(o.styleConfig || {}),
                plantScale: sourceObj.styleConfig?.plantScale,
                plantWidth: sourceObj.styleConfig?.plantWidth,
                plantHeight: sourceObj.styleConfig?.plantHeight,
                plantOffsetX: sourceObj.styleConfig?.plantOffsetX,
                plantOffsetY: sourceObj.styleConfig?.plantOffsetY,
                plantAnchorX: sourceObj.styleConfig?.plantAnchorX,
                plantAnchorY: sourceObj.styleConfig?.plantAnchorY,
                minScale: sourceObj.styleConfig?.minScale,
                maxScale: sourceObj.styleConfig?.maxScale,
                lockAspectRatio: sourceObj.styleConfig?.lockAspectRatio,
                stages: sourceObj.styleConfig?.stages ? JSON.parse(JSON.stringify(sourceObj.styleConfig.stages)) : undefined,
              },
            };
          }
          return o;
        });
        const newVersion = { ...prev, objects: updatedObjs };
        farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: newVersion, editorMode: !isPreviewMode });
        toast.success('Đã sao chép kích thước sang tất cả 16 ô đất!');
        return newVersion;
      });
    },
    [currentVersion, pushUndoState, isPreviewMode]
  );

  // Khôi phục kích thước mặc định cho đối tượng
  const handleResetObjectSize = useCallback(
    (sourceObj: GardenObject) => {
      if (!currentVersion) return;
      pushUndoState();
      const isPlot = sourceObj.objectType === 'PLOT';
      const isTree = sourceObj.objectKey === 'prop_avora_tree' || sourceObj.objectType === 'TREE';
      const { baseW, baseH } = getObjectBaseDimensions(sourceObj);
      const defaultScale = isTree ? 0.532 : 1.0;

      const updates: Partial<GardenObject> = {
        scaleX: defaultScale,
        scaleY: defaultScale,
        width: Math.round(baseW * defaultScale),
        height: Math.round(baseH * defaultScale),
      };

      if (isPlot) {
        updates.styleConfig = {
          ...(sourceObj.styleConfig || {}),
          plantScale: 1.0,
          plantWidth: undefined,
          plantHeight: undefined,
          plantOffsetX: 0,
          plantOffsetY: 0,
          plantAnchorX: undefined,
          plantAnchorY: undefined,
          minScale: 0.2,
          maxScale: 4.0,
          lockAspectRatio: true,
          stages: undefined,
        };
      }

      handleUpdateObjectProps(sourceObj.objectKey, updates, 'CURRENT');
      toast.success('Đã khôi phục kích thước chuẩn mặc định!');
    },
    [currentVersion, pushUndoState, handleUpdateObjectProps]
  );

  // Áp dụng làm kích thước mặc định cho FarmPlantAsset
  const handleConfirmApplyDefaultScale = async () => {
    try {
      setIsApplyingDefaultScale(true);
      const res = await fetch('/api/admin/farm/assets/apply-default-scale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cropCode: defaultScaleCropCode,
          stageIndex: defaultScaleScope === 'SPECIFIC_STAGE' ? defaultScaleStageIndex : undefined,
          renderScale: defaultScaleValue,
          scope: defaultScaleScope,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Thất bại khi cập nhật asset');
      }
      toast.success(`Đã lưu kích thước mặc định cho ${json.data?.updatedCount || 'các'} assets thành công!`);
      setIsDefaultScaleModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi áp dụng kích thước mặc định');
    } finally {
      setIsApplyingDefaultScale(false);
    }
  };

  // Thêm asset từ thư viện lên đảo
  const handleAddAssetToIsland = useCallback((asset: GardenAsset) => {
    if (!currentVersion) return;
    pushUndoState();

    const timestamp = Date.now();
    const newKey = `dec_${asset.code.toLowerCase()}_${timestamp}`;

    const newObj: GardenObject = {
      objectKey: newKey,
      objectType: asset.category === 'TREE' ? 'TREE' : 'DECORATION',
      assetId: asset.id,
      name: asset.name,
      positionX: 0, // Tâm đảo
      positionY: 100,
      width: asset.width || 128,
      height: asset.height || 128,
      scaleX: asset.defaultScale || 1.0,
      scaleY: asset.defaultScale || 1.0,
      rotation: 0,
      opacity: 1.0,
      zIndex: 1000,
      anchorX: asset.defaultAnchorX || 0.5,
      anchorY: asset.defaultAnchorY || 1.0,
      flipX: false,
      flipY: false,
      isVisible: true,
      isLocked: false,
      displayMode: 'ALWAYS',
      deviceMode: 'ALL',
      animationConfig: {
        preset: asset.category === 'LANTERN' ? 'LANTERN_SWAY' : asset.category === 'TREE' ? 'SWAY' : 'NONE',
        duration: 3000,
        staticBaseEnabled: asset.category === 'TREE',
        staticBaseRatio: 0.28,
      },
      asset,
    };

    const newObjs = [...currentVersion.objects, newObj];
    const newVersion = { ...currentVersion, objects: newObjs };
    setCurrentVersion(newVersion);
    setSelectedObjectKey(newKey);
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: newVersion, editorMode: !isPreviewMode });
    toast.success(`Đã thêm "${asset.name}" lên đảo!`);
  }, [currentVersion, pushUndoState, isPreviewMode]);

  // Thêm ô đất mới (tìm plotIndex khả dụng)
  const handleAddNewPlot = useCallback(() => {
    if (!currentVersion) return;
    pushUndoState();

    const existingIndexes = new Set(
      currentVersion.objects
        .filter((o) => o.objectType === 'PLOT' && o.plotIndex !== null && o.plotIndex !== undefined)
        .map((o) => o.plotIndex as number)
    );

    let nextIndex = 0;
    while (existingIndexes.has(nextIndex)) {
      nextIndex++;
    }

    const newKey = `plot_${nextIndex}`;
    const newPlotObj: GardenObject = {
      objectKey: newKey,
      objectType: 'PLOT',
      plotIndex: nextIndex,
      name: `Ô đất #${nextIndex + 1}`,
      positionX: -100 + (nextIndex % 5) * 40,
      positionY: 200 + Math.floor(nextIndex / 5) * 30,
      width: 264,
      height: 168,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      zIndex: Math.round(200 * 10),
      anchorX: 0.5,
      anchorY: 0.45,
      flipX: false,
      flipY: false,
      isVisible: true,
      isLocked: false,
      displayMode: 'ALWAYS',
      deviceMode: 'ALL',
    };

    const newObjs = [...currentVersion.objects, newPlotObj];
    const newVersion = { ...currentVersion, objects: newObjs };
    setCurrentVersion(newVersion);
    setSelectedObjectKey(newKey);
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: newVersion, editorMode: !isPreviewMode });
    toast.success(`Đã thêm Vị trí Ô đất #${nextIndex + 1}!`);
  }, [currentVersion, pushUndoState, isPreviewMode]);

  // Nhân bản object (Duplicate)
  const handleDuplicateObject = useCallback((key: string) => {
    if (!currentVersion) return;
    const target = currentVersion.objects.find((o) => o.objectKey === key);
    if (!target) return;

    if (target.objectType === 'PLOT') {
      toast.error('Không thể nhân bản ô đất bằng duplicate, hãy dùng "Thêm ô đất"!');
      return;
    }

    pushUndoState();
    const timestamp = Date.now();
    const dupKey = `${target.objectKey}_dup_${timestamp}`;
    const duplicateObj: GardenObject = {
      ...JSON.parse(JSON.stringify(target)),
      id: undefined,
      objectKey: dupKey,
      name: `${target.name || 'Vật thể'} (Bản sao)`,
      positionX: target.positionX + 25,
      positionY: target.positionY + 25,
      zIndex: (target.zIndex || 0) + 1,
    };

    const newObjs = [...currentVersion.objects, duplicateObj];
    const newVersion = { ...currentVersion, objects: newObjs };
    setCurrentVersion(newVersion);
    setSelectedObjectKey(dupKey);
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: newVersion, editorMode: !isPreviewMode });
    toast.success('Đã nhân bản đối tượng thành công!');
  }, [currentVersion, pushUndoState, isPreviewMode]);

  // Xóa object (Kiểm tra an toàn nếu là ô đất)
  const handleDeleteObjectClick = useCallback(async (key: string) => {
    if (!currentVersion) return;
    const target = currentVersion.objects.find((o) => o.objectKey === key);
    if (!target) return;

    if (target.objectType === 'PLOT' && target.plotIndex !== null && target.plotIndex !== undefined) {
      try {
        const res = await fetch(`/api/admin/farm/garden-layout/plots/${target.plotIndex}/usage`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.activeCropsCount > 0) {
            setPlotSafetyWarning({
              plotIndex: target.plotIndex,
              activeCropsCount: json.data.activeCropsCount,
              objectId: key,
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra trạng thái ô đất:', err);
      }
    }

    // Xóa an toàn
    pushUndoState();
    const newObjs = currentVersion.objects.filter((o) => o.objectKey !== key);
    const newVersion = { ...currentVersion, objects: newObjs };
    setCurrentVersion(newVersion);
    setSelectedObjectKey(null);
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: newVersion, editorMode: !isPreviewMode });
    toast.success('Đã xóa đối tượng khỏi bố cục');
  }, [currentVersion, pushUndoState, isPreviewMode]);

  // Lưu bản nháp (Save Draft) kèm Optimistic Locking qua revision
  const handleSaveDraft = async () => {
    if (!currentVersion) return null;
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/farm/garden-layout/version/${currentVersion.id}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          revision: currentVersion.revision,
          objects: currentVersion.objects,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setCurrentVersion(json.data);
        toast.success(`Đã lưu bản nháp thành công (Revision ${json.data.revision})!`);
        return json.data;
      } else if (res.status === 409) {
        toast.error(json.error?.message || 'Xung đột phiên bản! Bố cục vừa được chỉnh sửa bởi Admin khác.');
        return null;
      } else {
        toast.error(json.error?.message || 'Không thể lưu bản nháp');
        return null;
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi lưu dữ liệu');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Xuất bản (Publish Layout)
  const handlePublishLayout = async () => {
    if (!currentVersion) return;

    const confirm = window.confirm(
      `Bạn có chắc chắn muốn XUẤT BẢN Phiên bản ${currentVersion.version} không?\n\nToàn bộ người chơi sẽ nhìn thấy bố cục này ngay lập tức.`
    );
    if (!confirm) return;

    try {
      setPublishing(true);
      // 1. Lưu nháp trước và nhận về revision mới nhất từ server
      const savedVersion = await handleSaveDraft();
      if (!savedVersion) {
        setPublishing(false);
        return;
      }

      // 2. Xuất bản phiên bản với đúng revision vừa được lưu
      const res = await fetch(`/api/admin/farm/garden-layout/version/${savedVersion.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          revision: savedVersion.revision,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setCurrentVersion(json.data);
        toast.success(`🎉 Đã xuất bản thành công Phiên bản ${json.data.version}! Toàn bộ người chơi đã được đồng bộ.`);
        fetchLayoutData();
      } else {
        toast.error(json.error?.message || 'Không thể xuất bản bố cục');
      }
    } catch {
      toast.error('Lỗi khi xuất bản bố cục');
    } finally {
      setPublishing(false);
    }
  };

  // Đặt lại vị trí của một ô đất về tọa độ chuẩn Isometric
  const handleResetSinglePlot = useCallback((plotIndex: number) => {
    const row = Math.floor(plotIndex / 5);
    const col = plotIndex % 5;
    const originX = -280;
    const originY = -35;
    const posX = originX + (col - row) * 152;
    const posY = originY + (col + row) * 78;

    pushUndoState();
    handleUpdateObjectProps(`plot_${plotIndex}`, {
      positionX: posX,
      positionY: posY,
      zIndex: Math.max(10, Math.round(posY * 10)),
      rotation: 0,
      scaleX: 1.0,
      scaleY: 1.0,
    });

    farmEventBus.emit('RESET_PLOT_POSITION', { plotIndex });
    toast.success(`Đã căn chỉnh ô đất #${plotIndex + 1} về tọa độ chuẩn (${posX}, ${posY})`);
  }, [pushUndoState, handleUpdateObjectProps]);

  // Đặt lại toàn bộ 25 ô đất về lưới Isometric chuẩn
  const handleResetAllPlots = useCallback(() => {
    if (!currentVersion) return;
    const confirm = window.confirm('Bạn có chắc chắn muốn đặt lại toàn bộ 25 ô đất về bố cục lưới Isometric chuẩn?');
    if (!confirm) return;

    pushUndoState();
    const originX = -280;
    const originY = -35;

    const newObjs = currentVersion.objects.map((obj) => {
      if (obj.objectType === 'PLOT' && obj.plotIndex !== null && obj.plotIndex !== undefined) {
        const row = Math.floor(obj.plotIndex / 5);
        const col = obj.plotIndex % 5;
        const posX = originX + (col - row) * 152;
        const posY = originY + (col + row) * 78;
        return {
          ...obj,
          positionX: posX,
          positionY: posY,
          zIndex: Math.max(10, Math.round(posY * 10)),
          rotation: 0,
          scaleX: 1.0,
          scaleY: 1.0,
        };
      }
      return obj;
    });

    const updated = { ...currentVersion, objects: newObjs };
    setCurrentVersion(updated);
    farmEventBus.emit('SET_GARDEN_LAYOUT', { layout: updated, editorMode: !isPreviewMode });
    toast.success('Đã đặt lại toàn bộ 25 ô đất về lưới chuẩn!');
  }, [currentVersion, isPreviewMode, pushUndoState]);

  // Lưu cấu hình Cấp độ Nông trại (Level Config)
  const handleSaveLevelConfig = async () => {
    if (!editingLevel) return;
    try {
      setSavingLevel(true);
      const res = await fetch(`/api/admin/farm/levels/${editingLevel.level}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          expRequired: Number(editingLevel.expRequired) || 0,
          coinCost: Number(editingLevel.coinCost) || 0,
          pointCost: Number(editingLevel.pointCost) || 0,
          requiredCrops: editingLevel.requiredCrops || [],
          speedBoost: Number(editingLevel.speedBoost) || 0,
          energyBonus: Number(editingLevel.energyBonus) || 5,
          sellPriceBoost: Number(editingLevel.sellPriceBoost) || 0,
          unlockTitle: editingLevel.unlockTitle || '',
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Đã lưu cấu hình Cấp độ ${editingLevel.level} thành công!`);
        fetchLevels();
      } else {
        toast.error(json.error?.message || 'Không thể lưu cấu hình cấp độ');
      }
    } catch {
      toast.error('Lỗi khi lưu cấu hình cấp độ');
    } finally {
      setSavingLevel(false);
    }
  };

  // Tạo mới cấp độ tiếp theo
  const handleCreateNewLevel = async () => {
    const nextLevel = farmLevels.length > 0 ? Math.max(...farmLevels.map((l) => l.level)) + 1 : 1;
    try {
      setSavingLevel(true);
      const res = await fetch('/api/admin/farm/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          level: nextLevel,
          expRequired: nextLevel * 150,
          coinCost: nextLevel * 100,
          pointCost: nextLevel * 10,
          requiredCrops: [],
          speedBoost: 0.02,
          energyBonus: 5,
          sellPriceBoost: 0.05,
          unlockTitle: `Thần Điền Tầng ${nextLevel}`,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Đã tạo mới Cấp độ ${nextLevel}!`);
        await fetchLevels();
        setEditingLevel(json.data);
        setSelectedLevelNum(nextLevel);
      } else {
        toast.error(json.error?.message || 'Không thể tạo cấp độ mới');
      }
    } catch {
      toast.error('Lỗi khi tạo cấp độ mới');
    } finally {
      setSavingLevel(false);
    }
  };

  // Upload file Asset mới
  const handleUploadAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadCode || !uploadName) {
      toast.error('Vui lòng điền đủ thông tin và chọn file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('code', uploadCode);
      formData.append('name', uploadName);
      formData.append('category', uploadCategory);

      const res = await fetch('/api/admin/farm/garden-assets/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Đã tải lên asset "${uploadName}" thành công!`);
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setUploadPreview(null);
        setUploadCode('');
        setUploadName('');
        fetchGardenAssets();
      } else {
        toast.error(json.error?.message || 'Tải ảnh thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi tải file');
    } finally {
      setUploading(false);
    }
  };

  // Lọc danh sách Asset
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchCat = selectedCategory === 'ALL' || a.category === selectedCategory;
      const matchSearch =
        !assetSearchQuery.trim() ||
        a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
        a.code.toLowerCase().includes(assetSearchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [assets, selectedCategory, assetSearchQuery]);

  // Nhóm Layers theo loại
  const groupedLayers = useMemo(() => {
    if (!currentVersion) return [];
    return [...currentVersion.objects].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
  }, [currentVersion]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-900 text-slate-100 font-sans">
      {/* 1. Header Navigation */}
      <div className="shrink-0 bg-white text-slate-900 px-4 pt-2">
        <AdminFarmNav />
      </div>

      {/* 2. Top Editor Action Toolbar */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between gap-3 select-none z-10 shadow-md">
        {/* Left: Layout Info & Version Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {currentVersion?.layout?.name || 'Bố Cục Đảo Tiên AVORA'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    currentVersion?.status === 'PUBLISHED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : currentVersion?.status === 'ARCHIVED'
                      ? 'bg-slate-700 text-slate-400 border border-slate-600'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {currentVersion?.status === 'PUBLISHED'
                    ? 'Đang Áp Dụng'
                    : currentVersion?.status === 'ARCHIVED'
                    ? 'Lưu Trữ'
                    : 'Bản Nháp (DRAFT)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Phiên bản v{currentVersion?.version || 1} • Revision {currentVersion?.revision ?? 0} •{' '}
                {currentVersion?.objects?.length || 0} đối tượng
              </p>
            </div>
          </div>
        </div>

        {/* Center: Tools (Undo, Redo, Snap, Day/Night, Device Preview) */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700/60">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Hoàn tác (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Làm lại (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          {/* Snap Line Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              snapEnabled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MagnetIcon className="w-3.5 h-3.5" />
            <span>Snap Line</span>
          </button>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          {/* Day / Night Mode Toggle */}
          <button
            onClick={() => {
              const next = themeMode === 'DAY' ? 'NIGHT' : 'DAY';
              setThemeMode(next);
              farmEventBus.emit('WEATHER_CHANGED', next === 'NIGHT' ? 'NIGHT' : 'SUNNY');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              themeMode === 'NIGHT' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {themeMode === 'NIGHT' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{themeMode === 'NIGHT' ? 'Ban Đêm' : 'Ban Ngày'}</span>
          </button>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          {/* Desktop / Mobile Preview Toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDeviceMode('DESKTOP')}
              title="Xem trước Desktop"
              className={`p-1.5 rounded-lg transition-all ${
                deviceMode === 'DESKTOP' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceMode('MOBILE')}
              title="Xem trước Mobile iPhone"
              className={`p-1.5 rounded-lg transition-all ${
                deviceMode === 'MOBILE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          {/* Preview Mode Toggle */}
          <button
            onClick={() => {
              const nextMode = !isPreviewMode;
              setIsPreviewMode(nextMode);
              if (nextMode) {
                setSelectedObjectKey(null);
              }
              farmEventBus.emit('SET_EDITOR_MODE', !nextMode);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isPreviewMode ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isPreviewMode ? 'Đang Xem Trước' : 'Chỉnh Sửa'}</span>
          </button>
        </div>

        {/* Right: Save & Publish & History */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsRollbackModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1.5 transition-all"
          >
            <History className="w-3.5 h-3.5" />
            <span>Lịch Sử</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Đang lưu...' : 'Lưu Nháp'}</span>
          </button>

          <button
            onClick={handlePublishLayout}
            disabled={publishing}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center gap-1.5 shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{publishing ? 'Đang xuất bản...' : 'Xuất Bản'}</span>
          </button>
        </div>
      </div>

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Drawer / Panel (Asset Library, Plots, Layers) */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 z-10 shadow-xl">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-700 bg-slate-850">
            <button
              onClick={() => setActiveLeftTab('assets')}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${
                activeLeftTab === 'assets'
                  ? 'border-amber-500 text-amber-400 bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Thư Viện</span>
            </button>
            <button
              onClick={() => setActiveLeftTab('plots')}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${
                activeLeftTab === 'plots'
                  ? 'border-amber-500 text-amber-400 bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Ô Đất</span>
            </button>
            <button
              onClick={() => setActiveLeftTab('layers')}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${
                activeLeftTab === 'layers'
                  ? 'border-amber-500 text-amber-400 bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Layers</span>
            </button>
            <button
              onClick={() => setActiveLeftTab('levels')}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${
                activeLeftTab === 'levels'
                  ? 'border-amber-500 text-amber-400 bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Cấp Độ</span>
            </button>
          </div>

          {/* Tab Content: Thư Viện Asset */}
          {activeLeftTab === 'assets' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
              {/* Search & Upload button */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm asset..."
                    value={assetSearchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all shadow-xs"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Tải ảnh</span>
                </button>
              </div>

              {/* Category Filter Chips */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                {ASSET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {CATEGORY_NAMES_VN[cat] || cat}
                  </button>
                ))}
              </div>

              {/* Assets Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {loadingAssets ? (
                  <div className="py-12 text-center text-slate-500 text-xs">Đang tải thư viện asset...</div>
                ) : filteredAssets.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Chưa có asset nào. Hãy nhấn "Tải ảnh" để thêm PNG/WebP!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="p-2 bg-slate-900/80 border border-slate-700/80 rounded-xl hover:border-amber-500/60 transition-all group relative flex flex-col justify-between"
                      >
                        <div className="aspect-square bg-slate-950/60 rounded-lg flex items-center justify-center p-2 mb-1.5 relative overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.webpUrl || asset.fallbackUrl || asset.originalUrl || ''}
                            alt={asset.name}
                            className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute top-1 left-1 text-[9px] px-1 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono">
                            {asset.width}x{asset.height}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-white block truncate mb-0.5" title={asset.name}>
                            {asset.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono truncate">{asset.code}</span>
                        </div>

                        <button
                          onClick={() => handleAddAssetToIsland(asset)}
                          className="mt-2 w-full py-1 bg-amber-600/30 hover:bg-amber-500 hover:text-slate-950 text-amber-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Đặt Lên Đảo</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content: Quản Lý Ô Đất */}
          {activeLeftTab === 'plots' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetAllPlots}
                  className="flex-1 py-2 px-2 bg-slate-700/80 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all shadow-xs"
                  title="Căn chỉnh toàn bộ 25 ô đất về lưới chuẩn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Căn chuẩn 25 ô</span>
                </button>
                <button
                  onClick={handleAddNewPlot}
                  className="py-2 px-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm ô</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {currentVersion?.objects
                  .filter((o) => o.objectType === 'PLOT')
                  .sort((a, b) => (a.plotIndex ?? 0) - (b.plotIndex ?? 0))
                  .map((plot) => {
                    const isSelected = selectedObjectKey === plot.objectKey;
                    return (
                      <div
                        key={plot.objectKey}
                        onClick={() => setSelectedObjectKey(plot.objectKey)}
                        className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                            : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-600/30 text-amber-400 flex items-center justify-center text-[11px] font-black">
                            {plot.plotIndex !== null && plot.plotIndex !== undefined ? plot.plotIndex + 1 : '?'}
                          </div>
                          <div>
                            <span className="text-xs font-bold block">{plot.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              X: {Math.round(plot.positionX)}, Y: {Math.round(plot.positionY)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (plot.plotIndex !== null && plot.plotIndex !== undefined) {
                                handleResetSinglePlot(plot.plotIndex);
                              }
                            }}
                            title="Đặt lại vị trí gốc cho ô này"
                            className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateObjectProps(plot.objectKey, { isVisible: !plot.isVisible });
                            }}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            {plot.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteObjectClick(plot.objectKey);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Tab Content: Quản Trị Cấp Độ Nông Trại (Level Configs) */}
          {activeLeftTab === 'levels' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>Cấu Hình Nâng Cấp LV</span>
                </span>
                <button
                  type="button"
                  onClick={handleCreateNewLevel}
                  disabled={savingLevel}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm LV</span>
                </button>
              </div>

              {/* Pills chọn Level */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {farmLevels.map((lv) => (
                  <button
                    key={lv.level}
                    type="button"
                    onClick={() => {
                      setSelectedLevelNum(lv.level);
                      setEditingLevel(lv);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      selectedLevelNum === lv.level
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Cấp {lv.level}
                  </button>
                ))}
              </div>

              {/* Form chỉnh sửa cấu hình Level */}
              {editingLevel ? (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <span className="font-bold text-white text-sm">Cấp Độ {editingLevel.level}</span>
                    <span className="text-[11px] text-amber-400 font-medium">{editingLevel.unlockTitle || 'Mở khóa'}</span>
                  </div>

                  {/* EXP Yêu cầu */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">EXP Yêu Cầu Để Đạt Cấp</label>
                    <input
                      type="number"
                      min={0}
                      value={editingLevel.expRequired ?? 0}
                      onChange={(e) => setEditingLevel({ ...editingLevel, expRequired: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>

                  {/* Xu Nông Trại & Điểm AVORA */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Xu Nông Trại (Coins)</label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={editingLevel.coinCost ?? 0}
                        onChange={(e) => setEditingLevel({ ...editingLevel, coinCost: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Điểm AVORA (Points)</label>
                      <input
                        type="number"
                        min={0}
                        value={editingLevel.pointCost ?? 0}
                        onChange={(e) => setEditingLevel({ ...editingLevel, pointCost: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Nông Sản Yêu Cầu */}
                  <div className="space-y-2 pt-1 border-t border-slate-700/60">
                    <label className="text-[11px] font-bold text-slate-400 block">Nông Sản Yêu Cầu Nâng Cấp</label>
                    
                    {/* Thêm Nông Sản */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={newLevelCropCode}
                        onChange={(e) => setNewLevelCropCode(e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                      >
                        {availableCrops.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={newLevelCropQty}
                        onChange={(e) => setNewLevelCropQty(Math.max(1, Number(e.target.value)))}
                        className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newLevelCropCode) return;
                          const currentList: any[] = editingLevel.requiredCrops || [];
                          const idx = currentList.findIndex((r: any) => r.cropCode === newLevelCropCode);
                          let updated: any[];
                          if (idx >= 0) {
                            updated = currentList.map((r, i) => i === idx ? { ...r, quantity: newLevelCropQty } : r);
                          } else {
                            updated = [...currentList, { cropCode: newLevelCropCode, quantity: newLevelCropQty }];
                          }
                          setEditingLevel({ ...editingLevel, requiredCrops: updated });
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shrink-0"
                      >
                        + Thêm
                      </button>
                    </div>

                    {/* Danh sách chip Nông sản đã gán */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(editingLevel.requiredCrops || []).map((req: any, idx: number) => {
                        const crop = availableCrops.find((c) => c.code === req.cropCode);
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-200"
                          >
                            <span>🌾 {crop?.name || req.cropCode}: <strong>x{req.quantity}</strong></span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editingLevel.requiredCrops || []).filter((_: any, i: number) => i !== idx);
                                setEditingLevel({ ...editingLevel, requiredCrops: updated });
                              }}
                              className="text-slate-400 hover:text-rose-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      {(!editingLevel.requiredCrops || editingLevel.requiredCrops.length === 0) && (
                        <span className="text-[10px] text-slate-500 italic">Chưa cần nông sản cho cấp độ này</span>
                      )}
                    </div>
                  </div>

                  {/* Đặc quyền & Tiêu đề */}
                  <div className="space-y-2 pt-1 border-t border-slate-700/60">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Tiêu Đề Mở Khóa</label>
                      <input
                        type="text"
                        value={editingLevel.unlockTitle || ''}
                        onChange={(e) => setEditingLevel({ ...editingLevel, unlockTitle: e.target.value })}
                        placeholder="Ví dụ: Dâu Tây Tochigi & Thửa đất mới"
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Tốc Độ Trồng (+%)</label>
                        <input
                          type="number"
                          step={0.01}
                          value={Math.round((editingLevel.speedBoost || 0) * 100)}
                          onChange={(e) => setEditingLevel({ ...editingLevel, speedBoost: Number(e.target.value) / 100 })}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Tăng Giá Bán (+%)</label>
                        <input
                          type="number"
                          step={0.01}
                          value={Math.round((editingLevel.sellPriceBoost || 0) * 100)}
                          onChange={(e) => setEditingLevel({ ...editingLevel, sellPriceBoost: Number(e.target.value) / 100 })}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nút Lưu Cấu Hình Level */}
                  <button
                    type="button"
                    onClick={handleSaveLevelConfig}
                    disabled={savingLevel}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 mt-2"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingLevel ? 'Đang lưu...' : `Lưu Cấu Hình Cấp ${editingLevel.level}`}</span>
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">Hãy chọn một cấp độ để cấu hình</div>
              )}
            </div>
          )}

          {/* Tab Content: Quản Lý Layers */}
          {activeLeftTab === 'layers' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Thứ tự hiển thị (Z-Index cao ở trên)</span>
                <span>{groupedLayers.length} Layers</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {groupedLayers.map((obj, idx) => {
                  const isSelected = selectedObjectKey === obj.objectKey;
                  return (
                    <div
                      key={obj.objectKey}
                      onClick={() => setSelectedObjectKey(obj.objectKey)}
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                          : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-mono text-slate-500 w-4">{idx + 1}</span>
                        <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center shrink-0">
                          {obj.objectType === 'PLOT' ? (
                            '🌾'
                          ) : obj.objectType === 'TREE' ? (
                            '🌸'
                          ) : (
                            '✨'
                          )}
                        </div>
                        <span className="text-xs font-bold truncate">{obj.name || obj.objectKey}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateObjectProps(obj.objectKey, { isLocked: !obj.isLocked });
                          }}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          {obj.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateObjectProps(obj.objectKey, { isVisible: !obj.isVisible });
                          }}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          {obj.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Center: The Actual Visual Island Canvas */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950">
          {/* Mobile frame wrapper if in Mobile preview mode */}
          <div
            className={`transition-all duration-300 relative overflow-hidden ${
              deviceMode === 'MOBILE'
                ? 'w-[390px] h-[844px] rounded-[48px] border-[10px] border-slate-800 shadow-2xl ring-1 ring-slate-700'
                : 'w-full h-full'
            }`}
          >
            {/* The SAME FarmCanvas used at /farm */}
            <FarmCanvas
              containerId="admin-farm-layout-canvas"
              theme={themeMode}
              editorMode={!isPreviewMode}
              layoutData={currentVersion}
            />

            {/* Mobile Notch Indicator in Mobile mode */}
            {deviceMode === 'MOBILE' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-800 rounded-full z-30 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Right Panel: Object Inspector */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 z-10 shadow-xl overflow-y-auto">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-850">
            <span className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Thuộc Tính (Inspector)</span>
            </span>
            {selectedObject && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                {selectedObject.objectType}
              </span>
            )}
          </div>

          {selectedObject ? (
            <div className="p-4 space-y-4 text-xs">
              {/* Tên và Key */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  value={selectedObject.name || ''}
                  onChange={(e) => handleUpdateObjectProps(selectedObject.objectKey, { name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Tọa độ X, Y */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Tọa độ X</label>
                  <input
                    type="number"
                    value={Math.round(selectedObject.positionX)}
                    onChange={(e) => handleUpdateObjectProps(selectedObject.objectKey, { positionX: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Tọa độ Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedObject.positionY)}
                    onChange={(e) => handleUpdateObjectProps(selectedObject.objectKey, { positionY: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Nút đặt lại vị trí gốc cho ô đất */}
              {selectedObject.objectType === 'PLOT' && selectedObject.plotIndex !== null && selectedObject.plotIndex !== undefined && (
                <button
                  type="button"
                  onClick={() => handleResetSinglePlot(selectedObject.plotIndex!)}
                  className="w-full py-1.5 px-2 bg-slate-700/60 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Căn chuẩn vị trí ô này (-280, -35)</span>
                </button>
              )}

              {/* Phạm Vi Áp Dụng (Scope Selector) */}
              <div className="p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                  <span>Phạm Vi Áp Dụng Kích Thước</span>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {applyScope === 'CURRENT' && 'Đang chọn'}
                    {applyScope === 'ALL_PLOTS' && '16 Ô Đất'}
                    {applyScope === 'SAME_TYPE' && 'Cùng loại'}
                    {applyScope === 'DESKTOP_ONLY' && 'Desktop'}
                    {applyScope === 'MOBILE_ONLY' && 'Mobile'}
                    {applyScope === 'ALL_DEVICES' && 'Mọi thiết bị'}
                  </span>
                </div>
                <select
                  value={applyScope}
                  onChange={(e: any) => setApplyScope(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-amber-300 text-xs font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="CURRENT">Chỉ đối tượng đang chọn</option>
                  {selectedObject.objectType === 'PLOT' && <option value="ALL_PLOTS">Áp dụng cho tất cả 16 ô đất</option>}
                  <option value="SAME_TYPE">Tất cả đối tượng cùng loại ({selectedObject.objectType})</option>
                  <option value="DESKTOP_ONLY">Chỉ áp dụng trên Desktop</option>
                  <option value="MOBILE_ONLY">Chỉ áp dụng trên Mobile</option>
                  <option value="ALL_DEVICES">Cả Desktop và Mobile</option>
                </select>
              </div>

              {/* Kích Thước Width/Height & Tỷ Lệ Scale */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Kích Thước & Tỉ Lệ (Gizmo / Form)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAspectLocked;
                      setIsAspectLocked(next);
                      farmEventBus.emit('GARDEN_SET_ASPECT_LOCK', next);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border transition-all ${
                      isAspectLocked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title={isAspectLocked ? 'Đang khóa tỉ lệ 1:1' : 'Tỉ lệ tự do'}
                  >
                    {isAspectLocked ? <LinkIcon className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                    <span>{isAspectLocked ? 'Khóa Tỉ Lệ' : 'Tự Do'}</span>
                  </button>
                </div>

                {/* Width & Height */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium">Chiều rộng (W px)</span>
                    <input
                      type="number"
                      min={20}
                      max={1200}
                      value={Math.round(getObjectBaseDimensions(selectedObject).baseW * (selectedObject.scaleX ?? 1.0))}
                      onChange={(e) => {
                        const newPixelW = Number(e.target.value);
                        if (!newPixelW || newPixelW <= 0) return;
                        const { baseW, baseH } = getObjectBaseDimensions(selectedObject);
                        const newScaleX = Number((newPixelW / baseW).toFixed(3));
                        const newScaleY = isAspectLocked ? newScaleX : (selectedObject.scaleY ?? 1.0);
                        const newPixelH = Math.round(baseH * newScaleY);
                        handleUpdateObjectProps(selectedObject.objectKey, {
                          scaleX: newScaleX,
                          scaleY: newScaleY,
                          width: newPixelW,
                          height: newPixelH,
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium">Chiều cao (H px)</span>
                    <input
                      type="number"
                      min={20}
                      max={1200}
                      value={Math.round(getObjectBaseDimensions(selectedObject).baseH * (selectedObject.scaleY ?? 1.0))}
                      onChange={(e) => {
                        const newPixelH = Number(e.target.value);
                        if (!newPixelH || newPixelH <= 0) return;
                        const { baseW, baseH } = getObjectBaseDimensions(selectedObject);
                        const newScaleY = Number((newPixelH / baseH).toFixed(3));
                        const newScaleX = isAspectLocked ? newScaleY : (selectedObject.scaleX ?? 1.0);
                        const newPixelW = Math.round(baseW * newScaleX);
                        handleUpdateObjectProps(selectedObject.objectKey, {
                          scaleX: newScaleX,
                          scaleY: newScaleY,
                          width: newPixelW,
                          height: newPixelH,
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Scale X & Scale Y */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium">Scale X (hệ số)</span>
                    <input
                      type="number"
                      step="0.05"
                      min={0.15}
                      max={4.0}
                      value={selectedObject.scaleX}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (isNaN(val)) return;
                        const { baseW, baseH } = getObjectBaseDimensions(selectedObject);
                        const newScaleX = val;
                        const newScaleY = isAspectLocked ? val : (selectedObject.scaleY ?? 1.0);
                        const newPixelW = Math.round(baseW * newScaleX);
                        const newPixelH = Math.round(baseH * newScaleY);
                        handleUpdateObjectProps(selectedObject.objectKey, {
                          scaleX: newScaleX,
                          scaleY: newScaleY,
                          width: newPixelW,
                          height: newPixelH,
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium">Scale Y (hệ số)</span>
                    <input
                      type="number"
                      step="0.05"
                      min={0.15}
                      max={4.0}
                      value={selectedObject.scaleY}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (isNaN(val)) return;
                        const { baseW, baseH } = getObjectBaseDimensions(selectedObject);
                        const newScaleY = val;
                        const newScaleX = isAspectLocked ? val : (selectedObject.scaleX ?? 1.0);
                        const newPixelW = Math.round(baseW * newScaleX);
                        const newPixelH = Math.round(baseH * newScaleY);
                        handleUpdateObjectProps(selectedObject.objectKey, {
                          scaleX: newScaleX,
                          scaleY: newScaleY,
                          width: newPixelW,
                          height: newPixelH,
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Quick actions for resizing */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleResetObjectSize(selectedObject)}
                    className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Mặc định</span>
                  </button>

                  {selectedObject.objectType === 'PLOT' && (
                    <button
                      type="button"
                      onClick={() => handleCopySizeToAllPlots(selectedObject)}
                      className="flex-1 py-1 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-lg text-[10px] font-bold text-amber-300 transition-all flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3 h-3 text-amber-400" />
                      <span>Sao chép 16 ô</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Panel Cấu Hình Riêng Cho Cây Thần AVORA */}
              {(selectedObject.objectKey === 'prop_avora_tree' || selectedObject.name === 'Cây Thần AVORA') && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                    <span>🌸 Cây Thần AVORA (Hero Object)</span>
                  </div>
                  <p className="text-[10px] text-emerald-200/70 leading-relaxed font-mono">
                    Tài nguyên: /game/farm/environment/props/avora_tree.avif (1086×1448)
                  </p>
                  <p className="text-[10px] text-slate-300">
                    Gốc cây & chậu bonsai 100% đứng yên; tán cây trên lắc nhẹ ±0.8° theo gió.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateObjectProps(selectedObject.objectKey, {
                        scaleX: 0.532,
                        scaleY: 0.532,
                        width: 340,
                        height: 380,
                      });
                      toast.success('Đã áp dụng tỉ lệ chuẩn 0.532 cho Cây Thần AVORA');
                    }}
                    className="w-full py-1 px-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 rounded-lg text-[10px] font-bold transition-all border border-emerald-500/30 flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Khôi phục tỉ lệ chuẩn Cây Thần (0.532)</span>
                  </button>
                </div>
              )}

              {/* Panel Cấu Hình Cây Trồng Trên Ô Đất (Plant Visual & Crop Sizing) */}
              {selectedObject.objectType === 'PLOT' && (
                <div className="p-3 bg-slate-900/90 border border-amber-500/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kích Thước Cây Trồng (Plant Visual)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Ô #{selectedObject.plotIndex}</span>
                  </div>

                  {/* Tỷ Lệ Cây Chung (plantScale) */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-300 font-semibold">Tỉ lệ cây trồng (plantScale)</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {((selectedObject.styleConfig?.plantScale ?? 1.0)).toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.50"
                        max="2.50"
                        step="0.05"
                        value={selectedObject.styleConfig?.plantScale ?? 1.0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...(selectedObject.styleConfig || {}),
                              plantScale: val,
                            },
                          });
                        }}
                        className="flex-1 accent-amber-500"
                      />
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="2.5"
                        value={selectedObject.styleConfig?.plantScale ?? 1.0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...(selectedObject.styleConfig || {}),
                              plantScale: val,
                            },
                          });
                        }}
                        className="w-14 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-center text-white font-mono text-[10px]"
                      />
                    </div>
                  </div>

                  {/* Tùy Chỉnh Điểm Neo Cây (plantOffsetX, plantOffsetY) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium">Offset X neo (px)</span>
                      <input
                        type="number"
                        value={selectedObject.styleConfig?.plantOffsetX ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...(selectedObject.styleConfig || {}),
                              plantOffsetX: val,
                            },
                          });
                        }}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium">Offset Y neo (px)</span>
                      <input
                        type="number"
                        value={selectedObject.styleConfig?.plantOffsetY ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...(selectedObject.styleConfig || {}),
                              plantOffsetY: val,
                            },
                          });
                        }}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Kích thước cây theo từng giai đoạn (Stage 0 - 5) */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-700/60">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>Tỉ Lệ Theo Giai Đoạn (Stage 0 - 5)</span>
                      <span className="text-amber-400 text-[9px]">Giai đoạn sinh trưởng</span>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {[
                        { stage: 0, label: 'Stage 0 (Hạt mầm)', defaultScale: 0.40 },
                        { stage: 1, label: 'Stage 1 (Nảy mầm)', defaultScale: 0.55 },
                        { stage: 2, label: 'Stage 2 (Cây con)', defaultScale: 0.70 },
                        { stage: 3, label: 'Stage 3 (Phát triển)', defaultScale: 0.85 },
                        { stage: 4, label: 'Stage 4 (Trưởng thành)', defaultScale: 0.95 },
                        { stage: 5, label: 'Stage 5 (Chín mọng)', defaultScale: 1.00 },
                      ].map((item) => {
                        const currentStageScale =
                          selectedObject.styleConfig?.stages?.[item.stage]?.scale ?? item.defaultScale;
                        return (
                          <div key={item.stage} className="flex items-center gap-2 bg-slate-800/80 p-1 rounded">
                            <span className="text-[9px] text-slate-300 w-24 truncate">{item.label}</span>
                            <input
                              type="range"
                              min="0.30"
                              max="2.00"
                              step="0.05"
                              value={currentStageScale}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const currentStages = selectedObject.styleConfig?.stages || {};
                                handleUpdateObjectProps(selectedObject.objectKey, {
                                  styleConfig: {
                                    ...(selectedObject.styleConfig || {}),
                                    stages: {
                                      ...currentStages,
                                      [item.stage]: {
                                        scale: val,
                                      },
                                    },
                                  },
                                });
                              }}
                              className="flex-1 accent-amber-500 h-1"
                            />
                            <span className="text-[9px] font-mono text-amber-300 w-8 text-right">
                              {currentStageScale.toFixed(2)}x
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nút: Áp Dụng Làm Kích Thước Mặc Định Toàn Hệ Thống */}
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultScaleValue(selectedObject.styleConfig?.plantScale ?? 1.0);
                      setIsDefaultScaleModalOpen(true);
                    }}
                    className="w-full py-1.5 px-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 border border-amber-400/30"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Áp Dụng Làm Kích Thước Mặc Định</span>
                  </button>
                </div>
              )}

              {/* Góc xoay Rotation & Z-Index */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Góc Xoay (°)</label>
                  <input
                    type="number"
                    value={selectedObject.rotation || 0}
                    onChange={(e) => handleUpdateObjectProps(selectedObject.objectKey, { rotation: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Thứ tự Z-Index</label>
                  <input
                    type="number"
                    value={selectedObject.zIndex || 0}
                    onChange={(e) => handleUpdateObjectProps(selectedObject.objectKey, { zIndex: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Lật hình ảnh (Flip X, Flip Y) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateObjectProps(selectedObject.objectKey, { flipX: !selectedObject.flipX })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    selectedObject.flipX ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Lật Ngang (Flip X)
                </button>
                <button
                  onClick={() => handleUpdateObjectProps(selectedObject.objectKey, { flipY: !selectedObject.flipY })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    selectedObject.flipY ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Lật Dọc (Flip Y)
                </button>
              </div>

              {/* Chế độ hiển thị Display & Device Mode */}
              <div className="space-y-2 pt-2 border-t border-slate-700/60">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Hiển thị Ngày / Đêm</label>
                  <select
                    value={selectedObject.displayMode || 'ALWAYS'}
                    onChange={(e: any) => handleUpdateObjectProps(selectedObject.objectKey, { displayMode: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="ALWAYS">Luôn luôn hiển thị</option>
                    <option value="DAY_ONLY">Chỉ ban ngày</option>
                    <option value="NIGHT_ONLY">Chỉ ban đêm</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Thiết bị áp dụng</label>
                  <select
                    value={selectedObject.deviceMode || 'ALL'}
                    onChange={(e: any) => handleUpdateObjectProps(selectedObject.objectKey, { deviceMode: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="ALL">Tất cả thiết bị</option>
                    <option value="DESKTOP_ONLY">Chỉ Desktop</option>
                    <option value="MOBILE_ONLY">Chỉ Mobile</option>
                  </select>
                </div>
              </div>

              {/* Cấu hình Hoạt Ảnh (Animation Presets) */}
              <div className="space-y-2 pt-2 border-t border-slate-700/60">
                <label className="text-[11px] font-bold text-amber-400 block flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cấu Hình Hoạt Ảnh (Animation)</span>
                </label>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Hiệu ứng chuyển động Preset</span>
                  <select
                    value={selectedObject.animationConfig?.preset || 'NONE'}
                    onChange={(e) =>
                      handleUpdateObjectProps(selectedObject.objectKey, {
                        animationConfig: {
                          ...selectedObject.animationConfig,
                          preset: e.target.value,
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium"
                  >
                    {ANIMATION_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tách lớp tĩnh cho cây (Section 7) */}
                {(selectedObject.animationConfig?.preset === 'SWAY' || selectedObject.animationConfig?.preset === 'SWAY_SOFT') && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/30 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedObject.animationConfig?.staticBaseEnabled ?? true}
                        onChange={(e) =>
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            animationConfig: {
                              ...selectedObject.animationConfig,
                              staticBaseEnabled: e.target.checked,
                            },
                          })
                        }
                        className="rounded text-amber-500 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-amber-300">Đất và gốc cây đứng yên (Static Base)</span>
                    </label>

                    {selectedObject.animationConfig?.staticBaseEnabled !== false && (
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Tỷ lệ phần gốc đứng yên</span>
                          <span className="font-mono text-amber-400">
                            {Math.round((selectedObject.animationConfig?.staticBaseRatio ?? 0.28) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.10"
                          max="0.60"
                          step="0.02"
                          value={selectedObject.animationConfig?.staticBaseRatio ?? 0.28}
                          onChange={(e) =>
                            handleUpdateObjectProps(selectedObject.objectKey, {
                              animationConfig: {
                                ...selectedObject.animationConfig,
                                staticBaseRatio: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thiết Lập Mở Khóa Ô Đất Nâng Cao */}
              {selectedObject.objectType === 'PLOT' && (
                <div className="p-3 bg-slate-900/80 rounded-xl border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs border-b border-slate-700/60 pb-1.5">
                    <Award className="w-3.5 h-3.5" />
                    <span>Điều Kiện Mở Khóa Ô Đất</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Cấp độ tối thiểu (LV)</label>
                      <input
                        type="number"
                        min={1}
                        value={(selectedObject.styleConfig?.unlockConditions?.requiredLevel) ?? (Math.floor((selectedObject.plotIndex ?? 0) / 3) + 1)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const currentConds = selectedObject.styleConfig?.unlockConditions || {};
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...selectedObject.styleConfig,
                              unlockConditions: {
                                ...currentConds,
                                requiredLevel: val,
                              },
                            },
                          });
                        }}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Xu Nông Trại (Coins)</label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={(selectedObject.styleConfig?.unlockConditions?.requiredCoins) ?? Math.max(50, (selectedObject.plotIndex ?? 0) * 30)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const currentConds = selectedObject.styleConfig?.unlockConditions || {};
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...selectedObject.styleConfig,
                              unlockConditions: {
                                ...currentConds,
                                requiredCoins: val,
                              },
                            },
                          });
                        }}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Điểm AVORA Yêu Cầu (Points)</label>
                    <input
                      type="number"
                      min={0}
                      value={(selectedObject.styleConfig?.unlockConditions?.requiredPoints) ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const currentConds = selectedObject.styleConfig?.unlockConditions || {};
                        handleUpdateObjectProps(selectedObject.objectKey, {
                          styleConfig: {
                            ...selectedObject.styleConfig,
                            unlockConditions: {
                              ...currentConds,
                              requiredPoints: val,
                            },
                          },
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs"
                    />
                  </div>

                  {/* Danh sách Nông sản yêu cầu */}
                  <div className="space-y-2 pt-1 border-t border-slate-700/50">
                    <label className="text-[10px] font-bold text-slate-400 block">Nông Sản Yêu Cầu Để Mở Khóa</label>
                    
                    {/* Thêm nông sản mới */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={newPlotReqCropCode}
                        onChange={(e) => setNewPlotReqCropCode(e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                      >
                        {availableCrops.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={newPlotReqCropQty}
                        onChange={(e) => setNewPlotReqCropQty(Math.max(1, Number(e.target.value)))}
                        className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newPlotReqCropCode) return;
                          const currentConds = selectedObject.styleConfig?.unlockConditions || {};
                          const existingList: any[] = currentConds.requiredCrops || [];
                          const idx = existingList.findIndex((r: any) => r.cropCode === newPlotReqCropCode);
                          let updatedList: any[];
                          if (idx >= 0) {
                            updatedList = existingList.map((r, i) => i === idx ? { ...r, quantity: newPlotReqCropQty } : r);
                          } else {
                            updatedList = [...existingList, { cropCode: newPlotReqCropCode, quantity: newPlotReqCropQty }];
                          }
                          handleUpdateObjectProps(selectedObject.objectKey, {
                            styleConfig: {
                              ...selectedObject.styleConfig,
                              unlockConditions: {
                                ...currentConds,
                                requiredCrops: updatedList,
                              },
                            },
                          });
                          toast.success('Đã thêm điều kiện nông sản!');
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shrink-0"
                      >
                        + Thêm
                      </button>
                    </div>

                    {/* Chips hiển thị các nông sản đã cấu hình */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {((selectedObject.styleConfig?.unlockConditions?.requiredCrops) || []).map((req: any, idx: number) => {
                        const crop = availableCrops.find((c) => c.code === req.cropCode);
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-200"
                          >
                            <span>🌾 {crop?.name || req.cropCode}: <strong>x{req.quantity}</strong></span>
                            <button
                              type="button"
                              onClick={() => {
                                const currentConds = selectedObject.styleConfig?.unlockConditions || {};
                                const updatedList = (currentConds.requiredCrops || []).filter((_: any, i: number) => i !== idx);
                                handleUpdateObjectProps(selectedObject.objectKey, {
                                  styleConfig: {
                                    ...selectedObject.styleConfig,
                                    unlockConditions: {
                                      ...currentConds,
                                      requiredCrops: updatedList,
                                    },
                                  },
                                });
                              }}
                              className="text-slate-400 hover:text-rose-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      {(!selectedObject.styleConfig?.unlockConditions?.requiredCrops || selectedObject.styleConfig.unlockConditions.requiredCrops.length === 0) && (
                        <span className="text-[10px] text-slate-500 italic">Chưa có điều kiện nông sản (chỉ cần xu & cấp)</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Thao tác nhanh (Duplicate, Delete) */}
              <div className="pt-3 border-t border-slate-700 flex gap-2">
                <button
                  onClick={() => handleDuplicateObject(selectedObject.objectKey)}
                  className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Nhân bản</span>
                </button>
                <button
                  onClick={() => handleDeleteObjectClick(selectedObject.objectKey)}
                  className="py-1.5 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-64">
              <Compass className="w-8 h-8 text-slate-600 mb-2" />
              <p>Chưa chọn đối tượng nào.</p>
              <p className="text-[11px] text-slate-600 mt-1">Nhấp vào ô đất hoặc vật trang trí trên đảo để tinh chỉnh.</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Modal Tải Asset Mới (Upload PNG, WebP, AVIF) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-md p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <span className="font-bold text-sm flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>Tải Lên Tài Nguyên Trang Trí Mới</span>
              </span>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadAssetSubmit} className="space-y-3 text-xs">
              {/* File Dropzone */}
              <div className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl p-4 text-center cursor-pointer relative bg-slate-900/60">
                <input
                  type="file"
                  accept="image/png,image/webp,image/avif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      setUploadPreview(URL.createObjectURL(f));
                      if (!uploadName) {
                        const clean = f.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, ' ');
                        setUploadName(clean);
                        setUploadCode(clean.toUpperCase().replace(/\s+/g, '_'));
                      }
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {uploadPreview ? (
                  <div className="flex flex-col items-center">
                    <img src={uploadPreview} alt="Preview" className="w-20 h-20 object-contain mb-2" />
                    <span className="text-xs text-amber-300 font-bold">{uploadFile?.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {Math.round((uploadFile?.size || 0) / 1024)} KB
                    </span>
                  </div>
                ) : (
                  <div className="py-4 text-slate-400">
                    <UploadCloud className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p className="font-semibold text-slate-300">Kéo thả ảnh hoặc nhấp để chọn file</p>
                    <p className="text-[10px] text-slate-500 mt-1">Hỗ trợ PNG, WebP, AVIF có nền trong suốt (tối đa 15MB)</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Mã Asset (Code duy nhất)</label>
                <input
                  type="text"
                  placeholder="Vd: SAKURA_BENCH"
                  value={uploadCode}
                  onChange={(e) => setUploadCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Tên Hiển Thị</label>
                <input
                  type="text"
                  placeholder="Vd: Ghế Gỗ Hoa Anh Đào"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Danh Mục (Category)</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  {ASSET_CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_NAMES_VN[c] || c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {uploading ? 'Đang tải lên...' : 'Tải Lên Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Cảnh Báo An Toàn Xóa Ô Đất (Plot Safety Warning Modal) */}
      {plotSafetyWarning && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-850 border border-rose-500/50 rounded-2xl w-full max-w-md p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-rose-300">Không Thể Xóa Cứng Ô Đất #{plotSafetyWarning.plotIndex + 1}!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Hiện đang có <span className="text-amber-400 font-bold">{plotSafetyWarning.activeCropsCount} nông trại</span> của người chơi đang trồng cây trên ô đất này.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-amber-300">Quy tắc an toàn dữ liệu người dùng:</p>
              <p>• Việc xóa cứng sẽ phá vỡ tiến trình sinh trưởng và mất mát cây trồng của khách hàng.</p>
              <p>• Khuyến nghị: Bạn có thể chọn <span className="font-bold text-white">Ẩn ô đất (isVisible = false)</span> để người dùng hoàn tất thu hoạch tự nhiên.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPlotSafetyWarning(null)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleUpdateObjectProps(plotSafetyWarning.objectId, { isVisible: false });
                  setPlotSafetyWarning(null);
                  toast.success(`Đã chuyển ô đất #${plotSafetyWarning.plotIndex + 1} sang trạng thái ẩn an toàn!`);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
              >
                Ẩn Ô Đất Thay Thế
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Lịch Sử Phiên Bản & Rollback */}
      {isRollbackModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-lg p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <span className="font-bold text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <span>Lịch Sử Phiên Bản Bố Cục (Version History)</span>
              </span>
              <button onClick={() => setIsRollbackModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 text-xs">
              {layoutList[0]?.versions?.map((v: any) => (
                <div
                  key={v.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    v.id === currentVersion?.id
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white">Phiên bản v{v.version}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          v.status === 'PUBLISHED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {v.objectsCount || v._count?.objects || 0} đối tượng • Cập nhật: {new Date(v.updatedAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {v.id !== currentVersion?.id && (
                      <button
                        onClick={async () => {
                          const confirm = window.confirm(`Khôi phục về phiên bản v${v.version}?`);
                          if (!confirm) return;
                          try {
                            const res = await fetch(`/api/admin/farm/garden-layout/version/${currentVersion?.id}/rollback`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ targetVersionId: v.id }),
                            });
                            const json = await res.json();
                            if (res.ok && json.success) {
                              toast.success(`Đã khôi phục về phiên bản v${v.version}!`);
                              setIsRollbackModalOpen(false);
                              fetchLayoutData();
                            }
                          } catch {
                            toast.error('Lỗi khi khôi phục');
                          }
                        }}
                        className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded-lg text-xs font-bold transition-all"
                      >
                        Khôi Phục
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsRollbackModalOpen(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Xác Nhận Áp Dụng Làm Kích Thước Mặc Định (FarmPlantAsset DB) */}
      {isDefaultScaleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-850 border border-amber-500/50 rounded-2xl w-full max-w-lg p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Áp Dụng Làm Kích Thước Mặc Định Hệ Thống</span>
              </div>
              <button
                onClick={() => setIsDefaultScaleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-200/90 space-y-1 leading-relaxed">
              <p className="font-bold text-amber-300">⚠️ Xác nhận cập nhật FarmPlantAsset:</p>
              <p>
                Thao tác này sẽ ghi đè giá trị <span className="font-mono font-bold text-white">renderScale</span> trực tiếp vào cơ sở dữ liệu và tăng version để xóa cache ảnh. Tất cả người chơi khi tải cây trồng này sẽ nhận kích thước mới.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Cây Trồng Áp Dụng</label>
                <select
                  value={defaultScaleCropCode}
                  onChange={(e) => setDefaultScaleCropCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="CORN">Ngô Ngọt (CORN)</option>
                  <option value="JAPANESE_RICE">Lúa Nhật Koshihikari (JAPANESE_RICE)</option>
                  <option value="STRAWBERRY">Dâu Tây Tochiotome (STRAWBERRY)</option>
                  <option value="TOMATO">Cà Chua Bi (TOMATO)</option>
                  <option value="CARROT">Cà Rốt Kyoto (CARROT)</option>
                  <option value="SUNFLOWER">Hoa Hướng Dương (SUNFLOWER)</option>
                  <option value="TUNA_CORAL">San Hô Ngừ (TUNA_CORAL)</option>
                  <option value="SALMON_BLOSSOM">Hoa Hồi Cá Hồi (SALMON_BLOSSOM)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Phạm Vi Cập Nhật</label>
                <select
                  value={defaultScaleScope}
                  onChange={(e: any) => setDefaultScaleScope(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="SELECTED_CROP_ALL_STAGES">Tất cả giai đoạn (Stage 0 - 5) của cây này</option>
                  <option value="SPECIFIC_STAGE">Chỉ một giai đoạn cụ thể</option>
                  <option value="MUTATIONS">Chỉ các biến thể đột biến của cây này</option>
                  <option value="ALL_CROPS">Tất cả cây trồng trong hệ thống</option>
                </select>
              </div>

              {defaultScaleScope === 'SPECIFIC_STAGE' && (
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Giai Đoạn Cụ Thể</label>
                  <select
                    value={defaultScaleStageIndex}
                    onChange={(e) => setDefaultScaleStageIndex(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-amber-500"
                  >
                    <option value={0}>Stage 0 (Hạt mầm)</option>
                    <option value={1}>Stage 1 (Nảy mầm)</option>
                    <option value={2}>Stage 2 (Cây non)</option>
                    <option value={3}>Stage 3 (Phát triển)</option>
                    <option value={4}>Stage 4 (Trưởng thành)</option>
                    <option value={5}>Stage 5 (Chín mọng)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-slate-400 font-bold block mb-1">Giá Trị Tỉ Lệ Mặc Định Mới (renderScale)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0.2"
                    max="4.0"
                    value={defaultScaleValue}
                    onChange={(e) => setDefaultScaleValue(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="font-mono text-amber-400 font-bold text-sm">
                    {Math.round(defaultScaleValue * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => setIsDefaultScaleModalOpen(false)}
                disabled={isApplyingDefaultScale}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmApplyDefaultScale}
                disabled={isApplyingDefaultScale}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-lg text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isApplyingDefaultScale ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang cập nhật DB...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Xác Nhận & Cập Nhật DB</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon nam châm Snap
function MagnetIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15" />
      <path d="m5 8 4 4" />
      <path d="m12 15 4 4" />
    </svg>
  );
}
