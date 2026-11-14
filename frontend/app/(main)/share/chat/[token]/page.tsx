'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Trash2,
  Utensils,
  Ticket,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://avorafnb.com';

// Format text supporting Markdown bold, links, code, and vouchers
function renderFormattedText(text: string, onNavigate?: (path: string) => void) {
  if (!text) return null;
  const regex = /(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(`[^`]+`)/g;
  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1).trim();
      const isVoucher = /^[A-Z0-9_]{3,30}$/.test(code);
      if (isVoucher) {
        return (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard.writeText(code);
              toast.success(`Đã sao chép mã ${code}!`);
            }}
            title={`Bấm để sao chép mã ${code}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 mx-1 bg-gradient-to-r from-red-50 to-amber-50 hover:from-red-100 hover:to-amber-100 text-red-700 font-mono font-bold text-xs rounded-lg border border-red-200/90 shadow-2xs transition-all cursor-pointer"
          >
            <Ticket size={11} className="text-red-500 shrink-0" />
            <span className="tracking-wider">{code}</span>
            <Copy size={10} className="text-slate-400 shrink-0" />
          </button>
        );
      }
      return (
        <code key={index} className="px-1.5 py-0.5 bg-slate-100 text-red-600 rounded-md font-mono text-xs">
          {code}
        </code>
      );
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const [, label, url] = match;
        return (
          <a
            key={index}
            href={url}
            onClick={(e) => {
              if (url.startsWith('/') && onNavigate) {
                e.preventDefault();
                onNavigate(url);
              }
            }}
            className="text-red-600 hover:text-red-700 font-semibold underline underline-offset-2 inline-flex items-center gap-0.5"
            target={url.startsWith('http') ? '_blank' : '_self'}
            rel="noopener noreferrer"
          >
            <span>{label}</span>
            {url.startsWith('http') && <ExternalLink size={10} className="inline ml-0.5 shrink-0" />}
          </a>
        );
      }
    }
    return <span key={index}>{part}</span>;
  });
}

export default function SharedChatPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<any>(null);
  const [isRevoked, setIsRevoked] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchSharedChat = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/chatbot/share/${token}`);
        if (!res.ok) {
          if (res.status === 410) {
            setIsRevoked(true);
            throw new Error('Liên kết chia sẻ này đã hết thời hạn hoặc bị người dùng hủy bỏ.');
          }
          throw new Error('Không tìm thấy cuộc trò chuyện được chia sẻ.');
        }
        const data = await res.json();
        setChatData(data);
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải cuộc trò chuyện.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedChat();
  }, [token]);

  // Handle Revoke Share
  const handleRevokeShare = async () => {
    const result = await Swal.fire({
      title: 'Hủy liên kết chia sẻ?',
      text: 'Sau khi hủy, bất kỳ ai có đường dẫn này đều sẽ không thể truy cập đoạn hội thoại này nữa.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'Đồng ý hủy chia sẻ',
      cancelButtonText: 'Đóng',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/chatbot/share/${token}/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Không thể hủy chia sẻ');
          return data;
        } catch (err: any) {
          Swal.showValidationMessage(`Lỗi: ${err.message}`);
        }
      },
    });

    if (result.isConfirmed) {
      setIsRevoked(true);
      setError('Liên kết chia sẻ này đã được hủy bỏ thành công.');
      Swal.fire({
        icon: 'success',
        title: 'Đã hủy chia sẻ!',
        text: 'Liên kết không còn khả dụng trên toàn hệ thống.',
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          <span>Đang tải đoạn hội thoại chia sẻ...</span>
        </div>
      </div>
    );
  }

  if (error || isRevoked || !chatData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-sm border border-slate-100 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Không thể mở cuộc trò chuyện</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {error || 'Liên kết chia sẻ đã hết hạn hoặc bị hủy bởi chủ sở hữu.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full pt-1">
            <Link
              href="/chatbot"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
            >
              Trò chuyện với AvoBOT
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Về trang chủ AVORA
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const createdTime = chatData.createdAt
    ? new Date(chatData.createdAt).toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              title="Về trang chủ"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-slate-900 tracking-tight">AVORA</span>
                <span className="bg-red-100 text-red-600 text-[10px] font-black px-1.5 py-0.2 rounded-md">
                  Shared Chat
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px] sm:max-w-md">
                {chatData.title || 'Đoạn trò chuyện được chia sẻ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Đã sao chép liên kết chia sẻ!');
                }
              }}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Copy size={13} />
              <span className="hidden sm:inline">Sao chép link</span>
            </button>

            {/* Nút Hủy Chia Sẻ */}
            <button
              type="button"
              onClick={handleRevokeShare}
              className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Hủy quyền truy cập liên kết chia sẻ này"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Hủy chia sẻ</span>
            </button>

            <Link
              href="/menu"
              className="px-3 sm:px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Đặt món</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Conversation Thread */}
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        {/* Privacy & Protection Banner */}
        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3.5 flex items-start gap-3 text-emerald-950">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-emerald-900">Bảo mật thông tin khách hàng tuyệt đối</h4>
            <p className="text-[11px] text-emerald-700/90 leading-relaxed mt-0.5">
              Hệ thống đã tự động mã hóa & làm mờ số điện thoại (ví dụ:{' '}
              <span className="font-mono font-bold text-emerald-950">083*****52</span>) và địa chỉ nhà để bảo đảm quyền
              riêng tư.
            </p>
            {createdTime && (
              <span className="text-[10px] text-emerald-600 block mt-1">Được tạo lúc: {createdTime}</span>
            )}
          </div>
        </div>

        {/* Messages List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-5">
          {chatData.messages?.map((msg: any, idx: number) => {
            const isUser = msg.senderType === 'USER';
            const actionType = msg.actionType;
            let actionData: any = null;
            if (msg.actionPayload) {
              try {
                actionData = typeof msg.actionPayload === 'string' ? JSON.parse(msg.actionPayload) : msg.actionPayload;
              } catch {}
            }

            return (
              <div
                key={msg.id || idx}
                className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs ${
                    isUser ? 'bg-slate-700' : 'bg-red-600'
                  }`}
                >
                  {isUser ? <User size={15} /> : <Bot size={15} />}
                </div>

                {/* Message Bubble & Rich Cards */}
                <div className={`flex flex-col gap-2 min-w-0 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                  {msg.content && (
                    <div
                      className={`p-3 sm:p-3.5 text-xs sm:text-[13px] leading-relaxed rounded-2xl shadow-2xs break-words whitespace-pre-line ${
                        isUser
                          ? 'bg-gradient-to-br from-red-600 to-rose-600 text-white rounded-tr-xs font-medium'
                          : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-xs'
                      }`}
                    >
                      {renderFormattedText(msg.content, (path) => router.push(path))}
                    </div>
                  )}

                  {/* Render ORDER_PREVIEW Card if available */}
                  {!isUser && (actionType === 'ORDER_PREVIEW' || actionType === 'SHOW_BEAUTIFUL_ORDER') && actionData && (
                    <div className="w-full bg-white rounded-2xl border border-red-200 shadow-sm p-3.5 space-y-2.5 max-w-sm">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
                          <Utensils size={14} />
                          <span>Chi tiết đơn đặt món</span>
                        </div>
                        {actionData.orderCode && (
                          <span className="font-mono text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">
                            #{actionData.orderCode}
                          </span>
                        )}
                      </div>
                      {Array.isArray(actionData.items) && (
                        <div className="space-y-1.5">
                          {actionData.items.map((it: any, iIdx: number) => (
                            <div key={iIdx} className="flex items-center justify-between text-xs">
                              <span className="text-slate-700 font-medium truncate max-w-[200px]">
                                {it.quantity || 1}x {it.name || it.productName}
                              </span>
                              <span className="font-bold text-slate-900">
                                {Number(it.price || it.priceAtSale || 0).toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">Tổng thanh toán:</span>
                        <span className="text-red-600 font-black text-sm">
                          {Number(actionData.totalAmount || actionData.finalTotal || actionData.total || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Render SHOW_ORDER_SUCCESS Card if available */}
                  {!isUser && actionType === 'SHOW_ORDER_SUCCESS' && (
                    <div className="w-full bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 text-emerald-950 flex items-center gap-2.5 max-w-sm">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold block text-emerald-900">Đơn hàng đã được tạo thành công!</span>
                        <span className="text-[11px] text-emerald-700">Mã đơn: {actionData?.orderCode || 'Đã ghi nhận'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Card */}
        <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-3xl p-5 text-white shadow-lg shadow-red-600/20 text-center space-y-2">
          <h3 className="font-black text-sm sm:text-base">Bạn cũng muốn đặt món chuẩn vị với AvoBOT?</h3>
          <p className="text-xs text-white/80 max-w-md mx-auto">
            AvoBOT giúp bạn chọn món ngon, tính toán calories, áp mã giảm giá và tạo đơn hàng chỉ trong 30 giây!
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Link
              href="/chatbot"
              className="px-5 py-2.5 bg-white text-red-600 hover:bg-slate-50 font-bold rounded-xl text-xs shadow-sm transition-all"
            >
              Chat với AvoBOT ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
