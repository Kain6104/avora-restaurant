'use client';

import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Sprout,
  Image as ImageIcon,
  UploadCloud,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Eye,
  Sparkles,
  Zap,
  Dna,
  HardDrive,
  Maximize2,
  X,
  Layers,
  Check,
  Plus,
} from 'lucide-react';
import AdminFarmNav from '../components/AdminFarmNav';

interface PlantAsset {
  id: string;
  cropCode: string;
  cropName: string;
  assetType: 'STAGE' | 'MUTATION';
  stageIndex: number;
  mutationCode: string;
  mutationName?: string;
  avifUrl: string;
  webpUrl: string;
  fallbackUrl: string;
  originalUrl?: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  originalFileSize: number;
  avifFileSize: number;
  webpFileSize: number;
  renderScale: number;
  renderOffsetX: number;
  renderOffsetY: number;
  anchorX: number;
  anchorY: number;
  version: number;
  isActive: boolean;
  updatedAt: string;
}

interface CropGroup {
  cropCode: string;
  cropName: string;
  stages: PlantAsset[];
  mutations: PlantAsset[];
  updatedAt: string;
}

export default function AdminFarmAssetsPage() {
  const [cropGroups, setCropGroups] = useState<CropGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCropCode, setSelectedCropCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stages' | 'mutations'>('stages');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [tuningAsset, setTuningAsset] = useState<PlantAsset | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    cropCode: string;
    cropName: string;
    assetType: 'STAGE' | 'MUTATION';
    stageIndex?: number;
    mutationCode?: string;
    mutationName?: string;
    existingAsset?: PlantAsset;
  } | null>(null);

  // Tuning state
  const [tuneScale, setTuneScale] = useState(1.0);
  const [tuneOffsetX, setTuneOffsetX] = useState(0);
  const [tuneOffsetY, setTuneOffsetY] = useState(0);
  const [savingTune, setSavingTune] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileDimensions, setFileDimensions] = useState<{ width: number; height: number } | null>(null);
  const [customMutCode, setCustomMutCode] = useState('');
  const [customMutName, setCustomMutName] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/assets', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setCropGroups(json.data || []);
      } else {
        toast.error('Không thể tải danh sách asset nông trại');
      }
    } catch {
      toast.error('Lỗi kết nối khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const selectedCrop = useMemo(() => {
    return cropGroups.find((c) => c.cropCode === selectedCropCode) || null;
  }, [cropGroups, selectedCropCode]);

  const filteredCrops = useMemo(() => {
    if (!searchQuery.trim()) return cropGroups;
    const q = searchQuery.toLowerCase();
    return cropGroups.filter(
      (c) =>
        c.cropName.toLowerCase().includes(q) ||
        c.cropCode.toLowerCase().includes(q),
    );
  }, [cropGroups, searchQuery]);

  // Handle open Tuning modal
  const openTuningModal = (asset: PlantAsset) => {
    setTuningAsset(asset);
    setTuneScale(asset.renderScale ?? 1.0);
    setTuneOffsetX(asset.renderOffsetX ?? 0);
    setTuneOffsetY(asset.renderOffsetY ?? 0);
  };

  // Save Tuning (Scale & Offset)
  const handleSaveTuning = async () => {
    if (!tuningAsset) return;
    try {
      setSavingTune(true);
      const res = await fetch(`/api/admin/farm/assets/${tuningAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          renderScale: tuneScale,
          renderOffsetX: tuneOffsetX,
          renderOffsetY: tuneOffsetY,
        }),
      });

      if (res.ok) {
        toast.success(`Đã cập nhật scale & offset cho ${tuningAsset.mutationName || `Stage ${tuningAsset.stageIndex}`}`);
        setTuningAsset(null);
        await fetchAssets();
      } else {
        toast.error('Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi hệ thống khi lưu');
    } finally {
      setSavingTune(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (asset: PlantAsset) => {
    try {
      const res = await fetch(`/api/admin/farm/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isActive: !asset.isActive,
        }),
      });

      if (res.ok) {
        toast.success(`Đã ${asset.isActive ? 'ẩn' : 'kích hoạt'} asset`);
        await fetchAssets();
      }
    } catch {
      toast.error('Lỗi cập nhật trạng thái');
    }
  };

  // File selection for upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);

    const img = new Image();
    img.onload = () => {
      setFileDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = objectUrl;
  };

  // Submit Upload
  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTarget || !selectedFile) {
      toast.error('Vui lòng chọn file hình ảnh');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('cropCode', uploadTarget.cropCode);
      formData.append('assetType', uploadTarget.assetType);

      if (uploadTarget.assetType === 'STAGE') {
        formData.append('stageIndex', String(uploadTarget.stageIndex ?? 0));
      } else {
        const code = uploadTarget.mutationCode || customMutCode.trim().toUpperCase();
        const name = uploadTarget.mutationName || customMutName.trim();
        if (!code) {
          toast.error('Vui lòng nhập mã biến dị');
          setUploading(false);
          return;
        }
        formData.append('mutationCode', code);
        if (name) formData.append('mutationName', name);
      }

      const res = await fetch('/api/admin/farm/assets/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        toast.success(
          `Đã tối ưu hóa và cập nhật thành công! AVIF: ${(json.data.avifFileSize / 1024).toFixed(0)} KB (giảm ${(
            (1 - json.data.avifFileSize / json.data.originalFileSize) *
            100
          ).toFixed(1)}%)`,
        );
        setUploadTarget(null);
        setSelectedFile(null);
        setFilePreview(null);
        setFileDimensions(null);
        setCustomMutCode('');
        setCustomMutName('');
        await fetchAssets();
      } else {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson?.message || 'Tải ảnh thất bại');
      }
    } catch {
      toast.error('Lỗi khi tải ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const calculateReduction = (orig: number, opt: number) => {
    if (!orig || orig <= 0 || !opt) return 0;
    return Math.max(0, Math.round(((orig - opt) / orig) * 100));
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <AdminFarmNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Farm Visual Production Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-serif">
            Quản Trị Asset Cây Trồng
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Quản lý pipeline AVIF/WebP, độ phân giải, scale & offset cân chỉnh cây trồng chống tràn layout.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAssets}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* Main Content: Plant List OR Plant Detail */}
      {!selectedCrop ? (
        // VIEW 1: PLANT LIST
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Tìm kiếm cây trồng (Tên hoặc Code)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <Sprout className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Tổng cộng: <b className="text-gray-900">{filteredCrops.length}</b> giống cây
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 animate-pulse h-48" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCrops.map((crop) => {
                // Thumbnail: mature stage (5) or last stage or first
                const matureStage =
                  crop.stages.find((s) => s.stageIndex === 5) ||
                  crop.stages[crop.stages.length - 1] ||
                  crop.stages[0];
                const thumbUrl = matureStage
                  ? `${matureStage.avifUrl}?v=${matureStage.version}`
                  : '/game/farm/crops/rice/stage_5.avif';

                return (
                  <div
                    key={crop.cropCode}
                    className="bg-white rounded-2xl border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start gap-3.5 mb-4">
                        <div className="w-16 h-16 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                          <picture>
                            <source srcSet={thumbUrl} type="image/avif" />
                            <img
                              src={matureStage?.fallbackUrl || thumbUrl}
                              alt={crop.cropName}
                              className="w-14 h-14 object-contain transition-transform group-hover:scale-110"
                              loading="lazy"
                            />
                          </picture>
                          <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/60 text-[9px] font-bold text-white rounded-xs">
                            AVIF
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-700">
                              {crop.cropCode}
                            </span>
                          </div>
                          <h3 className="font-bold text-base text-gray-900 truncate">
                            {crop.cropName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-amber-600" />
                              <b>{crop.stages.length}</b> stages
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Dna className="w-3 h-3 text-purple-600" />
                              <b>{crop.mutations.length}</b> đột biến
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mutation badges */}
                      {crop.mutations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {crop.mutations.map((m) => (
                            <span
                              key={m.id}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100"
                            >
                              ✨ {m.mutationName || m.mutationCode}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        Cập nhật: {new Date(crop.updatedAt).toLocaleDateString('vi-VN')}
                      </span>

                      <button
                        onClick={() => setSelectedCropCode(crop.cropCode)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Quản lý hình ảnh</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // VIEW 2: PLANT DETAIL (STAGES & MUTATIONS)
        <div className="space-y-5">
          {/* Back & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCropCode(null)}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    {selectedCrop.cropCode}
                  </span>
                  <h2 className="text-lg font-bold text-gray-900">{selectedCrop.cropName}</h2>
                </div>
                <span className="text-xs text-gray-500">
                  {selectedCrop.stages.length} giai đoạn sinh trưởng • {selectedCrop.mutations.length} giống đột biến
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setActiveTab('stages')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'stages'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Giai Đoạn ({selectedCrop.stages.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('mutations')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'mutations'
                    ? 'bg-white text-purple-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Dna className="w-3.5 h-3.5" />
                <span>Đột Biến ({selectedCrop.mutations.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: STAGES */}
          {activeTab === 'stages' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedCrop.stages.map((stage) => {
                const reduction = calculateReduction(stage.originalFileSize, stage.avifFileSize);
                const imageUrl = `${stage.avifUrl}?v=${stage.version}`;

                return (
                  <div
                    key={stage.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-between hover:shadow-xs transition-shadow"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-mono">
                            {stage.stageIndex}
                          </span>
                          Stage {stage.stageIndex}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(stage)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              stage.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {stage.isActive ? 'Active' : 'Hidden'}
                          </button>
                        </div>
                      </div>

                      {/* Preview Box */}
                      <div className="w-full h-36 bg-gradient-to-b from-gray-50 to-gray-100/70 rounded-xl border border-dashed border-gray-200 flex items-center justify-center p-3 relative overflow-hidden mb-3">
                        <picture>
                          <source srcSet={imageUrl} type="image/avif" />
                          <source srcSet={`${stage.webpUrl}?v=${stage.version}`} type="image/webp" />
                          <img
                            src={stage.fallbackUrl || imageUrl}
                            alt={`Stage ${stage.stageIndex}`}
                            className="max-h-28 max-w-full object-contain filter drop-shadow-sm"
                            style={{
                              transform: `scale(${stage.renderScale || 1}) translate(${stage.renderOffsetX || 0}px, ${
                                stage.renderOffsetY || 0
                              }px)`,
                            }}
                          />
                        </picture>

                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-xs bg-black/70 text-white text-[9px] font-mono font-bold">
                            {stage.width}x{stage.height}
                          </span>
                        </div>

                        {reduction > 0 && (
                          <div className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                            -{reduction}% AVIF
                          </div>
                        )}
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-gray-50 p-2 rounded-xl mb-3">
                        <div>
                          <div className="text-gray-400 font-medium">AVIF (Ưu tiên)</div>
                          <div className="font-bold text-amber-700">{formatBytes(stage.avifFileSize)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 font-medium">WebP (Fallback)</div>
                          <div className="font-bold text-gray-700">{formatBytes(stage.webpFileSize)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 font-medium">PNG Gốc</div>
                          <div className="font-medium text-gray-500">{formatBytes(stage.originalFileSize)}</div>
                        </div>
                      </div>

                      {/* Scale config display */}
                      <div className="flex items-center justify-between text-xs text-gray-500 px-1 mb-3 font-mono">
                        <span>Scale: <b>{stage.renderScale?.toFixed(2) || '1.00'}x</b></span>
                        <span>X: <b>{stage.renderOffsetX || 0}px</b></span>
                        <span>Y: <b>{stage.renderOffsetY || 0}px</b></span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => openTuningModal(stage)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Chỉnh Scale</span>
                      </button>

                      <button
                        onClick={() =>
                          setUploadTarget({
                            cropCode: selectedCrop.cropCode,
                            cropName: selectedCrop.cropName,
                            assetType: 'STAGE',
                            stageIndex: stage.stageIndex,
                            existingAsset: stage,
                          })
                        }
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Thay Ảnh</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: MUTATIONS */}
          {activeTab === 'mutations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Các biến dị có tỷ lệ xuất hiện đặc biệt khi thu hoạch. Hình ảnh AVIF được ưu tiên tuyệt đối.
                </p>

                <button
                  onClick={() =>
                    setUploadTarget({
                      cropCode: selectedCrop.cropCode,
                      cropName: selectedCrop.cropName,
                      assetType: 'MUTATION',
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Biến Dị Mới</span>
                </button>
              </div>

              {selectedCrop.mutations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                  <Dna className="w-10 h-10 text-purple-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-gray-700">Chưa có biến dị nào</h4>
                  <p className="text-xs text-gray-400 mt-1">Bấm "+ Thêm Biến Dị Mới" để tải lên sprite mutation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedCrop.mutations.map((mut) => {
                    const reduction = calculateReduction(mut.originalFileSize, mut.avifFileSize);
                    const imageUrl = `${mut.avifUrl}?v=${mut.version}`;

                    return (
                      <div
                        key={mut.id}
                        className="bg-white rounded-2xl border border-purple-100 p-4 flex flex-col justify-between hover:shadow-xs transition-shadow"
                      >
                        <div>
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-bold text-sm text-gray-900 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>{mut.mutationName || mut.mutationCode}</span>
                              </div>
                              <span className="font-mono text-[10px] text-purple-600 font-bold">
                                {mut.mutationCode}
                              </span>
                            </div>

                            <button
                              onClick={() => handleToggleActive(mut)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                mut.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {mut.isActive ? 'Active' : 'Disabled'}
                            </button>
                          </div>

                          {/* Preview Box */}
                          <div className="w-full h-40 bg-gradient-to-b from-purple-50/40 to-amber-50/40 rounded-xl border border-dashed border-purple-200 flex items-center justify-center p-3 relative overflow-hidden mb-3">
                            <picture>
                              <source srcSet={imageUrl} type="image/avif" />
                              <source srcSet={`${mut.webpUrl}?v=${mut.version}`} type="image/webp" />
                              <img
                                src={mut.fallbackUrl || imageUrl}
                                alt={mut.mutationName || mut.mutationCode}
                                className="max-h-32 max-w-full object-contain filter drop-shadow-md"
                                style={{
                                  transform: `scale(${mut.renderScale || 1}) translate(${
                                    mut.renderOffsetX || 0
                                  }px, ${mut.renderOffsetY || 0}px)`,
                                }}
                              />
                            </picture>

                            <div className="absolute top-2 left-2 flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded-xs bg-black/70 text-white text-[9px] font-mono font-bold">
                                {mut.width}x{mut.height}
                              </span>
                            </div>

                            {reduction > 0 && (
                              <div className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                                -{reduction}% AVIF
                              </div>
                            )}
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-purple-50/50 p-2 rounded-xl mb-3">
                            <div>
                              <div className="text-gray-400 font-medium">AVIF</div>
                              <div className="font-bold text-purple-800">{formatBytes(mut.avifFileSize)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 font-medium">WebP</div>
                              <div className="font-bold text-gray-700">{formatBytes(mut.webpFileSize)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 font-medium">Gốc</div>
                              <div className="font-medium text-gray-500">{formatBytes(mut.originalFileSize)}</div>
                            </div>
                          </div>

                          {/* Scale config display */}
                          <div className="flex items-center justify-between text-xs text-gray-500 px-1 mb-3 font-mono">
                            <span>Scale: <b>{mut.renderScale?.toFixed(2) || '1.00'}x</b></span>
                            <span>X: <b>{mut.renderOffsetX || 0}px</b></span>
                            <span>Y: <b>{mut.renderOffsetY || 0}px</b></span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-100">
                          <button
                            onClick={() => openTuningModal(mut)}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Chỉnh Scale</span>
                          </button>

                          <button
                            onClick={() =>
                              setUploadTarget({
                                cropCode: selectedCrop.cropCode,
                                cropName: selectedCrop.cropName,
                                assetType: 'MUTATION',
                                mutationCode: mut.mutationCode,
                                mutationName: mut.mutationName,
                                existingAsset: mut,
                              })
                            }
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Thay Ảnh</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 1: LIVE FARM PLOT PREVIEW & TUNING  */}
      {/* ========================================== */}
      {tuningAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    Cân Chỉnh Kích Thước & Tọa Độ Ô Đất
                  </h3>
                  <p className="text-xs text-gray-500">
                    {tuningAsset.cropCode} • {tuningAsset.mutationName || `Stage ${tuningAsset.stageIndex}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setTuningAsset(null)}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Live Plot Preview & Sliders */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {/* LIVE FARM PLOT PREVIEW CONTAINER */}
              <div className="bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-50 rounded-2xl border border-sky-200/60 p-6 flex flex-col items-center justify-center relative min-h-[260px] overflow-hidden shadow-inner">
                <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] font-bold text-sky-800 bg-white/80 px-2 py-0.5 rounded-md shadow-2xs backdrop-blur-xs">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>LIVE FARM PLOT PREVIEW (TỶ LỆ CHUẨN Ô ĐẤT GAME)</span>
                </div>

                {/* Isometric Soil Plot Representation */}
                <div className="relative w-48 h-32 flex items-center justify-center mt-12">
                  {/* Soil Base (Isometric Diamond) */}
                  <div
                    className="absolute w-36 h-20 bg-[#6d4c41] rounded-[40%] shadow-lg border-2 border-[#5d4037]"
                    style={{
                      transform: 'rotateX(60deg) rotateZ(45deg)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="w-full h-full bg-[radial-gradient(#8d6e63_1px,transparent_1px)] [background-size:8px_8px] opacity-70" />
                  </div>

                  {/* Crop Sprite Overlay with live Scale & Offset */}
                  <div
                    className="absolute z-10 transition-transform duration-75 flex items-end justify-center pointer-events-none"
                    style={{
                      transform: `scale(${tuneScale}) translate(${tuneOffsetX}px, ${tuneOffsetY}px)`,
                      transformOrigin: '50% 85%',
                    }}
                  >
                    <picture>
                      <source srcSet={`${tuningAsset.avifUrl}?v=${tuningAsset.version}`} type="image/avif" />
                      <source srcSet={`${tuningAsset.webpUrl}?v=${tuningAsset.version}`} type="image/webp" />
                      <img
                        src={tuningAsset.fallbackUrl || tuningAsset.avifUrl}
                        alt="Crop Preview"
                        className="max-h-36 max-w-[150px] object-contain filter drop-shadow-md"
                      />
                    </picture>
                  </div>
                </div>

                <div className="mt-4 text-[10px] text-gray-500 font-mono">
                  Origin Y: {tuningAsset.anchorY?.toFixed(2) || '0.85'} • Đảm bảo cây nằm đúng tâm ô đất, không tràn sang đảo khác.
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-200/60">
                {/* Scale Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1.5">
                    <span>Tỷ lệ hiển thị (Render Scale):</span>
                    <span className="font-mono text-amber-700 font-black text-sm">{tuneScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.40"
                    max="1.80"
                    step="0.05"
                    value={tuneScale}
                    onChange={(e) => setTuneScale(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>0.40x (Nhỏ)</span>
                    <span>1.00x (Chuẩn)</span>
                    <span>1.80x (Lớn)</span>
                  </div>
                </div>

                {/* Offset Y Slider (Up / Down) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1.5">
                    <span>Dịch chuyển đứng (Offset Y - Lên / Xuống):</span>
                    <span className="font-mono text-gray-900 font-bold">{tuneOffsetY} px</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={tuneOffsetY}
                    onChange={(e) => setTuneOffsetY(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700"
                  />
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>-40px (Kéo lên)</span>
                    <span>0px</span>
                    <span>+40px (Hạ xuống)</span>
                  </div>
                </div>

                {/* Offset X Slider (Left / Right) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1.5">
                    <span>Dịch chuyển ngang (Offset X - Trái / Phải):</span>
                    <span className="font-mono text-gray-900 font-bold">{tuneOffsetX} px</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={tuneOffsetX}
                    onChange={(e) => setTuneOffsetX(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700"
                  />
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>-40px (Sang trái)</span>
                    <span>0px (Giữa)</span>
                    <span>+40px (Sang phải)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                  <span className="text-[11px] text-gray-500 font-bold self-center mr-1">Phím tắt nhanh:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTuneScale(1.0);
                      setTuneOffsetX(0);
                      setTuneOffsetY(0);
                    }}
                    className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                  >
                    Reset (1.0x, 0, 0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTuneScale(0.85)}
                    className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                  >
                    Thu nhỏ 15% (0.85x)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTuneOffsetY(-12)}
                    className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                  >
                    Hạ thấp (-12px)
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setTuningAsset(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveTuning}
                disabled={savingTune}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {savingTune ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Lưu Cấu Hình Ô Đất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: UPLOAD & AUTO OPTIMIZATION MODAL */}
      {/* ========================================== */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">
            <form onSubmit={handleSubmitUpload} className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                      {uploadTarget.existingAsset ? 'Thay Đổi Hình Ảnh Asset' : 'Thêm Biến Dị Mới'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {uploadTarget.cropName} •{' '}
                      {uploadTarget.assetType === 'STAGE'
                        ? `Stage ${uploadTarget.stageIndex}`
                        : uploadTarget.mutationName || 'Mutation'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUploadTarget(null);
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                {/* Mutation details input if creating brand new mutation */}
                {uploadTarget.assetType === 'MUTATION' && !uploadTarget.mutationCode && (
                  <div className="space-y-3 bg-purple-50/60 p-4 rounded-2xl border border-purple-100">
                    <div>
                      <label className="block text-xs font-bold text-purple-900 mb-1">
                        Mã Biến Dị (Mutation Code - Viết hoa, không dấu, e.g. DIAMOND_RICE):
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="DIAMOND_RICE"
                        value={customMutCode}
                        onChange={(e) => setCustomMutCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-900 mb-1">
                        Tên Hiển Thị (Display Name):
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Lúa Kim Cương"
                        value={customMutName}
                        onChange={(e) => setCustomMutName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}

                {/* File Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Chọn file ảnh (Hỗ trợ PNG, WebP, AVIF):
                  </label>
                  <label className="border-2 border-dashed border-gray-200 hover:border-amber-400 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-amber-50/20 transition-all">
                    <input
                      type="file"
                      accept=".png,.webp,.avif,image/png,image/webp,image/avif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <UploadCloud className="w-10 h-10 text-amber-500 mb-2" />
                    <span className="text-xs font-bold text-gray-700">Kéo thả file hoặc bấm vào đây để chọn</span>
                    <span className="text-[11px] text-gray-400 mt-0.5">Hỗ trợ PNG, WebP, AVIF tối đa 15MB</span>
                  </label>
                </div>

                {/* Preview Before Save */}
                {filePreview && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
                    <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      <span>Xem Trước File Đã Chọn</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-2">
                        <img src={filePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                      </div>

                      <div className="flex-1 text-xs space-y-1">
                        <div className="font-bold text-gray-900 truncate">{selectedFile?.name}</div>
                        <div className="text-gray-500">
                          Kích thước file: <b>{formatBytes(selectedFile?.size || 0)}</b>
                        </div>
                        {fileDimensions && (
                          <div className="text-gray-500 font-mono">
                            Độ phân giải: <b>{fileDimensions.width} x {fileDimensions.height} px</b>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
                      <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <b>Pipeline tự động kích hoạt khi Lưu:</b>
                        <br />
                        File PNG sẽ được Sharp chuyển đổi thành <b>AVIF siêu nén (Primary)</b> và <b>WebP (Fallback)</b>, giữ nguyên 100% độ trong suốt (Alpha channel).
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setUploadTarget(null);
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white transition-colors"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{uploading ? 'Đang Tối Ưu & Lưu...' : 'Bắt Đầu Tối Ưu & Lưu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
