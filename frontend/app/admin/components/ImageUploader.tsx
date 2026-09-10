'use client';

import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  imageUrl: string;
  folder: string;
  onUploadSuccess: (url: string) => void;
  label?: string;
  className?: string;
}

export default function ImageUploader({
  imageUrl,
  folder,
  onUploadSuccess,
  label,
  className = '',
}: Props) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    toast.loading(t('uploader.uploading', 'Đang tải ảnh lên...'), { id: `upload-${folder}` });
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch(`/api/admin/upload?folder=${folder}`, {
        method: 'POST',
        body: data,
      });
      if (res.ok) {
        const uData = await res.json();
        onUploadSuccess(uData.url);
        toast.success(t('uploader.success', 'Tải ảnh thành công!'), { id: `upload-${folder}` });
      } else {
        toast.error(t('uploader.error', 'Lỗi tải ảnh!'), { id: `upload-${folder}` });
      }
    } catch {
      toast.error('Lỗi kết nối', { id: `upload-${folder}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-700">{label}</label>}
      <div className="flex items-center gap-4">
        {imageUrl ? (
          <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 shadow-2xs">
            <img
              src={imageUrl}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
            <ImageIcon size={22} />
          </div>
        )}
        <div>
          <label
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin text-red-600" />
            ) : (
              <Upload size={14} />
            )}
            <span>
              {uploading
                ? t('uploader.uploading', 'Đang tải lên...')
                : t('uploader.choose', 'Chọn ảnh mới')}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-[10px] text-slate-400 mt-1">
            {t('uploader.maxSize', 'PNG, JPG, WebP tối đa 5MB')}
          </p>
        </div>
      </div>
    </div>
  );
}
