'use client';

import React, { useId } from 'react';

export interface AvoraCoinProps {
  amount?: number | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showAmount?: boolean;
  prefix?: string;
  className?: string;
  valueClassName?: string;
  iconOnly?: boolean;
}

const SIZE_MAP: Record<NonNullable<AvoraCoinProps['size']>, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 26,
};

export const AvoraCoin: React.FC<AvoraCoinProps> = ({
  amount,
  size = 'sm',
  showAmount = true,
  prefix = '',
  className = '',
  valueClassName = '',
  iconOnly = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const px = SIZE_MAP[size];
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const formatted =
    amount === undefined || amount === null
      ? ''
      : typeof amount === 'number' || !Number.isNaN(numeric)
        ? Number(amount).toLocaleString('vi-VN')
        : String(amount);

  return (
    <span
      className={`inline-flex items-center gap-1 align-middle leading-none ${className}`.trim()}
      aria-label={formatted ? `${prefix}${formatted} AVORA Coin` : 'AVORA Coin'}
    >
      {!iconOnly && showAmount && amount !== undefined && amount !== null && (
        <span className={`tabular-nums ${valueClassName}`.trim()}>
          {prefix}
          {formatted}
        </span>
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        width={px}
        height={px}
        role="img"
        aria-label="AVORA Coin"
        shapeRendering="geometricPrecision"
        className="shrink-0 select-none inline-block"
      >
        <defs>
          <linearGradient id={`c3d-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9e4300" />
            <stop offset="25%" stopColor="#e88504" />
            <stop offset="50%" stopColor="#7a2f00" />
            <stop offset="75%" stopColor="#d47202" />
            <stop offset="100%" stopColor="#692600" />
          </linearGradient>
          <linearGradient id={`orim-${uid}`} x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#fff3a1" />
            <stop offset="25%" stopColor="#ffd447" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#ffdd63" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id={`dgrv-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#782902" />
            <stop offset="50%" stopColor="#9a3803" />
            <stop offset="100%" stopColor="#5c1d01" />
          </linearGradient>
          <linearGradient id={`irim-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="40%" stopColor="#fde047" />
            <stop offset="70%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <radialGradient id={`face-${uid}`} cx="35%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#ffca3a" />
            <stop offset="45%" stopColor="#f59300" />
            <stop offset="85%" stopColor="#d96b00" />
            <stop offset="100%" stopColor="#b34e00" />
          </radialGradient>
          <linearGradient id={`lleg-${uid}`} x1="15%" y1="20%" x2="45%" y2="95%">
            <stop offset="0%" stopColor="#d47a00" />
            <stop offset="25%" stopColor="#f5a614" />
            <stop offset="65%" stopColor="#ffd863" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id={`ufold-${uid}`} x1="48%" y1="18%" x2="32%" y2="85%">
            <stop offset="0%" stopColor="#7c3500" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#b85900" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f5a614" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`rleg-${uid}`} x1="35%" y1="15%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#fff9c4" />
            <stop offset="25%" stopColor="#ffea79" />
            <stop offset="65%" stopColor="#ffca3a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id={`bfold-${uid}`} x1="62%" y1="62%" x2="96%" y2="94%">
            <stop offset="0%" stopColor="#803800" />
            <stop offset="40%" stopColor="#bd6102" />
            <stop offset="80%" stopColor="#eba018" />
            <stop offset="100%" stopColor="#ffd152" />
          </linearGradient>
          <linearGradient id={`spoon-${uid}`} x1="10%" y1="92%" x2="58%" y2="58%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="45%" stopColor="#ffd859" />
            <stop offset="80%" stopColor="#fff099" />
            <stop offset="100%" stopColor="#ffcf40" />
          </linearGradient>
          <linearGradient id={`fork-${uid}`} x1="32%" y1="92%" x2="65%" y2="70%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="45%" stopColor="#ffd552" />
            <stop offset="80%" stopColor="#ffec8a" />
            <stop offset="100%" stopColor="#fff6b3" />
          </linearGradient>
          <clipPath id={`clip-${uid}`}>
            <circle cx="500" cy="482" r="356" />
          </clipPath>
        </defs>

        <ellipse cx="500" cy="522" rx="438" ry="432" fill={`url(#c3d-${uid})`} />
        <ellipse cx="500" cy="508" rx="438" ry="434" fill="#7c2d02" />
        <circle cx="500" cy="482" r="438" fill={`url(#orim-${uid})`} />
        <circle cx="500" cy="482" r="410" fill={`url(#dgrv-${uid})`} />
        <circle cx="500" cy="482" r="392" fill={`url(#irim-${uid})`} />
        <circle cx="500" cy="482" r="368" fill="#853102" />
        <circle cx="500" cy="482" r="356" fill={`url(#face-${uid})`} />

        <g clipPath={`url(#clip-${uid})`}>
          <circle cx="500" cy="495" r="356" fill="none" stroke="#782902" strokeWidth="18" opacity="0.35" />
          <polygon points="315,100 345,100 390,880 355,880" fill="#ffffff" opacity="0.14" />
          <polygon points="750,120 778,120 675,880 645,880" fill="#ffffff" opacity="0.12" />
          <path d="M 140,420 Q 450,240 840,320 A 356,356 0 0,0 144,420 Z" fill="#ffffff" opacity="0.12" />
          <path d="M 210,720 Q 500,660 790,685 A 356,356 0 0,1 210,720 Z" fill="#6b2400" opacity="0.18" />
        </g>

        <g transform="translate(224, 174) scale(0.56)" opacity="0.35">
          <path d="M 7,911 C 95,738 232,468 328,302 C 350,264 378,242 415,242 L 508,395 C 492,390 480,395 468,412 C 372,545 190,745 48,896 L 7,911 Z" fill="#6e2c00" />
          <path d="M 310,338 C 358,244 415,193 482,193 C 546,193 590,232 630,302 L 980,909 C 855,868 745,782 658,655 L 482,355 C 435,288 345,288 310,338 Z" fill="#6e2c00" />
          <path d="M 7,911 L 48,896 C 155,865 262,800 342,695 C 392,629 442,578 508,578 C 552,578 576,602 571,634 C 565,672 522,702 455,728 C 412,745 375,774 330,810 C 245,878 135,914 7,911 Z" fill="#6e2c00" />
          <path d="M 315,911 C 362,892 398,856 422,810 C 438,780 452,767 476,756 L 604,700 A 5.8,5.8 0 0,1 610,710 L 491,779 A 8.5,8.5 0 0,0 500,793 L 621,726 A 5.8,5.8 0 0,1 627,736 L 512,811 A 8.5,8.5 0 0,0 521,825 L 638,754 A 5.8,5.8 0 0,1 644,764 L 533,843 A 8.5,8.5 0 0,0 542,857 L 654,782 A 5.8,5.8 0 0,1 660,792 L 556,878 C 534,896 514,911 488,911 L 315,911 Z" fill="#6e2c00" />
        </g>

        <g transform="translate(224, 158) scale(0.56)">
          <path
            d="M 7,911 C 95,738 232,468 328,302 C 350,264 378,242 415,242 L 508,395 C 492,390 480,395 468,412 C 372,545 190,745 48,896 L 7,911 Z"
            fill={`url(#lleg-${uid})`}
          />
          <path
            d="M 310,338 C 345,288 435,288 482,355 L 502,388 C 486,388 474,398 458,422 L 272,402 Z"
            fill={`url(#ufold-${uid})`}
          />
          <path
            d="M 658,655 L 756,826 C 790,886 848,912 918,912 C 942,912 965,910 980,909 L 915,830 Z"
            fill={`url(#bfold-${uid})`}
          />
          <path
            d="M 310,338 C 358,244 415,193 482,193 C 546,193 590,232 630,302 L 980,909 C 855,868 745,782 658,655 L 482,355 C 435,288 345,288 310,338 Z"
            fill={`url(#rleg-${uid})`}
          />
          <path
            d="M 7,911 L 48,896 C 155,865 262,800 342,695 C 392,629 442,578 508,578 C 552,578 576,602 571,634 C 565,672 522,702 455,728 C 412,745 375,774 330,810 C 245,878 135,914 7,911 Z"
            fill={`url(#spoon-${uid})`}
          />
          <path
            d="M 315,911 C 362,892 398,856 422,810 C 438,780 452,767 476,756 L 604,700 A 5.8,5.8 0 0,1 610,710 L 491,779 A 8.5,8.5 0 0,0 500,793 L 621,726 A 5.8,5.8 0 0,1 627,736 L 512,811 A 8.5,8.5 0 0,0 521,825 L 638,754 A 5.8,5.8 0 0,1 644,764 L 533,843 A 8.5,8.5 0 0,0 542,857 L 654,782 A 5.8,5.8 0 0,1 660,792 L 556,878 C 534,896 514,911 488,911 L 315,911 Z"
            fill={`url(#fork-${uid})`}
          />
        </g>
      </svg>
    </span>
  );
};

export default AvoraCoin;
