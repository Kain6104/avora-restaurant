"use client";

import React, { useState } from 'react';
import {
  Fish,
  CupSoda,
  Coffee,
  Soup,
  Flame,
  UtensilsCrossed,
  Sparkles,
  Salad,
  Crown,
  Package,
  ShoppingBag,
  Utensils,
  Wine,
  Layers
} from 'lucide-react';

interface CategoryAvatarProps {
  image?: string | null;
  name: string;
  slug?: string;
  className?: string;
  iconClassName?: string;
}

export function getCategoryIconAndColor(name: string = '', slug: string = '') {
  const text = `${name} ${slug}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (text.includes('sashimi') || text.includes('sushi') || text.includes('ca hoi') || text.includes('ca trich')) {
    return {
      Icon: Fish,
      gradient: 'from-orange-500 to-rose-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    };
  }
  if (text.includes('nuoc') || text.includes('trai cay') || text.includes('do uong') || text.includes('smoothie')) {
    return {
      Icon: CupSoda,
      gradient: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    };
  }
  if (text.includes('cafe') || text.includes('coffee') || text.includes('tra')) {
    return {
      Icon: Coffee,
      gradient: 'from-amber-600 to-amber-800',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-800'
    };
  }
  if (text.includes('ruou') || text.includes('sake') || text.includes('wine')) {
    return {
      Icon: Wine,
      gradient: 'from-purple-600 to-rose-700',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    };
  }
  if (text.includes('lau') || text.includes('hotpot') || text.includes('soup') || text.includes('canh')) {
    return {
      Icon: Flame,
      gradient: 'from-red-500 to-amber-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600'
    };
  }
  if (text.includes('com') || text.includes('my') || text.includes('ramen') || text.includes('udon') || text.includes('cuon')) {
    return {
      Icon: UtensilsCrossed,
      gradient: 'from-amber-500 to-yellow-600',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700'
    };
  }
  if (text.includes('khai vi') || text.includes('appetizer')) {
    return {
      Icon: Sparkles,
      gradient: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600'
    };
  }
  if (text.includes('salad') || text.includes('rau') || text.includes('chay')) {
    return {
      Icon: Salad,
      gradient: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    };
  }
  if (text.includes('buffet')) {
    return {
      Icon: Crown,
      gradient: 'from-amber-500 to-yellow-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    };
  }
  if (text.includes('combo') || text.includes('set')) {
    return {
      Icon: Package,
      gradient: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    };
  }
  if (text.includes('take away') || text.includes('mang ve')) {
    return {
      Icon: ShoppingBag,
      gradient: 'from-cyan-500 to-blue-600',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600'
    };
  }

  return {
    Icon: Utensils,
    gradient: 'from-red-500 to-rose-600',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600'
  };
}

export default function CategoryAvatar({
  image,
  name,
  slug = '',
  className = 'w-full h-full rounded-full',
  iconClassName = 'w-1/2 h-1/2'
}: CategoryAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { Icon, gradient, textColor, bgColor } = getCategoryIconAndColor(name, slug);

  if (!image || imgError) {
    return (
      <div
        className={`${className} bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-inner select-none transition-transform`}
        title={name}
      >
        <Icon className={`${iconClassName} drop-shadow-sm`} />
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={name}
      onError={() => setImgError(true)}
      className={`${className} object-cover`}
    />
  );
}
