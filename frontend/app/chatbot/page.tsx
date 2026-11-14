"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Send, Loader2,
  Trash2, Bot, ShoppingCart,
  RefreshCw, MapPin, Ticket, Clock,
  ChevronLeft, Home, Utensils, Calendar,
  Building2, ArrowRight, MessageSquare,
  Flame, Check, Copy, ExternalLink, Menu, X,
  AlertTriangle, RotateCcw, User, Mic, MicOff,
  Activity, Store, Plus, Volume2, VolumeX,
  CreditCard, QrCode, DollarSign, History, ChevronRight,
  Share2, Lock, MoreVertical, CheckCircle2
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useCart } from '@/context/CartContext';
import { toast } from 'react-hot-toast';
import { getAuthToken, getAuthHeaders, getAuthUser, AuthUser } from '@/lib/auth';
import { AiAnalysisProgress } from '@/components/chatbot/AiAnalysisProgress';
import { BranchLocationMapCard } from '@/components/chatbot/BranchLocationMapCard';

// Helper: Phân tích & xóa sạch tag SUGGESTIONS khỏi nội dung văn bản để tránh lộ JSON ra bong bóng chat
function parseSuggestionsAndCleanContent(content: string, existingSuggestions?: any[]): {
  cleanContent: string;
  suggestions: any[];
} {
  if (!content) return { cleanContent: '', suggestions: existingSuggestions || [] };

  let suggestions: any[] = existingSuggestions && existingSuggestions.length > 0 ? [...existingSuggestions] : [];
  const match = content.match(/(?:<{1,3}SUGGESTIONS>{1,3}|<SUGGESTIONS>)([\s\S]*?)(?:<\/{0,1}SUGGESTIONS>{0,3}|<\/SUGGESTIONS>|$)/i);

  if (match && match[1]) {
    try {
      let rawJson = match[1].trim();
      const s = rawJson.indexOf('[');
      const e = rawJson.lastIndexOf(']');
      if (s !== -1 && e !== -1 && e > s) {
        rawJson = rawJson.substring(s, e + 1);
      }
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0 && suggestions.length === 0) {
        suggestions = parsed.map((item) =>
          typeof item === 'string'
            ? { label: item, action: 'SEND_MESSAGE', payload: item }
            : {
              label: item.label || item.text || 'Gợi ý',
              action: item.action || 'SEND_MESSAGE',
              payload: item.payload || item.label || item.text,
            }
        );
      }
    } catch (e) {
      console.warn('Failed to parse suggestions in client:', e);
    }
  }

  const cleanContent = content
    .replace(/(?:<{1,3}SUGGESTIONS>{1,3}|<SUGGESTIONS>)[\s\S]*?(?:<\/{0,1}SUGGESTIONS>{0,3}|<\/SUGGESTIONS>|$)/gi, '')
    .trim();

  return { cleanContent, suggestions };
}

interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: "USER" | "AI" | "TOOL" | "SYSTEM";
  content: string;
  actionType?: string | null;
  actionPayload?: string | null;
  createdAt: string;
  suggestedReplies?: any[];
  isError?: boolean;
}

// 4-bar vertical soundwave / equalizer icon
const SoundwaveIcon = ({ isListening = false }: { isListening?: boolean }) => (
  <span className="inline-flex items-center justify-center gap-[2.5px] w-5 h-5" aria-hidden="true">
    <span className={`w-[2.5px] bg-current rounded-full transition-all duration-200 ${isListening ? 'h-3 animate-pulse' : 'h-2'}`} />
    <span className={`w-[2.5px] bg-current rounded-full transition-all duration-200 ${isListening ? 'h-5 animate-pulse delay-75' : 'h-4.5'}`} />
    <span className={`w-[2.5px] bg-current rounded-full transition-all duration-200 ${isListening ? 'h-4 animate-pulse delay-150' : 'h-3.5'}`} />
    <span className={`w-[2.5px] bg-current rounded-full transition-all duration-200 ${isListening ? 'h-2.5 animate-pulse delay-100' : 'h-2'}`} />
  </span>
);

// Fallback User Avatar with React Lucide icon
const UserAvatar = ({ user }: { user: any }) => {
  const [hasError, setHasError] = useState(false);
  const avatarUrl = user?.avatarUrl || user?.avatar;

  if (avatarUrl && !hasError) {
    return (
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-100 border border-red-200 overflow-hidden shadow-xs shrink-0">
        <img
          src={avatarUrl}
          alt={user?.fullName || "User"}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  if (user?.fullName) {
    return (
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-xs shrink-0 font-bold text-xs uppercase">
        {user.fullName.charAt(0)}
      </div>
    );
  }

  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
      <User size={15} className="text-white" />
    </div>
  );
};

// PCM downsampling utility for 16kHz WebSocket voice
function downsampleTo16k(inputData: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return inputData;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(inputData.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputData.length; i++) {
      accum += inputData[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

const renderFormattedText = (text: string, onNavigate?: (path: string) => void) => {
  const clean = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '');
  const regex = /(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(`[^`]+`)/g;
  const parts = clean.split(regex).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
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
              e.stopPropagation();
              navigator.clipboard.writeText(code);
              toast.success(`Đã sao chép mã ${code}!`);
            }}
            title={`Bấm để sao chép mã ${code}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 mx-1 bg-gradient-to-r from-red-50 to-amber-50 hover:from-red-100 hover:to-amber-100 text-red-700 hover:text-red-800 font-mono font-bold text-xs rounded-xl border border-red-200/90 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 group align-baseline"
          >
            <Ticket size={12} className="text-red-500 shrink-0 group-hover:rotate-12 transition-transform" />
            <span className="tracking-wider">{code}</span>
            <Copy size={11} className="text-slate-400 group-hover:text-red-600 shrink-0 ml-0.5" />
          </button>
        );
      }
      return <code key={index} className="px-1.5 py-0.5 mx-0.5 bg-slate-100 text-slate-800 font-mono text-[12px] rounded border border-slate-200">{code}</code>;
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const title = match[1];
        const href = match[2];
        const isMap = href.includes('google.com/maps') || href.includes('maps.google') || title.toLowerCase().includes('bản đồ');

        if (isMap) {
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs sm:text-sm transition-colors border border-blue-200 shadow-2xs"
            >
              <MapPin size={13} className="shrink-0 text-blue-600" />
              <span>{title}</span>
            </a>
          );
        }

        const cleanPath = href.replace(/^https?:\/\/[^\/]+/, '');

        // Branch route
        if (cleanPath.startsWith('/chi-nhanh/')) {
          return (
            <a
              key={index}
              href={cleanPath}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(cleanPath);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 my-0.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs sm:text-sm transition-colors border border-red-200 shadow-2xs cursor-pointer align-baseline"
            >
              <MapPin size={12} className="shrink-0 text-red-600" />
              <span className="underline decoration-red-300 underline-offset-2">{title}</span>
            </a>
          );
        }

        // Voucher links
        if (cleanPath.startsWith('/vouchers')) {
          return (
            <a
              key={index}
              href={cleanPath}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(cleanPath);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 my-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-xs sm:text-sm transition-colors border border-amber-200 shadow-2xs cursor-pointer align-baseline"
            >
              <Ticket size={12} className="shrink-0 text-amber-600" />
              <span className="underline decoration-amber-400 underline-offset-2">{title}</span>
            </a>
          );
        }

        // Internal relative routes
        if (cleanPath.startsWith('/')) {
          return (
            <a
              key={index}
              href={cleanPath}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(cleanPath);
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs sm:text-sm transition-colors cursor-pointer align-baseline"
            >
              <Utensils size={12} className="shrink-0 text-slate-600" />
              <span>{title}</span>
            </a>
          );
        }

        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 hover:underline font-bold inline-flex items-center gap-0.5"
          >
            <span>{title}</span>
            <ExternalLink size={10} className="shrink-0" />
          </a>
        );
      }
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

export default function ChatbotPage() {
  const router = useRouter();
  const { cartItems, currentBranchId, addToCart, removeFromCart, updateQuantity, changeBranch, setOptionsModalProduct, replaceFromServerCart, clearCart } = useCart();
  const cartTotal = cartItems.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
  const cartSummary = cartItems.map(i => `${i.name} (x${i.quantity})`).join(', ');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [guestSessionToken, setGuestSessionToken] = useState<string | null>(null);
  const [personality, setPersonality] = useState("Thân thiện");
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<{ [msgId: string]: string }>({});

  // Session & Conversation History state (Backend database persisted)
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDuration, setShareDuration] = useState('24h');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [shareTargetSessionId, setShareTargetSessionId] = useState<string | null>(null);
  const [sessionActionMenuId, setSessionActionMenuId] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://avorafnb.com';

  // Determine current active branch name
  const effectiveBranchId = currentBranchId || (typeof window !== 'undefined' ? (localStorage.getItem('currentBranchId') || localStorage.getItem('selectedBranchId')) : '') || branches[0]?.id || 'AVO-Q1';
  const matchedBranch = branches.find(b => b.id === effectiveBranchId || b.slug === effectiveBranchId);
  const branchName = matchedBranch?.name || 'Avora West Lake';

  // Load chat sessions from Backend/Database
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const res = await fetch(`${API_URL}/api/chatbot/sessions`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessions(data);
        }
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [API_URL]);

  // Start a new conversation (Does NOT save to DB until first message is sent)
  const handleCreateNewSession = () => {
    setSessionId(null);
    setMessages([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(user?.id ? 'avora_chat_session_id' : 'avora_chat_guest_session_id');
    }
    setShowHistoryDrawer(false);
    toast.success('Đã bắt đầu cuộc trò chuyện mới');
  };

  // Switch to an existing session from Backend/Database
  const handleSelectSession = async (targetId: string) => {
    if (targetId === sessionId) {
      setShowHistoryDrawer(false);
      return;
    }
    try {
      setIsLoading(true);
      setSessionId(targetId);
      localStorage.setItem(user?.id ? 'avora_chat_session_id' : 'avora_chat_guest_session_id', targetId);
      const res = await fetch(`${API_URL}/api/chatbot/session/${targetId}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.messages)) {
          const cleanMsgs = data.messages
            .filter(
              (m: any) =>
                (m.senderType === 'USER' || m.senderType === 'AI') &&
                ((m.content && typeof m.content === 'string' && m.content.trim().length > 0) || m.actionType || m.actionPayload)
            )
            .map((m: any) => ({ ...m, isHistorical: true }));
          setMessages(cleanMsgs);
        } else {
          setMessages([]);
        }
      }
      setShowHistoryDrawer(false);
    } catch (e) {
      console.error('Error loading session:', e);
      toast.error('Không thể tải cuộc trò chuyện');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an existing session from Backend/Database
  const handleDeleteSession = async (targetId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chatbot/session/${targetId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success('Đã xóa cuộc trò chuyện');
        setSessions(prev => prev.filter(s => s.id !== targetId));
        if (sessionId === targetId) {
          const remaining = sessions.filter(s => s.id !== targetId);
          if (remaining.length > 0) {
            handleSelectSession(remaining[0].id);
          } else {
            handleCreateNewSession();
          }
        }
      } else {
        toast.error('Không thể xóa cuộc trò chuyện');
      }
    } catch (e) {
      console.error('Delete session error:', e);
      toast.error('Có lỗi xảy ra khi xóa');
    } finally {
      setSessionToDelete(null);
    }
  };

  const handleGenerateShareLink = async () => {
    const targetSessionId = shareTargetSessionId || sessionId;
    if (!targetSessionId && messages.length === 0) {
      toast.error('Chưa có nội dung cuộc trò chuyện để chia sẻ');
      return;
    }
    try {
      setIsGeneratingShare(true);
      const res = await fetch(`${API_URL}/api/chatbot/session/${targetSessionId || 'guest-session'}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          duration: shareDuration,
          maskSensitive: true,
        }),
      });
      if (!res.ok) throw new Error('Không thể tạo liên kết chia sẻ');
      const data = await res.json();
      setGeneratedShareUrl(data.shareUrl);
      if (typeof window !== 'undefined') {
        navigator.clipboard.writeText(data.shareUrl);
      }
      toast.success('Đã sao chép liên kết chia sẻ an toàn!');
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi khi tạo liên kết chia sẻ');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  // Realtime SePay Payment Notification vào Chatbot Session
  useEffect(() => {
    const handlePaymentSuccess = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const orderCode = detail.orderCode;
      setMessages(prev => {
        if (prev.some(m => m.actionPayload?.includes(orderCode) && m.actionType === 'SHOW_ORDER_SUCCESS' && m.content?.includes('Ting ting'))) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `pay-succ-${Date.now()}`,
            sessionId: sessionId || "curr-session",
            senderType: 'AI',
            content: detail.message || `🎉 Ting ting! AVORA đã nhận được thanh toán chuyển khoản thành công cho đơn hàng [${orderCode}] qua SePay VietQR! 👨‍🍳 Bếp đang tiến hành chuẩn bị các món ăn nóng hổi ngay cho bạn nhé! Bạn có thể kiểm tra chi tiết tại mục Đơn Hàng.`,
            actionType: 'SHOW_ORDER_SUCCESS',
            actionPayload: JSON.stringify({
              orderCode: orderCode,
              amount: detail.amount,
              paymentStatus: 'PAID',
            }),
            createdAt: new Date().toISOString(),
          }
        ];
      });
      toast.success(`🎉 Đã nhận thanh toán chuyển khoản SePay đơn [${orderCode}]!`, { duration: 6000 });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('avora_chatbot_payment_success', handlePaymentSuccess);
      return () => {
        window.removeEventListener('avora_chatbot_payment_success', handlePaymentSuccess);
      };
    }
  }, [sessionId]);

  // Auto-sync selected branch across window events without reloading page
  useEffect(() => {
    const handleBranchSync = (e: any) => {
      const newBranchId = e?.detail?.branchId || localStorage.getItem('currentBranchId') || localStorage.getItem('selectedBranchId');
      if (newBranchId && changeBranch) {
        changeBranch(newBranchId);
      }
    };
    window.addEventListener('branch-changed', handleBranchSync);
    window.addEventListener('storage', handleBranchSync);
    return () => {
      window.removeEventListener('branch-changed', handleBranchSync);
      window.removeEventListener('storage', handleBranchSync);
    };
  }, [changeBranch]);

  async function confirmChatTransaction(
    operation: 'ORDER' | 'RESERVATION',
    previewToken: string | undefined,
    confirmationMessage: string,
    paymentMethod?: string,
    usePoints?: boolean,
  ) {
    if (!user || !sessionId || !previewToken) {
      toast.error('Vui lòng đăng nhập và tạo lại bản xem trước để xác nhận.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/chatbot/confirmation`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sessionId, operation, previewToken, paymentMethod, usePoints }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          toast.error('Giỏ hàng hoặc bản xem trước vừa thay đổi. Vui lòng xem trước lại.');
          return;
        }
        toast.error('Bản xem trước đã hết hạn hoặc không còn hợp lệ.');
        return;
      }
      await handleSendMessage(confirmationMessage);
    } catch (e: any) {
      console.error('Confirmation error:', e);
      toast.error('Có lỗi khi xác nhận giao dịch');
    }
  }

  // Voice Mode State (Duplex live audio like FloatingChatbot)
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'PERMISSION_DENIED'>('IDLE');
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeVoiceTool, setActiveVoiceTool] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef<number>(0);
  const voiceStateRef = useRef<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'PERMISSION_DENIED'>('IDLE');
  const silenceStartRef = useRef<number | null>(null);
  const speakChunksRef = useRef(0);
  const hasSpokenInTurnRef = useRef(false);

  voiceStateRef.current = voiceState;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load user profile & session messages on mount
  useEffect(() => {
    const localUser = getAuthUser();
    if (localUser) {
      setUser(localUser);
      fetch(`${API_URL}/api/users/profile`, { headers: getAuthHeaders() })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setUser(data);
        })
        .catch(() => { });
    }

    // Fetch branches for accurate dynamic prompts
    fetch(`${API_URL}/api/home/branches`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setBranches(data);
      })
      .catch(() => { });

    // Load DB conversation sessions
    fetchSessions();

    // Hydrate session messages
    const currentUserId = localUser?.id;
    const savedSessionId = localStorage.getItem(
      currentUserId ? 'avora_chat_session_id' : 'avora_chat_guest_session_id'
    );

    if (savedSessionId) {
      setSessionId(savedSessionId);
      fetch(`${API_URL}/api/chatbot/session/${savedSessionId}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(d => {
          if (d && d.messages && Array.isArray(d.messages)) {
            const cleanMsgs = d.messages
              .filter(
                (m: any) =>
                  (m.senderType === 'USER' || m.senderType === 'AI') &&
                  ((m.content && typeof m.content === 'string' && m.content.trim().length > 0) || m.actionType || m.actionPayload)
              )
              .map((m: any) => ({ ...m, isHistorical: true }));
            setMessages(cleanMsgs);
          }
        })
        .catch(err => {
          console.error("Session load error:", err);
        });
    }

    // Fetch top products for sidebar
    fetch(`${API_URL}/api/home`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.bestSellers) {
          setTopProducts((data.bestSellers || []).slice(0, 8));
        }
      })
      .catch(() => { });

    const savedPersonality = localStorage.getItem('avora_chat_personality');
    if (savedPersonality) setPersonality(savedPersonality);
  }, [API_URL, fetchSessions]);

  // Gapless scheduled audio chunk player for WebSocket Voice
  const playNextAudioChunk = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      if (ctx && ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
        isPlayingRef.current = false;
        if (voiceStateRef.current === 'SPEAKING') {
          setVoiceState('LISTENING');
        }
      }
      return;
    }

    isPlayingRef.current = true;
    setVoiceState('SPEAKING');

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { });
    }

    while (audioQueueRef.current.length > 0) {
      const pcmData = audioQueueRef.current.shift()!;
      const audioBuffer = ctx.createBuffer(1, pcmData.length, 24000);
      audioBuffer.getChannelData(0).set(pcmData);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      playbackSourceRef.current = source;

      const startTime = Math.max(ctx.currentTime + 0.012, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        if (audioQueueRef.current.length === 0 && audioContextRef.current && audioContextRef.current.currentTime >= nextPlayTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          if (voiceStateRef.current === 'SPEAKING') {
            setVoiceState('LISTENING');
          }
        }
      };
    }
  }, []);

  const stopVoiceMode = useCallback(() => {
    setIsVoiceMode(false);
    setVoiceState('IDLE');
    setAudioLevel(0);

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (playbackSourceRef.current) {
      try { playbackSourceRef.current.stop(); } catch { }
      playbackSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    silenceStartRef.current = null;
    speakChunksRef.current = 0;
    hasSpokenInTurnRef.current = false;
  }, []);

  const handleServerAddToCart = useCallback((payloadStr: string) => {
    try {
      const payload = JSON.parse(payloadStr);
      if (Array.isArray(payload.items)) {
        replaceFromServerCart(payload, true);
        return;
      }
      if (payload.cart && Array.isArray(payload.cart)) {
        replaceFromServerCart({
          cartVersion: payload.cartVersion || 1,
          currentBranchId: payload.currentBranchId || currentBranchId,
          items: payload.cart,
          subTotal: payload.subTotal || 0,
          totalItems: payload.totalItems || 0,
        }, true);
      }
    } catch (e) {
      console.error('Failed to parse ADD_TO_CART payload:', e);
    }
  }, [replaceFromServerCart, currentBranchId]);

  const handleServerUpdateCart = useCallback((payloadStr: string) => {
    try {
      const payload = JSON.parse(payloadStr);
      if (Array.isArray(payload.items)) {
        replaceFromServerCart(payload, true);
      }
    } catch (e) {
      console.error('Failed to parse UPDATE_CART payload:', e);
    }
  }, [replaceFromServerCart]);

  const handleServerClearCart = useCallback(() => {
    clearCart();
  }, [clearCart]);

  const handleOrderSuccess = useCallback((payloadStr: any) => {
    try {
      const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
      const orderCode = payload?.orderCode;
      const pm = String(payload?.paymentMethod || '').toUpperCase();
      const isSepay = payload?.isSepay !== false && (pm === 'SEPAY' || pm === 'TRANSFER' || pm === 'SEPAY_QR' || pm.includes('SEPAY') || pm.includes('VIETQR') || pm === '');

      clearCart();

      if (orderCode) {
        toast.success(`Đơn hàng [${orderCode}] đã tạo thành công! Đang chuyển hướng bạn đến cổng thanh toán QR SePay...`, { duration: 4000 });
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = `/payment/sepay?orderCode=${orderCode}`;
          } else {
            router.push(`/payment/sepay?orderCode=${orderCode}`);
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Failed to handle order success:', e);
    }
  }, [clearCart, router]);

  const startVoiceMode = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Trình duyệt không hỗ trợ truy cập microphone.");
        return;
      }

      setVoiceState('LISTENING');
      setIsVoiceMode(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      source.connect(analyser);

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      analyser.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        const rawInput = e.inputBuffer.getChannelData(0);
        let sumSquare = 0;
        for (let i = 0; i < rawInput.length; i++) {
          sumSquare += rawInput[i] * rawInput[i];
        }
        const rms = Math.sqrt(sumSquare / rawInput.length);
        const level = Math.min(100, Math.floor(rms * 1200));
        setAudioLevel(level);

        const currentRate = ctx.sampleRate || 16000;
        const downsampled = downsampleTo16k(rawInput, currentRate);
        const threshold = isPlayingRef.current ? 55 : 16;
        const isSpeaking = level > threshold;

        if (isSpeaking) {
          speakChunksRef.current += 1;
          silenceStartRef.current = null;

          // Chỉ xác nhận người dùng thật sự nói khi có ít nhất 3 chunks liên tục (~300ms)
          if (speakChunksRef.current >= 3) {
            hasSpokenInTurnRef.current = true;
          }

          if (isPlayingRef.current && speakChunksRef.current >= 5) {
            if (playbackSourceRef.current) playbackSourceRef.current.stop();
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            socketRef.current?.emit('stop_audio');
            setVoiceState('LISTENING');
          }
        } else {
          speakChunksRef.current = 0;
          if (hasSpokenInTurnRef.current && !isPlayingRef.current) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > 1500 && voiceStateRef.current === 'LISTENING') {
              setVoiceState('THINKING');
              socketRef.current?.emit('client_content', { turnComplete: true });
              silenceStartRef.current = null;
              hasSpokenInTurnRef.current = false;
            }
          }
        }

        if (voiceStateRef.current === 'LISTENING' || voiceStateRef.current === 'THINKING') {
          const pcm16 = new Int16Array(downsampled.length);
          for (let i = 0; i < downsampled.length; i++) {
            const s = Math.max(-1, Math.min(1, downsampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          const buffer = new Uint8Array(pcm16.buffer);
          let binary = '';
          for (let i = 0; i < buffer.byteLength; i++) {
            binary += String.fromCharCode(buffer[i]);
          }
          const base64 = btoa(binary);
          socketRef.current?.emit('audio_input', base64);
        }
      };

      const socketUrl = (process.env.NEXT_PUBLIC_API_URL || API_URL).replace(/^http/, 'ws');
      const activeBranch = currentBranchId || (typeof window !== 'undefined' ? (localStorage.getItem('currentBranchId') || localStorage.getItem('selectedBranchId')) : '') || '';
      const token = getAuthToken() || '';

      const socket = io(`${socketUrl}/voice-chat`, {
        withCredentials: true,
        query: {
          token,
          sessionId: sessionId || undefined,
          guestSessionToken: guestSessionToken || undefined,
          branchId: activeBranch,
          cartSummary: encodeURIComponent(cartSummary || ''),
          cartTotal: (cartTotal || 0).toString(),
        },
        auth: {
          token,
          sessionId: sessionId || undefined,
          branchId: activeBranch,
          personality,
        },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Voice Socket connected');
      });

      socket.on('system', (data: { type?: string; sessionId?: string; guestSessionToken?: string }) => {
        if (data.type !== 'voice_session' || !data.sessionId) return;
        setSessionId(data.sessionId);
        localStorage.setItem(user?.id ? 'avora_chat_session_id' : 'avora_chat_guest_session_id', data.sessionId);
        if (data.guestSessionToken) {
          setGuestSessionToken(data.guestSessionToken);
          localStorage.setItem('avora_chat_guest_session_token', data.guestSessionToken);
        }
      });

      socket.on('audio_output', (payload: string | { data: string; generation: number }) => {
        try {
          const base64Audio = typeof payload === 'string' ? payload : payload.data;
          const binaryStr = atob(base64Audio);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const pcm16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
          }
          audioQueueRef.current.push(float32);
          if (!isPlayingRef.current) {
            playNextAudioChunk();
          }
        } catch (err) {
          console.error("Audio decode error:", err);
        }
      });

      socket.on('tool_call', (toolInfo?: { name?: string }) => {
        setVoiceState('THINKING');
        if (toolInfo?.name) setActiveVoiceTool(toolInfo.name);
      });

      socket.on('barge_in', () => {
        if (playbackSourceRef.current) {
          try { playbackSourceRef.current.stop(); } catch { }
          playbackSourceRef.current = null;
        }
        audioQueueRef.current = [];
        nextPlayTimeRef.current = 0;
        isPlayingRef.current = false;
        setVoiceState('LISTENING');
      });

      socket.on('transcript', (data: any) => {
        if (data && data.text) {
          const senderRole: 'USER' | 'AI' = data.role === 'user' ? 'USER' : 'AI';
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (
              lastMsg &&
              lastMsg.id.startsWith('voice-stream-') &&
              lastMsg.senderType === senderRole &&
              !lastMsg.actionType
            ) {
              const mergedRaw = `${lastMsg.content || ''}${data.text}`;
              const { cleanContent, suggestions } = parseSuggestionsAndCleanContent(mergedRaw, lastMsg.suggestedReplies);
              const updatedLast: ChatMessage = {
                ...lastMsg,
                content: cleanContent,
                suggestedReplies: suggestions.length > 0 ? suggestions : lastMsg.suggestedReplies,
              };
              return [...prev.slice(0, -1), updatedLast];
            }

            const { cleanContent, suggestions } = parseSuggestionsAndCleanContent(data.text);
            const newMsg: ChatMessage = {
              id: `voice-stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sessionId: sessionId || 'temp',
              senderType: senderRole,
              content: cleanContent,
              suggestedReplies: suggestions.length > 0 ? suggestions : undefined,
              createdAt: new Date().toISOString(),
            };
            return [...prev, newMsg];
          });
        }
      });

      socket.on('transcript_verified', (data: { text?: string; wasHallucinationPrevented?: boolean }) => {
        const verifiedStr = data?.text;
        if (verifiedStr) {
          setMessages((prev) => {
            const lastAiIndex = [...prev]
              .map((m, i) => ({ m, i }))
              .reverse()
              .find((entry) => entry.m.senderType === 'AI' && entry.m.id.startsWith('voice-stream-'))?.i;
            const { cleanContent, suggestions } = parseSuggestionsAndCleanContent(verifiedStr);
            if (lastAiIndex !== undefined) {
              const copy = [...prev];
              copy[lastAiIndex] = {
                ...copy[lastAiIndex],
                content: cleanContent,
                suggestedReplies: suggestions.length > 0 ? suggestions : copy[lastAiIndex].suggestedReplies,
              };
              return copy;
            }
            return prev;
          });
        }
      });

      socket.on('rich_action', (data) => {
        const { cleanContent, suggestions } = parseSuggestionsAndCleanContent(data.content || '', data.suggestedReplies);
        const tempMsg: ChatMessage = {
          id: `voice-${Date.now()}`,
          sessionId: sessionId || "temp-session",
          senderType: "AI",
          content: cleanContent,
          actionType: data.actionType,
          actionPayload: data.actionPayload,
          createdAt: new Date().toISOString(),
          suggestedReplies: suggestions.length > 0 ? suggestions : undefined,
        };
        setMessages(prev => [...prev, tempMsg]);

        if (data.actionType === 'ADD_TO_CART' && data.actionPayload) {
          handleServerAddToCart(data.actionPayload);
        } else if (data.actionType === 'UPDATE_CART' && data.actionPayload) {
          handleServerUpdateCart(data.actionPayload);
        } else if (data.actionType === 'CLEAR_CART') {
          handleServerClearCart();
        } else if (data.actionType === 'SHOW_ORDER_SUCCESS' && data.actionPayload) {
          handleOrderSuccess(data.actionPayload);
        }

        if (data.actionType === 'STOP_VOICE') {
          stopVoiceMode();
        }
      });

      socket.on('turn_complete', () => {
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          setVoiceState('LISTENING');
        }
      });

      socket.on('voice_error', (err: { code?: string; message?: string; retryable?: boolean }) => {
        if (err.code === 'AUTH_REQUIRED') {
          toast.error("Tính năng Voice AI chỉ dành cho thành viên đã đăng nhập.");
        } else {
          toast.error(err.message || 'Lỗi kết nối máy chủ giọng nói AI');
        }
        stopVoiceMode();
      });

      socket.on('connect_error', (err) => {
        console.error("Voice socket error:", err);
        toast.error("Không thể kết nối đến máy chủ âm thanh AI. Vui lòng thử lại!");
        stopVoiceMode();
      });
    } catch (err: any) {
      console.error("Start voice mode error:", err);
      setVoiceState('PERMISSION_DENIED');
      toast.error("Vui lòng cấp quyền Microphone để trò chuyện giọng nói");
    }
  }, [API_URL, sessionId, currentBranchId, personality, playNextAudioChunk, stopVoiceMode, user, guestSessionToken, cartSummary, cartTotal, handleServerAddToCart, handleServerUpdateCart, handleServerClearCart]);

  const toggleVoiceMode = () => {
    if (!user) {
      const loginCardMsg: ChatMessage = {
        id: `login-prompt-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "AI",
        content: "Khách hàng thành viên vui lòng đăng nhập hoặc đăng ký để sử dụng tính năng Trò chuyện bằng Giọng nói AI siêu thông minh của AVORA nhé!",
        actionType: 'PROMPT_LOGIN',
        actionPayload: null,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, loginCardMsg]);
      return;
    }
    if (isVoiceMode) {
      stopVoiceMode();
    } else {
      startVoiceMode();
    }
  };

  // Helper: Thêm món vào giỏ hàng hoặc hiển thị modal tùy chọn options (Topping, Size, v.v.)
  const handleProductAddToCart = async (productToAdd: any): Promise<boolean> => {
    let fullProduct = productToAdd;
    if (!fullProduct) return false;

    const prodId = fullProduct.id || fullProduct.productId;

    // Fetch full product details if optionGroups not yet loaded or empty
    if ((!fullProduct.optionGroups || fullProduct.optionGroups.length === 0) && prodId) {
      try {
        const cleanId = String(prodId).replace(/^cart-/, '').replace(/^line-/, '').replace(/-\d{10,}$/, '').trim();
        let res = await fetch(`/api/products/by-id/${cleanId}`).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(`${API_URL}/api/products/by-id/${cleanId}`).catch(() => null);
        }
        if (res && res.ok) {
          const pData = await res.json();
          if (pData) fullProduct = { ...fullProduct, ...pData };
        }
      } catch (e) { }
    }

    const branchToUse = currentBranchId || (typeof window !== 'undefined' ? (localStorage.getItem('currentBranchId') || localStorage.getItem('selectedBranchId')) : '') || branches[0]?.id || 'AVO-Q1';

    if (!currentBranchId && changeBranch) {
      changeBranch(branchToUse);
    }

    // Nếu món có nhóm tùy chọn (Option Groups) -> Mở modal tùy chọn options
    if (fullProduct.optionGroups && Array.isArray(fullProduct.optionGroups) && fullProduct.optionGroups.length > 0) {
      setOptionsModalProduct(fullProduct);
      return true;
    }

    // Nếu không có options -> Thêm trực tiếp vào giỏ
    addToCart({
      id: `cart-${fullProduct.id || prodId}`,
      productId: fullProduct.id || prodId,
      name: fullProduct.name,
      originalPriceAtSale: Number(fullProduct.price) || 0,
      priceAtSale: Number(fullProduct.price) || 0,
      quantity: 1,
      imageUrl: fullProduct.imageUrl || fullProduct.images?.[0]?.url || fullProduct.img,
      rawProduct: fullProduct,
    }, branchToUse, false);
    toast.success(`Đã thêm ${fullProduct.name} vào giỏ hàng! 🛒`);
    return true;
  };

  const handleSuggestionClick = async (reply: any, parentMsg?: ChatMessage) => {
    const label = typeof reply === 'string' ? reply : reply.label || reply.text || '';
    const payload = typeof reply === 'string' ? reply : reply.payload || label;
    const action = reply?.action || '';

    // Handle GPS Location Share chip directly via browser Geolocation API
    if (
      label.toLowerCase().includes('chia sẻ vị trí') ||
      payload.toLowerCase().includes('chia sẻ vị trí')
    ) {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        const toastId = toast.loading('Đang định vị tọa độ GPS của quý khách...');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            toast.dismiss(toastId);
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);
            handleSendMessage(`[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lng}]`);
          },
          () => {
            toast.dismiss(toastId);
            toast.error('Không thể lấy GPS tự động. Vui lòng xem danh sách chi nhánh hoặc gõ địa chỉ của bạn nhé!');
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
        return;
      }
    }

    const isAddToCart =
      action === 'ADD_TO_CART' ||
      (label.toLowerCase().includes('thêm') && label.toLowerCase().includes('vào giỏ')) ||
      (payload.toLowerCase().includes('thêm') && payload.toLowerCase().includes('vào giỏ'));

    if (isAddToCart) {
      let targetProduct: any = null;

      // 1. Try finding in parent message payload if SHOW_PRODUCT
      if (parentMsg?.actionType === 'SHOW_PRODUCT' && parentMsg.actionPayload) {
        try {
          const parsed = JSON.parse(parentMsg.actionPayload);
          const products = parsed && !Array.isArray(parsed) ? parsed.products : parsed;
          if (Array.isArray(products) && products.length > 0) {
            targetProduct = products.find((p: any) =>
              p.name && (label.toLowerCase().includes(p.name.toLowerCase()) || payload.toLowerCase().includes(p.name.toLowerCase()))
            ) || products[0];
          }
        } catch { }
      }

      // 2. Try finding in topProducts
      if (!targetProduct && topProducts.length > 0) {
        targetProduct = topProducts.find((p: any) =>
          p.name && (label.toLowerCase().includes(p.name.toLowerCase()) || payload.toLowerCase().includes(p.name.toLowerCase()))
        );
      }

      // 3. Fallback: Extract dish name from text e.g. "Thêm Mỳ Trứng vào giỏ"
      let dishName = '';
      const match = label.match(/thêm\s+(.+?)\s+vào\s+giỏ/i) || payload.match(/thêm\s+(.+?)\s+vào\s+giỏ/i);
      if (match && match[1]) {
        dishName = match[1].trim();
      }

      if (targetProduct) {
        const added = await handleProductAddToCart(targetProduct);
        if (added) {
          handleSendMessage(`Tôi vừa thêm ${targetProduct.name} vào giỏ hàng. Bạn hãy gợi ý các món ăn kèm hoặc ưu đãi phù hợp nhé!`);
          return;
        }
      }

      if (dishName) {
        const toastId = toast.loading(`Đang tìm và thêm ${dishName} vào giỏ...`);
        try {
          const res = await fetch(`${API_URL}/api/products/search?q=${encodeURIComponent(dishName)}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.data || []);
            const found = list[0];
            if (found) {
              toast.dismiss(toastId);
              const added = await handleProductAddToCart(found);
              if (added) {
                handleSendMessage(`Tôi vừa thêm ${found.name} vào giỏ hàng. Gợi ý thêm cho tôi món ăn kèm nhé!`);
                return;
              }
            }
          }
        } catch { }
        toast.dismiss(toastId);
      }
    }

    handleSendMessage(payload);
  };

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || inputValue).trim();
    if (!textToSend || isLoading) return;

    // Khi đã bật chế độ Voice: Nếu khách gửi tin nhắn vào khung chat thì gửi qua Socket Voice
    if (isVoiceMode && socketRef.current) {
      const tempVoiceMessage: ChatMessage = {
        id: `client-voice-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "USER",
        content: textToSend,
        actionType: null,
        actionPayload: null,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempVoiceMessage]);
      if (!overrideText) setInputValue("");
      setVoiceState('THINKING');
      socketRef.current.emit('client_content', {
        turns: [{ role: 'user', parts: [{ text: textToSend }] }],
        turnComplete: true,
      });
      return;
    }

    const tempMessage: ChatMessage = {
      id: `client-${Date.now()}`,
      sessionId: sessionId || "temp-session",
      senderType: "USER",
      content: textToSend,
      actionType: null,
      actionPayload: null,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);
    if (!overrideText) setInputValue("");
    setIsLoading(true);

    try {
      const currentUserId = user?.id;
      const res = await fetch(`${API_URL}/api/chatbot/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          sessionId,
          guestSessionToken: currentUserId ? undefined : guestSessionToken,
          userId: currentUserId,
          message: tempMessage.content,
          branchId: effectiveBranchId || undefined,
          history: !currentUserId ? messages.filter(m => !m.isError) : undefined,
          personality,
          cartTotal,
          cartSummary,
          cartItems,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || 'Gửi tin nhắn không thành công');
      }

      const data = await res.json();

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem(
          currentUserId ? 'avora_chat_session_id' : 'avora_chat_guest_session_id',
          data.sessionId,
        );
      }

      if (!currentUserId && data.guestSessionToken) {
        setGuestSessionToken(data.guestSessionToken);
        localStorage.setItem('avora_chat_guest_session_token', data.guestSessionToken);
      }

      const receivedMessages = data.messages || data.sessionMessages;
      if (receivedMessages && Array.isArray(receivedMessages)) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const toAdd = receivedMessages.filter(
            (m: any) =>
              !existingIds.has(m.id) &&
              (m.senderType === 'USER' || m.senderType === 'AI') &&
              ((m.content && typeof m.content === 'string' && m.content.trim().length > 0) || m.actionType || m.actionPayload)
          );
          return [...prev, ...toAdd];
        });

        // Chỉ cập nhật giỏ hàng theo tin nhắn phản hồi mới nhất (tránh duplicate lịch sử)
        const latestActionMsg = [...receivedMessages].reverse().find(m => m.actionType);
        if (latestActionMsg) {
          if (latestActionMsg.actionType === 'ADD_TO_CART' && latestActionMsg.actionPayload) {
            handleServerAddToCart(latestActionMsg.actionPayload);
          } else if (latestActionMsg.actionType === 'UPDATE_CART' && latestActionMsg.actionPayload) {
            handleServerUpdateCart(latestActionMsg.actionPayload);
          } else if (latestActionMsg.actionType === 'CLEAR_CART') {
            handleServerClearCart();
          } else if (latestActionMsg.actionType === 'SHOW_ORDER_SUCCESS' && latestActionMsg.actionPayload) {
            handleOrderSuccess(latestActionMsg.actionPayload);
          }
        }

        if (data.actionType === 'ADD_TO_CART' && data.actionPayload) {
          handleServerAddToCart(data.actionPayload);
        } else if (data.actionType === 'UPDATE_CART' && data.actionPayload) {
          handleServerUpdateCart(data.actionPayload);
        } else if (data.actionType === 'CLEAR_CART') {
          handleServerClearCart();
        } else if (data.actionType === 'SHOW_ORDER_SUCCESS' && data.actionPayload) {
          handleOrderSuccess(data.actionPayload);
        }

        // Auto-refresh sessions list in background
        fetchSessions();
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "AI",
        content: "Dạ hệ thống AI đang tạm thời bận hoặc quá tải kết nối. Quý khách vui lòng bấm nút Thử lại bên dưới hoặc gửi lại tin nhắn nhé!",
        actionType: null,
        actionPayload: null,
        createdAt: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error(err?.message || 'Không thể kết nối đến máy chủ AI');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmClearHistory = () => {
    localStorage.removeItem('avora_chat_session_id');
    localStorage.removeItem('avora_chat_guest_session_id');
    setSessionId(null);
    setMessages([]);
    setShowClearModal(false);
    toast.success('Đã làm mới cuộc hội thoại');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter out any internal empty or tool messages
  const visibleMessages = messages.filter((msg) => {
    if (msg.senderType === 'USER') {
      return typeof msg.content === 'string' && msg.content.trim().length > 0;
    }
    if (msg.senderType === 'AI') {
      const hasContent = typeof msg.content === 'string' && msg.content.trim().length > 0;
      const hasValidAction = Boolean(msg.actionType);
      return hasContent || hasValidAction;
    }
    return false;
  });

  // Dynamic chip questions based on real cart and active branch
  const promoQuestion = cartTotal > 0
    ? `Có ưu đãi nào tại ${branchName} cho đơn ${new Intl.NumberFormat('vi-VN').format(cartTotal)}đ không?`
    : `Hôm nay tại chi nhánh ${branchName} có những khuyến mãi và voucher nào?`;
  const promoLabel = cartTotal > 0
    ? `Ưu đãi ${branchName} đơn ${(cartTotal / 1000).toLocaleString('vi-VN')}k`
    : `Ưu đãi tại ${branchName}`;

  // Dynamic Quick Prompt Chips derived from the last AI response
  const lastAiMessage = [...messages].reverse().find(m => m.senderType === 'AI');

  const dynamicQuickPrompts = (() => {
    if (!lastAiMessage || !lastAiMessage.content) {
      return [
        { label: `Ưu đãi ${branchName}`, prompt: `Hôm nay tại chi nhánh ${branchName} có những khuyến mãi và voucher nào?`, icon: Ticket, color: 'text-amber-500' },
        { label: `Tìm chi nhánh gần tôi`, prompt: "Xem các chi nhánh AVORA trên bản đồ và chỉ đường", icon: MapPin, color: 'text-red-500' },
        { label: `Món hot ${branchName}`, prompt: `Gợi ý các món ăn bán chạy nhất tại ${branchName}`, icon: Utensils, color: 'text-emerald-600' },
        { label: `Đặt bàn tại ${branchName}`, prompt: `Tôi muốn đặt bàn ăn tại chi nhánh ${branchName}`, icon: Calendar, color: 'text-blue-500' },
      ];
    }

    const contentLower = (lastAiMessage.content + ' ' + (lastAiMessage.actionType || '')).toLowerCase();

    // 1. If AI message is showing order preview or cart
    if (lastAiMessage.actionType === 'ORDER_PREVIEW' || lastAiMessage.actionType === 'SHOW_BEAUTIFUL_ORDER' || contentLower.includes('đơn hàng') || contentLower.includes('xác nhận')) {
      return [
        { label: "Xem giỏ hàng", prompt: "Xem lại chi tiết giỏ hàng hiện tại của tôi", icon: ShoppingCart, color: 'text-red-500' },
        { label: "Mã giảm giá tốt nhất", prompt: "Tìm voucher giảm giá nhiều nhất cho đơn này", icon: Ticket, color: 'text-amber-500' },
        { label: "Gợi ý thêm đồ uống", prompt: "Gợi ý cho tôi thêm đồ uống hoặc tráng miệng kèm", icon: Utensils, color: 'text-emerald-500' },
        { label: "Phương thức thanh toán", prompt: "Có những cách thanh toán nào cho đơn hàng này?", icon: CreditCard, color: 'text-blue-500' },
      ];
    }

    // 2. If AI discussed dishes / menu / food
    if (contentLower.includes('món') || contentLower.includes('ngon') || contentLower.includes('thực đơn') || contentLower.includes('lẩu') || contentLower.includes('sushi') || contentLower.includes('mỳ') || lastAiMessage.actionType === 'SHOW_PRODUCT') {
      return [
        { label: "Món ăn kèm phù hợp", prompt: "Gợi ý cho tôi món ăn kèm phù hợp nhất với các món trên", icon: Utensils, color: 'text-emerald-600' },
        { label: "Nước uống & tráng miệng", prompt: "Có đồ uống hoặc món tráng miệng nào ngon đi cùng không?", icon: Sparkles, color: 'text-purple-500' },
        { label: `Ưu đãi đơn ${cartTotal > 0 ? (cartTotal / 1000).toLocaleString('vi-VN') + 'k' : 'tại ' + branchName}`, prompt: cartTotal > 0 ? `Có ưu đãi nào tại ${branchName} cho đơn ${new Intl.NumberFormat('vi-VN').format(cartTotal)}đ không?` : `Hôm nay tại chi nhánh ${branchName} có những khuyến mãi nào?`, icon: Ticket, color: 'text-amber-500' },
        { label: "Xem giỏ hàng", prompt: "Kiểm tra giỏ hàng của tôi hiện tại", icon: ShoppingCart, color: 'text-red-500' },
      ];
    }

    // 3. If AI discussed branch / location
    if (contentLower.includes('chi nhánh') || contentLower.includes('địa chỉ') || contentLower.includes('west lake') || contentLower.includes('landmark')) {
      return [
        { label: "Chỉ đường trên bản đồ", prompt: `Chỉ đường cho tôi đến chi nhánh ${branchName}`, icon: MapPin, color: 'text-red-500' },
        { label: "Đặt bàn trước", prompt: `Tôi muốn đặt bàn ăn tại chi nhánh ${branchName}`, icon: Calendar, color: 'text-blue-500' },
        { label: "Giờ mở cửa & hotline", prompt: `Cho tôi biết thời gian mở cửa và số hotline của ${branchName}`, icon: Clock, color: 'text-slate-600' },
        { label: `Món đặc sắc tại ${branchName}`, prompt: `Chi nhánh ${branchName} có những món đặc sắc gì?`, icon: Utensils, color: 'text-emerald-600' },
      ];
    }

    // 4. If AI discussed voucher / promotions
    if (contentLower.includes('voucher') || contentLower.includes('khuyến mãi') || contentLower.includes('giảm giá') || contentLower.includes('ưu đãi')) {
      return [
        { label: "Áp dụng voucher ngay", prompt: "Áp dụng voucher giảm giá tốt nhất cho tôi", icon: Ticket, color: 'text-amber-500' },
        { label: "Món đang giảm giá", prompt: "Chi nhánh đang có những món nào giảm giá hôm nay?", icon: Flame, color: 'text-red-500' },
        { label: "Điểm tích lũy thành viên", prompt: "Điểm tích lũy thành viên được tính như thế nào?", icon: Sparkles, color: 'text-purple-500' },
        { label: `Món hot tại ${branchName}`, prompt: `Món bán chạy nhất tại ${branchName}`, icon: Utensils, color: 'text-emerald-600' },
      ];
    }

    return [
      { label: `Ưu đãi ${branchName}`, prompt: `Chi nhánh ${branchName} có những ưu đãi nào?`, icon: Ticket, color: 'text-amber-500' },
      { label: "Gợi ý món hot", prompt: `Gợi ý các món ăn bán chạy nhất tại ${branchName}`, icon: Utensils, color: 'text-emerald-600' },
      { label: "Tìm chi nhánh gần tôi", prompt: "Tìm chi nhánh AVORA gần vị trí của tôi nhất", icon: MapPin, color: 'text-red-500' },
      { label: "Đặt bàn trước", prompt: `Tôi muốn đặt bàn tại chi nhánh ${branchName}`, icon: Calendar, color: 'text-blue-500' },
    ];
  })();

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f8fafc] text-slate-800 overflow-hidden font-sans select-text">
      {/* ── Header: Ultra-clean & Compact ── */}
      {!isVoiceMode ? (
        <header className="h-14 sm:h-16 px-3 sm:px-5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white flex items-center justify-between shrink-0 z-30 shadow-lg shadow-red-950/10 rounded-b-2xl sm:rounded-b-3xl rounded-t-none">
          {/* Left: Back button + History Button + Avatar + Brand Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Link
              href="/"
              className="p-1.5 sm:p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Quay lại Trang chủ AVORA"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>

            <button
              onClick={() => setShowHistoryDrawer(prev => !prev)}
              className="p-1.5 sm:p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors relative cursor-pointer"
              title="Danh sách cuộc hội thoại cũ"
            >
              <History className="w-5 h-5" />
              {sessions.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 font-black text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                  {sessions.length}
                </span>
              )}
            </button>

            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white p-0.5 shadow-sm shrink-0 border-2 border-white/60">
              <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm sm:text-base text-white tracking-wide truncate">
                  AvoBOT AI
                </span>
                {user && (
                  <div className="relative inline-flex ml-0.5 group">
                    <div className="absolute transition-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#FFD700] rounded-md blur-xs group-hover:opacity-100 animate-pulse" />
                    <span className="relative inline-flex items-center justify-center px-1.5 py-0.5 bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#996515] rounded-md text-[10px] uppercase tracking-widest font-black text-amber-950 border border-yellow-300 shadow-xs overflow-hidden">
                      <Sparkles size={10} className="mr-0.5 text-amber-900 mb-[1px]" />
                      <span>PRO</span>
                      <div className="absolute top-0 -left-[100%] h-full w-full z-20 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white to-transparent opacity-60 animate-shine pointer-events-none" />
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <span className="truncate">Trợ lý AVORA · {personality}</span>
              </div>
            </div>
          </div>

          {/* Right: Giỏ hàng + Chia sẻ + Cuộc trò chuyện mới & 3-Gạch Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowCartDrawer(true)}
              className="relative p-2 sm:px-2.5 sm:py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/20 flex items-center gap-1.5 cursor-pointer"
              title="Xem và chỉnh sửa giỏ hàng"
            >
              <ShoppingCart className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 font-black text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="hidden sm:flex p-2 sm:px-2.5 sm:py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/20 items-center gap-1 cursor-pointer"
              title="Chia sẻ đoạn hội thoại an toàn"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {user && (
              <button
                onClick={handleCreateNewSession}
                className="hidden sm:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 active:scale-95 cursor-pointer shadow-2xs"
                title="Bắt đầu cuộc trò chuyện mới"
              >
                <Plus size={15} />
                <span>Hội thoại mới</span>
              </button>
            )}

            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/20 flex items-center gap-1.5 cursor-pointer"
              title="Mở menu tiện ích & gợi ý"
            >
              <Menu className="w-5 h-5" />
              <span className="hidden sm:inline text-xs font-bold">Tiện ích</span>
            </button>
          </div>
        </header>
      ) : (
        /* ── Voice Visualizer Header Overlay (Identical to FloatingChatbot) ── */
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-2xl relative overflow-hidden shrink-0 z-30">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-red-500 blur-lg transition-all duration-75"
              style={{
                opacity: voiceState === 'LISTENING' ? Math.min(1, 0.3 + (audioLevel / 50)) : 0.4,
                transform: `scale(${1 + (audioLevel / 80)})`,
              }}
            />
            <div className={`relative z-10 w-full h-full rounded-full flex items-center justify-center text-white border border-white/20 ${voiceState === 'LISTENING' ? 'bg-gradient-to-br from-red-500 to-rose-600' : (voiceState === 'THINKING' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-emerald-400 to-green-600')}`}>
              {voiceState === 'THINKING' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : voiceState === 'SPEAKING' ? (
                <Activity size={20} className="animate-pulse" />
              ) : (
                <Mic size={20} className={audioLevel > 10 ? 'animate-bounce' : ''} />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-xs sm:text-sm tracking-wide truncate">
              {voiceState === 'LISTENING' ? "Avora đang nghe bạn..." : (voiceState === 'THINKING' ? "Đang xử lý câu hỏi..." : "Avora đang trả lời...")}
            </h3>
            <p className="text-slate-300 text-[10px] sm:text-xs font-medium truncate">
              {voiceState === 'LISTENING' ? "Hãy nói điều bạn muốn hỏi..." : "Trợ lý AI Giọng nói Avora"}
            </p>
          </div>

          {voiceState === 'LISTENING' && (
            <button
              onClick={() => {
                setVoiceState('THINKING');
                socketRef.current?.emit('client_content', { turnComplete: true });
              }}
              className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all border border-white/30"
            >
              Nói xong
            </button>
          )}

          {voiceState === 'SPEAKING' && (
            <button
              onClick={() => {
                if (playbackSourceRef.current) playbackSourceRef.current.stop();
                audioQueueRef.current = [];
                isPlayingRef.current = false;
                socketRef.current?.emit('stop_audio');
                setVoiceState('LISTENING');
              }}
              className="px-2.5 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg text-xs font-bold border border-red-500/30"
            >
              Ngắt lời
            </button>
          )}

          <button
            onClick={stopVoiceMode}
            className="p-2 bg-white/10 hover:bg-red-600 text-white rounded-full transition-colors"
            title="Đóng chế độ giọng nói"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* ── Main Chat Thread Body with Left History Sidebar ────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop for Conversation History */}
        {showHistoryDrawer && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity lg:hidden"
            onClick={() => setShowHistoryDrawer(false)}
          />
        )}

        {/* ── Left Sidebar: Lịch sử hội thoại (Backend Database Persisted) ── */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-72 sm:w-80 bg-white border-r border-slate-200/90 flex flex-col h-full transition-transform duration-300 ease-in-out shrink-0 ${showHistoryDrawer ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
            }`}
        >
          {/* History Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-red-600" />
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                Hội thoại ({sessions.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-2.5 border-b border-slate-100 shrink-0">
            <button
              onClick={handleCreateNewSession}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-xs shadow-red-600/20 transition-all active:scale-98 text-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>Cuộc trò chuyện mới</span>
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {isLoadingSessions && sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2 text-xs">
                <Loader2 size={18} className="animate-spin text-red-500" />
                <span>Đang tải danh sách hội thoại...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-2.5">
                  <MessageSquare size={18} />
                </div>
                <p className="text-xs font-bold text-slate-700">Chưa có hội thoại nào</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Bấm &quot;Cuộc trò chuyện mới&quot; hoặc gửi tin nhắn để bắt đầu.
                </p>
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.id === sessionId;
                const msgCount = s._count?.messages || 0;
                const updatedTime = new Date(s.updatedAt || s.createdAt).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${isActive
                        ? 'bg-red-50/90 border-red-300 text-red-950 font-bold shadow-2xs ring-1 ring-red-400/50'
                        : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/80 text-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-6">
                      <MessageSquare
                        size={14}
                        className={`shrink-0 ${isActive ? 'text-red-600' : 'text-slate-400 group-hover:text-red-500'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs truncate font-semibold leading-tight">
                          {s.title || 'Cuộc trò chuyện mới'}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span>{updatedTime}</span>
                          {msgCount > 0 && <span>· {msgCount} tin nhắn</span>}
                        </div>
                      </div>
                    </div>

                    {/* Menu 3 chấm: Gộp Chia sẻ và Xóa */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSessionActionMenuId(sessionActionMenuId === s.id ? null : s.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-all cursor-pointer"
                        title="Tùy chọn hội thoại"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {sessionActionMenuId === s.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setSessionActionMenuId(null);
                              setShareTargetSessionId(s.id);
                              setShowShareModal(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                          >
                            <Share2 size={13} className="text-blue-600" />
                            <span>Chia sẻ hội thoại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionActionMenuId(null);
                              setSessionToDelete(s);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Xóa cuộc trò chuyện</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* User Cloud Sync Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/60 shrink-0 text-xs">
            {user ? (
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-xs truncate">{user.fullName || 'Thành viên AVORA'}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đồng bộ đám mây
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-1.5">
                <p className="text-[10px] text-slate-500">Đăng nhập để lưu trữ vĩnh viễn trên đám mây</p>
                <Link
                  href="/login?redirect=/chatbot"
                  className="block w-full py-1.5 text-center bg-white hover:bg-red-50 text-red-600 font-bold border border-red-200 rounded-lg text-[11px] shadow-2xs transition-colors"
                >
                  Đăng nhập đồng bộ
                </Link>
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden relative">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 max-w-4xl w-full mx-auto">
            {/* Empty State Welcome */}
            {visibleMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mb-3 p-1 shadow-sm">
                  <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 mb-1.5 tracking-tight">
                  Chào mừng quý khách đến với AVORA AI
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mb-5 leading-relaxed">
                  Tôi là AvoBOT – trợ lý ẩm thực AI thông minh. Tôi hỗ trợ tra cứu thực đơn, gợi ý món ăn theo chi nhánh thực tế, kiểm tra mã ưu đãi hợp lệ và đặt bàn nhanh chóng.
                </p>

                {/* Quick Prompts Grid */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  <button
                    onClick={() => handleSendMessage(`Món nào đang bán chạy nhất tại ${branchName}?`)}
                    className="p-3 rounded-2xl bg-white hover:bg-red-50/50 border border-slate-200 hover:border-red-300 text-xs text-slate-700 font-semibold transition-all flex items-center gap-2.5 shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Flame className="w-4 h-4" />
                    </div>
                    <span className="truncate">Món bán chạy tại {branchName}</span>
                  </button>

                  <button
                    onClick={() => handleSendMessage(promoQuestion)}
                    className="p-3 rounded-2xl bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 text-xs text-slate-700 font-semibold transition-all flex items-center gap-2.5 shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <span className="truncate">{promoLabel}</span>
                  </button>

                  <button
                    onClick={() => handleSendMessage("Xem các chi nhánh AVORA trên bản đồ và chỉ đường")}
                    className="p-3 rounded-2xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 font-semibold transition-all flex items-center gap-2.5 shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span>Tìm chi nhánh gần tôi nhất</span>
                  </button>

                  <button
                    onClick={() => handleSendMessage(`Tôi muốn đặt bàn tối nay tại ${branchName}`)}
                    className="p-3 rounded-2xl bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 text-xs text-slate-700 font-semibold transition-all flex items-center gap-2.5 shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span>Đặt bàn tiệc ẩm thực</span>
                  </button>
                </div>
              </div>
            )}

            {/* Message History List */}
            {visibleMessages.map((msg, index) => {
              const { cleanContent } = parseSuggestionsAndCleanContent(msg.content, msg.suggestedReplies);
              const hasAction = Boolean(msg.actionType) && Boolean(msg.actionPayload);
              if (!cleanContent && !hasAction) return null;
              return (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3.5 ${msg.senderType === 'USER' ? 'flex-row-reverse' : 'justify-start'} animate-in fade-in duration-200`}
              >
                {/* Avatar */}
                <div className="shrink-0 pt-0.5 sm:pt-1">
                  {msg.senderType === 'USER' ? (
                    <UserAvatar user={user} />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-xs border border-red-500/40 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src="/avt_chatbot.gif"
                        alt="AvoBOT"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Message Bubble + Rich Carousel/Chips */}
                <div className={`flex flex-col gap-1.5 min-w-0 max-w-[85%] sm:max-w-[78%] ${msg.senderType === 'USER' ? 'items-end' : 'items-start'}`}>
                  {(() => {
                    const { cleanContent } = parseSuggestionsAndCleanContent(msg.content, msg.suggestedReplies);
                    const isGpsLocationMsg = msg.senderType === 'USER' && (cleanContent.startsWith('[HỆ THỐNG:') || (cleanContent.includes('vĩ độ') && cleanContent.includes('kinh độ')));
                    if (isGpsLocationMsg) {
                      const coordsMatch = cleanContent.match(/vĩ độ\s*([-\d.]+)\s*,\s*kinh độ\s*([-\d.]+)/i);
                      const lat = coordsMatch ? coordsMatch[1] : '';
                      const lng = coordsMatch ? coordsMatch[2] : '';
                      return (
                        <div className="p-2.5 sm:p-3 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-2xl rounded-tr-xs shadow-xs flex items-center gap-2 text-xs sm:text-[13px] font-semibold max-w-full">
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div>Đã chia sẻ vị trí của tôi</div>
                            {lat && lng && (
                              <div className="text-[10px] text-rose-100 font-mono font-normal">
                                Tọa độ: {lat}, {lng}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return cleanContent ? (
                      <div
                        className={`p-3 sm:p-4 text-xs sm:text-sm leading-relaxed max-w-full break-words whitespace-pre-wrap rounded-2xl shadow-xs ${msg.senderType === 'USER'
                          ? 'bg-gradient-to-br from-red-600 to-rose-600 text-white rounded-tr-xs font-medium'
                          : msg.isError
                            ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-xs'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-2xs'
                          }`}
                      >
                        {cleanContent.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {renderFormattedText(line, (path) => router.push(path))}
                            {i !== cleanContent.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}

                        {/* Inline Retry Button for failed messages */}
                        {msg.isError && (
                          <div className="mt-2.5 pt-2 border-t border-rose-200/60 flex items-center justify-end">
                            <button
                              onClick={() => {
                                const lastUserMsg = [...messages].reverse().find(m => m.senderType === 'USER');
                                if (lastUserMsg) handleSendMessage(lastUserMsg.content);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <RotateCcw size={12} />
                              <span>Thử lại câu vừa rồi</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {/* PROMPT_LOGIN Card (Chuyển đổi cảnh báo giọng nói thành tin nhắn kèm 2 nút Đăng nhập / Đăng ký) */}
                  {msg.actionType === 'PROMPT_LOGIN' && (
                    <div className="w-full mt-2.5 p-3.5 sm:p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border border-red-200 shadow-xs flex flex-col gap-2.5 max-w-sm animate-in fade-in">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-xs sm:text-sm">
                        <Mic className="w-4 h-4 text-red-600 animate-pulse" />
                        <span>Trò chuyện bằng Giọng nói AI</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">
                        Khách hàng thành viên vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng tính năng Trò chuyện bằng Giọng nói AI nhé!
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Link
                          href="/login?redirect=/chatbot"
                          className="flex-1 py-2 text-center bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl border border-slate-200 text-xs shadow-2xs transition-all active:scale-95"
                        >
                          Đăng nhập
                        </Link>
                        <Link
                          href="/register?redirect=/chatbot"
                          className="flex-1 py-2 text-center bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs shadow-sm shadow-red-500/20 transition-all active:scale-95"
                        >
                          Đăng ký
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* ORDER_PREVIEW Card (Bản xem trước đơn hàng xịn xò chuẩn UI) */}
                  {msg.senderType === 'AI' && (msg.actionType === 'ORDER_PREVIEW' || msg.actionType === 'SHOW_BEAUTIFUL_ORDER') && msg.actionPayload && (() => {
                    try {
                      const previewData = JSON.parse(msg.actionPayload);
                      const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
                      const isObsoleteOrder = visibleMessages.slice(index + 1).some(
                        (laterMsg) => laterMsg.actionType === 'SHOW_ORDER_SUCCESS' || laterMsg.actionType === 'ORDER_PREVIEW'
                      );

                      return (
                        <div className={`w-full mt-2.5 p-3.5 sm:p-4 bg-white rounded-2xl border shadow-md flex flex-col gap-2.5 text-xs animate-in fade-in duration-300 ${isObsoleteOrder ? 'border-slate-200 bg-slate-50/50 opacity-80' : 'border-red-200'}`}>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-1.5 text-red-600 font-black tracking-wide uppercase text-xs sm:text-sm">
                              <ShoppingCart className="w-4 h-4" />
                              <span>Xác nhận đơn hàng</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isObsoleteOrder && (
                                <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                  Bản xem trước cũ
                                </span>
                              )}
                              {previewData.branchName && (
                                <span className="text-[11px] bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-bold truncate max-w-[200px]">
                                  {previewData.branchName}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Danh sách món ăn */}
                          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                            {(previewData.items || []).map((it: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-start py-1.5 border-b border-slate-50 last:border-b-0">
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-slate-800 text-xs sm:text-[13px] flex items-center gap-1">
                                    <span className="truncate">{it.productName || it.name}</span>
                                    <span className="text-red-600 font-extrabold shrink-0">x{it.quantity}</span>
                                  </div>
                                  {it.selectedOptions?.length > 0 && (
                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                      {it.selectedOptions.map((o: any) => o.optionItemName || o.name).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <div className="font-extrabold text-slate-800 shrink-0 text-xs sm:text-[13px]">
                                  {formatter.format((it.priceAtSale || it.unitPrice || 0) * (it.quantity || 1))}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Bảng phân rã chi phí */}
                          <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600">
                            <div className="flex justify-between">
                              <span>Tạm tính món:</span>
                              <span className="font-semibold text-slate-800">{formatter.format(previewData.subTotal || 0)}</span>
                            </div>
                            {previewData.discountAmount > 0 && (
                              <div className="flex justify-between text-green-600 font-semibold">
                                <span>Mã giảm giá:</span>
                                <span>-{formatter.format(previewData.discountAmount)}</span>
                              </div>
                            )}
                            {previewData.pointsDiscount > 0 && (
                              <div className="flex justify-between text-amber-600 font-semibold">
                                <span>Điểm tích lũy ({previewData.pointsUsed} điểm):</span>
                                <span>-{formatter.format(previewData.pointsDiscount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Phí giao hàng:</span>
                              <span className="font-semibold text-slate-800">
                                {previewData.shippingFee > 0 ? formatter.format(previewData.shippingFee) : 'Miễn phí'}
                              </span>
                            </div>
                            {previewData.taxAmount > 0 && (
                              <div className="flex justify-between text-slate-500">
                                <span>Thuế VAT:</span>
                                <span>{formatter.format(previewData.taxAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm sm:text-base font-black text-red-600 pt-1.5 border-t border-slate-200/80">
                              <span>TỔNG THANH TOÁN:</span>
                              <span>{formatter.format(previewData.finalTotal || previewData.totalAmount || 0)}</span>
                            </div>
                          </div>

                          {/* Nút dùng điểm tích lũy */}
                          {user && (
                            <div className="flex items-center justify-between p-2.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs">
                              <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                                <Sparkles size={14} className="text-amber-600 shrink-0" />
                                <span>Dùng điểm thành viên (Tối đa {previewData.maxPointDiscountPercent || 20}% đơn)</span>
                              </div>
                              <button
                                type="button"
                                disabled={isObsoleteOrder || isLoading}
                                onClick={() => {
                                  if (isObsoleteOrder) {
                                    toast.error("Bản xem trước đơn hàng này đã xử lý hoặc không còn khả dụng!");
                                    return;
                                  }
                                  handleSendMessage(previewData.pointsUsed > 0 ? "Tôi không dùng điểm tích lũy" : "Tôi muốn dùng điểm tích lũy thành viên");
                                }}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all shrink-0 ${isObsoleteOrder
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
                                  : previewData.pointsUsed > 0
                                    ? 'bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-700 cursor-pointer'
                                    : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/50 cursor-pointer'
                                  }`}
                              >
                                {previewData.pointsUsed > 0 ? `Đã trừ ${previewData.pointsUsed}đ (Bỏ dùng)` : 'Áp dụng điểm'}
                              </button>
                            </div>
                          )}

                          {/* Voucher & Khuyến mãi */}
                          <div className="flex items-center justify-between p-2.5 bg-red-50/60 border border-red-200/80 rounded-xl text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Ticket size={14} className="text-red-600 shrink-0" />
                              <div className="truncate">
                                <span className="font-semibold text-slate-800">Mã giảm giá: </span>
                                {previewData.discountVoucherCode || previewData.shippingVoucherCode ? (
                                  <span className="font-mono font-bold text-red-600">
                                    {[previewData.discountVoucherCode, previewData.shippingVoucherCode].filter(Boolean).join(' + ')}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Chưa áp dụng</span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={isObsoleteOrder || isLoading}
                              onClick={() => {
                                if (isObsoleteOrder) {
                                  toast.error("Bản xem trước đơn hàng này đã xử lý hoặc không còn khả dụng!");
                                  return;
                                }
                                handleSendMessage("Gợi ý các mã giảm giá và voucher hời nhất cho đơn hàng này của tôi");
                              }}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all shrink-0 ${isObsoleteOrder ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed' : 'bg-white border-red-300 text-red-700 hover:bg-red-100/60 cursor-pointer shadow-2xs'}`}
                            >
                              {previewData.discountVoucherCode || previewData.shippingVoucherCode ? 'Đổi mã' : 'Áp dụng voucher'}
                            </button>
                          </div>

                          {/* Thông tin nhận hàng - Tối ưu Mobile thấy trọn vẹn địa chỉ và khung giờ */}
                          <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-2 text-slate-600 border border-slate-200/80 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 pb-2 border-b border-slate-200/60">
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <MapPin size={13} className="text-red-500 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-slate-900 block text-[10.5px] uppercase tracking-wide text-rose-700">
                                    {previewData.fulfillmentType === 'TAKEAWAY' ? 'Mang về tại chi nhánh:' : 'Địa chỉ giao hàng tận nơi:'}
                                  </span>
                                  <p className="text-slate-800 font-medium break-words leading-relaxed mt-0.5 text-xs">
                                    {previewData.deliveryAddress || previewData.branchName}
                                  </p>
                                  {previewData.recipientName && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      Người nhận: <b>{previewData.recipientName}</b> {previewData.recipientPhone ? `(${previewData.recipientPhone})` : ''}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isObsoleteOrder || isLoading}
                                onClick={() => {
                                  if (isObsoleteOrder) {
                                    toast.error("Bản xem trước đơn hàng này đã xử lý hoặc không còn khả dụng!");
                                    return;
                                  }
                                  handleSendMessage("Tôi muốn thay đổi địa chỉ giao hàng");
                                }}
                                className={`font-bold text-[11px] px-2 py-1 rounded-lg border transition-colors shrink-0 self-end sm:self-start shadow-2xs ${isObsoleteOrder ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed' : 'text-red-600 hover:text-red-700 border-red-200 bg-white hover:bg-red-50 cursor-pointer'}`}
                              >
                                Đổi địa chỉ
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <Clock size={13} className="text-blue-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <span className="text-slate-500">Khung giờ giao: </span>
                                  <span className="font-bold text-slate-800 break-words">
                                    {previewData.deliverySlotTime || previewData.scheduledTime || 'Giao sớm nhất (30-45 phút)'}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isObsoleteOrder || isLoading}
                                onClick={() => {
                                  if (isObsoleteOrder) {
                                    toast.error("Bản xem trước đơn hàng này đã xử lý hoặc không còn khả dụng!");
                                    return;
                                  }
                                  handleSendMessage("Tôi muốn chọn khung giờ giao hàng");
                                }}
                                className={`font-bold text-[11px] px-2 py-1 rounded-lg border transition-colors shrink-0 shadow-2xs ${isObsoleteOrder ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700 border-blue-200 bg-white hover:bg-blue-50 cursor-pointer'}`}
                              >
                                Đổi giờ
                              </button>
                            </div>
                          </div>

                          {/* Chọn Phương thức thanh toán */}
                          <div className="space-y-1.5 pt-1">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <CreditCard size={14} className="text-red-500" /> Chọn phương thức thanh toán:
                            </span>
                            {previewData.availablePaymentMethods && previewData.availablePaymentMethods.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {previewData.availablePaymentMethods.map((pm: any) => {
                                  const currentSelected = selectedPaymentMethods[msg.id] || previewData.paymentMethod || 'COD';
                                  const isSelected = currentSelected === pm.code;
                                  const isSepay = pm.code === 'SEPAY_QR' || pm.code === 'TRANSFER' || pm.type === 'TRANSFER' || pm.code.includes('SEPAY');
                                  const isCash = pm.code === 'COD' || pm.type === 'COD';
                                  const isPos = pm.type === 'CASH' || pm.code === 'CASH';

                                  return (
                                    <button
                                      key={pm.code}
                                      type="button"
                                      disabled={isObsoleteOrder || isLoading}
                                      onClick={() => {
                                        if (isObsoleteOrder) {
                                          toast.error("Bản xem trước đơn hàng này đã xử lý hoặc không còn khả dụng!");
                                          return;
                                        }
                                        setSelectedPaymentMethods(prev => ({ ...prev, [msg.id]: pm.code }));
                                      }}
                                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${isObsoleteOrder
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : isSelected
                                          ? 'bg-red-50/90 border-red-500 text-red-950 ring-1 ring-red-500 shadow-xs cursor-pointer'
                                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/70 cursor-pointer'
                                        }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSepay ? 'bg-rose-100 text-rose-600' :
                                          isCash ? 'bg-emerald-100 text-emerald-600' :
                                            isPos ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                          }`}>
                                          {isSepay ? <QrCode size={15} /> : isCash ? <DollarSign size={15} /> : isPos ? <Store size={15} /> : <CreditCard size={15} />}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-xs truncate">{pm.name}</span>
                                            {isSepay && (
                                              <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">Tự động SePay</span>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-slate-500 truncate block">
                                            {pm.description || (isCash ? 'Thanh toán tiền mặt khi nhận hàng' : isSepay ? 'Quét mã VietQR xác nhận tức thì' : 'Thanh toán tại quầy')}
                                          </span>
                                        </div>
                                      </div>
                                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-red-600 bg-red-600' : 'border-slate-300 bg-white'
                                        }`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="font-semibold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                                {previewData.paymentMethod || 'COD'}
                              </div>
                            )}
                          </div>

                          {isObsoleteOrder ? (
                            <button
                              type="button"
                              disabled
                              className="mt-1 w-full py-2.5 bg-slate-200 text-slate-500 font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                            >
                              <Check size={15} /> Đơn hàng đã được tạo thành công
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const hasSlot = Boolean(previewData.operatingSlotId || previewData.deliverySlotTime);
                                if (!hasSlot) {
                                  toast.error("Vui lòng chọn khung giờ giao hàng trước khi xác nhận đơn!");
                                  handleSendMessage("Tôi muốn chọn khung giờ giao hàng");
                                  return;
                                }
                                const chosenMethod = selectedPaymentMethods[msg.id] || previewData.paymentMethod || 'COD';
                                const chosenMethodName = previewData.availablePaymentMethods?.find((m: any) => m.code === chosenMethod)?.name || chosenMethod;
                                confirmChatTransaction(
                                  'ORDER',
                                  previewData.previewToken,
                                  `Tôi xác nhận đơn hàng trên với phương thức thanh toán [${chosenMethodName}], hãy tạo đơn giúp tôi.`,
                                  chosenMethod,
                                  previewData.pointsUsed > 0,
                                );
                              }}
                              disabled={isLoading}
                              className="mt-1 w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] text-xs sm:text-sm cursor-pointer"
                            >
                              <CreditCard size={15} /> Xác nhận đặt đơn ngay
                            </button>
                          )}
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* SHOW_ORDER_SUCCESS Card (Thẻ xác nhận tạo đơn & chuyển hướng SePay) */}
                  {msg.senderType === 'AI' && msg.actionType === 'SHOW_ORDER_SUCCESS' && msg.actionPayload && (() => {
                    try {
                      const payload = JSON.parse(msg.actionPayload);
                      const orderCode = payload.orderCode;
                      return (
                        <div className="w-full mt-2.5 p-4 bg-emerald-50/90 rounded-2xl border border-emerald-200 shadow-md flex flex-col gap-3 text-xs animate-in fade-in duration-300">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                              <Check className="w-6 h-6 stroke-[3]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-extrabold text-emerald-900 text-sm sm:text-base">Đặt Hàng Thành Công!</div>
                              <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 mt-0.5">
                                <span>Mã đơn:</span>
                                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900">{orderCode}</span>
                              </div>
                            </div>
                          </div>

                          <p className="text-[11px] text-emerald-800 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                            Đơn hàng của bạn đã được ghi nhận. Hệ thống đang chuyển hướng tới cổng thanh toán QR SePay. Quý khách vui lòng quét mã QR để hoàn tất thanh toán nhé!
                          </p>

                          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => router.push(`/payment/sepay?orderCode=${orderCode}`)}
                              className="w-full sm:flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 transition-all cursor-pointer"
                            >
                              <QrCode size={15} /> Quét mã QR thanh toán SePay ngay
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/orders/${orderCode}`)}
                              className="w-full sm:w-auto py-2.5 px-3 bg-white border border-emerald-300 hover:bg-emerald-100/60 text-emerald-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                            >
                              Theo dõi đơn
                            </button>
                          </div>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* SELECT_ORDER_SLOT Card */}
                  {msg.senderType === 'AI' && msg.actionType === 'SELECT_ORDER_SLOT' && msg.actionPayload && (() => {
                    try {
                      const slotData = JSON.parse(msg.actionPayload);
                      const slots = slotData.slots || [];
                      const selectedSlot = slotData.selectedSlot;
                      return (
                        <div className="w-full mt-2.5 p-3.5 sm:p-4 bg-white rounded-2xl border border-indigo-200 shadow-md flex flex-col gap-3 animate-in fade-in duration-300">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs sm:text-sm">
                              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span>CHỌN KHUNG GIỜ NHẬN HÀNG</span>
                            </div>
                            {slotData.date && (
                              <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                                {slotData.date}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500">
                            {slotData.branchName ? `Chi nhánh: ${slotData.branchName}` : 'Khung giờ giao hàng còn khả dụng:'}
                          </p>

                          {/* Nút bấm nhanh ASAP */}
                          <button
                            onClick={() => handleSendMessage("Tôi muốn giao ngay (ASAP)")}
                            disabled={isLoading}
                            className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                          >
                            <Sparkles size={13} className="shrink-0 text-amber-200" />
                            <span>Giao ngay (ASAP - Càng sớm càng tốt)</span>
                          </button>

                          {/* Lưới các khung giờ cụ thể */}
                          {slots.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-semibold text-slate-700">Hoặc chọn khung giờ hẹn trước:</span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-0.5">
                                {slots.map((s: any, idx: number) => {
                                  const isSelected = selectedSlot && (selectedSlot.id === s.id || (selectedSlot.startTime === s.startTime && selectedSlot.endTime === s.endTime));
                                  return (
                                    <button
                                      key={idx}
                                      disabled={isLoading}
                                      onClick={() => handleSendMessage(`Tôi chọn khung giờ ${s.startTime} - ${s.endTime}`)}
                                      className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all text-center flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                          : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200 hover:border-indigo-200'
                                      }`}
                                    >
                                      <Clock size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                      <span>{s.startTime} - {s.endTime}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* REQUEST_LOCATION & SHOW_MAP_LINK Interactive Branch Locator + 7s Auto-Fallback + Embedded Google Map */}
                  {msg.senderType === 'AI' && (msg.actionType === 'REQUEST_LOCATION' || msg.actionType === 'SHOW_MAP_LINK') && (
                    <div className="w-full max-w-xl">
                      <BranchLocationMapCard
                        actionType={msg.actionType}
                        actionPayload={msg.actionPayload}
                        isHistorical={Boolean((msg as any).isHistorical)}
                        selectedBranchId={effectiveBranchId}
                        onConfirmDeliveryAddress={(data) => {
                          const addrText = `Tôi muốn giao hàng đến: ${data.streetDetail}, ${data.ward}, ${data.province} (Người nhận: ${data.recipientName} - SĐT: ${data.phone})${data.deliveryNote ? ` - Ghi chú: ${data.deliveryNote}` : ''}`;
                          handleSendMessage(`[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${data.latitude}, kinh độ ${data.longitude}]\n${addrText}`);
                        }}
                        onLocationShared={(lat, lng) => {
                          handleSendMessage(`[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lng}]`);
                        }}
                        onSelectBranch={(bId, bName) => {
                          if (changeBranch) changeBranch(bId);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('currentBranchId', bId);
                            localStorage.setItem('selectedBranchId', bId);
                            window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: bId } }));
                          }
                          toast.success(`Đã chọn chi nhánh ${bName}`);
                        }}
                        onBookTable={(bName) => {
                          handleSendMessage(`Tôi muốn đặt bàn tại chi nhánh ${bName}`);
                        }}
                      />
                    </div>
                  )}

                  {/* SHOW_VOUCHERS Card */}
                  {msg.senderType === 'AI' && msg.actionType === 'SHOW_VOUCHERS' && msg.actionPayload && (() => {
                    try {
                      const payload = JSON.parse(msg.actionPayload);
                      if (!payload.vouchers || payload.vouchers.length === 0) return null;

                      return (
                        <div className="mt-2.5 flex flex-col gap-2 w-full">
                          {payload.vouchers.map((voucher: any, vIdx: number) => (
                            <div key={vIdx} className="bg-white border border-red-200 rounded-2xl p-3 shadow-xs relative overflow-hidden flex flex-col gap-1.5">
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-red-600 text-xs sm:text-sm flex items-center gap-1.5">
                                  <Ticket size={15} /> {voucher.title}
                                </h4>
                              </div>
                              <div className="text-xs text-slate-600 space-y-1 mt-0.5">
                                <p className="flex items-center gap-1.5">
                                  <span className="font-medium">Mức giảm:</span> {voucher.discountType === 'PERCENTAGE' ? `${voucher.discountValue}% (Tối đa ${voucher.maxDiscount?.toLocaleString('vi-VN')}đ)` : `${voucher.discountValue?.toLocaleString('vi-VN')}đ`}
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <span className="font-medium">Đơn tối thiểu:</span> {voucher.minOrderValue?.toLocaleString('vi-VN')}đ
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <span className="font-medium">HSD:</span> {new Date(voucher.endDate).toLocaleDateString('vi-VN')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(voucher.code);
                                  toast.success(`Đã sao chép mã ${voucher.code}!`);
                                }}
                                className="mt-1 bg-red-50 hover:bg-red-100 text-red-700 font-mono font-bold py-1.5 px-3 rounded-xl text-xs transition-colors border border-red-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <Copy size={12} />
                                <span>COPY MÃ: {voucher.code}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* CONFIRM_RESERVATION Card */}
                  {msg.senderType === 'AI' && msg.actionType === 'CONFIRM_RESERVATION' && msg.actionPayload && (() => {
                    try {
                      const resData = JSON.parse(msg.actionPayload);
                      if (!resData || !resData.previewToken || !resData.reservationDate || !resData.reservationTime) {
                        return null;
                      }
                      const isObsoleteReservation = messages.slice(index + 1).some(
                        (laterMsg: any) => laterMsg.actionType === 'SHOW_RESERVATION_SUCCESS' || laterMsg.actionType === 'CONFIRM_RESERVATION'
                      );
                      return (
                        <div className={`w-full max-w-md mt-2.5 p-4 bg-white rounded-2xl border shadow-md flex flex-col gap-3 text-xs ${isObsoleteReservation ? 'border-slate-200 bg-slate-50/50 opacity-80' : 'border-rose-200'}`}>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2 text-rose-600 font-bold">
                              <Calendar className="w-4 h-4" />
                              <span>XÁC NHẬN ĐẶT BÀN</span>
                            </div>
                            {isObsoleteReservation && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                                Đã xác nhận
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 text-slate-700">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Chi nhánh:</span>
                              <span className="font-bold text-slate-900">{resData.branchName || 'Chi nhánh Avora'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ngày đặt:</span>
                              <span className="font-semibold text-slate-900">{resData.reservationDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Khung giờ:</span>
                              <span className="font-semibold text-rose-600">{resData.reservationTime}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Số lượng khách:</span>
                              <span className="font-bold text-slate-900">{resData.partySize} người</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Khách hàng:</span>
                              <span className="font-medium text-slate-900">{resData.customerName} ({resData.customerPhone})</span>
                            </div>
                            {resData.specialRequests && (
                              <div className="flex justify-between text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">
                                <span>Ghi chú: {resData.specialRequests}</span>
                              </div>
                            )}
                            {Array.isArray(resData.preOrderedItems) && resData.preOrderedItems.length > 0 && (
                              <div className="pt-2 border-t border-slate-100">
                                <span className="text-[11px] font-bold text-slate-700 block mb-1">Món ăn đặt trước:</span>
                                <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px]">
                                  {resData.preOrderedItems.map((item: any, iIdx: number) => (
                                    <div key={iIdx} className="flex justify-between text-slate-600">
                                      <span className="truncate max-w-[180px]">{item.name} x{item.quantity}</span>
                                      <span className="font-medium text-slate-800">
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.lineTotal || (item.price * item.quantity))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {!isObsoleteReservation ? (
                            <button
                              onClick={() => confirmChatTransaction(
                                'RESERVATION',
                                resData.previewToken,
                                'Tôi xác nhận đặt bàn thông tin trên, hãy tạo đặt bàn giúp tôi.',
                              )}
                              disabled={isLoading}
                              className="mt-1 w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                            >
                              <Sparkles size={15} /> Xác nhận đặt bàn ngay
                            </button>
                          ) : (
                            <div className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-center font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4" /> Đặt bàn đã được gửi thành công
                            </div>
                          )}
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* SHOW_RESERVATION_SUCCESS Card */}
                  {msg.senderType === 'AI' && msg.actionType === 'SHOW_RESERVATION_SUCCESS' && msg.actionPayload && (() => {
                    try {
                      const resData = JSON.parse(msg.actionPayload);
                      return (
                        <div className="w-full max-w-md mt-2.5 p-4 bg-white rounded-2xl border border-emerald-200 shadow-md flex flex-col gap-3 text-xs animate-in fade-in duration-300">
                          <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                            <div className="flex items-center gap-2 text-emerald-600 font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>ĐẶT BÀN THÀNH CÔNG</span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Đã giữ chỗ
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 text-slate-700">
                            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="text-slate-500 font-medium">Mã đặt bàn:</span>
                              <span className="font-mono font-extrabold text-red-600 text-sm">{resData.reservationCode}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Chi nhánh:</span>
                              <span className="font-bold text-slate-900">{resData.branchName || 'Chi nhánh Avora'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Thời gian:</span>
                              <span className="font-semibold text-slate-900">
                                {resData.reservationTime} • {resData.reservationDate}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Số lượng:</span>
                              <span className="font-bold text-slate-900">{resData.partySize} khách</span>
                            </div>
                            {resData.customerName && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Khách hàng:</span>
                                <span className="font-medium text-slate-900">
                                  {resData.customerName} {resData.customerPhone ? `(${resData.customerPhone})` : ''}
                                </span>
                              </div>
                            )}

                            {Array.isArray(resData.preOrderedItems) && resData.preOrderedItems.length > 0 && (
                              <div className="mt-1 pt-2 border-t border-slate-100">
                                <div className="flex justify-between items-center font-bold text-slate-900 mb-1.5">
                                  <span>Món đặt trước ({resData.preOrderedItems.length} món):</span>
                                  <span className="text-red-600 font-extrabold">
                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(resData.preOrderTotal || 0)}
                                  </span>
                                </div>
                                <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px]">
                                  {resData.preOrderedItems.map((item: any, iIdx: number) => (
                                    <div key={iIdx} className="flex justify-between text-slate-600">
                                      <span className="truncate max-w-[180px]">{item.name} x{item.quantity}</span>
                                      <span className="font-medium text-slate-800">
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.lineTotal || (item.price * item.quantity))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <Link
                            href={`/profile/reservations/${resData.reservationCode}${resData.customerPhone ? `?phone=${encodeURIComponent(resData.customerPhone)}` : ''}`}
                            className="mt-1 w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-md shadow-red-600/20 text-center transition-all flex items-center justify-center gap-2"
                          >
                            <QrCode className="w-4 h-4" /> Xem phiếu đặt bàn & Mã QR
                          </Link>
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* SHOW_PRODUCT Carousel */}
                  {msg.senderType === 'AI' && msg.actionType === 'SHOW_PRODUCT' && msg.actionPayload && (() => {
                    try {
                      const payload = JSON.parse(msg.actionPayload);
                      const products = payload && !Array.isArray(payload) ? payload.products : payload;
                      const validProducts = Array.isArray(products) ? products.filter((p: any) => p && p.id) : [];

                      if (validProducts.length === 0) return null;

                      return (
                        <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none w-full max-w-full -mx-1 px-1">
                          {validProducts.map((product: any, idx: number) => {
                            const categorySlug = product.category?.slug || product.categorySlug || (typeof product.category === 'string' ? product.category : null) || 'mon-an';
                            const dishUrl = product.productUrl || (product.slug ? `/${categorySlug}/${product.slug}` : (product.id ? `/${categorySlug}/${product.id}` : '/menu'));

                            return (
                              <div
                                key={`${product.id || 'p'}-${idx}`}
                                className="min-w-[130px] max-w-[140px] sm:min-w-[160px] sm:max-w-[160px] bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow shrink-0 flex flex-col"
                              >
                                <div
                                  className="w-full h-24 sm:h-28 bg-slate-100 relative cursor-pointer group overflow-hidden"
                                  onClick={() => router.push(dishUrl)}
                                >
                                  <img
                                    src={product.imageUrl || product.images?.[0]?.url || 'https://via.placeholder.com/150'}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>

                                <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
                                  <h5
                                    className="font-bold text-[11px] sm:text-xs text-slate-800 line-clamp-2 leading-snug cursor-pointer hover:text-red-600 transition-colors"
                                    onClick={() => router.push(dishUrl)}
                                    title={product.name}
                                  >
                                    {product.name}
                                  </h5>

                                  <div className="text-red-600 font-black text-xs sm:text-sm mt-1 mb-2">
                                    {product.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price) : 'Liên hệ'}
                                  </div>

                                  <div className="flex items-center gap-1 mt-auto">
                                    <button
                                      onClick={() => handleProductAddToCart(product)}
                                      className="flex-1 py-1.5 px-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      <ShoppingCart size={11} />
                                      <span>Thêm</span>
                                    </button>
                                    <button
                                      onClick={() => router.push(dishUrl)}
                                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                                      title="Xem chi tiết"
                                    >
                                      <ExternalLink size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* Interactive Smart Suggested Replies with direct Add-to-Cart logic */}
                  {(() => {
                    const { suggestions } = parseSuggestionsAndCleanContent(msg.content, msg.suggestedReplies);
                    if (!suggestions || suggestions.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {suggestions.map((reply: any, rIdx: number) => {
                          const label = typeof reply === 'string' ? reply : reply.label || reply.text;
                          return (
                            <button
                              key={rIdx}
                              onClick={() => handleSuggestionClick(reply, msg)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-full text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-95"
                            >
                              <Sparkles size={11} className="text-red-500 shrink-0" />
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <span className="text-[10px] text-slate-400 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              );
            })}

            {/* Loading Indicator with AvoBOT AI Analysis Progress */}
            {isLoading && (
              <AiAnalysisProgress
                userQuery={messages.filter(m => m.senderType === 'USER').slice(-1)[0]?.content}
                branchName={branchName}
                cartCount={cartItems.length}
                activeTool={activeVoiceTool}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Fixed Bottom Input Zone: Bright White, Voice Button, Dynamic Chips ──── */}
          <div className="bg-white border-t border-slate-200/80 p-2 sm:p-3 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-[max(0.6rem,env(safe-area-inset-bottom))]">
            <div className="max-w-4xl mx-auto space-y-2">
              {/* Dynamic Quick Prompt Chips (Thay đổi linh hoạt theo câu trả lời của AI) */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {dynamicQuickPrompts.map((chip, idx) => {
                  const IconComp = chip.icon || Sparkles;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (chip.label.toLowerCase().includes('giỏ hàng')) {
                          setShowCartDrawer(true);
                        } else {
                          handleSendMessage(chip.prompt);
                        }
                      }}
                      className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-300 whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 shadow-2xs font-semibold active:scale-95 cursor-pointer"
                    >
                      <IconComp className={`w-3.5 h-3.5 ${chip.color || 'text-red-500'}`} />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Input Box with Voice Chat & Send */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 rounded-2xl px-3 py-1.5 transition-all">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Hỏi AvoBOT về món ăn, ưu đãi tại ${branchName}...`}
                  rows={1}
                  className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none resize-none max-h-24 leading-relaxed font-normal"
                />

                {/* Voice Input Button with Equalizer Icon */}
                <button
                  type="button"
                  onClick={toggleVoiceMode}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${isVoiceMode
                    ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-200 shadow-sm'
                    : 'text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95'
                    }`}
                  title={isVoiceMode ? "Đang mở đàm thoại giọng nói... bấm để dừng" : "Nói chuyện bằng giọng nói với AvoBOT"}
                >
                  <SoundwaveIcon isListening={isVoiceMode} />
                </button>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isLoading}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all shadow-xs active:scale-95"
                  title="Gửi tin nhắn"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                AvoBOT là AI có thể mắc lỗi!
              </p>
            </div>
          </div>
        </div>

        {/* ── Collapsible Right Sidebar: ALL Menu Items (Personality, Clear Chat, Home, Dishes) ── */}
        {showSidebar && (
          <aside className="fixed inset-y-0 right-0 w-80 sm:w-96 border-l border-slate-200 bg-white flex flex-col h-full z-50 animate-in slide-in-from-right duration-200 shadow-2xl">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-600" />
                Tiện ích & Gợi ý AvoBOT
              </h3>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
              {/* Section 1: Personality Selector (Moved into 3-gạch menu) */}
              <div>
                <p className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Phong cách giao tiếp AvoBOT</span>
                  <span className="text-[11px] text-red-600 font-bold">{personality}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Thân thiện', desc: 'Ngọt ngào, ấm áp' },
                    { name: 'Chuyên nghiệp', desc: 'Lịch thiệp, chuẩn mực' },
                    { name: 'Hài hước', desc: 'Vui nhộn, dí dỏm' },
                    { name: 'Nhanh gọn', desc: 'Súc tích, dứt khoát' },
                  ].map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        setPersonality(p.name);
                        localStorage.setItem('avora_chat_personality', p.name);
                        toast.success(`Đã đổi phong cách thành ${p.name}`);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${personality === p.name
                        ? 'bg-red-50 border-red-500 text-red-700 font-bold shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                    >
                      <div className="leading-tight">{p.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Branch Switcher (Đổi chi nhánh Avora trực tiếp trong Tiện ích) */}
              <div className="pt-3 border-t border-slate-100">
                <p className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-red-600" />
                    Đổi chi nhánh phục vụ
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {branches.find(b => b.id === effectiveBranchId)?.name || 'Chi nhánh'}
                  </span>
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {branches.map((b) => {
                    const isSelected = b.id === effectiveBranchId;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          if (changeBranch) changeBranch(b.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('currentBranchId', b.id);
                            localStorage.setItem('selectedBranchId', b.id);
                            window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: b.id } }));
                          }
                          toast.success(`Đã đổi sang chi nhánh ${b.name}`);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${isSelected
                          ? 'bg-red-50/90 border-red-400 text-red-950 font-bold ring-1 ring-red-400/60 shadow-xs'
                          : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/90 text-slate-700 font-medium'
                          }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="truncate text-xs">{b.name}</div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {[b.street, b.district, b.province].filter(Boolean).join(', ')}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Manage Chat & Quick Navigation (Moved into 3-gạch menu) */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <p className="font-bold text-slate-700 mb-1">Thao tác & Điều hướng</p>
                <button
                  onClick={() => {
                    setShowSidebar(false);
                    setShowClearModal(true);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-red-50/70 hover:bg-red-100 text-red-700 transition-colors font-bold border border-red-200/80"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    Làm mới cuộc trò chuyện
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                </button>

                <Link
                  href="/"
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors font-semibold border border-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-slate-600" />
                    Về trang chủ AVORA
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/restaurants"
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors font-semibold border border-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-red-600" />
                    Hệ thống chi nhánh ({branches.length})
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/vouchers"
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors font-semibold border border-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-amber-500" />
                    Kho mã giảm giá & voucher
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>

              {/* Section 3: Recommended Dishes with Add to Cart / Advice Buttons */}
              <div className="pt-3 border-t border-slate-100">
                <p className="font-bold text-slate-700 mb-2">Món bán chạy tại {branchName}</p>
                <div className="space-y-2">
                  {topProducts.map((p) => {
                    const catSlug = p.category?.slug || p.categorySlug || 'mon-an';
                    const dishUrl = p.productUrl || (p.slug ? `/${catSlug}/${p.slug}` : (p.id ? `/${catSlug}/${p.id}` : '/menu'));

                    return (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-2xl bg-white border border-slate-200/90 hover:border-red-300 transition-all shadow-2xs space-y-2"
                      >
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl && (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-12 h-12 rounded-xl object-cover shrink-0 cursor-pointer"
                              onClick={() => {
                                setShowSidebar(false);
                                router.push(dishUrl);
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h5
                              onClick={() => {
                                setShowSidebar(false);
                                router.push(dishUrl);
                              }}
                              className="font-bold text-slate-800 text-xs truncate cursor-pointer hover:text-red-600 transition-colors"
                              title={p.name}
                            >
                              {p.name}
                            </h5>
                            <p className="text-red-600 font-bold mt-0.5 text-xs">
                              {new Intl.NumberFormat('vi-VN').format(p.price)} ₫
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons: Thêm vào giỏ & Tư vấn món */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleProductAddToCart(p)}
                            className="flex-1 py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 border border-red-200 cursor-pointer active:scale-95"
                          >
                            <ShoppingCart size={11} />
                            <span>Thêm giỏ</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowSidebar(false);
                              handleSendMessage(`Tư vấn cho tôi chi tiết về món ${p.name}`);
                            }}
                            className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 border border-slate-200"
                          >
                            <MessageSquare size={11} />
                            <span>Tư vấn</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── React Modal: Clear Conversation (NO window.confirm) ─────── */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-black text-base text-slate-900">
                Làm mới hội thoại?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Toàn bộ lịch sử trò chuyện hiện tại với AvoBOT sẽ được xóa sạch. Bạn có chắc chắn muốn bắt đầu cuộc trò chuyện mới?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmClearHistory}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30"
              >
                Xóa trò chuyện
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── React Modal: Delete Individual Session Modal ────────── */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-black text-base text-slate-900">
                Xóa cuộc trò chuyện?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa hội thoại &quot;{sessionToDelete.title || 'Cuộc trò chuyện này'}&quot; khỏi hệ thống? Hành động này không thể hoàn tác.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSession(sessionToDelete.id)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30 cursor-pointer"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-over Cart Drawer ── */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Giỏ hàng của bạn ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} món)
                  </h4>
                  <span className="text-[11px] text-slate-400 block">Tăng giảm số lượng, xóa món hoặc chốt đơn</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCartDrawer(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Giỏ hàng của bạn đang trống</p>
                  <p className="text-xs text-slate-400 mt-1">Hỏi AvoBOT để thêm những món ăn hấp dẫn vào giỏ nhé!</p>
                </div>
              ) : (
                cartItems.map((item: any) => {
                  const itemPrice = Number(item.priceAtSale ?? item.price ?? 0);
                  const itemImg = item.imageUrl || item.image || item.product?.imageUrl || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400';
                  const itemName = item.name || item.product?.name || 'Món ăn';
                  const itemOpts = item.optionsTextSnapshot || item.optionsSummary || '';

                  return (
                    <div key={item.id} className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex items-start gap-3">
                      <img
                        src={itemImg}
                        alt={itemName}
                        onError={(e) => { (e.target as any).src = 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'; }}
                        className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-100"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h5 className="font-bold text-xs sm:text-sm text-slate-800 truncate">{itemName}</h5>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                            title="Xóa món này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="text-xs font-bold text-red-600 mt-0.5">
                          {new Intl.NumberFormat('vi-VN').format(itemPrice)}đ
                        </div>
                        {itemOpts && (
                          <p className="text-[11px] text-slate-500 italic line-clamp-1 mt-0.5">{itemOpts}</p>
                        )}

                        <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-50">
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-black text-slate-800">
                            {new Intl.NumberFormat('vi-VN').format(itemPrice * item.quantity)}đ
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/90 space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-slate-600">Tổng tiền tạm tính:</span>
                  <span className="text-red-600 text-base font-black">{new Intl.NumberFormat('vi-VN').format(cartTotal)}đ</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCartDrawer(false);
                      handleSendMessage("Tiến hành chốt đơn và thanh toán cho các món trong giỏ hàng hiện tại");
                    }}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/20 text-center cursor-pointer transition-all active:scale-98"
                  >
                    Chốt đơn AI
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/checkout')}
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs text-center cursor-pointer transition-all active:scale-98"
                  >
                    Đi đến Thanh toán
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Share2 size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Chia sẻ cuộc trò chuyện</h4>
                  <span className="text-[11px] text-slate-400 block">Tạo liên kết xem lại phiên chat</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowShareModal(false); setGeneratedShareUrl(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 text-amber-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Lock size={13} className="text-amber-600" />
                Bảo vệ thông tin cá nhân
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Đoạn chat được chia sẻ sẽ tự động che số điện thoại (ví dụ: <strong className="font-mono text-slate-800">083*****52</strong>) và địa chỉ nhà (ví dụ: <strong className="font-mono text-slate-800">***, Phường Ba Đình, Hà Nội</strong>) để đảm bảo quyền riêng tư của bạn.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Thời hạn liên kết tồn tại:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: '1h', label: '1 Giờ' },
                  { id: '24h', label: '24 Giờ' },
                  { id: '7d', label: '7 Ngày' },
                  { id: 'permanent', label: 'Vô hạn' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setShareDuration(opt.id)}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      shareDuration === opt.id
                        ? 'bg-red-50 border-red-500 text-red-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {generatedShareUrl ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedShareUrl}
                    className="bg-transparent text-xs text-slate-700 font-mono flex-1 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedShareUrl);
                      toast.success('Đã sao chép liên kết chia sẻ!');
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={12} /> Sao chép
                  </button>
                </div>
                <p className="text-[10px] text-emerald-600 text-center font-semibold">✓ Liên kết đã sẵn sàng để gửi cho bạn bè!</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateShareLink}
                disabled={isGeneratingShare}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-all active:scale-98"
              >
                {isGeneratingShare ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                <span>Tạo liên kết chia sẻ an toàn</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
