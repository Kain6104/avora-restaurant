'use client';

import React, { useState } from 'react';
import {
  getPlantStageAsset,
  getPlantMutationAsset,
  PlantAssetDescriptor,
} from '../../game/services/PlantAssetResolver';

export interface PlantSpriteProps {
  cropCode: string;
  stage?: number;
  mutationCode?: string;
  isMutated?: boolean;
  className?: string;
  containerClassName?: string;
  alt?: string;
  customScale?: number;
  customOffsetX?: number;
  customOffsetY?: number;
  version?: number | string;
  priority?: boolean;
  onLoad?: () => void;
  onClick?: () => void;
}

export default function PlantSprite({
  cropCode,
  stage = 5,
  mutationCode,
  isMutated = false,
  className = 'w-full h-full object-contain',
  containerClassName = 'relative w-full h-full flex items-center justify-center overflow-hidden',
  alt,
  customScale,
  customOffsetX,
  customOffsetY,
  version,
  priority = false,
  onLoad,
  onClick,
}: PlantSpriteProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Tra cứu thông tin asset qua Central Asset Resolver
  const descriptor: PlantAssetDescriptor =
    isMutated && mutationCode
      ? getPlantMutationAsset(cropCode, mutationCode, version)
      : getPlantStageAsset(cropCode, stage, version);

  const finalScale = customScale ?? descriptor.renderScale ?? 1.0;
  const finalOffsetX = customOffsetX ?? descriptor.renderOffsetX ?? 0;
  const finalOffsetY = customOffsetY ?? descriptor.renderOffsetY ?? 0;

  const displayName = alt || descriptor.name || cropCode;

  // Fallback an toàn nếu cả 3 format đều lỗi
  const fallbackSrc = hasError
    ? '/game/farm/crops/rice/stage_5.png'
    : descriptor.fallbackUrl;

  return (
    <div
      className={containerClassName}
      onClick={onClick}
      style={{
        transform: `translate(${finalOffsetX}px, ${finalOffsetY}px) scale(${finalScale})`,
        transformOrigin: 'bottom center',
        transition: 'transform 0.15s ease-out',
      }}
    >
      {/* Skeleton loading nhẹ nhàng khi chưa giải nén ảnh */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-amber-100/20 animate-pulse rounded-lg pointer-events-none" />
      )}

      <picture className="w-full h-full flex items-center justify-center">
        {/* 1. Format ƯU TIÊN: AVIF (Giảm ~87% dung lượng, giữ 100% alpha) */}
        {!hasError && (
          <source
            srcSet={descriptor.avifUrl}
            type="image/avif"
          />
        )}

        {/* 2. Format FALLBACK: WebP (Tương thích rộng rãi) */}
        {!hasError && (
          <source
            srcSet={descriptor.webpUrl}
            type="image/webp"
          />
        )}

        {/* 3. Format SOURCE GỐC / LEGACY FALLBACK: PNG */}
        <img
          src={fallbackSrc}
          alt={displayName}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`${className} transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => {
            setIsLoaded(true);
            onLoad?.();
          }}
          onError={() => {
            if (!hasError) {
              setHasError(true);
              setIsLoaded(true);
            }
          }}
        />
      </picture>
    </div>
  );
}
