'use strict';
'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, Film, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export interface UploadedMediaItem {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  sizeBytes: number;
}

interface ReviewMediaUploaderProps {
  mediaList: UploadedMediaItem[];
  onMediaChange: (items: UploadedMediaItem[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const ReviewMediaUploader: React.FC<ReviewMediaUploaderProps> = ({
  mediaList,
  onMediaChange,
  maxFiles = 5,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (mediaList.length + files.length > maxFiles) {
      toast.error(`Bạn chỉ có thể đính kèm tối đa ${maxFiles} ảnh/video cho mỗi đánh giá.`);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vui lòng đăng nhập để tải ảnh hoặc video');
      return;
    }

    setIsUploading(true);

    try {
      const newItems: UploadedMediaItem[] = [...mediaList];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');

        if (isVideo) {
          setUploadStatus(`Đang tối ưu & xử lý video "${file.name}"...`);
        } else {
          setUploadStatus(`Đang tải ảnh "${file.name}"...`);
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_URL}/api/reviews/media/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errMsg = data?.error?.message || data?.message || 'Lỗi tải tệp lên server';
          toast.error(`${file.name}: ${errMsg}`);
          continue;
        }

        newItems.push({
          id: data.data.id,
          mediaType: data.data.mediaType,
          url: data.data.url,
          thumbnailUrl: data.data.thumbnailUrl,
          mimeType: data.data.mimeType,
          sizeBytes: data.data.sizeBytes,
        });
      }

      onMediaChange(newItems);
      toast.success('Tải media thành công!');
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi xảy ra trong quá trình tải tệp lên');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    onMediaChange(mediaList.filter((item) => item.id !== id));
  };

  return (
    <div className="w-full space-y-2">
      {/* Dropzone Tải lên */}
      {mediaList.length < maxFiles && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl transition-all cursor-pointer ${
            mediaList.length > 0
              ? 'p-2 border-amber-300 bg-amber-50/40 hover:bg-amber-100/50 flex items-center justify-center gap-2 text-xs font-semibold text-amber-800'
              : 'p-3 sm:p-4 border-amber-300/80 bg-amber-50/30 hover:bg-amber-50/70 hover:border-amber-400 text-center flex flex-col items-center justify-center gap-1.5'
          } ${isDragOver ? 'border-amber-500 bg-amber-100/60' : ''} ${
            disabled || isUploading ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || isUploading}
          />

          {isUploading ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="text-xs font-medium text-amber-700">
                {uploadStatus || 'Đang xử lý media...'}
              </span>
            </div>
          ) : mediaList.length > 0 ? (
            <>
              <UploadCloud className="w-4 h-4 text-amber-600" />
              <span>Thêm ảnh / video ({mediaList.length}/{maxFiles})</span>
            </>
          ) : (
            <>
              <div className="p-2 bg-amber-100/80 rounded-full text-amber-600">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Kéo thả ảnh / video vào đây hoặc <span className="text-amber-600 underline font-bold">chọn tệp</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tối đa {maxFiles} tệp (JPG, PNG, WebP, MP4). Tự động tối ưu ≤ 5MB.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Danh sách ảnh & video đã đính kèm (Preview & Remove) */}
      {mediaList.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1">
          {mediaList.map((item, idx) => (
            <div
              key={item.id || idx}
              className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group bg-slate-900 shadow-2xs"
            >
              {item.mediaType === 'IMAGE' ? (
                <img
                  src={item.url}
                  alt={`Media ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                  <video
                    src={item.url}
                    className="w-full h-full object-cover opacity-80"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Film className="w-5 h-5 text-white drop-shadow" />
                  </div>
                </div>
              )}

              {/* Nút xóa media */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors opacity-90 group-hover:opacity-100 focus:outline-none cursor-pointer"
                  aria-label="Xóa tệp đính kèm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Label loại media */}
              <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/75 rounded text-[9px] text-white font-mono flex items-center gap-0.5">
                {item.mediaType === 'IMAGE' ? (
                  <ImageIcon className="w-2.5 h-2.5" />
                ) : (
                  <Film className="w-2.5 h-2.5" />
                )}
                <span>{(item.sizeBytes / (1024 * 1024)).toFixed(1)}MB</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewMediaUploader;
