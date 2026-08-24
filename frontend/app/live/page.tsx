"use client";

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Mic, X, Users, ShoppingBag, Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { io, Socket } from 'socket.io-client';
import { useCart, CartItem } from '../../context/CartContext';

type ChatSenderType = "USER" | "AI" | "TOOL" | "SYSTEM";
type ChatActionType = "ADD_TO_CART" | "SHOW_ORDER" | "CONFIRM_CANCEL" | "CONFIRM_RESERVATION" | "SHOW_PRODUCT" | "SHOW_VOUCHERS" | "NAVIGATE" | "REQUEST_LOCATION" | "ADD_ALL_SUMMARY" | "CART_SUMMARY" | "SHOW_ORDER_SUCCESS" | "STOP_VOICE" | "SUGGEST_VOUCHER" | "PROMPT_VOUCHER_INPUT" | "SHOW_BEAUTIFUL_ORDER" | "UPDATE_CART" | "PROMPT_PERSONALITY";

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

export default function LiveCommercePage() {
  const router = useRouter();
  
  // Cart logic
  const { cartItems, getCartItemTotal, updateQuantity, removeFromCart } = useCart();
  const cartTotal = cartItems.reduce((sum: number, item: any) => sum + getCartItemTotal(item), 0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Chat / Socket logic
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Real-time Socket Connection
  useEffect(() => {
    let id = localStorage.getItem('avora_live_session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('avora_live_session_id', id);
    }
    setSessionId(id);

    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    
    socketRef.current = newSocket;

    newSocket.emit('joinSession', id);

    newSocket.on('chatHistory', (history: ChatMessage[]) => {
      setMessages(history);
      scrollToBottom();
    });

    newSocket.on('receiveMessage', (msg: ChatMessage) => {
      setMessages(prev => {
        if (!prev.find(m => m.id === msg.id)) {
          return [...prev, msg];
        }
        return prev;
      });
      setIsLoading(false);
      scrollToBottom();
    });

    newSocket.on('actionResult', (msg: ChatMessage) => {
      setMessages(prev => {
        if (!prev.find(m => m.id === msg.id)) {
          return [...prev, msg];
        }
        return prev;
      });
      scrollToBottom();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [API_URL]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !sessionId || !socketRef.current) return;

    const tempMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      senderType: 'USER',
      content: inputText,
      actionType: null,
      actionPayload: null,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const res = await fetch(`/api/chatbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: tempMsg.content,
          history: messages
        })
      });
      
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      if (data.sessionMessages) {
        setMessages(data.sessionMessages);
      } else {
        setMessages(prev => [...prev, data]);
      }
      setIsLoading(false);
      scrollToBottom();
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // Helper to format currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Extract featured product if AI shows one
  const featuredProductMessage = [...messages].reverse().find(m => m.actionType === 'SHOW_PRODUCT' && m.actionPayload);
  const featuredProduct = featuredProductMessage ? JSON.parse(featuredProductMessage.actionPayload!) : null;

  return (
    <div className="relative w-full h-[100dvh] bg-neutral-900 text-white overflow-hidden flex flex-col font-sans">
      {/* Background/Avatar Layer */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-black">
        <div className="absolute inset-0 opacity-80 pointer-events-none">
           {/* Spline 3D Robot Model */}
           <Script type="module" src="https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js" strategy="lazyOnload" />
           {/* @ts-ignore */}
           <spline-viewer url="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode"></spline-viewer>
        </div>
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 w-full z-10 p-4 pt-safe flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-xs font-bold tracking-wider">LIVE</span>
          <div className="w-px h-3 bg-white/20 mx-1"></div>
          <Users className="w-3 h-3 text-neutral-300" />
          <span className="text-xs text-neutral-300">1.2k</span>
        </div>
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-end pb-[80px] p-4 pointer-events-none">
        
        {/* Product Card (Slide in when AI pins a product) */}
        {featuredProduct && (
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 mb-4 pointer-events-auto transform translate-x-0 transition-transform flex gap-3 items-center shadow-lg">
            <div className="w-16 h-16 rounded-xl bg-neutral-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
              <img src={featuredProduct.image} alt={featuredProduct.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm line-clamp-1">{featuredProduct.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-amber-400 font-bold text-sm">{formatVND(featuredProduct.price)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Chat Stream */}
        <div className="w-full max-w-sm flex flex-col gap-3 max-h-[35vh] overflow-y-auto no-scrollbar pointer-events-auto pb-4" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black)' }}>
          {messages.filter(m => m.senderType === 'AI' || m.senderType === 'USER').map(msg => (
            <div key={msg.id} className="flex flex-col">
              <span className="text-[10px] text-white/50 mb-0.5 ml-1">{msg.senderType === 'AI' ? 'Avora Host' : 'Bạn'}</span>
              <div className={`w-fit max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.senderType === 'AI' ? 'bg-amber-500/20 border border-amber-500/30 text-amber-50 rounded-tl-sm' : 'bg-white/10 border border-white/10 text-white rounded-tr-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex flex-col">
              <span className="text-[10px] text-white/50 mb-0.5 ml-1">Avora Host</span>
              <div className="w-fit px-4 py-2 rounded-2xl text-sm bg-amber-500/20 border border-amber-500/30 text-amber-50 rounded-tl-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="absolute bottom-0 w-full z-20 bg-gradient-to-t from-black via-black/90 to-transparent p-4 pb-safe flex items-center gap-3">
        <button 
          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isListening ? 'bg-rose-500 shadow-[0_0_15px_rgba(243,24,63,0.4)] animate-pulse' : 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]'}`}
          onClick={() => setIsListening(!isListening)}
        >
          <Mic className="w-5 h-5 text-white" />
        </button>
        
        <div className="flex-1 relative flex items-center">
          <input 
            type="text"
            placeholder="Trò chuyện với Avora..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-4 pr-10 text-sm text-white placeholder-white/50 focus:outline-none focus:border-amber-500/50 backdrop-blur-md"
          />
          <button 
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2 w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-amber-500 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <button 
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-md hover:bg-white/20 transition-colors relative"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingBag className="w-5 h-5 text-white" />
          {cartItems.length > 0 && (
            <div className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-black">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
            </div>
          )}
        </button>
      </div>

      {/* Cart Bottom Sheet */}
      <div className={`absolute inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsCartOpen(false)}>
        <div 
          className={`absolute bottom-0 w-full h-[70vh] bg-neutral-900 rounded-t-3xl border-t border-white/10 flex flex-col transition-transform duration-300 ${isCartOpen ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="w-full flex justify-center py-3">
            <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
          </div>
          <div className="px-5 pb-3 flex justify-between items-center border-b border-white/10">
            <h2 className="font-bold text-lg">Giỏ hàng của bạn</h2>
            <button onClick={() => setIsCartOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {cartItems.length === 0 ? (
              <div className="text-center text-white/50 mt-10">Giỏ hàng đang trống.</div>
            ) : (
              cartItems.map((item: any) => (
                <div key={`${item.id}-${item.selectedVariants?.map((v: any) => v.id).join('-')}`} className="flex gap-3">
                  <div className="w-20 h-20 bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                      <p className="text-amber-500 font-bold mt-1">{formatVND(getCartItemTotal(item))}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-white/10 rounded-lg">
                        <button onClick={() => item.quantity > 1 ? updateQuantity(item, item.quantity - 1) : removeFromCart(item)} className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white">-</button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-5 border-t border-white/10 bg-neutral-900 pb-safe">
            <div className="flex justify-between mb-4">
              <span className="text-white/70">Tổng cộng</span>
              <span className="font-bold text-xl text-amber-500">{formatVND(cartTotal)}</span>
            </div>
            <button className="w-full bg-amber-500 hover:bg-amber-600 transition-colors text-white font-bold py-3.5 rounded-xl text-sm shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50" disabled={cartItems.length === 0}>
              CHỐT ĐƠN
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
