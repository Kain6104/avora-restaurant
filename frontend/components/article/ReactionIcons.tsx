'use client';

import React from 'react';

export type ReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

interface ReactionIconProps {
  type: ReactionType;
  className?: string;
  size?: number;
}

export function LikeIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-200 ${className}`}
    >
      <circle cx="18" cy="18" r="18" fill="url(#like_grad)" />
      <path
        d="M20.2 11.2c-.4-1.2-1.3-1.7-2.1-1.7-.8 0-1.5.6-1.7 1.5l-.8 3.8h-4.1c-1.3 0-2.5 1.1-2.5 2.5v7.2c0 1.3 1.1 2.5 2.5 2.5h8.8c1.1 0 2-.7 2.3-1.8l1.8-6.1c.4-1.3-.4-2.7-1.8-2.7h-2.9l.5-5.2z"
        fill="#FFFFFF"
      />
      <path
        d="M9 15.5h2.5v11.5H9c-.8 0-1.5-.7-1.5-1.5V17c0-.8.7-1.5 1.5-1.5z"
        fill="#D6E4FF"
      />
      <defs>
        <linearGradient id="like_grad" x1="18" y1="0" x2="18" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1877F2" />
          <stop offset="1" stopColor="#0B57D0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LoveIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-200 ${className}`}
    >
      <circle cx="18" cy="18" r="18" fill="url(#love_grad)" />
      <path
        d="M18 26.5l-1.4-1.3C11.5 20.6 8 17.5 8 13.6 8 10.5 10.4 8 13.5 8c1.7 0 3.4.8 4.5 2.1C19.1 8.8 20.8 8 22.5 8 25.6 8 28 10.5 28 13.6c0 3.9-3.5 7-8.6 11.6L18 26.5z"
        fill="#FFFFFF"
      />
      <path
        d="M20.5 11c1.2.8 1.9 2.1 1.9 3.5 0 .6-.4 1-1 1s-1-.4-1-1c0-.8-.4-1.5-1.1-2-.5-.3-.6-.9-.3-1.4.3-.5.9-.6 1.5-.1z"
        fill="#FFD2DA"
      />
      <defs>
        <linearGradient id="love_grad" x1="18" y1="0" x2="18" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FA3E3E" />
          <stop offset="1" stopColor="#E0245E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HahaIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-200 ${className}`}
    >
      <circle cx="18" cy="18" r="18" fill="url(#haha_grad)" />
      <path
        d="M11 13.5l3.5 2-3.5 2M25 13.5l-3.5 2 3.5 2"
        stroke="#4A2600"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20c0 4.4 3.6 8 8 8s8-3.6 8-8H10z"
        fill="#4A2600"
      />
      <path
        d="M13.5 23.5c1.2 2.7 2.7 4.5 4.5 4.5s3.3-1.8 4.5-4.5h-9z"
        fill="#FF647C"
      />
      <defs>
        <linearGradient id="haha_grad" x1="18" y1="0" x2="18" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD93B" />
          <stop offset="1" stopColor="#F5A623" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function WowIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-200 ${className}`}
    >
      <circle cx="18" cy="18" r="18" fill="url(#wow_grad)" />
      <ellipse cx="12.5" cy="13.5" rx="2" ry="3" fill="#4A2600" />
      <ellipse cx="23.5" cy="13.5" rx="2" ry="3" fill="#4A2600" />
      <path
        d="M9.5 9.5c1-.8 2.3-1 3.5-.8M23 8.7c1.2-.2 2.5 0 3.5.8"
        stroke="#4A2600"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="18" cy="22.5" rx="4" ry="5.5" fill="#4A2600" />
      <defs>
        <linearGradient id="wow_grad" x1="18" y1="0" x2="18" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD93B" />
          <stop offset="1" stopColor="#F5A623" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SadIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-200 ${className}`}
    >
      <circle cx="18" cy="18" r="18" fill="url(#sad_grad)" />
      <ellipse cx="12.5" cy="14.5" rx="2" ry="2.5" fill="#4A2600" />
      <ellipse cx="23.5" cy="14.5" rx="2" ry="2.5" fill="#4A2600" />
      <path
        d="M10 11.5c1.2.6 2.3.8 3.5.4M22.5 11.9c1.2.4 2.3.2 3.5-.4"
        stroke="#4A2600"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 24c1.5-2 3.2-3 5-3s3.5 1 5 3"
        stroke="#4A2600"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10.5 18c0 2-1.5 4.5-1.5 4.5S7.5 20 7.5 18a1.5 1.5 0 013 0z"
        fill="#3EA6FF"
      />
      <defs>
        <linearGradient id="sad_grad" x1="18" y1="0" x2="18" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD93B" />
          <stop offset="1" stopColor="#E5A01A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AngryIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-200 ${className}`}
    >
      <circle cx="18" cy="18" r="18" fill="url(#angry_grad)" />
      <circle cx="12.5" cy="17.5" r="2.2" fill="#FFFFFF" />
      <circle cx="12.5" cy="17.5" r="1.2" fill="#200000" />
      <circle cx="23.5" cy="17.5" r="2.2" fill="#FFFFFF" />
      <circle cx="23.5" cy="17.5" r="1.2" fill="#200000" />
      <path
        d="M9 13l6 3.5M27 13l-6 3.5"
        stroke="#200000"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M13 25c1.8-2 3.2-2.5 5-2.5s3.2.5 5 2.5"
        stroke="#200000"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="angry_grad" x1="18" y1="0" x2="18" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5C38" />
          <stop offset="1" stopColor="#D8232A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const REACTION_CONFIG: Record<
  ReactionType,
  {
    label: string;
    color: string;
    component: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  LIKE: {
    label: 'Thích',
    color: 'text-blue-600',
    component: LikeIcon,
  },
  LOVE: {
    label: 'Yêu thích',
    color: 'text-rose-600',
    component: LoveIcon,
  },
  HAHA: {
    label: 'Haha',
    color: 'text-amber-500',
    component: HahaIcon,
  },
  WOW: {
    label: 'Wow',
    color: 'text-amber-600',
    component: WowIcon,
  },
  SAD: {
    label: 'Buồn',
    color: 'text-amber-600',
    component: SadIcon,
  },
  ANGRY: {
    label: 'Phẫn nộ',
    color: 'text-red-600',
    component: AngryIcon,
  },
};

export default function ReactionIcon({ type, size = 24, className = '' }: ReactionIconProps) {
  const Icon = REACTION_CONFIG[type]?.component || LikeIcon;
  return <Icon size={size} className={className} />;
}
