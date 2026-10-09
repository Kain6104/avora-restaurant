import React from 'react';
import Image from 'next/image';

export type CoinSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export interface AvoraCoinIconProps {
  size?: CoinSize;
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}

export const AVORA_COIN_SRC = '/game/farm/environment/props/avora-coin.svg';

export const AvoraCoinIcon: React.FC<AvoraCoinIconProps> = ({
  size = 'md',
  className = '',
  alt = 'Xu AVORA',
  style,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 20;

  return (
    <Image
      src={AVORA_COIN_SRC}
      alt={alt}
      width={pixelSize}
      height={pixelSize}
      className={`inline-block shrink-0 object-contain select-none pointer-events-none ${className}`}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        aspectRatio: '1 / 1',
        ...style,
      }}
      priority
      unoptimized
    />
  );
};

export default AvoraCoinIcon;
