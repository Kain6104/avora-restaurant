import React from 'react';

interface BuffetRibbonTagProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Bookmark Ribbon Tag for Buffet packages and Buffet-included dishes
 * Features a bright orange banner with top fold and swallowtail bottom notch, exactly matching design
 */
export const BuffetRibbonTag: React.FC<BuffetRibbonTagProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeStyles =
    size === 'sm'
      ? { width: '42px', height: '38px', fontSize: '9px', paddingBottom: '7px' }
      : size === 'lg'
      ? { width: '64px', height: '56px', fontSize: '13px', paddingBottom: '11px' }
      : { width: '52px', height: '46px', fontSize: '11px', paddingBottom: '9px' };

  return (
    <div
      className={`absolute top-0 left-2 z-20 pointer-events-none drop-shadow-md select-none ${className}`}
    >
      {/* Top rounded tab accent */}
      <div className="w-full h-1 bg-[#E04400] rounded-t-sm" />
      {/* Main Orange Ribbon with Swallowtail V-cut bottom */}
      <div
        style={{
          width: sizeStyles.width,
          height: sizeStyles.height,
          fontSize: sizeStyles.fontSize,
          paddingBottom: sizeStyles.paddingBottom,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 72%, 0% 100%)',
        }}
        className="bg-gradient-to-b from-[#FF5E00] to-[#FF4500] text-white font-black flex items-center justify-center tracking-tight leading-none text-center shadow-inner"
      >
        BUFFET
      </div>
    </div>
  );
};

