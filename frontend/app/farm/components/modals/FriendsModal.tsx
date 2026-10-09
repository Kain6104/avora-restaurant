'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Droplets,
  Hand,
  Home,
  Clock,
  Check,
  UserCheck,
  UserX,
  Bell,
  Hourglass,
  Users,
  History,
  Droplet,
  ExternalLink,
} from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';

interface FriendsModalProps {
  overview?: {
    friends: any[];
    strangers: any[];
    pendingReceived?: any[];
    pendingSentIds?: string[];
    limits: {
      strangerMax: number;
      strangerUsed: number;
      strangerRemaining: number;
      friendMax: number;
      friendUsed: number;
      friendRemaining: number;
    };
  };
  friends?: any[];
  onClose: () => void;
  onVisitFarm: (friendUserId: string) => void;
  onWaterFriend: (friendUserId: string, plotIndex: number) => void;
  onGatherFriend: (friendUserId: string, plotIndex: number) => void;
  onAddFriend?: (friendUserId: string) => Promise<void> | void;
  onAcceptFriend?: (requesterUserId: string) => Promise<void> | void;
  onRejectFriend?: (requesterUserId: string) => Promise<void> | void;
}

export default function FriendsModal({
  overview,
  friends = [],
  onClose,
  onVisitFarm,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
}: FriendsModalProps) {
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'SUGGEST' | 'INVITES' | 'JOURNAL'>('FRIENDS');
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [journalLogs, setJournalLogs] = useState<any[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);

  const friendsList = overview?.friends || friends || [];
  const strangersList = overview?.strangers || [];
  const pendingReceived = overview?.pendingReceived || [];
  const pendingSentIds = overview?.pendingSentIds || [];

  const limits = overview?.limits || {
    strangerMax: 3,
    strangerUsed: 0,
    strangerRemaining: 3,
    friendMax: 10,
    friendUsed: 0,
    friendRemaining: 10,
  };

  const handleAddFriendClick = async (e: React.MouseEvent, friendUserId: string) => {
    e.stopPropagation();
    if (!onAddFriend || addingFriendId) return;
    setAddingFriendId(friendUserId);
    farmSound.playReward();
    try {
      await onAddFriend(friendUserId);
    } finally {
      setAddingFriendId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'JOURNAL') {
      fetchJournal();
    }
  }, [activeTab]);

  const fetchJournal = async () => {
    try {
      setLoadingJournal(true);
      const res = await fetch('/api/farm/friends/journal', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setJournalLogs(json.data || []);
      }
    } catch (e) {
      console.warn('Could not fetch social journal:', e);
    } finally {
      setLoadingJournal(false);
    }
  };

  const formatVietnamTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const handleAcceptClick = async (e: React.MouseEvent, requesterUserId: string) => {
    e.stopPropagation();
    if (!onAcceptFriend || processingInviteId) return;
    setProcessingInviteId(requesterUserId);
    farmSound.playReward();
    try {
      await onAcceptFriend(requesterUserId);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleRejectClick = async (e: React.MouseEvent, requesterUserId: string) => {
    e.stopPropagation();
    if (!onRejectFriend || processingInviteId) return;
    setProcessingInviteId(requesterUserId);
    farmSound.playClick();
    try {
      await onRejectFriend(requesterUserId);
    } finally {
      setProcessingInviteId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex flex-col w-full h-full min-h-[100dvh] max-h-[100dvh] bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Header */}
      <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#422006] via-[#754714] to-[#422006] text-white flex items-center justify-between border-b border-[#e0a93b]/60 shrink-0 shadow-md gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            ← Trở về
          </button>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif font-black text-xs sm:text-sm text-[#fff8e7] tracking-wider truncate">
              NÔNG TRẠI BẠN BÈ & CỘNG ĐỒNG
            </h3>
            <p className="hidden sm:block text-[10px] text-amber-200/70 truncate">
              Giao lưu nông hữu, tưới nước giúp nhau và giao lưu nông sản
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/25 hover:bg-black/50 flex items-center justify-center text-white/90 cursor-pointer transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

        {/* Tab Selection Bar */}
        <div className="flex items-center justify-between bg-[#2d1b0f] text-white px-2 sm:px-4 py-1.5 border-b border-[#e0a93b]/40 shrink-0 gap-1">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('FRIENDS')}
              className={`px-3 sm:px-4 py-1.5 rounded-t-lg font-serif text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'FRIENDS'
                  ? 'bg-[#c62828] text-white border-t-2 border-amber-300 shadow-md'
                  : 'bg-[#4a2e1b] text-gray-300 hover:text-white'
              }`}
            >
              Danh sách bạn bè ({friendsList.length})
            </button>

            <button
              onClick={() => setActiveTab('SUGGEST')}
              className={`px-3 sm:px-4 py-1.5 rounded-t-lg font-serif text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'SUGGEST'
                  ? 'bg-[#c62828] text-white border-t-2 border-amber-300 shadow-md'
                  : 'bg-[#4a2e1b] text-gray-300 hover:text-white'
              }`}
            >
              Gợi ý thêm bạn ({strangersList.length})
            </button>

            <button
              onClick={() => setActiveTab('INVITES')}
              className={`px-3 sm:px-4 py-1.5 rounded-t-lg font-serif text-xs sm:text-sm font-black transition-all cursor-pointer relative flex items-center gap-1 ${
                activeTab === 'INVITES'
                  ? 'bg-[#c62828] text-white border-t-2 border-amber-300 shadow-md'
                  : 'bg-[#4a2e1b] text-gray-300 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Lời mời kết bạn</span>
              {pendingReceived.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {pendingReceived.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('JOURNAL')}
              className={`px-3 sm:px-4 py-1.5 rounded-t-lg font-serif text-xs sm:text-sm font-black transition-all cursor-pointer relative flex items-center gap-1 ${
                activeTab === 'JOURNAL'
                  ? 'bg-[#c62828] text-white border-t-2 border-amber-300 shadow-md'
                  : 'bg-[#4a2e1b] text-gray-300 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Nhật ký bạn bè</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#ffe58f] font-mono bg-black/30 px-3 py-1 rounded-full border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Làm mới mỗi ngày</span>
          </div>
        </div>

        {/* Steal Quota Indicator */}
        <div className="bg-[#f5ecdd] border-b border-[#e2d5c0] px-4 py-1.5 text-center text-xs font-bold text-[#5a3e1b] shrink-0">
          {activeTab === 'FRIENDS' ? (
            <span>
              Hôm nay, số lần bạn có thể lấy cây trồng của <strong className="text-rose-700">bạn bè</strong> là:{' '}
              <span className="text-emerald-700 font-black font-mono text-sm">
                {limits.friendUsed} / {limits.friendMax}
              </span>
            </span>
          ) : activeTab === 'SUGGEST' ? (
            <span>
              Hôm nay, số lần bạn có thể lấy cây trồng của <strong className="text-amber-800">người lạ</strong> là:{' '}
              <span className="text-emerald-700 font-black font-mono text-sm">
                {limits.strangerUsed} / {limits.strangerMax}
              </span>
            </span>
          ) : (
            <span>
              Các yêu cầu kết bạn đang chờ bạn phê duyệt. Sau khi đồng ý sẽ mở khóa{' '}
              <strong className="text-emerald-700">{limits.friendMax} lượt trộm/ngày</strong>!
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto min-h-0 flex-1 bg-[#faf6ef]">
          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'FRIENDS' && (
            friendsList.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-bold text-gray-500">
                  Bạn chưa có bạn bè nào trong danh sách!
                </p>
                <p className="text-xs text-gray-400">
                  Hãy gửi lời mời kết bạn từ tab &quot;Gợi ý thêm bạn&quot; để mở rộng mạng lưới nông hữu.
                </p>
                <button
                  onClick={() => setActiveTab('SUGGEST')}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-sm hover:bg-amber-700 transition cursor-pointer"
                >
                  Khám phá gợi ý kết bạn
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {friendsList.map((player: any) => {
                  const canSteal = player.canGatherCount > 0;
                  const needWater = player.needWaterCount > 0;

                  return (
                    <div
                      key={player.userId}
                      onClick={() => onVisitFarm(player.userId)}
                      className="relative flex items-center justify-between p-3 rounded-2xl bg-[#fffdfa] border-2 border-[#e5dcd0] hover:border-[#d4af37] shadow-xs hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden ring-2 ring-[#e0a93b] ring-offset-1 ring-offset-white bg-[#f5efe6] shrink-0">
                          {player.avatarUrl ? (
                            <img
                              src={player.avatarUrl}
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-serif font-black text-[#8d6e63]">
                              {(player.name || 'U')[0]}
                            </div>
                          )}
                          <div className="absolute bottom-0 right-0 px-1 py-0.2 rounded-tl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[9px] shadow-xs">
                            {player.level}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-serif font-black text-xs sm:text-sm text-[#422006] truncate group-hover:text-amber-800 transition-colors">
                            {player.name}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                            <span>Cây thần Lv.{player.treeLevel || 1}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                        {canSteal ? (
                          <div className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-[10px] font-black tracking-wide flex items-center gap-1 shadow-xs animate-pulse">
                            <Hand className="w-3 h-3" />
                            <span>Có thể trộm</span>
                          </div>
                        ) : needWater ? (
                          <div className="px-2.5 py-1 rounded-lg bg-sky-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <Droplets className="w-3 h-3" />
                            <span>Cần tưới</span>
                          </div>
                        ) : (
                          <div className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                            <Home className="w-3 h-3 text-amber-600" />
                            <span>Ghé thăm</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 2: SUGGEST STRANGERS */}
          {activeTab === 'SUGGEST' && (
            strangersList.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-gray-500">
                Đang tìm kiếm nông trang khác...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {strangersList.map((player: any) => {
                  const canSteal = player.canGatherCount > 0;
                  const needWater = player.needWaterCount > 0;
                  const isSentPending = player.isPendingSent || pendingSentIds.includes(player.userId);

                  return (
                    <div
                      key={player.userId}
                      onClick={() => onVisitFarm(player.userId)}
                      className="relative flex items-center justify-between p-3 rounded-2xl bg-[#fffdfa] border-2 border-[#e5dcd0] hover:border-[#d4af37] shadow-xs hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden ring-2 ring-[#e0a93b] ring-offset-1 ring-offset-white bg-[#f5efe6] shrink-0">
                          {player.avatarUrl ? (
                            <img
                              src={player.avatarUrl}
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-serif font-black text-[#8d6e63]">
                              {(player.name || 'U')[0]}
                            </div>
                          )}
                          <div className="absolute bottom-0 right-0 px-1 py-0.2 rounded-tl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[9px] shadow-xs">
                            {player.level}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-serif font-black text-xs sm:text-sm text-[#422006] truncate group-hover:text-amber-800 transition-colors">
                            {player.name}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                            <span>Cây thần Lv.{player.treeLevel || 1}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                        {canSteal ? (
                          <div className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black tracking-wide flex items-center gap-1 shadow-xs">
                            <Hand className="w-3 h-3" />
                            <span>Có thể trộm</span>
                          </div>
                        ) : needWater ? (
                          <div className="px-2 py-0.5 rounded-lg bg-sky-500 text-white text-[9px] font-bold flex items-center gap-1 shadow-xs">
                            <Droplets className="w-3 h-3" />
                            <span>Cần tưới</span>
                          </div>
                        ) : null}

                        {isSentPending ? (
                          <div className="px-2 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-[9px] font-bold flex items-center gap-1">
                            <Hourglass className="w-3 h-3 text-amber-600" />
                            <span>Chờ đồng ý</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleAddFriendClick(e, player.userId)}
                            disabled={addingFriendId === player.userId}
                            className="px-2.5 py-1 rounded-md bg-[#5a3e1b] hover:bg-[#784814] text-white text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>{addingFriendId === player.userId ? 'Đang gửi...' : '+ Kết bạn'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 3: PENDING RECEIVED INVITES */}
          {activeTab === 'INVITES' && (
            pendingReceived.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center text-gray-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-gray-500">
                  Hiện không có lời mời kết bạn nào đang chờ!
                </p>
                <p className="text-xs text-gray-400">
                  Khi người chơi khác gửi lời mời cho bạn, lời mời sẽ hiển thị tại đây để bạn đồng ý.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingReceived.map((req: any) => (
                  <div
                    key={req.requestId || req.userId}
                    className="p-3.5 rounded-2xl bg-white border-2 border-amber-300 shadow-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden ring-2 ring-amber-400 bg-amber-50 shrink-0">
                        {req.avatarUrl ? (
                          <img src={req.avatarUrl} alt={req.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-serif font-black text-amber-800">
                            {(req.name || 'U')[0]}
                          </div>
                        )}
                        <div className="absolute bottom-0 right-0 px-1 py-0.2 rounded-tl bg-amber-600 text-white font-black text-[9px]">
                          {req.level || 1}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-serif font-black text-xs sm:text-sm text-[#422006] truncate">
                          {req.name}
                        </h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Đã gửi lời mời kết bạn cho bạn
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <button
                        onClick={(e) => handleAcceptClick(e, req.userId)}
                        disabled={processingInviteId === req.userId}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Đồng ý</span>
                      </button>
                      <button
                        onClick={(e) => handleRejectClick(e, req.userId)}
                        disabled={processingInviteId === req.userId}
                        className="p-1.5 rounded-xl bg-gray-100 hover:bg-rose-100 text-gray-500 hover:text-rose-700 transition cursor-pointer"
                        title="Từ chối"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* TAB 4: JOURNAL (NHẬT KÝ BẠN BÈ) */}
          {activeTab === 'JOURNAL' && (
            loadingJournal ? (
              <div className="py-16 text-center text-stone-400 text-xs font-bold space-y-2">
                <Clock className="w-6 h-6 mx-auto animate-spin text-amber-700" />
                <p>Đang tải nhật ký bạn bè...</p>
              </div>
            ) : journalLogs.length === 0 ? (
              <div className="py-16 text-center text-stone-400 text-xs font-medium space-y-2">
                <History className="w-10 h-10 mx-auto text-stone-300" />
                <p>Chưa có nhật ký tương tác bạn bè nào gần đây</p>
              </div>
            ) : (
              <div className="space-y-2">
                {journalLogs.map((log: any) => {
                  const isSteal = log.action === 'STEAL';
                  const isWater = log.action === 'WATER';
                  const isVisit = log.action === 'VISIT';
                  const otherUser = log.isOwner ? log.actor : log.targetOwner;

                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isSteal && log.isOwner
                          ? 'bg-rose-50/70 border-rose-200'
                          : isWater
                          ? 'bg-sky-50/70 border-sky-200'
                          : 'bg-white border-[#ebd8be]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm text-stone-700">
                          {otherUser?.avatarUrl ? (
                            <img src={otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : isSteal ? (
                            '🥷'
                          ) : isWater ? (
                            '💧'
                          ) : (
                            '🚶'
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#3e2723] font-medium leading-snug">
                            {log.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-400 font-mono">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-stone-300" />
                              {formatVietnamTime(log.createdAt)}
                            </span>
                            {otherUser?.memberCode && (
                              <span>#{otherUser.memberCode}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {otherUser?.id && (
                        <button
                          onClick={() => {
                            farmSound.playClick();
                            onClose();
                            onVisitFarm(otherUser.id);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1 transition shrink-0 cursor-pointer active:scale-95"
                          title="Ghé thăm vườn người bạn này"
                        >
                          <Home className="w-3.5 h-3.5 text-amber-700" />
                          <span className="hidden sm:inline">Ghé thăm</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
    </div>
  );
}
