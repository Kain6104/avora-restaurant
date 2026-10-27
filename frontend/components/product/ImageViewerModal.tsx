"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  productName?: string;
}

export default function ImageViewerModal({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  productName = 'Món ăn',
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      resetTransform();
    }
  }, [isOpen, initialIndex, images.length]);

  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetTransform();
  }, [images.length, resetTransform]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetTransform();
  }, [images.length, resetTransform]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === '0') resetTransform();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, resetTransform]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 5));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers for 2-finger pinch-to-zoom & 1-finger pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistanceRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // Double tap check
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap toggle
        if (scale > 1) {
          resetTransform();
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (scale > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistanceRef.current !== null) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / pinchStartDistanceRef.current;
      const newScale = Math.min(Math.max(initialScaleRef.current * ratio, 1), 5);
      setScale(newScale);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistanceRef.current = null;
    setIsDragging(false);
  };

  // Double click for desktop
  const handleDoubleClick = () => {
    if (scale > 1) {
      resetTransform();
    } else {
      setScale(2.5);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Top Header Toolbar ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white/80 font-bold text-xs sm:text-sm truncate max-w-[200px] sm:max-w-md">
            {productName}
          </span>
          {images.length > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90 text-[11px] font-mono font-bold">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={zoomIn}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Phóng to (+)"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Thu nhỏ (-)"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={resetTransform}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Đặt lại (1:1)"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={rotate}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Xoay 90°"
          >
            <RotateCw size={17} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 ml-1 text-white bg-red-600/80 hover:bg-red-600 rounded-full transition-colors shadow-lg"
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Main Interactive Image Stage ── */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Navigation Prev */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl"
            title="Ảnh trước (Mũi tên trái)"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Zoomable Image Element */}
        <div
          className="transition-transform duration-75 ease-out will-change-transform max-w-full max-h-full flex items-center justify-center"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale}) rotate(${rotation}deg)`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={currentImage}
            alt={productName}
            draggable={false}
            className="max-w-[90vw] max-h-[75vh] sm:max-h-[82vh] object-contain rounded-2xl shadow-2xl pointer-events-none select-none ring-1 ring-white/10"
          />
        </div>

        {/* Navigation Next */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 sm:right-6 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl"
            title="Ảnh tiếp theo (Mũi tên phải)"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Floating Zoom Indicator */}
        {scale > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white/90 text-xs font-mono font-bold px-3 py-1 rounded-full border border-white/15 pointer-events-none">
            {Math.round(scale * 100)}%
          </div>
        )}
      </div>

      {/* ── Bottom Thumbnail Strip (Only rendered if multiple images) ── */}
      {images.length > 1 && (
        <div className="z-20 py-3 px-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2 overflow-x-auto hide-scrollbar">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                resetTransform();
              }}
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                currentIndex === idx
                  ? 'border-red-500 scale-105 shadow-md shadow-red-500/30'
                  : 'border-white/20 hover:border-white/50 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
