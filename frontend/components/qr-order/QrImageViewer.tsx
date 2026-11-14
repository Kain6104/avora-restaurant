'use client';

import React, { useEffect, useRef } from 'react';
import Viewer from 'viewerjs';
import 'viewerjs/dist/viewer.css';

interface QrImageViewerProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/**
 * Fullscreen interactive image lightbox powered by Viewer.js (zoom, pinch, rotate, pan).
 */
export const QrImageViewer: React.FC<QrImageViewerProps> = ({ src, alt, onClose }) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!src || !imgRef.current) return;

    const viewer = new Viewer(imgRef.current, {
      inline: false,
      navbar: false,
      title: Boolean(alt),
      zIndex: 10050,
      toolbar: {
        zoomIn: 1,
        zoomOut: 1,
        oneToOne: 1,
        reset: 1,
        rotateLeft: 1,
        rotateRight: 1,
        flipHorizontal: 0,
        flipVertical: 0,
        prev: 0,
        play: 0,
        next: 0,
      },
      hidden: () => {
        onCloseRef.current();
      },
    });

    viewer.show();

    return () => {
      try {
        viewer.destroy();
      } catch {
        // Ignore teardown race when already closed
      }
    };
  }, [src, alt]);

  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt || 'Hình ảnh món ăn'}
      className="hidden"
    />
  );
};

