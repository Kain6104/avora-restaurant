'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export type StatCardColor = 'red' | 'green' | 'blue' | 'amber' | 'purple' | 'orange';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changePeriod?: string;
  isPositiveGood?: boolean;
  icon?: React.ReactNode;
  color?: StatCardColor;
  sparklineData?: { value: number }[];
  sparklineColor?: string;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

const COLOR_STYLES: Record<
  StatCardColor,
  { bg: string; text: string; iconBg: string; border: string; spark: string }
> = {
  red: {
    bg: 'bg-white',
    text: 'text-red-600',
    iconBg: 'bg-red-50 text-red-600',
    border: 'border-slate-100',
    spark: '#ef4444',
  },
  green: {
    bg: 'bg-white',
    text: 'text-emerald-600',
    iconBg: 'bg-emerald-50 text-emerald-600',
    border: 'border-slate-100',
    spark: '#10b981',
  },
  blue: {
    bg: 'bg-white',
    text: 'text-blue-600',
    iconBg: 'bg-blue-50 text-blue-600',
    border: 'border-slate-100',
    spark: '#3b82f6',
  },
  amber: {
    bg: 'bg-white',
    text: 'text-amber-600',
    iconBg: 'bg-amber-50 text-amber-600',
    border: 'border-slate-100',
    spark: '#f59e0b',
  },
  purple: {
    bg: 'bg-white',
    text: 'text-purple-600',
    iconBg: 'bg-purple-50 text-purple-600',
    border: 'border-slate-100',
    spark: '#8b5cf6',
  },
  orange: {
    bg: 'bg-white',
    text: 'text-orange-600',
    iconBg: 'bg-orange-50 text-orange-600',
    border: 'border-slate-100',
    spark: '#f97316',
  },
};

export default function StatCard({
  title,
  value,
  change,
  changePeriod = 'so với hôm qua',
  isPositiveGood = true,
  icon,
  color = 'red',
  sparklineData,
  sparklineColor,
  loading = false,
  className = '',
  onClick,
}: StatCardProps) {
  const styles = COLOR_STYLES[color] || COLOR_STYLES.red;
  const isUp = typeof change === 'number' && change > 0;
  const isDown = typeof change === 'number' && change < 0;
  const isNeutral = typeof change === 'number' && change === 0;

  // Determine trend color (e.g. for cancellation rate, positive change might be bad)
  const isTrendGood = isPositiveGood ? isUp : isDown;
  const trendBg = isNeutral
    ? 'bg-slate-50 text-slate-600'
    : isTrendGood
    ? 'bg-emerald-50 text-emerald-600'
    : 'bg-red-50 text-red-600';

  // Chỉ hiển thị Skeleton khi đang loading VÀ chưa hề có giá trị (cold load)
  if (loading && (value === undefined || value === null || value === '')) {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-4 sm:p-5 animate-pulse flex flex-col justify-between ${className}`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-2 flex-1">
            <div className="h-3.5 bg-slate-100 rounded-md w-24"></div>
            <div className="h-7 bg-slate-100 rounded-lg w-32 mt-1"></div>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-xl shrink-0"></div>
        </div>
        <div className="h-4 bg-slate-100 rounded-md w-28 mt-2"></div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl sm:rounded-2xl border ${styles.border} shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-200 ${
        loading ? 'opacity-70' : ''
      } ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex justify-between items-start gap-1.5 sm:gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </p>
          <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1.5 tracking-tight truncate">
            {value}
          </h3>
        </div>
        {icon && (
          <div
            className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl ${styles.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Footer / Trend / Sparkline */}
      <div className="mt-2 pt-1.5 sm:mt-3.5 sm:pt-2 flex items-center justify-between gap-1.5 border-t border-slate-50">
        {typeof change === 'number' ? (
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded-md font-bold text-[10px] sm:text-[11px] ${trendBg}`}
            >
              {isUp ? (
                <TrendingUp size={11} strokeWidth={2.5} />
              ) : isDown ? (
                <TrendingDown size={11} strokeWidth={2.5} />
              ) : (
                <Minus size={11} strokeWidth={2.5} />
              )}
              {isUp ? `+${change}%` : `${change}%`}
            </span>
            <span className="text-slate-400 text-[10px] sm:text-[11px] truncate font-medium">
              {changePeriod}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-[10px] sm:text-[11px] font-medium truncate">{changePeriod}</span>
        )}

        {/* Optional mini sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="w-20 h-7 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={sparklineColor || styles.spark}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={sparklineColor || styles.spark}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor || styles.spark}
                  strokeWidth={2}
                  fill={`url(#grad-${title})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
