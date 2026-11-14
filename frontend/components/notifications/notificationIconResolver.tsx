'use client';

import React from 'react';
import {
  ShoppingBag,
  UtensilsCrossed,
  CalendarCheck,
  CreditCard,
  BellRing,
  MessageSquare,
  ShieldAlert,
  Gift,
  Edit3,
  PauseCircle,
  ArrowLeftRight,
  Scissors,
  GitMerge,
  XCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';

interface IconStyleResult {
  icon: React.ReactNode;
  wrapperClass: string;
}

const ICON_NAME_MAP: Record<
  string,
  {
    Component: React.ComponentType<{ size?: number; className?: string }>;
    colorClass: string;
    wrapperClass: string;
  }
> = {
  receipt: {
    Component: ShoppingBag,
    colorClass: 'text-red-600',
    wrapperClass: 'bg-red-50 text-red-600 border-red-100',
  },
  gift: {
    Component: Gift,
    colorClass: 'text-purple-600',
    wrapperClass: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  edit: {
    Component: Edit3,
    colorClass: 'text-amber-600',
    wrapperClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  utensils: {
    Component: UtensilsCrossed,
    colorClass: 'text-emerald-600',
    wrapperClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  'bell-ring': {
    Component: BellRing,
    colorClass: 'text-orange-600',
    wrapperClass: 'bg-orange-50 text-orange-600 border-orange-100',
  },
  wallet: {
    Component: Wallet,
    colorClass: 'text-amber-600',
    wrapperClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  'pause-circle': {
    Component: PauseCircle,
    colorClass: 'text-slate-600',
    wrapperClass: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  'arrow-left-right': {
    Component: ArrowLeftRight,
    colorClass: 'text-sky-600',
    wrapperClass: 'bg-sky-50 text-sky-600 border-sky-100',
  },
  scissors: {
    Component: Scissors,
    colorClass: 'text-orange-600',
    wrapperClass: 'bg-orange-50 text-orange-600 border-orange-100',
  },
  'git-merge': {
    Component: GitMerge,
    colorClass: 'text-indigo-600',
    wrapperClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  'x-circle': {
    Component: XCircle,
    colorClass: 'text-rose-600',
    wrapperClass: 'bg-rose-50 text-rose-600 border-rose-100',
  },
  'refresh-cw': {
    Component: RefreshCw,
    colorClass: 'text-indigo-600',
    wrapperClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  'check-circle': {
    Component: CheckCircle2,
    colorClass: 'text-emerald-600',
    wrapperClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  'alert-triangle': {
    Component: AlertTriangle,
    colorClass: 'text-rose-600',
    wrapperClass: 'bg-rose-50 text-rose-600 border-rose-100',
  },
};

export function resolveNotificationVisual(
  category?: string,
  typeOrEvent?: string,
  iconKey?: string,
  size = 15,
): IconStyleResult {
  const normalizedIcon = (iconKey || '').trim().toLowerCase();
  const mapped = ICON_NAME_MAP[normalizedIcon];
  if (mapped) {
    const Comp = mapped.Component;
    return {
      icon: <Comp size={size} className={mapped.colorClass} />,
      wrapperClass: mapped.wrapperClass,
    };
  }

  const cat = (category || typeOrEvent || '').toUpperCase();
  if (cat.includes('ORDER')) {
    return {
      icon: <ShoppingBag size={size} className="text-red-600" />,
      wrapperClass: 'bg-red-50 text-red-600 border-red-100',
    };
  }
  if (cat.includes('KITCHEN')) {
    return {
      icon: <UtensilsCrossed size={size} className="text-emerald-600" />,
      wrapperClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    };
  }
  if (cat.includes('RESERVATION')) {
    return {
      icon: <CalendarCheck size={size} className="text-purple-600" />,
      wrapperClass: 'bg-purple-50 text-purple-600 border-purple-100',
    };
  }
  if (cat.includes('PAYMENT')) {
    return {
      icon: <CreditCard size={size} className="text-amber-600" />,
      wrapperClass: 'bg-amber-50 text-amber-600 border-amber-100',
    };
  }
  if (cat.includes('SERVICE')) {
    return {
      icon: <BellRing size={size} className="text-orange-600" />,
      wrapperClass: 'bg-orange-50 text-orange-600 border-orange-100',
    };
  }
  if (cat.includes('MARKETING') || cat.includes('ARTICLE')) {
    return {
      icon: <MessageSquare size={size} className="text-blue-600" />,
      wrapperClass: 'bg-blue-50 text-blue-600 border-blue-100',
    };
  }

  return {
    icon: <ShieldAlert size={size} className="text-slate-600" />,
    wrapperClass: 'bg-slate-100 text-slate-600 border-slate-200',
  };
}

