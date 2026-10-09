'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Hand, Droplets } from 'lucide-react';

interface FriendCardItem {
  userId: string;
  name: string;
  avatarUrl?: string;
  level: number;
  treeLevel?: number;
  canGatherCount?: number;
  needWaterCount?: number;
  isFriend?: boolean;
}

interface VisitBottomDockProps {
  visitingState: {
    user: { id: string; fullName?: string };
    isFriend?: boolean;
    remainingSteals?: number;
    dailyStealsMax?: number;
    dailyStealsUsed?: number;
  };
  socialOverview?: {
    friends?: FriendCardItem[];
    strangers?: FriendCardItem[];
    friendMax?: number;
    strangerMax?: number;
    friendGathersCount?: number;
    strangerGathersCount?: number;
  } | null;
  onSelectFriend: (friendUserId: string) => void;
  onBack: () => void;
}

export default function VisitBottomDock({
  visitingState,
  socialOverview,
  onSelectFriend,
  onBack,
}: VisitBottomDockProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'strangers'>('strangers');

  const friends = socialOverview?.friends || [];
  const strangers = socialOverview?.strangers || [];
  const displayList = activeTab === 'friends' ? friends : strangers;

  const currentVisitedId = visitingState?.user?.id;
  const isFriendTab = activeTab === 'friends';
  const limitMax = isFriendTab
    ? (socialOverview?.friendMax ?? 10)
    : (socialOverview?.strangerMax ?? 3);
  const usedCount = isFriendTab
    ? (socialOverview?.friendGathersCount ?? 0)
    : (socialOverview?.strangerGathersCount ?? 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-stone-950 via-stone-950/90 to-transparent pb-3 pt-2 px-2.5 sm:px-5 pointer-events-auto select-none">
      <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
        {/* Thanh Điều Hướng Phụ: Hạn Mức Trộm & Chuyển Tab (Tham khảo Hình 3 gốc) */}
        <div className="flex items-center justify-between gap-2 px-1">
          {/* Thông báo hạn mức trộm */}
          <div className="text-[10px] sm:text-xs font-semibold text-amber-200/90 flex items-center gap-1">
            <span><span className="hidden sm:inline">Hôm nay, số lần có thể lấy cây của </span><span className="text-amber-400 font-bold">{isFriendTab ? 'bạn bè' : 'người lạ'}</span>:</span>
            <span className="px-1 sm:px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-black text-[9px] sm:text-xs">
              {usedCount} / {limitMax}
            </span>
          </div>

          {/* 2 Tab chuyển đổi: Bạn bè / Gợi ý thêm bạn */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-stone-900/80 p-0.5 rounded-xl border border-amber-900/50 shrink-0">
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-xs font-bold transition-all ${
                activeTab === 'friends'
                  ? 'bg-amber-600 text-stone-950 shadow'
                  : 'text-amber-200/70 hover:text-amber-100'
              }`}
            >
              Bạn bè ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('strangers')}
              className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-xs font-bold transition-all ${
                activeTab === 'strangers'
                  ? 'bg-amber-600 text-stone-950 shadow'
                  : 'text-amber-200/70 hover:text-amber-100'
              }`}
            >
              Gợi ý ({strangers.length})
            </button>
          </div>
        </div>

        {/* Danh Sách Thẻ Người Dùng Trượt Ngang (Carousel tương tác mượt mà như Hình 3 gốc) */}
        <div className="flex items-center gap-2.5 overflow-x-auto py-1 px-0.5 scrollbar-thin scrollbar-thumb-amber-700/60 scrollbar-track-transparent">
          {displayList.length === 0 ? (
            <div className="py-4 text-center text-xs text-amber-200/50 w-full">
              {activeTab === 'friends'
                ? 'Bạn chưa có bạn bè nào. Hãy ghé thăm và kết bạn từ tab Gợi ý thêm bạn!'
                : 'Đang tải danh sách người chơi khác...'}
            </div>
          ) : (
            displayList.map((user) => {
              const isCurrentVisited = user.userId === currentVisitedId;
              const hasCropsToGather = (user.canGatherCount ?? 0) > 0;
              const needsWater = (user.needWaterCount ?? 0) > 0;

              return (
                <div
                  key={user.userId}
                  onClick={() => onSelectFriend(user.userId)}
                  className={`flex-shrink-0 w-[125px] sm:w-[145px] p-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                    isCurrentVisited
                      ? 'bg-amber-950/90 border-2 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.6)] scale-105 ring-2 ring-amber-400/40'
                      : 'bg-stone-900/80 border border-stone-700/60 hover:bg-stone-850 hover:border-amber-500/50 active:scale-95'
                  }`}
                >
                  {/* Avatar & Level Tag */}
                  <div className="relative">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-amber-400/60 shadow"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-700/80 text-amber-100 flex items-center justify-center font-bold text-sm border border-amber-400/60 shadow">
                        {(user.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-amber-500 text-stone-950 font-black text-[9px] shadow leading-tight">
                      {user.level || 1}
                    </span>
                  </div>

                  {/* Tên người dùng */}
                  <span className="text-[11px] sm:text-xs font-bold text-amber-100 truncate w-full text-center">
                    {user.name}
                  </span>

                  {/* Nút / Huy hiệu Trạng thái Hành động (Khớp Hình 3 gốc) */}
                  {hasCropsToGather ? (
                    <button className="w-full py-0.5 px-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-green-500 text-white font-black text-[10px] sm:text-[11px] shadow-sm shadow-emerald-500/40 animate-pulse flex items-center justify-center gap-1">
                      <span>🖐️</span>
                      <span>Có thể trộm</span>
                    </button>
                  ) : needsWater ? (
                    <button className="w-full py-0.5 px-1.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 text-white font-black text-[10px] sm:text-[11px] shadow-sm shadow-sky-500/40 flex items-center justify-center gap-1">
                      <span>💧</span>
                      <span>Tưới nước</span>
                    </button>
                  ) : (
                    <button className="w-full py-0.5 px-1.5 rounded-full bg-stone-800 text-stone-300 font-semibold text-[10px] sm:text-[11px] border border-stone-700 hover:bg-stone-700 transition">
                      Ghé thăm
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
