'use strict';
'use client';

import React, { useState } from 'react';
import { Play, X, Film, Image as ImageIcon } from 'lucide-react';

export interface ReviewMediaItem {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string;
  sizeBytes?: number;
}

interface ReviewMediaViewerProps {
  media: ReviewMediaItem[];
  className?: string;
}

export const ReviewMediaViewer: React.FC<ReviewMediaViewerProps> = ({
  media,
  className = '',
}) => {
  const [activeMedia, setActiveMedia] = useState<ReviewMediaItem | null>(null);

  if (!media || media.length === 0) return null;

  return (
    <>
      <div className={`grid grid-cols-3 sm:grid-cols-5 gap-2.5 my-3 ${className}`}>
        {media.map((item, idx) => (
          <button
            key={item.id || idx}
            type="button"
            onClick={() => setActiveMedia(item)}
            className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 group bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer text-left"
            aria-label={`Xem ${item.mediaType === 'IMAGE' ? 'hình ảnh' : 'video'} số ${idx + 1}`}
          >
            {item.mediaType === 'IMAGE' ? (
              <img
                src={item.thumbnailUrl || item.url}
                alt="Ảnh đánh giá"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-neutral-900">
                <video
                  src={item.url}
                  className="w-full h-full object-cover opacity-75"
                  preload="none"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                  <div className="p-2.5 bg-amber-500/90 text-white rounded-full shadow-lg transform transition-transform group-hover:scale-110">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            <div className="absolute top-1.5 left-1.5 p-1 bg-black/60 rounded text-white text-[10px] flex items-center gap-1">
              {item.mediaType === 'IMAGE' ? (
                <ImageIcon className="w-3 h-3" />
              ) : (
                <Film className="w-3 h-3 text-amber-400" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveMedia(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setActiveMedia(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors focus:outline-none"
              aria-label="Đóng lightbox"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Media Content */}
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-black max-h-[80vh] flex items-center justify-center">
              {activeMedia.mediaType === 'IMAGE' ? (
                <img
                  src={activeMedia.url}
                  alt="Ảnh chi tiết đánh giá"
                  className="max-h-[80vh] max-w-full object-contain"
                />
              ) : (
                <video
                  src={activeMedia.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[80vh] max-w-full rounded-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewMediaViewer;
