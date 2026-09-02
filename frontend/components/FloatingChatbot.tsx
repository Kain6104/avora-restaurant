"use client";

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Sparkles, MessageCircle, X, Send, Camera, Mic, Loader2, Menu, Trash2, User, VolumeX, HelpCircle, PhoneCall, Maximize2, MicOff, Activity, Bot, UserCircle, Flame, Gift, Salad, ShoppingCart, Coffee, RefreshCw, CreditCard, BookOpen, Package, Plus, Ticket, Tag, Clock, Lock, AlertTriangle, ChevronDown, MapPin, HeartHandshake, Smile, Zap, Paperclip, FileText, Info } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useCart, CartItem } from '../context/CartContext';
import { toast } from 'react-hot-toast';
import { useRouter, usePathname } from 'next/navigation';

const renderFormattedText = (text: string) => {
  const regex = /(\[.*?\]\(.*?\))|(\*\*.*?\*\*)/g;
  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl text-[13px] transition-colors border border-blue-200 shadow-sm">
            <MapPin size={14} /> {match[1]}
          </a>
        );
      }
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

type ChatSenderType = "USER" | "AI" | "TOOL" | "SYSTEM";
type ChatActionType = "ADD_TO_CART" | "SHOW_ORDER" | "CONFIRM_CANCEL" | "CONFIRM_RESERVATION" | "SHOW_PRODUCT" | "SHOW_VOUCHERS" | "NAVIGATE" | "REQUEST_LOCATION" | "ADD_ALL_SUMMARY" | "CART_SUMMARY" | "SHOW_ORDER_SUCCESS" | "STOP_VOICE" | "SUGGEST_VOUCHER" | "PROMPT_VOUCHER_INPUT" | "SHOW_BEAUTIFUL_ORDER" | "UPDATE_CART" | "PROMPT_PERSONALITY" | "SHOW_MAP_LINK" | "PROMPT_LOGIN";

interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: ChatSenderType;
  content: string;
  actionType: ChatActionType | null;
  actionPayload: string | null;
  createdAt: string;
  suggestedReplies?: string[];
}

export function FloatingChatbot() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [checkoutAddressId, setCheckoutAddressId] = useState<string | null>(null);
  const checkoutAddressIdRef = useRef<string | null>(null);
  const previewVoucherRef = useRef<string | null>(null);
  const shouldStopVoiceRef = useRef<boolean>(false);
  const cartItemsRef = useRef<CartItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [personality, setPersonality] = useState("Thân thiện");
  const [user, setUser] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [buttonPos, setButtonPos] = useState({ bottom: 24, right: 24 });
  const [hideUntil, setHideUntil] = useState<number | null>(null);
  const [showHideModal, setShowHideModal] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number, b: number, r: number } | null>(null);
  // --- VOICE MODE STATES ---
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceState, _setVoiceState] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const voiceStateRef = useRef(voiceState);

  const setVoiceState = (state: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING') => {
    voiceStateRef.current = state;
    _setVoiceState(state);
  };
  const [audioLevel, setAudioLevel] = useState(0);

  // Audio & Socket refs
  const [sharedLocationIds, setSharedLocationIds] = useState<string[]>([]);
  const [loadingLocationIds, setLoadingLocationIds] = useState<string[]>([]);
  const [hasSharedLocationSession, setHasSharedLocationSession] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Playback queue
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const speakChunksRef = useRef(0);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Silence detection
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenInTurnRef = useRef<boolean>(false);
  const silenceTimeoutMs = 3000; // 3 seconds of silence -> commit turn

  useEffect(() => {
    const savedPersonality = localStorage.getItem('avora_chat_personality');
    if (savedPersonality) setPersonality(savedPersonality);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { addToCart, currentBranchId, cartItems, getCartItemTotal, clearCart, removeFromCart, updateQuantity } = useCart();
  const cartTotal = cartItems.reduce((sum: number, item: any) => sum + getCartItemTotal(item), 0);
  const cartSummary = cartItems.length > 0
    ? "Giỏ hàng hiện tại: " + cartItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')
    : "Giỏ hàng trống";

  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Load session from API auth
  useEffect(() => {
    const fetchGlobalTopProducts = () => {
      fetch(`${API_URL}/api/home`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
        .then(r => r.json())
        .then(data => {
          if (data && data.bestSellers) {
            let products = [...(data.bestSellers || []), ...(data.aiRecommended || [])];
            
            // Remove duplicates
            products = products.filter((p, index, self) => 
              index === self.findIndex((t) => t.id === p.id)
            );

            // Sort: Flash sale first, then random
            products.sort((a, b) => {
              const aHasFlashSale = a.flashSale ? 1 : 0;
              const bHasFlashSale = b.flashSale ? 1 : 0;
              if (aHasFlashSale !== bHasFlashSale) {
                return bHasFlashSale - aHasFlashSale;
              }
              return Math.random() - 0.5;
            });

            if (products.length > 0) {
              setTopProducts(products.slice(0, 5).map((p: any) => ({
                id: p.id,
                name: p.name,
                price: p.flashSale ? p.flashSale.salePrice : p.price,
                originalPrice: p.flashSale ? p.price : null,
                img: p.imageUrl || p.images?.[0]?.url || 'https://via.placeholder.com/150',
                flashSale: p.flashSale,
                branches: p.branches,
                optionGroups: p.optionGroups
              })));
            }
          }
        }).catch(() => { });
    };

    fetchGlobalTopProducts();

    fetch(`${API_URL}/api/auth/me`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setUser(data);
        }

        const isLogged = !!data;
        const savedSessionId = localStorage.getItem('avora_chat_session_id');

        if (isLogged) {
          if (savedSessionId) {
            setSessionId(savedSessionId);
            fetch(`${API_URL}/api/chatbot/session/${savedSessionId}`)
              .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
              })
              .then(d => {
                if (d && d.messages) {
                  setMessages(d.messages);
                }
              })
              .catch(err => {
                console.error("Session load error:", err);
                localStorage.removeItem('avora_chat_session_id');
                setSessionId(null);
              });
          }
        } else {
          const guestHistory = localStorage.getItem('avora_chat_guest_history');
          if (guestHistory) {
            try {
              setMessages(JSON.parse(guestHistory));
            } catch (e) {
              console.error("Failed to parse guest history", e);
            }
          }
        }
      })
      .catch(() => { });
  }, [API_URL, pathname]);

  useEffect(() => {
    const hiddenUntil = localStorage.getItem('avora_chat_hidden_until');
    if (hiddenUntil) {
      const ts = parseInt(hiddenUntil, 10);
      if (Date.now() < ts) {
        setHideUntil(ts);
      } else {
        localStorage.removeItem('avora_chat_hidden_until');
      }
    }
  }, []);

  const hideChatbot = (minutes: number) => {
    const hideUntilTime = Date.now() + minutes * 60000;
    localStorage.setItem('avora_chat_hidden_until', hideUntilTime.toString());
    setHideUntil(hideUntilTime);
    setShowHideModal(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, b: buttonPos.bottom, r: buttonPos.right };
    setIsDragging(false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = dragStartRef.current.x - moveEvent.clientX;
      const dy = dragStartRef.current.y - moveEvent.clientY;
      if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        setIsDragging(true);
      }
      let newRight = dragStartRef.current.r + dx;
      let newBottom = dragStartRef.current.b + dy;

      const maxRight = window.innerWidth - 56;
      const maxBottom = window.innerHeight - 56;
      if (newRight < 0) newRight = 0;
      if (newRight > maxRight) newRight = maxRight;
      if (newBottom < 0) newBottom = 0;
      if (newBottom > maxBottom) newBottom = maxBottom;

      setButtonPos({ right: newRight, bottom: newBottom });

      if (moveEvent.clientY < 100) {
        setIsOverDropZone(true);
      } else {
        setIsOverDropZone(false);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (upEvent.clientY < 100) {
        setShowHideModal(true);
        setIsOverDropZone(false);
      }
      setTimeout(() => setIsDragging(false), 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };


  // Load session location status - only persist within the browser tab
  // No longer loading from sessionStorage to avoid stale "Đã ghi nhận" showing on new requests

  // Save guest history
  useEffect(() => {
    if (!user) {
      if (messages.length > 0) {
        localStorage.setItem('avora_chat_guest_history', JSON.stringify(messages));
      } else {
        localStorage.removeItem('avora_chat_guest_history');
      }
    }
  }, [messages, user]);

  // Voice Mode Cleanup
  useEffect(() => {
    return () => {
      stopVoiceMode();
    };
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Text-to-speech effect
  useEffect(() => {
    if (isAudioEnabled && messages.length > 0 && !isVoiceMode) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderType === 'AI' && lastMsg.content && !isLoading) {
        window.speechSynthesis.cancel(); // clear queue
        const utterance = new SpeechSynthesisUtterance(lastMsg.content);
        utterance.lang = 'vi-VN';
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [messages, isAudioEnabled, isLoading, isVoiceMode]);

  const stopVoiceMode = () => {
    setIsVoiceMode(false);
    setVoiceState('IDLE');
    setAudioLevel(0);

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackSourceRef.current) {
      playbackSourceRef.current.stop();
      playbackSourceRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    silenceStartRef.current = null;
  };

  const playNextAudioChunk = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (voiceStateRef.current === 'SPEAKING') {
        setVoiceState('LISTENING');
      }
      if (shouldStopVoiceRef.current) {
        stopVoiceMode();
        shouldStopVoiceRef.current = false;
      }
      return;
    }

    isPlayingRef.current = true;
    setVoiceState('SPEAKING');

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(err => console.error("Could not resume AudioContext", err));
    }

    const pcmData = audioQueueRef.current.shift()!;
    console.log(`[AudioPlayback] Playing audio chunk`);

    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, pcmData.length, 24000); // Gemini output is usually 24kHz
    audioBuffer.getChannelData(0).set(pcmData);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currTime = ctx.currentTime;
    const startTime = Math.max(currTime, nextPlayTimeRef.current);
    source.start(startTime);

    nextPlayTimeRef.current = startTime + audioBuffer.duration;
    playbackSourceRef.current = source;

    source.onended = () => {
      playNextAudioChunk();
    };
  };

  const startVoiceMode = async () => {
    try {
      const authCookie = document.cookie.split(';').find(c => c.trim().startsWith('token='));
      console.log(`[VoiceAuth] Token exists: ${!!authCookie}`);
      console.log(`[VoiceAuth] Token length: ${authCookie ? authCookie.length : 0}`);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setIsVoiceMode(true);
      setVoiceState('LISTENING');

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
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
      processor.connect(ctx.destination); // Required for script processor to work

      let audioChunkCount = 0;
      processor.onaudioprocess = (e) => {
        audioChunkCount++;
        if (audioChunkCount % 10 === 0) {
          console.log(`[AudioCapture] Processed ${audioChunkCount} chunks, voiceState: ${voiceStateRef.current}`);
        }

        const inputData = e.inputBuffer.getChannelData(0);

        let sumSquare = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquare += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquare / inputData.length);
        const level = Math.min(100, Math.floor(rms * 1000));
        setAudioLevel(level);

        // Increase threshold when AI is playing to avoid echo triggering barge-in
        const threshold = isPlayingRef.current ? 40 : 15;
        const isSpeaking = level > threshold;

        if (isSpeaking) {
          hasSpokenInTurnRef.current = true;
          speakChunksRef.current += 1;
          silenceStartRef.current = null;

          // Barge-in: If AI is speaking, interrupt it ONLY if user speaks continuously for > 3 chunks (~300ms)
          if (isPlayingRef.current && speakChunksRef.current > 3) {
            if (playbackSourceRef.current) playbackSourceRef.current.stop();
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            console.log("[Barge-in] Interrupting AI playback");
            socketRef.current?.emit('client_content', { turnComplete: false }); // Interrupt
            setVoiceState('LISTENING');
          }
        } else {
          speakChunksRef.current = 0;
          if (hasSpokenInTurnRef.current) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > silenceTimeoutMs && voiceStateRef.current === 'LISTENING') {
              // Silence detected -> Trigger Thinking
              console.log("[Silence Detected] Committing turn");
              setVoiceState('THINKING');
              socketRef.current?.emit('client_content', { turnComplete: true });
              silenceStartRef.current = null;
              hasSpokenInTurnRef.current = false;
            }
          }
        }

        // Send Audio to Server
        if (voiceStateRef.current === 'LISTENING' || voiceStateRef.current === 'THINKING') {
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          const buffer = new Uint8Array(pcm16.buffer);
          let binary = '';
          for (let i = 0; i < buffer.byteLength; i++) {
            binary += String.fromCharCode(buffer[i]);
          }
          const base64 = btoa(binary);
          if (audioChunkCount % 10 === 0) {
            console.log(`[VoiceWS] Sending audio chunk: ${base64.length} bytes base64`);
          }
          socketRef.current?.emit('audio_input', base64);
        }
      };

      const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:3001';

      const socket = io(`${socketUrl}/voice-chat`, {
        withCredentials: true,
        query: { cartSummary: encodeURIComponent(cartSummary) }
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Voice Socket connected');
      });

      socket.on('connect_error', (err) => {
        console.error('Voice Socket connect_error:', err);
        toast.error("Lỗi kết nối Voice Server.");
        stopVoiceMode();
      });

      socket.on('error', (err) => {
        console.error('Voice Socket explicit error:', err);
        if (err === 'auth_failed') {
          toast.error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
        } else {
          toast.error(`Lỗi Voice: ${err}`);
        }
        stopVoiceMode();
      });

      socket.on('disconnect', (reason) => {
        console.log('Voice Socket disconnected:', reason);
        // Only stop, do not toast here since we have explicit error handling now
        stopVoiceMode();
      });

      socket.on('audio_output', (base64Data: string) => {
        console.log(`[VoiceWS] Received audio_output: ${base64Data.length} bytes base64`);
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }
        audioQueueRef.current.push(float32);
        if (!isPlayingRef.current) {
          nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
          playNextAudioChunk();
        }
      });

      socket.on('tool_call', (data) => {
        setVoiceState('THINKING');
      });

      socket.on('turn_complete', () => {
        if (voiceStateRef.current !== 'SPEAKING') {
          setVoiceState('LISTENING');
        }
      });

      socket.on('rich_action', (data) => {
        const tempMsg: ChatMessage = {
          id: `voice-${Date.now()}`,
          sessionId: sessionId || "temp-session",
          senderType: "AI",
          content: data.content || "", // Audio plays content
          actionType: data.actionType,
          actionPayload: data.actionPayload,
          createdAt: new Date().toISOString(),
          suggestedReplies: data.suggestedReplies || undefined
        };
        setMessages(prev => [...prev, tempMsg]);
        if (data.actionType === 'STOP_VOICE') {
          shouldStopVoiceRef.current = true;
          // Failsafe in case queue is empty and audio doesn't play
          setTimeout(() => {
            if (shouldStopVoiceRef.current) {
              stopVoiceMode();
              shouldStopVoiceRef.current = false;
            }
          }, 3000);
        } else if (data.actionType === 'ADD_TO_CART' && data.actionPayload) {
          handleAddToCart(data.actionPayload, tempMsg.id);
        } else if (data.actionType === 'UPDATE_CART' && data.actionPayload) {
          handleUpdateCart(data.actionPayload, tempMsg.id);
        } else if (data.actionType === 'ADD_ALL_TO_CART' && data.actionPayload) {
          handleAddAllToCart(data.actionPayload, tempMsg.id);
        } else if (data.actionType === 'NAVIGATE' && data.actionPayload) {
          handleNavigate(data.actionPayload);
        } else if (data.actionType === 'ORDER_PREVIEW' && data.actionPayload) {
          const payload = JSON.parse(data.actionPayload);
          handleOrderPreview(payload.addressId, tempMsg.id);
        } else if (data.actionType === 'PLACE_ORDER' && data.actionPayload) {
          const payload = JSON.parse(data.actionPayload);
          handlePlaceOrder(payload.idempotencyKey);
        } else if (data.actionType === 'SUGGEST_VOUCHER') {
          handleSuggestVoucher();
        }
      });

    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Không thể truy cập Microphone.");
      stopVoiceMode();
    }
  };

  const toggleVoiceMode = () => {
    if (!user) {
      const sysMsg: ChatMessage = {
        id: `sys-voice-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "SYSTEM",
        content: "Khách hàng thành viên vui lòng đăng nhập/ đăng ký để sử dụng tính năng Trò chuyện bằng Giọng nói nhé!",
        actionType: 'PROMPT_LOGIN' as any,
        actionPayload: null,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, sysMsg]);
      return;
    }

    if (isVoiceMode) {
      stopVoiceMode();
    } else {
      startVoiceMode();
    }
  };

  const handleDeleteHistory = async () => {
    setIsActionMenuOpen(false);
    if (sessionId && user) {
      try {
        await fetch(`${API_URL}/api/chatbot/session/${sessionId}`, { method: 'DELETE' });
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('avora_chat_session_id');
    localStorage.removeItem('avora_chat_guest_history');
    setSessionId(null);
    setMessages([]);
    toast.success("Đã xóa lịch sử trò chuyện");
  };
  const handleSuggestVoucher = async () => {
    try {
      const res = await fetch(`${API_URL}/api/promotions/vouchers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ userId: user?.id })
      });
      const vouchers = await res.json();
      const validVouchers = vouchers.filter((v: any) => v.minOrderValue <= cartTotal);
      if (validVouchers.length > 0) {
        // Pick the one with the highest nominal discount for simplicity, or just the first
        const best = validVouchers[0];
        previewVoucherRef.current = best.code;
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sessionId: sessionId || "temp-session",
          senderType: "AI",
          content: `Hệ thống tìm thấy voucher ${best.code} giảm giá tốt nhất cho đơn hàng của bạn. Bạn có muốn áp dụng mã này không, hay bạn muốn nhập mã khác?`,
          actionType: null,
          actionPayload: null,
          createdAt: new Date().toISOString(),
          suggestedReplies: ["Dùng voucher này", "Nhập mã khác", "Không dùng voucher"]
        }]);
      } else {
        previewVoucherRef.current = null;
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sessionId: sessionId || "temp-session",
          senderType: "AI",
          content: `Hiện không có voucher nào phù hợp. Bạn có muốn nhập mã voucher của riêng bạn không?`,
          actionType: null,
          actionPayload: null,
          createdAt: new Date().toISOString(),
          suggestedReplies: ["Nhập mã khác", "Không dùng voucher"]
        }]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOrderPreview = async (addressId: string, voucherCode: string | null) => {
    if (!cartItemsRef.current || cartItemsRef.current.length === 0) {
      toast.error('Giỏ hàng của bạn đang trống! Vui lòng thêm món trước khi chốt đơn.');
      setIsLoading(false);
      return;
    }

    setCheckoutAddressId(addressId);
    checkoutAddressIdRef.current = addressId;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ addressId, cartItems: cartItemsRef.current, voucherCode })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Preview error: ${errorText}`);
      }
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "AI",
        content: "",
        actionType: 'SHOW_BEAUTIFUL_ORDER',
        actionPayload: JSON.stringify(data),
        createdAt: new Date().toISOString(),
        suggestedReplies: ["Xác nhận đặt", "Hủy"]
      }]);
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi khi tạo bản xem trước đơn hàng');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceOrder = async (idempotencyKey: string) => {
    const currentAddressId = checkoutAddressIdRef.current || checkoutAddressId;
    if (!currentAddressId) {
      toast.error('Không tìm thấy thông tin địa chỉ giao hàng. Vui lòng bắt đầu lại quá trình chốt đơn.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'x-idempotency-key': idempotencyKey
        },
        credentials: 'include',
        body: JSON.stringify({ addressId: currentAddressId, branchId: currentBranchId, cartItems: cartItemsRef.current, paymentMethod: 'COD', voucherCode: previewVoucherRef.current })
      });
      if (!res.ok) throw new Error('Order error');
      const data = await res.json();

      const formattedTotal = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.totalAmount || cartTotal);
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "AI",
        content: `Đơn hàng ${data.orderCode} của ${user?.fullName || "bạn"} tổng tiền ${formattedTotal} đã được đặt thành công! Chúng tôi sẽ sớm xác nhận và chuẩn bị đơn hàng thật chu đáo. Chúc quý khách ăn ngon miệng và đừng quên ghé Avora thường xuyên nhé!`,
        actionType: 'SHOW_ORDER_SUCCESS' as any,
        actionPayload: JSON.stringify({ orderCode: data.orderCode }),
        createdAt: new Date().toISOString()
      }]);

      clearCart();
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi khi đặt hàng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    let textToSend = overrideText || inputValue.trim();
    if (!textToSend) return;

    if (textToSend === "Nhập mã khác") {
      setMessages(prev => prev.map(m => m.suggestedReplies ? { ...m, suggestedReplies: undefined } : m));
      setMessages(prev => [...prev, {
        id: `sys-input-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "SYSTEM",
        content: "",
        actionType: 'PROMPT_VOUCHER_INPUT',
        actionPayload: null,
        createdAt: new Date().toISOString(),
      }]);
      return;
    }

    if (textToSend === "Dùng voucher này" && previewVoucherRef.current) {
      textToSend = `Tôi đồng ý dùng voucher ${previewVoucherRef.current}`;
    }

    if (textToSend === "Tiếp tục không dùng voucher" || textToSend === "Không dùng voucher") {
      textToSend = `Tôi không dùng voucher, hãy tiếp tục`;
    }

    // Nếu đang ở chế độ Voice, gửi thẳng qua WebSocket thay vì API REST
    if (isVoiceMode && socketRef.current) {
      setMessages(prev => prev.map(m => m.suggestedReplies ? { ...m, suggestedReplies: undefined } : m));
      setMessages(prev => [...prev, {
        id: `temp-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "USER",
        content: textToSend,
        actionType: null,
        actionPayload: null,
        createdAt: new Date().toISOString(),
      }]);
      if (!overrideText) setInputValue("");

      socketRef.current.emit('client_content', {
        turns: [{ role: 'user', parts: [{ text: textToSend }] }],
        turnComplete: true
      });
      return;
    }

    // Cart validation before checkout
    const checkoutKeywords = ['chốt đơn', 'thanh toán', 'mua hàng', 'chốt đơn hàng', 'buy', 'checkout', 'đặt hàng', 'order now'];
    const isCheckoutIntent = checkoutKeywords.some(k => textToSend.toLowerCase().includes(k));
    if (isCheckoutIntent && cartItems.length === 0) {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "AI",
        content: "Giỏ hàng của bạn đang trống! Vui lòng thêm món ăn vào giỏ hàng trước khi chốt đơn nhé.",
        actionType: null,
        actionPayload: null,
        createdAt: new Date().toISOString(),
        suggestedReplies: ["Xem thực đơn", "Gợi ý món người khác hay gọi"]
      }]);
      return;
    }

    setMessages(prev => prev.map(m => m.suggestedReplies ? { ...m, suggestedReplies: undefined } : m));

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
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
      let currentUserId = user?.id;

      // Double check auth status just in case component state is stale after login
      if (!currentUserId) {
        try {
          const authRes = await fetch(`${API_URL}/api/auth/me`, {
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            if (authData && authData.id) {
              currentUserId = authData.id;
              setUser(authData);
            }
          }
        } catch (e) {
          console.error("Failed to verify auth state before chatting", e);
        }
      }

      const res = await fetch(`${API_URL}/api/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          userId: currentUserId,
          message: tempMessage.content,
          branchId: currentBranchId || undefined,
          history: !currentUserId ? messages : undefined,
          personality,
          cartTotal,
          cartSummary,
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Chat API Error:', {
          status: res.status,
          text: errorText
        });

        let errorMessage = 'Failed to send message';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || `API Error ${res.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('avora_chat_session_id', data.sessionId);
      }

      if (data.sessionMessages) {
        setMessages(data.sessionMessages);
        const lastMsg = data.sessionMessages[data.sessionMessages.length - 1];
        if (lastMsg && lastMsg.actionType === 'ADD_TO_CART' && lastMsg.actionPayload) {
          handleAddToCart(lastMsg.actionPayload, lastMsg.id);
        } else if (lastMsg && lastMsg.actionType === 'NAVIGATE' && lastMsg.actionPayload) {
          handleNavigate(lastMsg.actionPayload);
        } else if (lastMsg && lastMsg.actionType === 'ORDER_PREVIEW' && lastMsg.actionPayload) {
          const payload = JSON.parse(lastMsg.actionPayload);
          handleOrderPreview(payload.addressId, lastMsg.id);
        } else if (lastMsg && lastMsg.actionType === 'PLACE_ORDER' && lastMsg.actionPayload) {
          const payload = JSON.parse(lastMsg.actionPayload);
          handlePlaceOrder(payload.idempotencyKey);
        }
      } else {
        setMessages(prev => [...prev.filter(m => m.id !== tempMessage.id), tempMessage, data]);
        if (data.actionType === 'ADD_TO_CART' && data.actionPayload) {
          handleAddToCart(data.actionPayload, data.id);
        } else if (data.actionType === 'UPDATE_CART' && data.actionPayload) {
          handleUpdateCart(data.actionPayload, data.id);
        } else if (data.actionType === 'NAVIGATE' && data.actionPayload) {
          handleNavigate(data.actionPayload);
        } else if (data.actionType === 'ORDER_PREVIEW' && data.actionPayload) {
          const payload = JSON.parse(data.actionPayload);
          handleOrderPreview(payload.addressId, data.id);
        } else if (data.actionType === 'PLACE_ORDER' && data.actionPayload) {
          const payload = JSON.parse(data.actionPayload);
          handlePlaceOrder(payload.idempotencyKey);
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMessage.id),
        tempMessage,
        {
          id: `error-${Date.now()}`,
          sessionId: sessionId || "temp-session",
          senderType: "SYSTEM",
          content: error.message || "Đã có lỗi xảy ra",
          actionType: null,
          actionPayload: null,
          createdAt: new Date().toISOString(),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  function handleNavigate(payloadStr: string) {
    try {
      const payload = JSON.parse(payloadStr);
      let url = null;
      if (payload.destination === 'CART') url = '/cart';
      else if (payload.destination === 'ORDER_DETAILS' && payload.orderCode) url = `/orders/${payload.orderCode}`;

      if (!url) return;

      toast.success('Đang tự động chuyển hướng...');
      setTimeout(() => {
        setIsOpen(false);
        router.push(url);
      }, 1500);
    } catch (e) {
      console.error('Lỗi chuyển hướng', e);
    }
  };

  const handleAddToCart = async (payloadStr: string, msgId: string) => {
    try {
      const payload = JSON.parse(payloadStr);
      let { productId, quantity } = payload;

      let url = `${API_URL}/api/products/by-id/${productId}`;
      if (currentBranchId) {
        url += `?branchId=${currentBranchId}`;
      }
      const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });

      if (res.ok) {
        const product = await res.json();
        addToCart({
          id: product.id,
          productId: product.id,
          name: product.name,
          originalPriceAtSale: product.price,
          priceAtSale: product.price,
          quantity: quantity || 1,
          imageUrl: product.imageUrl || product.images?.[0]?.url || undefined,
          rawProduct: product
        }, currentBranchId || product.branchId || "BR-001");
      } else {
        toast.error('Không tìm thấy thông tin món ăn');
      }
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi xảy ra khi thêm vào giỏ hàng');
    }
  };

  const handleUpdateCart = (payloadStr: string, msgId: string) => {
    try {
      const { productName, quantity } = JSON.parse(payloadStr);
      if (!productName) return;
      const itemsToUpdate = cartItems.filter((item: any) => item.name.toLowerCase().includes(productName.toLowerCase()));

      if (itemsToUpdate.length > 0) {
        // Chỉ cập nhật món đầu tiên tìm thấy trong giỏ hàng
        const targetItem = itemsToUpdate[0];
        if (quantity === 0) {
          removeFromCart(targetItem.id);
          toast.success(`Đã xóa ${targetItem.name} khỏi giỏ hàng`);
        } else {
          updateQuantity(targetItem.id, quantity);
          toast.success(`Đã cập nhật số lượng ${targetItem.name} thành ${quantity}`);
        }
      } else {
        toast.error(`Không tìm thấy món "${productName}" trong giỏ hàng`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  async function handleAddAllToCart(payloadStr: string, messageId: string) {
    if (isAddingAll) return;
    setIsAddingAll(true);
    const toastId = toast.loading("Đang thêm các món vào giỏ...");
    try {
      const payload = JSON.parse(payloadStr);
      const products = payload && !Array.isArray(payload) ? payload.products : payload;
      if (!products || products.length === 0) {
        toast.dismiss(toastId);
        return;
      }

      const addedItems: { name: string; quantity: number; price: number }[] = [];
      for (const p of products) {
        let url = `${API_URL}/api/products/by-id/${p.id}`;
        if (currentBranchId) {
          url += `?branchId=${currentBranchId}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const product = await res.json();
          const qty = p.quantity || 1;
          const item: CartItem = {
            id: product.id,
            productId: product.id,
            name: product.name,
            originalPriceAtSale: product.price,
            priceAtSale: product.price,
            quantity: qty,
            imageUrl: product.imageUrl || product.images?.[0] || undefined,
            rawProduct: product
          };
          const added = addToCart(item, currentBranchId || product.branchId || "");
          addedItems.push({ name: product.name, quantity: qty, price: product.price });
        }
      }

      const addedCount = addedItems.length;
      const grandTotal = addedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
      const itemLines = addedItems.map(i => `${i.name} x ${i.quantity}`).join('\n');
      const summaryContent = `Đã thêm ${addedCount} món được gợi ý vào giỏ hàng thành công gồm:\n${itemLines}\nTổng tiền giỏ hàng ${formatter.format(grandTotal)}`;

      toast.success(`Đã thêm ${addedCount} món vào giỏ hàng!`, { id: toastId });

      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "SYSTEM",
        content: summaryContent,
        actionType: 'ADD_ALL_SUMMARY' as any,
        actionPayload: JSON.stringify({ cartUrl: '/cart' }),
        createdAt: new Date().toISOString()
      }]);
    } catch (err: any) {
      console.error("Add all error:", err);
      toast.error("Có lỗi khi thêm tất cả món vào giỏ.", { id: toastId });
    } finally {
      setIsAddingAll(false);
    }
  };

  function handleCheckCart() {
    const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
    if (cartItems.length === 0) {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        sessionId: sessionId || "temp-session",
        senderType: "SYSTEM",
        content: "Giỏ hàng của bạn hiện đang trống. Hãy thêm món để tiếp tục nhé!",
        actionType: null,
        actionPayload: null,
        createdAt: new Date().toISOString()
      }]);
      return;
    }
    const total = cartItems.reduce((sum: number, item: any) => sum + getCartItemTotal(item), 0);
    const itemLines = cartItems.map((item: any) => `• ${item.name} x${item.quantity} — ${formatter.format(item.priceAtSale * item.quantity)}`).join('\n');
    const summaryContent = `Giỏ hàng hiện tại (${cartItems.length} món):\n${itemLines}\n\nTổng tiền: ${formatter.format(total)}`;
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      sessionId: sessionId || "temp-session",
      senderType: "SYSTEM",
      content: summaryContent,
      actionType: 'CART_SUMMARY' as any,
      actionPayload: JSON.stringify({ cartUrl: '/cart' }),
      createdAt: new Date().toISOString()
    }]);
  };

  const displayMessages = messages.filter(m =>
    (m.senderType === 'USER' && !m.content?.startsWith('[HỆ THỐNG:')) ||
    m.senderType === 'AI' ||
    m.senderType === 'SYSTEM'
  );

  if (hideUntil && Date.now() < hideUntil) {
    return null;
  }

  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {isDragging && (
        <div className={`fixed top-0 left-0 right-0 h-[100px] bg-gradient-to-b from-red-600/20 to-transparent z-[9998] flex items-start justify-center pt-4 transition-all duration-300 ${isOverDropZone ? 'from-red-600/40' : ''}`}>
          <div className={`bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-transform duration-300 ${isOverDropZone ? 'scale-110 shadow-red-600/50' : 'scale-100'}`}>
            Thả để ẩn!
          </div>
        </div>
      )}

      {showHideModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-[320px] max-w-[90vw] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center self-center mb-2">
              <Bot size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800 text-center mb-2">Bạn muốn ẩn Avora trong bao lâu?</h3>
            <button onClick={() => hideChatbot(10)} className="w-full py-3 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold rounded-2xl transition-colors border border-slate-100 hover:border-red-200">10 phút</button>
            <button onClick={() => hideChatbot(30)} className="w-full py-3 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold rounded-2xl transition-colors border border-slate-100 hover:border-red-200">30 phút</button>
            <button onClick={() => hideChatbot(12 * 60)} className="w-full py-3 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold rounded-2xl transition-colors border border-slate-100 hover:border-red-200">12 giờ</button>
            <button onClick={() => {
              const now = new Date();
              const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
              hideChatbot((eod.getTime() - now.getTime()) / 60000);
            }} className="w-full py-3 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold rounded-2xl transition-colors border border-slate-100 hover:border-red-200">Hôm nay</button>
            <button onClick={() => {
              setShowHideModal(false);
              setButtonPos({ bottom: 24, right: 24 });
            }} className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-600/20">Hủy</button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => {
          if (!isDragging) setIsOpen(!isOpen);
        }}
        onPointerDown={handlePointerDown}
        style={{ bottom: `${buttonPos.bottom}px`, right: `${buttonPos.right}px`, touchAction: 'none' }}
        className={`fixed z-[9999] flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-red-600 to-red-500 text-white shadow-xl hover:shadow-red-500/50 ${!isDragging ? 'hover:-translate-y-1 transition-all duration-300 cursor-pointer' : 'cursor-grabbing hover:-translate-y-0 duration-0 transition-none'} ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <div className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-20"></div>
        <img src="/avt_chatbot.gif" alt="AvoBOT" className="relative z-10 w-12 h-12 rounded-full object-cover shadow-lg border border-white/20 pointer-events-none" />
      </button>

      <div
        className={`fixed z-[10000] flex flex-col bg-slate-50/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(220,38,38,0.15)] overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'} ${isExpanded ? 'inset-0 w-full h-[100dvh] rounded-none border-none' : 'bottom-[80px] sm:bottom-6 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[380px] h-[75dvh] sm:h-[600px] max-h-[calc(100dvh-100px)] sm:max-h-[calc(100dvh-6rem)] rounded-3xl border border-white/60'}`}
      >
        {/* Header / Voice Overlay */}
        {!isVoiceMode ? (
          <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-red-600 to-red-700 text-white shrink-0 shadow-lg relative overflow-hidden rounded-b-xl z-10">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black opacity-10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>

            <div className="flex items-center gap-2.5 relative z-10">
              <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full shadow-md p-0.5 border-2 border-red-500/50">
                <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-[14px] sm:text-[15px] tracking-wide flex items-center gap-1.5">
                  AvoBOT 
                  {user && (
                    <div className="relative inline-flex ml-0.5 group">
                      <div className="absolute transition-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#FFD700] rounded-md blur-sm group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-pulse"></div>
                      <span className="relative inline-flex items-center justify-center px-1.5 py-0.5 bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#996515] rounded-md text-[10px] uppercase tracking-widest font-black text-amber-950 border border-yellow-300 shadow-sm overflow-hidden">
                        <Sparkles size={10} className="mr-0.5 text-amber-900 mb-[1px]" />
                        <span>PRO</span>
                        {/* Hiệu ứng ánh kim quét lên trên chữ */}
                        <div className="absolute top-0 -left-[100%] h-full w-full z-20 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white to-transparent opacity-60 animate-shine pointer-events-none" />
                      </span>
                    </div>
                  )}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-red-100 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse"></span> Luôn sẵn sàng hỗ trợ
                </p>
              </div>
            </div>
            <div className="flex gap-1 relative z-10">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-7 h-7 sm:w-8 sm:h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
                title="Toàn màn hình"
              >
                <Maximize2 size={14} className="text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <X size={18} className="text-white" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-top duration-500 shadow-2xl relative overflow-hidden shrink-0 rounded-t-3xl">
            {/* Animated Background Waves */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className={`absolute -inset-1/2 bg-gradient-to-tr from-red-500 to-fuchsia-500 rounded-full mix-blend-screen filter blur-3xl transition-transform duration-1000 ${voiceState === 'LISTENING' ? 'scale-110 opacity-40 animate-pulse' : (voiceState === 'SPEAKING' ? 'scale-100 opacity-30' : 'scale-90 opacity-10')}`}></div>
            </div>

            {/* Visualizer Circle */}
            <div className="relative w-10 h-10 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-red-500 blur-lg transition-all duration-75 ease-out"
                style={{
                  opacity: voiceState === 'LISTENING' ? Math.min(1, 0.3 + (audioLevel / 50)) : (voiceState === 'SPEAKING' ? 0.8 : 0.2),
                  transform: `scale(${1 + (audioLevel / 80)})`,
                }}
              ></div>

              <div className={`relative z-10 w-full h-full rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-colors duration-500 border border-white/10 ${voiceState === 'LISTENING' ? 'bg-gradient-to-br from-red-500 to-rose-600' : (voiceState === 'THINKING' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : (voiceState === 'SPEAKING' ? 'bg-gradient-to-br from-emerald-400 to-green-600' : 'bg-slate-700'))}`}>
                {voiceState === 'THINKING' ? (
                  <Loader2 size={18} className="animate-spin sm:w-[24px] sm:h-[24px]" />
                ) : voiceState === 'SPEAKING' ? (
                  <Activity size={18} className="animate-pulse sm:w-[24px] sm:h-[24px]" />
                ) : (
                  <Mic size={18} className={`sm:w-[24px] sm:h-[24px] ${audioLevel > 10 ? 'animate-bounce' : ''}`} />
                )}
              </div>
            </div>

            <div className="flex-1 relative z-10 min-w-0">
              <h3 className="font-bold text-white text-[13px] sm:text-[15px] tracking-wide flex items-center gap-1.5 truncate">
                {voiceState === 'LISTENING' ? "Avora đang nghe..." : (voiceState === 'THINKING' ? "Đang xử lý..." : (voiceState === 'SPEAKING' ? "Avora đang trả lời..." : "Sẵn sàng"))}
                {voiceState === 'LISTENING' && <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 relative shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-full w-full bg-red-500"></span></span>}
              </h3>
              <p className="text-slate-300 text-[10px] sm:text-xs font-medium flex items-center gap-1 mt-0.5 truncate">
                <Sparkles size={10} className="text-amber-400 shrink-0" /> {voiceState === 'LISTENING' ? "Hãy nói điều gì đó..." : "Trợ lý AI Giọng nói"}
              </p>
            </div>

            {voiceState === 'SPEAKING' && (
              <button
                onClick={() => {
                  if (playbackSourceRef.current) playbackSourceRef.current.stop();
                  audioQueueRef.current = [];
                  isPlayingRef.current = false;
                  socketRef.current?.emit('client_content', { turnComplete: false });
                  setVoiceState('LISTENING');
                }}
                className="relative z-10 px-2 py-1.5 sm:px-3 sm:py-1.5 mr-0.5 sm:mr-1 bg-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/30 rounded-lg text-[10px] sm:text-xs font-bold transition-all border border-red-500/30 flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <MicOff size={12} className="sm:w-[14px] sm:h-[14px]" /> Ngắt lời
              </button>
            )}

            <button
              onClick={stopVoiceMode}
              className="relative z-10 p-1.5 sm:p-2.5 bg-white/10 text-white/70 hover:text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-full transition-all duration-300 backdrop-blur-sm shrink-0"
            >
              <X size={16} className="sm:w-[20px] sm:h-[20px]" />
            </button>
          </div>
        )}

        {/* Message Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 relative">

          {/* Welcome Message & Empty State UI */}
          {displayMessages.length === 0 && (
            <div className="flex flex-col gap-5 sm:gap-6 w-full animate-in fade-in duration-500 pb-4">

              {/* Greeting Card */}
              <div className="flex gap-3 justify-start items-start">
                <div className="w-10 h-10 rounded-full bg-white shadow-lg p-0.5 shrink-0 mt-2 z-10 border border-slate-100">
                  <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
                </div>
                <div className="bg-white border border-slate-100 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] text-slate-800 p-4 rounded-3xl rounded-tl-sm w-full -ml-1">
                  <div className="text-[15px] font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    Xin chào! <Smile size={18} className="inline text-amber-500 mb-0.5" /> Tôi là <span className="text-red-600">AvoBOT</span>
                  </div>
                  <div className="text-[13.5px] leading-relaxed text-slate-600">
                    Tôi có thể giúp bạn chọn món, tìm món phù hợp và hỗ trợ đặt hàng. Bạn muốn dùng gì hôm nay?
                  </div>
                </div>
              </div>

              {/* Personality / Quick Help */}
              <div className="bg-white border border-slate-100 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.03)] rounded-3xl p-4 w-full">
                <h4 className="font-bold text-[14px] text-slate-700 mb-3">Bạn cần hỗ trợ về điều gì?</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setPersonality("Chuyên nghiệp"); handleSendMessage("Hãy gợi ý cho tôi vài món ngon nhé."); }} className="flex items-center gap-2 p-2 bg-white border border-slate-100 hover:border-red-200 hover:shadow-md rounded-xl transition-all text-left group">
                    <div className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Salad size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] text-slate-800 leading-tight">Gợi ý món</div>
                    </div>
                  </button>
                  <button onClick={() => { setPersonality("Thân thiện"); handleSendMessage("Chào bạn, bạn có thể tâm sự cùng tôi không?"); }} className="flex items-center gap-2 p-2 bg-white border border-slate-100 hover:border-purple-200 hover:shadow-md rounded-xl transition-all text-left group">
                    <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <HeartHandshake size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] text-slate-800 leading-tight">Thân thiện</div>
                    </div>
                  </button>
                  <button onClick={() => { setPersonality("Hài hước"); handleSendMessage("Kể một câu chuyện vui về đồ ăn đi!"); }} className="flex items-center gap-2 p-2 bg-white border border-slate-100 hover:border-orange-200 hover:shadow-md rounded-xl transition-all text-left group">
                    <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Smile size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] text-slate-800 leading-tight">Hài hước</div>
                    </div>
                  </button>
                  <button onClick={() => { setPersonality("Nhanh gọn"); handleSendMessage("Tôi muốn đặt món nhanh, bạn giúp tôi nhé."); }} className="flex items-center gap-2 p-2 bg-white border border-slate-100 hover:border-green-200 hover:shadow-md rounded-xl transition-all text-left group">
                    <div className="w-7 h-7 rounded-full bg-green-50 text-green-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Zap size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] text-slate-800 leading-tight">Nhanh gọn</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Suggestions */}
              <div className="w-full">
                {user ? (
                  <>
                    <h4 className="font-bold text-[14px] text-red-600 mb-3 flex items-center gap-1.5"><Sparkles size={16} /> Gợi ý cho bạn</h4>
                    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 w-[calc(100%+2rem)]">
                      {topProducts
                        .filter(p => !currentBranchId || !p.branches || p.branches.length === 0 || p.branches.some((b: any) => b.id === currentBranchId))
                        .map((p, idx) => (
                        <div key={idx} className="min-w-[150px] w-[150px] bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow snap-start shrink-0 flex flex-col">
                          <div className="w-full h-28 bg-slate-100 relative cursor-pointer" onClick={() => handleSendMessage(`Tôi muốn mua ${p.name}`)}>
                            <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                            {p.flashSale && (
                              <div className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                                <Flame size={10} /> Flash Sale
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 flex-1 flex flex-col">
                            <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug mb-1 min-h-[32px] cursor-pointer" onClick={() => handleSendMessage(`Tôi muốn mua ${p.name}`)}>{p.name}</h4>
                            <div className="flex items-center gap-1.5 mt-auto mb-2.5 flex-wrap">
                              <span className="text-red-600 font-bold text-sm">
                                {p.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price) : 'Liên hệ'}
                              </span>
                              {p.originalPrice && p.originalPrice > p.price && (
                                <span className="text-slate-400 text-[10px] line-through font-medium">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.originalPrice)}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleAddToCart(JSON.stringify({ productId: p.id, quantity: 1 }), 'sugg-' + p.id)}
                              disabled={addingToCartId === 'sugg-' + p.id || isLoading}
                              className="w-full mb-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-70"
                            >
                              {addingToCartId === 'sugg-' + p.id ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                              Thêm vào giỏ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 text-center flex flex-col items-center w-full shadow-sm mt-2">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-3 shadow-sm border border-red-100">
                      <Mic size={24} />
                    </div>
                    <h4 className="font-bold text-[14px] text-slate-800 mb-2">Tính năng nâng cao</h4>
                    <p className="text-[13px] text-slate-600 mb-4 leading-relaxed px-2">
                      Khách hàng thành viên vui lòng đăng nhập/ đăng ký để sử dụng tính năng Trò chuyện bằng Giọng nói nhé!
                    </p>
                    <div className="flex gap-2 w-full">
                      <button onClick={() => window.location.href = '/login'} className="flex-1 py-2.5 bg-white text-slate-700 font-bold text-[13px] rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">Đăng nhập</button>
                      <button onClick={() => window.location.href = '/register'} className="flex-1 py-2.5 bg-red-600 text-white font-bold text-[13px] rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-600/20">Đăng ký</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Action Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 w-[calc(100%+2rem)]">
                <button onClick={() => handleSendMessage("Hiện tại có ưu đãi nào không?")} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-100 hover:border-red-200 text-slate-700 rounded-xl text-[12px] font-semibold whitespace-nowrap shadow-sm hover:shadow-md transition-all shrink-0">
                  <Gift size={14} className="text-red-500" /> Ưu đãi hôm nay
                </button>
                <button onClick={() => handleSendMessage("Tìm chi nhánh gần tôi")} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-100 hover:border-blue-200 text-slate-700 rounded-xl text-[12px] font-semibold whitespace-nowrap shadow-sm hover:shadow-md transition-all shrink-0">
                  <MapPin size={14} className="text-blue-500" /> Chi nhánh gần tôi
                </button>
                <button onClick={() => handleSendMessage("Kiểm tra đơn hàng của tôi")} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-100 hover:border-orange-200 text-slate-700 rounded-xl text-[12px] font-semibold whitespace-nowrap shadow-sm hover:shadow-md transition-all shrink-0">
                  <FileText size={14} className="text-slate-500" /> Đơn hàng của tôi
                </button>
              </div>

            </div>
          )}

          {displayMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 sm:gap-3 ${msg.senderType === 'USER' ? 'flex-row-reverse' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>

              {/* Avatar */}
              {!!msg.content && (
                <div className="shrink-0 pt-1 hidden sm:block">
                  {msg.senderType === 'USER' ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                      <UserCircle size={18} />
                    </div>
                  ) : msg.senderType === 'AI' ? (
                    <div className="w-8 h-8 rounded-full bg-white shadow-md shadow-red-600/10 p-0.5">
                      <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-600 text-white flex items-center justify-center shadow-md">
                      <Bot size={16} />
                    </div>
                  )}
                </div>
              )}


              <div className={`flex flex-col gap-2 min-w-0 ${msg.content ? 'max-w-[80%]' : 'w-full'} ${msg.senderType === 'USER' ? 'items-end' : 'items-start'}`}>
                {/* SYSTEM messages - render nicely as cart/action summaries */}
                {msg.senderType === 'SYSTEM' && (
                  <div className="flex flex-col gap-2 max-w-[90%]">
                    {msg.content && <div className="bg-slate-700 text-white p-3.5 rounded-2xl rounded-tl-sm text-[13.5px] leading-relaxed shadow whitespace-pre-line">
                      {msg.content}
                    </div>}

                    {/* Prompt Personality Message */}
                    {msg.actionType === 'PROMPT_PERSONALITY' && (
                      <div className="bg-white/95 backdrop-blur-md border border-white/60 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] p-4 rounded-3xl rounded-tl-sm w-full mt-2">
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-2">Chọn phong cách trò chuyện:</p>
                        <div className="flex flex-wrap gap-2">
                          {['Chuyên nghiệp', 'Thân thiện', 'Hài hước', 'Nhanh gọn'].map((p) => (
                            <button
                              key={p}
                              onClick={() => {
                                setPersonality(p);
                                localStorage.setItem('avora_chat_personality', p);
                                setMessages(prev => [
                                  ...prev,
                                  {
                                    id: `sys-ack-${Date.now()}`,
                                    sessionId: sessionId || "temp-session",
                                    senderType: "SYSTEM",
                                    content: `Đã thiết lập tính cách Avora: ${p}`,
                                    actionType: null,
                                    actionPayload: null,
                                    createdAt: new Date().toISOString(),
                                  }
                                ]);
                                toast.success(`Đã đổi tính cách thành ${p}`);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium border transition-colors ${personality === p ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(msg.actionType === 'ADD_ALL_SUMMARY' || msg.actionType === 'CART_SUMMARY') && msg.actionPayload && (() => {
                      try {
                        const { cartUrl } = JSON.parse(msg.actionPayload);
                        return (
                          <a
                            href={cartUrl}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-600/20 transition-colors w-fit"
                          >
                            <ShoppingCart size={13} /> Xem giỏ hàng
                          </a>
                        );
                      } catch { return null; }
                    })()}
                  </div>
                )}

                {msg.senderType !== 'SYSTEM' && msg.content && (
                  <div
                    className={`p-3.5 sm:p-4 text-[13.5px] sm:text-[14.5px] leading-relaxed max-w-full break-words whitespace-pre-wrap ${msg.senderType === 'USER'
                      ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-3xl rounded-tr-sm shadow-md shadow-red-600/20'
                      : 'bg-white/95 backdrop-blur-md border border-white/60 text-slate-800 rounded-3xl rounded-tl-sm shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)]'
                      }`}
                  >
                    {msg.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {renderFormattedText(line)}
                        {i !== msg.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Rich UI Actions */}
                {msg.senderType === 'AI' && msg.actionType === 'ADD_TO_CART' && msg.actionPayload && (
                  <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-600 rounded-xl text-sm font-bold border border-green-200 shadow-sm">
                    <Sparkles size={16} /> Đã thêm vào giỏ hàng tự động
                  </div>
                )}

                {/* SHOW_PRODUCT Carousel */}
                {msg.senderType === 'AI' && msg.actionType === 'SHOW_PRODUCT' && msg.actionPayload && (() => {
                  const payload = JSON.parse(msg.actionPayload);
                  const isSuggestion = payload && !Array.isArray(payload) && payload.isSuggestion;
                  const branches = payload && !Array.isArray(payload) ? payload.suggestedBranches : [];
                  const products = payload && !Array.isArray(payload) ? payload.products : payload;
                  const validProducts = Array.isArray(products) ? products.filter((p: any) => p.id) : [];

                  return (
                    <div className="flex flex-col gap-2 w-full min-w-0">
                      {isSuggestion && branches?.length > 0 && (
                        <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl rounded-tl-sm text-[13px] text-orange-800 shadow-sm mx-1 mt-1">
                          Món này hiện không có ở chi nhánh bạn chọn, nhưng có sẵn tại <b>{branches[0].name}</b>.
                          <button
                            onClick={() => {
                              localStorage.setItem('avora_branch_id', branches[0].id);
                              window.location.reload();
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/20"
                          >
                            Chuyển sang chi nhánh này
                          </button>
                        </div>
                      )}

                      {validProducts.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2 w-full max-w-full">
                          {validProducts.map((product: any, idx: number) => (
                            <div key={`${product.id || 'p'}-${idx}`} className="min-w-[150px] max-w-[150px] bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow snap-start shrink-0 flex flex-col">
                              <div className="w-full h-28 bg-slate-100 relative">
                                <img src={product.imageUrl || product.images?.[0]?.url || 'https://via.placeholder.com/150'} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="p-2.5 flex-1 flex flex-col">
                                <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug mb-1 min-h-[32px]">{product.name}</h4>
                                <div className="text-red-600 font-bold text-sm mt-auto mb-2.5">
                                  {product.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price) : 'Liên hệ'}
                                </div>

                                <button
                                  onClick={() => handleAddToCart(JSON.stringify({ productId: product.id, quantity: 1 }), msg.id + '-' + product.id)}
                                  disabled={addingToCartId === msg.id + '-' + product.id || isLoading}
                                  className="w-full mb-1.5 flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-70"
                                >
                                  {addingToCartId === msg.id + '-' + product.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                  Thêm vào giỏ
                                </button>

                                <button
                                  onClick={() => handleSendMessage(`Tư vấn cho tôi món ${product.name}`)}
                                  disabled={isLoading}
                                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                                >
                                  Tư vấn món này
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Order Success Button */}
                {msg.senderType === 'AI' && msg.actionType === 'SHOW_ORDER_SUCCESS' && msg.actionPayload && (() => {
                  try {
                    const payload = JSON.parse(msg.actionPayload);
                    return (
                      <div className="w-full mt-3 p-4 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                          <ShoppingCart className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-green-800 text-lg mb-1">Đặt hàng thành công!</div>
                          <div className="text-sm text-green-700 opacity-90">Mã đơn: <span className="font-mono font-bold bg-green-200/50 px-2 py-0.5 rounded">{payload.orderCode}</span></div>
                        </div>
                        <button
                          onClick={() => {
                            if (payload.orderCode) {
                              setIsOpen(false);
                              router.push(`/orders/${payload.orderCode}`);
                            }
                          }}
                          className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-sm shadow-green-600/20 active:scale-[0.98]"
                        >
                          <Package className="w-4 h-4" />
                          <span>Theo dõi đơn hàng này</span>
                        </button>
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}

                {msg.actionType === 'PROMPT_VOUCHER_INPUT' && (
                  <div className="w-full mt-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Ticket className="w-4 h-4 text-orange-500" /> Nhập mã voucher của bạn:</p>
                    <div className="flex gap-2">
                      <input type="text" id={`voucherInput-${msg.id}`} className="flex-1 px-3 py-2 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-lg text-sm" placeholder="Nhập mã giảm giá..." />
                      <button onClick={async () => {
                        const inputElement = document.getElementById(`voucherInput-${msg.id}`) as HTMLInputElement;
                        const code = inputElement?.value;
                        if (code) {
                          inputElement.disabled = true;
                          try {
                            const res = await fetch(`${API_URL}/api/promotions/vouchers/apply`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ code, orderValue: cartTotal, userId: user?.id })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              toast.success(`Đã áp dụng mã ${code} thành công!`);
                              previewVoucherRef.current = code;
                              if (checkoutAddressIdRef.current || checkoutAddressId) {
                                handleOrderPreview((checkoutAddressIdRef.current || checkoutAddressId) as string, code);
                              }
                            } else {
                              const err = await res.json();
                              toast.error(err.message || 'Mã voucher không hợp lệ');
                              inputElement.disabled = false;
                            }
                          } catch (e) {
                            toast.error('Có lỗi xảy ra khi áp dụng voucher');
                            inputElement.disabled = false;
                          }
                        } else {
                          toast.error("Vui lòng nhập mã");
                        }
                      }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors">Áp dụng</button>
                    </div>
                  </div>
                )}

                {msg.actionType === 'SHOW_BEAUTIFUL_ORDER' && msg.actionPayload && (() => {
                  try {
                    const orderData = JSON.parse(msg.actionPayload);
                    const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
                    return (
                      <div className="w-full mt-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-blue-600 font-bold border-b border-slate-100 pb-3">
                          <ShoppingCart className="w-5 h-5" />
                          <span>CHI TIẾT ĐƠN HÀNG</span>
                        </div>

                        <div className="flex flex-col gap-3">
                          {orderData.items.map((item: any, idx: number) => {
                            const cartItem = cartItems.find(c => c.name === item.name);
                            return (
                              <div key={idx} className="flex gap-3 items-center">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden relative shrink-0 border border-slate-200/60">
                                  {cartItem?.imageUrl ? (
                                    <img src={cartItem.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                      <Salad className="w-5 h-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 text-sm min-w-0">
                                  <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                                  <div className="text-slate-500 text-xs">x{item.quantity} • {formatter.format(item.unitPrice)}</div>
                                </div>
                                <div className="text-sm font-bold text-slate-800 shrink-0">
                                  {formatter.format(item.total)}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="flex flex-col gap-2 text-sm border-t border-dashed border-slate-200 pt-3 mt-1">
                          <div className="flex justify-between text-slate-600">
                            <span>Tạm tính</span>
                            <span className="font-medium">{formatter.format(orderData.subTotal)}</span>
                          </div>
                          {orderData.voucher?.applied && (
                            <div className="flex justify-between text-green-600 bg-green-50/50 p-1.5 -mx-1.5 rounded-lg">
                              <span className="flex items-center gap-1.5"><Ticket className="w-4 h-4" /> Voucher ({orderData.voucher.code})</span>
                              <span className="font-semibold">-{formatter.format(orderData.voucher.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-600">
                            <span>Phí giao hàng</span>
                            <span className="font-medium">{formatter.format(orderData.shippingFee)}</span>
                          </div>
                          <div className="flex justify-between font-black text-lg text-red-600 mt-2 pt-2 border-t border-slate-100">
                            <span>Tổng cộng</span>
                            <span>{formatter.format(orderData.totalAmount)}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 text-sm mt-1 flex flex-col gap-2.5 border border-slate-100">
                          <div className="flex gap-2.5 items-start">
                            <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate">{orderData.receiverName} • {orderData.phone}</div>
                              <div className="text-slate-600 text-xs mt-0.5 line-clamp-2 leading-relaxed">{orderData.deliveryAddress}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5 items-center pt-2 border-t border-slate-200/60">
                            <CreditCard className="w-4 h-4 text-orange-500 shrink-0" />
                            <span className="text-slate-700">Thanh toán: <span className="font-bold text-slate-800">{orderData.paymentMethod}</span></span>
                          </div>
                        </div>
                      </div>
                    )
                  } catch (e) {
                    return null;
                  }
                })()}

                {/* Render Voucher Card */}
                {msg.senderType === 'AI' && msg.actionType === 'SHOW_VOUCHERS' && msg.actionPayload && (() => {
                  try {
                    const payload = JSON.parse(msg.actionPayload);
                    if (!payload.vouchers || payload.vouchers.length === 0) return null;

                    return (
                      <div className="mt-3 flex flex-col gap-2">
                        {payload.vouchers.map((voucher: any, vIdx: number) => (
                          <div key={vIdx} className="bg-white border border-red-100 rounded-lg p-3 shadow-sm relative overflow-hidden flex flex-col gap-1.5">
                            <div className="absolute top-0 right-0 w-12 h-12 bg-red-50 rounded-bl-full -z-10"></div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-red-600 text-[15px] flex items-center gap-1.5">
                                <Ticket size={16} /> {voucher.title}
                              </h4>
                            </div>
                            <div className="text-[13px] text-slate-600 space-y-1 mt-1">
                              <p className="flex items-center gap-1.5"><Tag size={14} className="text-slate-400" /> <span className="font-medium">Mức giảm:</span> {voucher.discountType === 'PERCENTAGE' ? `${voucher.discountValue}% (Tối đa ${voucher.maxDiscount?.toLocaleString('vi-VN')}đ)` : `${voucher.discountValue?.toLocaleString('vi-VN')}đ`}</p>
                              <p className="flex items-center gap-1.5"><ShoppingCart size={14} className="text-slate-400" /> <span className="font-medium">Đơn tối thiểu:</span> {voucher.minOrderValue?.toLocaleString('vi-VN')}đ</p>
                              <p className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> <span className="font-medium">HSD:</span> {new Date(voucher.endDate).toLocaleDateString('vi-VN')}</p>
                              {voucher.membershipTier && (
                                <p className="flex items-center gap-1.5"><Lock size={14} className="text-amber-500" /> <span className="font-medium">Hạng:</span> Dành cho hạng {voucher.membershipTier}</p>
                              )}
                              {voucher.reasonCode && (
                                <p className="text-orange-600 font-medium mt-1 text-xs flex items-center gap-1">
                                  <AlertTriangle size={14} /> {voucher.reasonMessage}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(voucher.code);
                                toast.success('Đã sao chép mã voucher!');
                              }}
                              className="mt-1 bg-red-50 text-red-600 hover:bg-red-100 font-bold py-1.5 px-3 rounded-md text-[13px] transition-colors border border-red-200"
                            >
                              COPY MÃ: {voucher.code}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}

                {/* Request Login */}
                {msg.senderType === 'SYSTEM' && msg.actionType === 'PROMPT_LOGIN' && (
                  <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm flex flex-col items-center justify-center gap-3 w-full">
                    <div className="flex gap-2 w-full mt-1">
                      <button onClick={() => window.location.href = '/login'} className="flex-1 py-2.5 bg-white text-slate-700 font-bold text-[13px] rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">Đăng nhập</button>
                      <button onClick={() => window.location.href = '/register'} className="flex-1 py-2.5 bg-red-600 text-white font-bold text-[13px] rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-600/20">Đăng ký</button>
                    </div>
                  </div>
                )}

                {/* Map Link Action */}
                {msg.senderType === 'AI' && msg.actionType === 'SHOW_MAP_LINK' && msg.actionPayload && (
                  <div className="mt-3">
                    <a href={msg.actionPayload} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl text-[13px] transition-all border border-blue-200 shadow-sm w-full">
                      <MapPin size={16} /> Xem chỉ đường trên bản đồ
                    </a>
                  </div>
                )}

                {/* Request Location */}
                {msg.senderType === 'AI' && msg.actionType === 'REQUEST_LOCATION' && (
                  <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-800 shadow-sm flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <MapPin size={24} />
                    </div>
                    <p className="text-sm text-center font-medium">Chúng tôi cần vị trí của bạn để tìm chi nhánh gần nhất</p>
                    <button
                      disabled={sharedLocationIds.includes(msg.id) || loadingLocationIds.includes(msg.id) || isLoading}
                      onClick={() => {
                        if (sharedLocationIds.includes(msg.id)) return;

                        setLoadingLocationIds(prev => [...prev, msg.id]);
                        if ("geolocation" in navigator) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const lat = position.coords.latitude;
                              const lon = position.coords.longitude;
                              if (isVoiceMode && socketRef.current) {
                                socketRef.current.emit('client_content', {
                                  turns: [{ role: 'user', parts: [{ text: `[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lon}]` }] }],
                                  turnComplete: true
                                });
                              } else {
                                handleSendMessage(`[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lon}]`);
                              }
                              setSharedLocationIds(prev => [...prev, msg.id]);
                              setLoadingLocationIds(prev => prev.filter(id => id !== msg.id));
                            },
                            (error) => {
                              toast.error('Không thể lấy vị trí thực tế, đang dùng vị trí mặc định để tiếp tục chốt đơn.');
                              const lat = 10.762622;
                              const lon = 106.660172;
                              if (isVoiceMode && socketRef.current) {
                                socketRef.current.emit('client_content', {
                                  turns: [{ role: 'user', parts: [{ text: `[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lon} (Fallback)]` }] }],
                                  turnComplete: true
                                });
                              } else {
                                handleSendMessage(`[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lon} (Fallback)]`);
                              }
                              setSharedLocationIds(prev => [...prev, msg.id]);
                              setLoadingLocationIds(prev => prev.filter(id => id !== msg.id));
                            }
                          );
                        } else {
                          toast.error('Trình duyệt không hỗ trợ GPS, đang dùng vị trí mặc định.');
                          const lat = 10.762622;
                          const lon = 106.660172;
                          if (isVoiceMode && socketRef.current) {
                            socketRef.current.emit('client_content', {
                              turns: [{ role: 'user', parts: [{ text: `[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lon} (Fallback)]` }] }],
                              turnComplete: true
                            });
                          } else {
                            handleSendMessage(`[HỆ THỐNG: Vị trí của khách hàng là vĩ độ ${lat}, kinh độ ${lon} (Fallback)]`);
                          }
                          setSharedLocationIds(prev => [...prev, msg.id]);
                          setHasSharedLocationSession(true);
                          setLoadingLocationIds(prev => prev.filter(id => id !== msg.id));
                        }
                      }}
                      className="bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-2.5 px-6 rounded-lg text-[14.5px] transition-all w-full flex items-center justify-center gap-2 shadow-md shadow-green-500/20 disabled:opacity-70 disabled:active:scale-100 disabled:cursor-not-allowed disabled:bg-green-400"
                    >
                      {sharedLocationIds.includes(msg.id) ? "Đã ghi nhận vị trí" : (loadingLocationIds.includes(msg.id) ? <><Loader2 size={16} className="animate-spin" /> Đang lấy vị trí...</> : "Chia sẻ vị trí")}
                    </button>
                  </div>
                )}

                {/* Suggested Replies */}
                {msg.senderType === 'AI' && msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    {msg.suggestedReplies.map((reply: string, i: number) => (
                      <button
                        key={i}
                        disabled={isLoading}
                        onClick={() => handleSendMessage(reply)}
                        className="text-left px-4 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 text-sm font-semibold rounded-xl border border-slate-200 hover:border-red-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

                {/* Hardcoded Address Confirmation Buttons */}
                {msg.senderType === 'AI' && msg.content && msg.content.match(/dùng địa chỉ này/i) && (!msg.suggestedReplies || msg.suggestedReplies.length === 0) && (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    {["Ok", "Không"].map((reply: string, i: number) => (
                      <button
                        key={`addr-${i}`}
                        disabled={isLoading}
                        onClick={() => handleSendMessage(reply)}
                        className="text-left px-4 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 text-sm font-semibold rounded-xl border border-slate-200 hover:border-red-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 pt-1">
                <div className="w-8 h-8 rounded-full bg-white shadow-md shadow-red-600/10 p-0.5">
                  <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
                </div>
              </div>
              <div className="bg-white border border-slate-100 text-slate-500 p-3.5 rounded-2xl rounded-tl-sm shadow-sm max-w-[80%] flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-400">AvoBOT đang suy nghĩ</span>
                <div className="flex gap-1.5 items-center h-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {displayMessages.length > 0 && (() => {
          let currentSuggestions: { text: string; icon: React.ReactNode; action?: string }[] = [
            { text: "Món nào đang bán chạy nhất?", icon: <Flame size={16} /> },
            { text: "Có khuyến mãi gì hôm nay không?", icon: <Gift size={16} /> },
            { text: "Tư vấn cho tôi món ăn nhẹ", icon: <Salad size={16} /> }
          ];

          const lastMsg = displayMessages[displayMessages.length - 1];
          if (lastMsg && lastMsg.senderType === 'AI') {
            if (lastMsg.actionType === 'SHOW_PRODUCT') {
              currentSuggestions = [
                { text: "Thêm tất cả vào giỏ hàng!", icon: <ShoppingCart size={16} />, action: 'ADD_ALL' },
                { text: "Kiểm tra giỏ hàng", icon: <ShoppingCart size={16} />, action: 'CHECK_CART' },
                { text: "Bạn có món nào khác không?", icon: <RefreshCw size={16} /> }
              ];
            } else if (lastMsg.actionType === 'ADD_TO_CART') {
              currentSuggestions = [
                { text: "Kiểm tra giỏ hàng", icon: <ShoppingCart size={16} />, action: 'CHECK_CART' },
                { text: "Tiến hành chốt đơn", icon: <CreditCard size={16} /> },
                { text: "Gợi ý món ăn kèm", icon: <Package size={16} /> }
              ];
            } else if (lastMsg.actionType === 'SHOW_ORDER') {
              currentSuggestions = [
                { text: "Kiểm tra giỏ hàng", icon: <ShoppingCart size={16} />, action: 'CHECK_CART' },
                { text: "Trạng thái đơn hàng", icon: <Package size={16} /> },
                { text: "Tôi muốn đặt thêm", icon: <Plus size={16} /> }
              ];
            } else if (lastMsg.actionType === 'SHOW_VOUCHERS') {
              currentSuggestions = [
                { text: "Món bán chạy", icon: <Flame size={16} /> },
                { text: "Kiểm tra giỏ hàng", icon: <ShoppingCart size={16} />, action: 'CHECK_CART' },
                { text: "Điều kiện áp dụng", icon: <BookOpen size={16} /> }
              ];
            }
          }

          return (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 bg-white pt-2 border-t border-slate-50">
              {currentSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (suggestion.action === 'ADD_ALL' && lastMsg?.actionPayload) {
                      handleAddAllToCart(lastMsg.actionPayload, lastMsg.id);
                    } else if (suggestion.action === 'CHECK_CART') {
                      handleCheckCart();
                    } else if (suggestion.action === 'VIEW_CART') {
                      window.location.href = '/checkout';
                    } else {
                      handleSendMessage(suggestion.text);
                    }
                  }}
                  disabled={(isAddingAll && suggestion.action === 'ADD_ALL') || isLoading}
                  className="whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-full text-[12px] sm:text-[13px] font-semibold border border-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                >
                  {isAddingAll && suggestion.action === 'ADD_ALL' ? (
                    <Loader2 size={14} className="animate-spin text-red-500" />
                  ) : (
                    <span>{suggestion.icon}</span>
                  )}
                  {suggestion.text}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50/95 backdrop-blur-xl shrink-0 relative rounded-b-3xl flex flex-col items-center">

          {/* Action Menu Popover */}
          {isActionMenuOpen && (
            <div className="absolute bottom-[calc(100%-8px)] right-4 mb-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 p-2 z-[10001] w-64 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <button onClick={() => { setIsActionMenuOpen(false); handleDeleteHistory(); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[13.5px] font-semibold text-slate-700 transition-colors">
                <User size={18} className="text-slate-500" /> Đổi tính cách Avora
              </button>
              <button onClick={() => { setIsActionMenuOpen(false); setIsAudioEnabled(!isAudioEnabled); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[13.5px] font-semibold text-slate-700 transition-colors">
                <VolumeX size={18} className={isAudioEnabled ? "text-red-500" : "text-slate-500"} /> {isAudioEnabled ? "Tắt đọc văn bản" : "Bật đọc văn bản"}
              </button>
              <button onClick={() => { setIsActionMenuOpen(false); window.open('/', '_blank'); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[13.5px] font-semibold text-slate-700 transition-colors">
                <HelpCircle size={18} className="text-slate-500" /> Trung tâm hỗ trợ
              </button>
              <button onClick={() => { setIsActionMenuOpen(false); window.open('tel:19001234'); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[13.5px] font-semibold text-slate-700 transition-colors">
                <PhoneCall size={18} className="text-slate-500" /> Gọi Hotline
              </button>
              <button onClick={() => { setIsActionMenuOpen(false); setIsExpanded(!isExpanded); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[13.5px] font-semibold text-slate-700 transition-colors hidden sm:flex">
                <Maximize2 size={18} className="text-slate-500" /> {isExpanded ? "Thu nhỏ cửa sổ" : "Mở rộng toàn màn hình"}
              </button>
              <div className="h-px bg-slate-100 my-1.5 mx-2"></div>
              <button onClick={handleDeleteHistory} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-xl text-[13.5px] font-bold text-red-600 transition-colors">
                <Trash2 size={18} /> Xóa lịch sử Chat
              </button>
              <div className="h-px bg-slate-100 my-1.5 mx-2"></div>
              <button onClick={() => { setIsActionMenuOpen(false); setIsInfoModalOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-xl text-[13.5px] font-semibold text-blue-600 transition-colors">
                <Info size={18} /> Thông tin về AvoBOT
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 w-full">
            <div className="flex-1 flex items-center gap-1 sm:gap-2 bg-white border border-slate-200 rounded-[24px] p-1 sm:p-1 w-full focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-500/10 transition-all shadow-sm">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhắn tin cho AvoBOT..."
                disabled={isLoading}
                className="flex-1 max-h-[100px] min-h-[36px] bg-transparent text-[13px] sm:text-[14px] text-slate-700 outline-none resize-none py-2 px-3 placeholder:text-slate-400 disabled:opacity-70 disabled:cursor-not-allowed leading-relaxed"
                rows={1}
                style={{ height: "auto" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />

              <div className="flex items-center gap-1 shrink-0 pr-0.5">
                {inputValue.trim() ? (
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full shadow-md transition-colors disabled:opacity-50"
                  >
                    <Send size={15} className="translate-x-0.5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleVoiceMode}
                      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors ${isVoiceMode ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-slate-50'}`}
                    >
                      {isVoiceMode ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <button
                      onClick={() => handleSendMessage("Hãy gợi ý cho tôi vài món nhé")}
                      disabled={isLoading}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full shadow-md transition-colors disabled:opacity-50"
                    >
                      <Send size={15} className="translate-x-0.5 -translate-y-[1px]" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
              className="w-10 h-10 sm:w-11 sm:h-11 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm"
              title="Tính năng mở rộng"
            >
              <Menu size={18} className={`transition-transform duration-200 ${isActionMenuOpen ? 'rotate-90 text-red-500' : ''}`} />
            </button>
          </div>

          <div className="mt-3 text-[10px] text-slate-400 text-center px-4 w-full">
            AvoBOT là AI có thể mắc lỗi.
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-[10002] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsInfoModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors z-10">
              <X size={20} />
            </button>
            
            <div className="text-center mb-4 shrink-0 mt-2">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-14 h-14 rounded-full object-cover" />
              </div>
              <h3 className="text-xl font-black text-slate-800">AvoBOT</h3>
              <p className="text-sm text-red-500 font-semibold mt-1">Trợ lý AI Thế hệ mới</p>
            </div>
            
            <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-3 text-[13px] text-slate-600 pb-2">
              <p>
                <strong>AvoBOT</strong> là trợ lý ảo thông minh được phát triển riêng cho Avora, trang bị khả năng xử lý ngôn ngữ tự nhiên vượt trội.
              </p>
              <p>
                Với AvoBOT, bạn có thể:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Gợi ý & Tìm kiếm:</strong> Gợi ý món ăn theo sở thích, chế độ dinh dưỡng, độ cay, nguyên liệu...</li>
                <li><strong>Đặt hàng siêu tốc:</strong> Thêm món vào giỏ, chốt đơn nhanh chóng chỉ bằng hội thoại.</li>
                <li><strong>Giao tiếp Giọng nói:</strong> Hỗ trợ Voice AI 2 chiều cực mượt mà, rảnh tay khi đặt món.</li>
                <li><strong>Hỗ trợ toàn diện:</strong> Kiểm tra trạng thái đơn hàng, săn mã giảm giá, xem khuyến mãi hôm nay.</li>
                <li><strong>Tích hợp Bản đồ:</strong> Chỉ đường đến chi nhánh gần nhất dựa vào vị trí hiện tại của bạn.</li>
                <li><strong>Cá nhân hoá:</strong> Trò chuyện theo nhiều tính cách (Thân thiện, Hài hước, Chuyên nghiệp...).</li>
              </ul>
              
              <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-xl mt-4 shadow-sm">
                <p className="font-bold text-[13px] flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={14} className="text-orange-500" /> Lưu ý quan trọng
                </p>
                <p className="text-[12px] leading-relaxed">
                  AvoBOT là hệ thống AI đang trong quá trình thử nghiệm (BETA). Đôi khi AvoBOT có thể mắc lỗi hoặc phản hồi thông tin chưa hoàn toàn chính xác. Vui lòng luôn <strong>kiểm tra lại kỹ thông tin đơn hàng và hóa đơn</strong> trước khi xác nhận nhé!
                </p>
              </div>
            </div>

            <div className="shrink-0 pt-3 mt-1">
              <p className="text-[11px] text-slate-400 mb-4 text-center">Phiên bản: 1.0.0 (BETA)</p>
              <button onClick={() => setIsInfoModalOpen(false)} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all active:scale-95">
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
