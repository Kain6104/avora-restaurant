'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp } from 'lucide-react';
import ReactionIcon, { REACTION_CONFIG, ReactionType } from './ReactionIcons';

interface ReactionBreakdown {
  type: ReactionType;
  count: number;
}

interface ReactionPickerProps {
  articleId: string;
  initialReactionCount: number;
  initialUserReaction: ReactionType | null;
  initialBreakdown?: ReactionBreakdown[];
  onReactionChange?: (newReaction: ReactionType | null, newCount: number) => void;
  className?: string;
  isCompact?: boolean;
}

export default function ReactionPicker({
  articleId,
  initialReactionCount = 0,
  initialUserReaction = null,
  initialBreakdown = [],
  onReactionChange,
  className = '',
  isCompact = false,
}: ReactionPickerProps) {
  const [userReaction, setUserReaction] = useState<ReactionType | null>(initialUserReaction);
  const [reactionCount, setReactionCount] = useState<number>(initialReactionCount);
  const [breakdown, setBreakdown] = useState<ReactionBreakdown[]>(initialBreakdown);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setUserReaction(initialUserReaction);
  }, [initialUserReaction]);

  useEffect(() => {
    setReactionCount(initialReactionCount);
  }, [initialReactionCount]);

  useEffect(() => {
    if (initialBreakdown && initialBreakdown.length > 0) {
      setBreakdown(initialBreakdown);
    }
  }, [initialBreakdown]);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleSelectReaction = async (type: ReactionType) => {
    setIsOpen(false);
    if (isLoading) return;

    const previousReaction = userReaction;
    const previousCount = reactionCount;
    const isTogglingOff = previousReaction === type;
    const nextReaction = isTogglingOff ? null : type;
    const nextCount = isTogglingOff
      ? Math.max(0, previousCount - 1)
      : previousReaction
      ? previousCount
      : previousCount + 1;

    // Optimistic Update
    setUserReaction(nextReaction);
    setReactionCount(nextCount);
    onReactionChange?.(nextReaction, nextCount);

    setIsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${articleId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Alert login required
          alert('Vui lòng đăng nhập để thả cảm xúc cho bài viết!');
        }
        // Rollback
        setUserReaction(previousReaction);
        setReactionCount(previousCount);
        onReactionChange?.(previousReaction, previousCount);
        return;
      }

      const json = await res.json();
      const resPayload = json?.data || json;
      if (resPayload) {
        const returnedReaction = resPayload.userReaction !== undefined ? resPayload.userReaction : nextReaction;
        const returnedCount = resPayload.reactionCount !== undefined ? resPayload.reactionCount : nextCount;
        setUserReaction(returnedReaction);
        setReactionCount(returnedCount);
        if (resPayload.breakdown) {
          const bd = Array.isArray(resPayload.breakdown)
            ? resPayload.breakdown
            : Object.entries(resPayload.breakdown).map(([k, v]) => ({
                type: k as ReactionType,
                count: Number(v) || 0,
              }));
          setBreakdown(bd);
        }
        onReactionChange?.(returnedReaction, returnedCount);
      }
    } catch (err) {
      console.error('Failed to react:', err);
      // Rollback
      setUserReaction(previousReaction);
      setReactionCount(previousCount);
      onReactionChange?.(previousReaction, previousCount);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDefaultClick = () => {
    if (userReaction) {
      handleSelectReaction(userReaction); // Toggles off
    } else {
      handleSelectReaction('LIKE'); // Defaults to Like
    }
  };

  // Top distinct reaction icons for breakdown preview
  const topReactions = breakdown
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const activeReactionInfo = userReaction ? REACTION_CONFIG[userReaction] : null;

  return (
    <div
      className={`relative inline-flex items-center gap-2 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating Reaction Popover Bar */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chọn cảm xúc"
          className="absolute bottom-full left-0 mb-2.5 z-50 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        >
          {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((type) => {
            const isSelected = userReaction === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectReaction(type)}
                className={`group/btn relative p-1.5 rounded-full hover:bg-slate-100 hover:scale-125 transition-all duration-200 cursor-pointer ${
                  isSelected ? 'bg-slate-100 scale-110' : ''
                }`}
                title={REACTION_CONFIG[type].label}
              >
                <ReactionIcon type={type} size={28} className="drop-shadow-sm" />
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 bg-slate-900/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none transition-opacity duration-150 shadow-sm">
                  {REACTION_CONFIG[type].label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={handleDefaultClick}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer select-none ${
          userReaction
            ? `${activeReactionInfo?.color} bg-slate-100/90 font-bold border border-slate-200`
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-slate-50 border border-slate-200/60'
        }`}
      >
        {userReaction ? (
          <ReactionIcon type={userReaction} size={20} className="animate-in zoom-in-75 duration-200" />
        ) : (
          <ThumbsUp size={18} className="text-slate-500 group-hover:text-slate-700" />
        )}
        <span>{userReaction ? activeReactionInfo?.label : 'Thích'}</span>
      </button>

      {/* Stacked preview & Count */}
      {reactionCount > 0 && (
        <div
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-200/50"
          title={breakdown.map((b) => `${REACTION_CONFIG[b.type]?.label || b.type}: ${b.count}`).join(', ')}
        >
          {topReactions.length > 0 && (
            <div className="flex items-center -space-x-1">
              {topReactions.map((r) => (
                <div
                  key={r.type}
                  className="ring-2 ring-white rounded-full bg-white flex items-center justify-center"
                >
                  <ReactionIcon type={r.type} size={15} />
                </div>
              ))}
            </div>
          )}
          <span className="font-semibold text-slate-700">{reactionCount}</span>
        </div>
      )}
    </div>
  );
}
