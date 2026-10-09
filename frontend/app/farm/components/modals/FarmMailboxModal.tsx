'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  MailOpen,
  Gift,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  Ticket,
  Sparkle,
  RotateCcw,
  Check,
  Calendar,
} from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import toast from 'react-hot-toast';

interface FarmMailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshFarms?: () => void;
  onMailClaimed?: (rewards: any) => void;
}

export default function FarmMailboxModal({
  isOpen,
  onClose,
  onRefreshFarms,
  onMailClaimed,
}: FarmMailboxModalProps) {
  const [mails, setMails] = useState<any[]>([]);
  const [selectedMail, setSelectedMail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNCLAIMED' | 'CLAIMED'>('ALL');

  useEffect(() => {
    if (isOpen) {
      fetchMails();
    }
  }, [isOpen]);

  const fetchMails = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/farm/mails', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const mailList = json.data || [];
        setMails(mailList);
        if (mailList.length > 0 && !selectedMail) {
          setSelectedMail(mailList[0]);
        }
      }
    } catch (e) {
      console.warn('Could not fetch mails:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMail = async (mail: any) => {
    setSelectedMail(mail);
    farmSound.playClick();
    if (!mail.isRead) {
      try {
        await fetch(`/api/farm/mails/${mail.id}/read`, {
          method: 'POST',
          credentials: 'include',
        });
        setMails((prev) =>
          prev.map((m) => (m.id === mail.id ? { ...m, isRead: true } : m)),
        );
      } catch {}
    }
  };

  const handleClaim = async (userMailId: string) => {
    try {
      setClaimingId(userMailId);
      farmSound.playReward();
      const res = await fetch(`/api/farm/mails/${userMailId}/claim`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        toast.success(json.data.message || 'Nhận quà thành công!');
        // Update local state
        setMails((prev) =>
          prev.map((m) =>
            m.id === userMailId ? { ...m, isClaimed: true, claimedAt: new Date() } : m,
          ),
        );
        if (selectedMail?.id === userMailId) {
          setSelectedMail((prev: any) => (prev ? { ...prev, isClaimed: true } : null));
        }
        if (onMailClaimed) onMailClaimed(json.data);
        if (onRefreshFarms) onRefreshFarms();
      } else {
        toast.error(json.message || json.error?.message || 'Không thể nhận phần thưởng');
      }
    } catch (e) {
      toast.error('Lỗi khi nhận quà từ hòm thư');
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimAll = async () => {
    try {
      setIsClaimingAll(true);
      farmSound.playReward();
      const res = await fetch('/api/farm/mails/claim-all', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        toast.success(json.data.message || 'Đã nhận toàn bộ phần thưởng!');
        if (json.data.mails) {
          setMails(json.data.mails);
          if (selectedMail) {
            const updated = json.data.mails.find((m: any) => m.id === selectedMail.id);
            if (updated) setSelectedMail(updated);
          }
        }
        if (onRefreshFarms) onRefreshFarms();
      } else {
        toast.error(json.message || json.error?.message || 'Không có quà nào để nhận');
      }
    } catch (e) {
      toast.error('Lỗi khi nhận tất cả phần thưởng');
    } finally {
      setIsClaimingAll(false);
    }
  };

  const formatVietnamTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const renderRewardIcon = (type: string) => {
    switch (type) {
      case 'COIN':
        return <AvoraCoinIcon size="sm" className="w-4 h-4" />;
      case 'AVORA_POINT':
        return <Sparkles className="w-4 h-4 text-purple-600 fill-purple-400" />;
      case 'VOUCHER':
        return <Ticket className="w-4 h-4 text-rose-500 fill-rose-300" />;
      case 'SEED':
      case 'PRODUCE':
        return <Package className="w-4 h-4 text-emerald-600" />;
      case 'MYSTERY_PACK':
      default:
        return <Gift className="w-4 h-4 text-indigo-500" />;
    }
  };

  const filteredMails = mails.filter((m) => {
    if (filter === 'UNCLAIMED') return !m.isClaimed && !m.isExpired;
    if (filter === 'CLAIMED') return m.isClaimed;
    return true;
  });

  const unclaimedCount = mails.filter((m) => !m.isClaimed && !m.isExpired).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9996] flex flex-col w-screen h-screen bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
    >
      {/* ========================================================= */}
      {/* 1. HEADER                                                 */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-[#2d1b08] via-[#422006] to-[#2d1b08] text-[#fdfbf7] px-2.5 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between border-b border-[#d4af37]/80 shrink-0 shadow-md gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            ← Trở về
          </button>
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-400 to-[#d4af37] flex items-center justify-center text-stone-900 shadow-xs shrink-0">
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="font-serif font-black text-xs sm:text-sm text-[#fff8e1] tracking-wide truncate">
                HÒM THƯ NÔNG TRẠI
              </h2>
              {unclaimedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] sm:text-[10px] font-black shrink-0">
                  {unclaimedCount} chưa nhận
                </span>
              )}
            </div>
            <p className="hidden sm:block text-[10px] text-[#d7ccc8] font-medium truncate">
              Quà tặng sự kiện, bảo trì hệ thống và thư tri ân từ AVORA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {unclaimedCount > 0 && (
            <button
              onClick={handleClaimAll}
              disabled={isClaimingAll}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-serif font-black text-[11px] sm:text-xs flex items-center gap-1 shadow-xs active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <Gift className="w-3 h-3" />
              <span>{isClaimingAll ? 'Đang nhận...' : 'Nhận tất cả'}</span>
            </button>
          )}

            <button
              onClick={() => {
                farmSound.playClick();
                onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. BODY (SPLIT VIEW: LIST & DETAIL)                       */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#faf5eb]">
          {/* LEFT: MAIL LIST */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-[#e0c598] flex flex-col shrink-0 bg-[#fdfbf7]">
            {/* Filter bar */}
            <div className="p-2.5 border-b border-[#e0c598] flex items-center justify-between text-xs font-bold text-[#5d4037]">
              <div className="flex items-center gap-1 bg-[#f0e6d6] p-0.5 rounded-xl">
                <button
                  onClick={() => setFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    filter === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilter('UNCLAIMED')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    filter === 'UNCLAIMED' ? 'bg-white text-rose-700 font-black shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Chưa nhận
                </button>
                <button
                  onClick={() => setFilter('CLAIMED')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    filter === 'CLAIMED' ? 'bg-white text-emerald-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Đã nhận
                </button>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
                {filteredMails.length} thư
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-stone-400 space-y-2">
                  <RotateCcw className="w-6 h-6 animate-spin text-amber-700" />
                  <span className="text-xs font-bold">Đang tải hòm thư...</span>
                </div>
              ) : filteredMails.length === 0 ? (
                <div className="py-16 text-center text-stone-400 text-xs font-medium space-y-2">
                  <MailOpen className="w-10 h-10 mx-auto text-stone-300" />
                  <p>Không có thư nào trong mục này</p>
                </div>
              ) : (
                filteredMails.map((mail) => {
                  const isSelected = selectedMail?.id === mail.id;
                  const hasUnclaimed = !mail.isClaimed && !mail.isExpired;

                  return (
                    <div
                      key={mail.id}
                      onClick={() => handleSelectMail(mail)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#fff5e0] border-[#d4af37] shadow-sm'
                          : mail.isRead
                          ? 'bg-white border-[#e8ddcc] hover:border-[#d4af37]'
                          : 'bg-[#fffdf2] border-[#e0a93b] font-bold shadow-xs'
                      }`}
                    >
                      {/* Unread dot */}
                      {!mail.isRead && (
                        <div className="w-2 h-2 rounded-full bg-rose-500 absolute top-3 right-3 animate-ping" />
                      )}

                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-base shrink-0 mt-0.5">
                          {mail.isClaimed ? '📫' : hasUnclaimed ? '🎁' : '✉️'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[10px] text-amber-800 font-bold uppercase truncate">
                              {mail.sender || 'Hệ thống'}
                            </span>
                            <span className="text-[9px] text-stone-400 font-mono shrink-0">
                              {formatVietnamTime(mail.sentAt).split(' ')[0]}
                            </span>
                          </div>

                          <h4 className={`text-xs truncate ${isSelected ? 'text-[#3e2723] font-black' : 'text-stone-800 font-bold'}`}>
                            {mail.title}
                          </h4>

                          {/* Reward mini tags */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {mail.rewards?.slice(0, 2).map((r: any, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-[9px] font-bold text-stone-700"
                              >
                                {renderRewardIcon(r.type)}
                                <span className="truncate max-w-[80px]">
                                  {r.quantity ? `×${r.quantity}` : ''} {r.name}
                                </span>
                              </span>
                            ))}
                            {mail.rewards?.length > 2 && (
                              <span className="text-[9px] text-stone-400 font-bold">
                                +{mail.rewards.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: MAIL DETAIL PREVIEW */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 bg-[#faf5eb]">
            {selectedMail ? (
              <div className="max-w-xl mx-auto w-full space-y-5">
                {/* Mail Header Banner Card */}
                <div className="p-5 rounded-3xl bg-white border-2 border-[#e0c598] shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-sm">
                        👑
                      </span>
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block">Người gửi</span>
                        <span className="font-bold text-[#5d4037]">{selectedMail.sender || 'Hệ thống AVORA Farm'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Ngày gửi</span>
                      <span className="font-mono text-stone-600 text-[11px] font-semibold">
                        {formatVietnamTime(selectedMail.sentAt)}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-serif font-black text-lg sm:text-xl text-[#3e2723] leading-tight">
                    {selectedMail.title}
                  </h3>

                  <div className="p-4 rounded-2xl bg-[#faf5eb] border border-[#ebd8be] text-xs sm:text-sm text-[#5d4037] leading-relaxed whitespace-pre-line font-medium">
                    {selectedMail.content}
                  </div>

                  {selectedMail.expiresAt && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-mono font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hạn nhận quà: {formatVietnamTime(selectedMail.expiresAt)}</span>
                    </div>
                  )}
                </div>

                {/* Rewards Attachment Box */}
                {selectedMail.rewards && selectedMail.rewards.length > 0 && (
                  <div className="p-5 rounded-3xl bg-white border-2 border-[#e0c598] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-black text-xs text-[#5d4037] uppercase tracking-wide flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-amber-600" />
                        Phần thưởng đính kèm:
                      </span>
                      {selectedMail.isClaimed ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1 border border-emerald-300">
                          <Check className="w-3 h-3" /> ĐÃ NHẬN
                        </span>
                      ) : selectedMail.isExpired ? (
                        <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 text-[10px] font-black border border-stone-300">
                          ĐÃ HẾT HẠN
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300">
                          CHƯA NHẬN
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedMail.rewards.map((r: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-[#faf5eb] border border-[#e5d4be] flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-xl shrink-0">
                            {r.iconUrl && r.iconUrl.length <= 4 ? (
                              <span>{r.iconUrl}</span>
                            ) : (
                              renderRewardIcon(r.type)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-serif font-black text-xs text-[#3e2723] truncate">
                              {r.name}
                            </h5>
                            <span className="font-mono text-[11px] font-bold text-amber-800">
                              Số lượng: ×{r.quantity || 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Claim Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => handleClaim(selectedMail.id)}
                        disabled={selectedMail.isClaimed || selectedMail.isExpired || claimingId === selectedMail.id}
                        className={`w-full py-3 px-4 rounded-2xl font-serif font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98 ${
                          selectedMail.isClaimed
                            ? 'bg-stone-200 text-stone-500 cursor-not-allowed border border-stone-300'
                            : selectedMail.isExpired
                            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-900 shadow-amber-500/20'
                        }`}
                      >
                        <Gift className="w-4 h-4" />
                        <span>
                          {claimingId === selectedMail.id
                            ? 'Đang nhận phần thưởng...'
                            : selectedMail.isClaimed
                            ? 'Đã nhận phần thưởng'
                            : selectedMail.isExpired
                            ? 'Quà đã hết hạn'
                            : '🎁 NHẬN QUÀ NGAY'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-stone-400 text-xs font-medium space-y-2">
                <Mail className="w-12 h-12 mx-auto text-stone-300" />
                <p>Chọn một thư từ danh sách bên trái để đọc nội dung</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
