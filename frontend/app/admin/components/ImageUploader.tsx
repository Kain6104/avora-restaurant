import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  imageUrl: string;
  folder: string;
  onUploadSuccess: (url: string) => void;
  label?: string;
  className?: string;
}

export default function ImageUploader({ imageUrl, folder, onUploadSuccess, label = 'Ảnh', className = '' }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    toast.loading('Đang tải ảnh lên...', { id: `upload-${folder}` });
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch(`/api/admin/upload?folder=${folder}`, { method: 'POST', body: data });
      if (res.ok) {
        const uData = await res.json();
        onUploadSuccess(uData.url);
        toast.success('Tải ảnh thành công!', { id: `upload-${folder}` });
      } else {
        toast.error('Lỗi tải ảnh!', { id: `upload-${folder}` });
      }
    } catch {
      toast.error('Lỗi kết nối', { id: `upload-${folder}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`mb-4 ${className}`}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center gap-4">
        {imageUrl ? (
          <img src={imageUrl} alt="preview" className="w-20 h-20 object-cover rounded-lg border bg-gray-50" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=Error')} />
        ) : (
          <div className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">
            <Upload size={24} />
          </div>
        )}
        <label className={`bg-white border px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 font-medium text-sm transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Đang tải...' : 'Chọn file ảnh'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
