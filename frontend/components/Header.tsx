"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Menu, Search, X, Bell, ChevronDown, User, LogOut, MapPin, Phone,
  Truck, Gift, Download, Heart, ChevronRight, Home, ClipboardList, Star, ShoppingCart,
  Mic, Scan, Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function UpdatePhoneModal({ onUpdateSuccess }: { onUpdateSuccess: () => void }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length !== 10) {
      setError('Vui lòng nhập đúng 10 số điện thoại hợp lệ.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/update-phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Cập nhật thất bại.');
      } else {
        onUpdateSuccess();
      }
    } catch (err) {
      setError('Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
        <div className="p-8">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-inner">
            <Phone className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-center text-slate-800 mb-2">Cập nhật Số điện thoại</h2>
          <p className="text-center text-slate-500 text-sm mb-8">
            Đây là bước bắt buộc để hoàn tất hồ sơ đăng nhập của bạn. Chúng tôi cần số điện thoại để liên hệ giao hàng.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại của bạn</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold">+84</span>
                </div>
                <input
                  type="tel"
                  required
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-bold transition-all shadow-sm"
                  placeholder="Nhập 10 số..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-2xl text-white bg-red-600 hover:bg-red-700 font-black shadow-lg shadow-red-600/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Xác Nhận & Tiếp Tục'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface HeaderProps {
  initialCategories?: any[];
  initialBranches?: any[];
}

export default function Header({ initialCategories = [], initialBranches = [] }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMobileCategory, setExpandedMobileCategory] = useState<string | null>(null);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(initialCategories[0]?.id || '');
  const [user, setUser] = useState<any>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [suggestions, setSuggestions] = useState<{ topSearches: string[]; hotDeals: any[] }>({ topSearches: [], hotDeals: [] });
  const [quickSearchResults, setQuickSearchResults] = useState<{categories: any[], products: any[]}>({ categories: [], products: [] });
  const [isQuickSearchLoading, setIsQuickSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [mobileCatExpanded, setMobileCatExpanded] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const mobileNotificationRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { cartItems, changeBranch, currentBranchId, isBranchModalOpen, setIsBranchModalOpen, branchModalProduct, setBranchModalProduct, setConfirmDialog } = useCart();
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  /* ── init branch ── */
  useEffect(() => {
    if (initialBranches?.length > 0) {
      const saved = currentBranchId || localStorage.getItem('selectedBranchId');
      const found = saved ? initialBranches.find(b => b.id === saved) : null;
      setSelectedBranch(found || initialBranches[0]);
    }
  }, [initialBranches, currentBranchId]);

  const handleSelectBranch = (branch: any) => {
    changeBranch(branch.id);
    localStorage.setItem('selectedBranchId', branch.id);
    if (branchModalProduct) {
      setConfirmDialog({
        message: `Đã đổi sang chi nhánh ${branch.name}. Bạn có muốn xem chi tiết món này không?`,
        onConfirm: () => {
          setConfirmDialog(null);
          router.push(`/${branchModalProduct.category?.slug || 'menu'}/${branchModalProduct.slug}`);
        }
      });
      setBranchModalProduct(null);
    } else {
      toast.success(`Đã đổi sang chi nhánh ${branch.name}`);
    }
    setIsBranchDropdownOpen(false);
    setIsBranchModalOpen(false);
  };

  /* ── search history ── */
  useEffect(() => {
    try {
      const h = localStorage.getItem('searchHistory');
      if (h) setSearchHistory(JSON.parse(h));
    } catch { }
  }, []);

  const saveSearchHistory = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
    setSearchHistory(next);
    localStorage.setItem('searchHistory', JSON.stringify(next));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveSearchHistory(searchQuery.trim());
      router.push(`/search?s=${encodeURIComponent(searchQuery)}`);
      setIsSearchFocused(false);
    }
  };

  /* ── init active category ── */
  useEffect(() => {
    if (initialCategories.length > 0 && !activeCategory) {
      setActiveCategory(initialCategories[0].id);
    }
  }, [initialCategories]);

  /* ── fetch user ── */
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        setUser(res.ok ? await res.json() : null);
      } catch { setUser(null); }
    };
    run();
  }, []);

  /* ── handle login success & toast ── */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('loginSuccess') === 'true') {
        import('react-hot-toast').then(({ toast }) => {
          toast.success('Đăng nhập thành công!');
        });
        url.searchParams.delete('loginSuccess');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  /* ── fetch notifications ── */
  useEffect(() => {
    if (user) {
      const fetchNotifications = async () => {
        try {
          const res = await fetch(`${API_URL}/api/notifications`, {
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' },
          });
          if (res.ok) {
            const data = await res.json();
            setNotifications(data.data || []);
            setUnreadCount(data.unreadCount || 0);
          }
        } catch {}
      };
      fetchNotifications();
    }
  }, [user]);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      try {
        await fetch(`${API_URL}/api/notifications/${notif.id}/read`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {}
    }
    setIsNotificationOpen(false);
    if (notif.url) {
      router.push(notif.url);
    } else if (notif.type === 'ORDER') {
      router.push(notif.referenceId ? `/orders/${notif.referenceId}` : '/orders');
    }
  };

  /* ── fetch suggestions ── */
  useEffect(() => {
    fetch(`${API_URL}/api/products/search/suggestions`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.json()).then(d => setSuggestions(d)).catch(() => { });
  }, []);

  /* ── quick search ── */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setQuickSearchResults({ categories: [], products: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setIsQuickSearchLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/products/search/quick?q=${encodeURIComponent(searchQuery)}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (res.ok) {
          const data = await res.json();
          setQuickSearchResults(data);
        }
      } catch (err) { }
      setIsQuickSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST', credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      localStorage.removeItem('user');
      window.location.reload();
    } catch { }
  };

  /* ── scroll: compact desktop header ── */
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 150) {
        setIsScrolled(true);
      } else if (window.scrollY < 20) {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── close mega menu & notification on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(e.target as Node)) {
        setIsMegaMenuOpen(false);
      }
      if (
        (!notificationRef.current || !notificationRef.current.contains(e.target as Node)) &&
        (!mobileNotificationRef.current || !mobileNotificationRef.current.contains(e.target as Node))
      ) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const renderNotificationDropdown = (isMobile = false) => {
    if (!isNotificationOpen) return null;
    return (
      <div className={`absolute top-[calc(100%+8px)] ${isMobile ? 'right-0 w-[300px]' : '-right-10 md:right-0 w-[320px]'} bg-white shadow-2xl rounded-xl border border-slate-100 z-50 overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">Thông báo mới nhận</h3>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">Chưa có thông báo nào</div>
          ) : (
            notifications.slice(0, 5).map(notif => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-white shadow-sm border border-slate-100 overflow-hidden">
                    {notif.type === 'ORDER' ? <ClipboardList className="w-5 h-5 text-blue-500" /> : 
                     notif.type === 'PROMOTION' ? <Gift className="w-5 h-5 text-red-500" /> : 
                     <Bell className="w-5 h-5 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className={`text-sm line-clamp-1 ${!notif.isRead ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>{notif.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{notif.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t border-slate-100 bg-slate-50">
          <Link href="/notifications" onClick={() => setIsNotificationOpen(false)} className="block w-full text-center text-sm text-red-600 font-bold hover:underline py-1.5">
            Xem tất cả
          </Link>
        </div>
      </div>
    );
  };

  const renderSearchDropdown = () => {
    if (!isSearchFocused) return null;
    return (
      <>
        <div className="fixed inset-0 z-0" onClick={() => setIsSearchFocused(false)} />
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 overflow-hidden max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="p-4 text-left">
            {searchQuery.trim() ? (
              isQuickSearchLoading ? (
                <div className="py-6 text-center flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-slate-500 text-sm font-medium">Đang tìm kiếm...</span>
                </div>
              ) : quickSearchResults.categories.length === 0 && quickSearchResults.products.length === 0 ? (
                <div className="py-6 text-center flex flex-col items-center gap-2">
                  <Search className="w-8 h-8 text-slate-300" />
                  <span className="text-slate-500 text-sm font-medium">Không tìm thấy kết quả nào</span>
                </div>
              ) : (
                <>
                  {quickSearchResults.categories.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-col bg-white">
                        {quickSearchResults.categories.map((cat, idx) => (
                          <Link href={`/${cat.slug}`} key={cat.id} onClick={() => setIsSearchFocused(false)} className={`py-3 px-2 flex items-center justify-between group ${idx !== quickSearchResults.categories.length - 1 ? 'border-b border-slate-50' : ''}`}>
                            <span className="text-[14px] font-bold text-slate-600 group-hover:text-red-600 transition-colors lowercase first-letter:uppercase">{cat.name}</span>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {quickSearchResults.products.length > 0 && (
                    <div className="bg-orange-50/50 -mx-4 px-4 py-4 mt-2">
                      <span className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <div className="bg-green-500 text-white rounded-full p-1"><ShoppingCart className="w-3.5 h-3.5" /></div>
                        Gợi ý sản phẩm
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {quickSearchResults.products.map(p => {
                          const isAvailableHere = !selectedBranch || p.branches?.length === 0 || p.branches.some((b: any) => b.id === selectedBranch.id);
                          const onlyAvailableBranch = !isAvailableHere && p.branches?.length > 0 ? p.branches[0] : null;
                          return (
                            <div key={p.id} className="relative flex flex-col gap-2 p-2.5 bg-white border border-slate-100 hover:border-red-200 hover:shadow-md rounded-2xl group transition-all h-full">
                              <img src={p.imageUrl || p.images?.[0]?.url || 'https://via.placeholder.com/150'} alt={p.name} className="w-full aspect-[4/3] rounded-xl object-cover group-hover:scale-[1.02] transition-transform" />
                              <div className="flex-1 min-w-0 flex flex-col mt-1">
                                <h4 className="font-bold text-[13px] text-slate-800 line-clamp-2 leading-tight group-hover:text-red-600 transition-colors">{p.name}</h4>
                                <div className="mt-auto pt-2 flex items-center justify-between gap-1">
                                  <span className="text-slate-900 font-bold text-[13px]">{(p.flashSalePrice || p.price).toLocaleString()}đ</span>
                                </div>
                                {!isAvailableHere && p.branches?.length > 0 && (
                                  <button onClick={(e) => {
                                    e.preventDefault();
                                    setIsBranchModalOpen(true);
                                    setIsSearchFocused(false);
                                  }} className="mt-2 text-[10px] text-orange-700 font-bold bg-orange-100/80 hover:bg-orange-200 px-2 py-1 rounded-lg flex items-center justify-center gap-1 w-full transition-colors relative z-20">
                                    <MapPin className="w-3 h-3 shrink-0" /> Xem chi nhánh có hàng
                                  </button>
                                )}
                                {isAvailableHere && (
                                  <Link href={`/${p.category?.slug || 'menu'}/${p.slug}`} onClick={() => setIsSearchFocused(false)} className="absolute inset-0 z-10" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={handleSearchSubmit} className="w-full mt-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    Xem tất cả kết quả <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )
            ) : (
              <>
                {!searchQuery && searchHistory.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-800">Lịch sử tìm kiếm</span>
                      <button type="button" onClick={clearSearchHistory} className="text-xs text-blue-600 hover:underline">Xóa tất cả</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map(term => (
                        <button key={term} type="button"
                          onClick={() => { setSearchQuery(term); saveSearchHistory(term); router.push(`/search?s=${encodeURIComponent(term)}`); setIsSearchFocused(false); }}
                          className="flex items-center gap-1 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100"
                        >
                          <span className="text-slate-400"><Clock className="w-3.5 h-3.5" /></span> {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <span className="text-sm font-bold text-slate-800 mb-3 block">Tra cứu hàng đầu</span>
                <div className="flex flex-wrap gap-2">
                  {(suggestions.topSearches.length > 0 ? suggestions.topSearches : ['Sashimi', 'Ramen', 'Sushi', 'Tempura', 'Mì Udon', 'Combo']).map(term => (
                    <button key={term} type="button"
                      onClick={() => { setSearchQuery(term); saveSearchHistory(term); router.push(`/search?s=${encodeURIComponent(term)}`); setIsSearchFocused(false); }}
                      className="text-sm text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-red-400 hover:text-red-600 transition-colors"
                    >{term}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {/* UPDATE PHONE MODAL FOR NEW GOOGLE USERS */}
      {user && !user.phone && (
        <UpdatePhoneModal onUpdateSuccess={() => window.location.reload()} />
      )}

      {/* BRANCH SELECTION MODAL */}
      {(isBranchModalOpen || branchModalProduct) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsBranchModalOpen(false); setBranchModalProduct(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">Chọn chi nhánh</h3>
              <button onClick={() => { setIsBranchModalOpen(false); setBranchModalProduct(null); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {branchModalProduct && (
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4">
                <img src={branchModalProduct.imageUrl || branchModalProduct.image || 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400'} className="w-20 h-20 rounded-xl object-cover shadow-sm" />
                <div className="flex flex-col justify-center">
                  <h4 className="font-bold text-slate-900 text-lg leading-tight mb-1 line-clamp-2">{branchModalProduct.name}</h4>
                  <div className="text-red-600 font-bold text-lg">{(branchModalProduct.flashSalePrice || branchModalProduct.price).toLocaleString('vi-VN')}đ</div>
                </div>
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto p-3 custom-scrollbar">
              {branchModalProduct && (
                <div className="px-2 pt-2 pb-3">
                  <p className="text-sm font-bold text-slate-700">Chi nhánh còn hàng:</p>
                </div>
              )}
              
              {(branchModalProduct ? branchModalProduct.branches : initialBranches)?.map((branchRef: any) => {
                const b = branchModalProduct ? initialBranches?.find((ib: any) => ib.id === branchRef.id) : branchRef;
                if (!b) return null;
                return (
                  <div
                    key={b.id} onClick={() => handleSelectBranch(b)}
                    className={`p-4 mb-2 rounded-xl cursor-pointer transition-all border ${selectedBranch?.id === b.id ? 'bg-red-50 border-red-200 shadow-sm' : 'hover:bg-slate-50 border-slate-100'}`}
                  >
                    <p className={`font-bold text-base ${selectedBranch?.id === b.id ? 'text-red-600' : 'text-slate-800'}`}>{b.name}</p>
                    <p className="text-sm text-slate-500 mt-1">{b.street}, {b.district}</p>
                    <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-500 font-medium">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{b.openTime || '08:00'} - {b.closeTime || '22:00'}</span>
                    </div>
                  </div>
                );
              })}
              
              {branchModalProduct && (!branchModalProduct.branches || branchModalProduct.branches.length === 0) && (
                <div className="text-center py-6 text-slate-500 font-medium">
                  Món này hiện đang hết hàng ở tất cả chi nhánh.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BAR — desktop only, scrolls naturally ── */}
      <div className="hidden md:block bg-white border-b border-slate-100 relative z-[120]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-[36px] flex justify-between items-center text-[11px] lg:text-[12px] text-slate-600 font-medium">
            {/* Branch picker */}
            <div className="relative">
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors"
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              >
                <MapPin size={13} className="text-red-600" />
                <span>Chi nhánh: <strong className="text-slate-900">{selectedBranch?.name || 'Chọn chi nhánh'}</strong></span>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
              {isBranchDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setIsBranchDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-[150] overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 text-sm">Chọn chi nhánh</div>
                    <div className="max-h-60 overflow-y-auto p-2">
                      {initialBranches?.map(b => (
                        <div
                          key={b.id} onClick={() => handleSelectBranch(b)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedBranch?.id === b.id ? 'bg-red-50 border border-red-200' : 'hover:bg-slate-50 border border-transparent'}`}
                        >
                          <p className={`font-bold text-sm ${selectedBranch?.id === b.id ? 'text-red-600' : 'text-slate-800'}`}>{b.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{b.street}, {b.district}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{b.openTime || '08:00'} - {b.closeTime || '22:00'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Center promos */}
            <div className="hidden lg:flex items-center gap-8">
              <div className="flex items-center gap-1.5"><Truck size={13} className="text-red-600" /><span><strong className="text-red-600">FREESHIP</strong> cho đơn từ 300.000đ</span></div>
              <div className="flex items-center gap-1.5"><Gift size={13} className="text-red-600" /><span>Ưu đãi đến <strong className="text-red-600">30%</strong> cho thành viên</span></div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-5">
              <a href="tel:19001234" className="flex items-center gap-1.5 hover:text-red-600 transition-colors">
                <Phone size={13} className="text-red-600" />
                <span>Hotline: <strong className="text-slate-900">1900 1234</strong></span>
              </a>
              <a href="#" className="flex items-center gap-1.5 hover:text-red-600 transition-colors">
                <Download size={13} className="text-red-600" /><span>Tải ứng dụng</span>
              </a>
            </div>
          </div>
      </div>

      {/* ══════════════════════════════════════
          HEADER — sticky, never hides on mobile
      ══════════════════════════════════════ */}
      <header className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] sticky top-0 z-50 transition-colors duration-300">

        {/* ── MOBILE TOP ROW ── */}
        <div className="md:hidden bg-white shadow-sm">
          <div className="px-3 pt-2 pb-2 flex flex-col relative z-[90]">
            <div className="flex items-center justify-between h-11 relative">
              {/* Left: Menu */}
              <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-700 p-1.5 hover:bg-slate-100 rounded-full transition-colors z-10 shrink-0">
                <Menu className="w-6 h-6" />
              </button>

              {/* Center Area */}
              <div className="flex-1 h-full relative mx-2">
                {/* Logo */}
                <Link href="/" className={`absolute inset-0 flex justify-center items-center transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isScrolled ? 'opacity-0 scale-90 pointer-events-none -translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
                  <img src="/avora_logo_ngang.png" alt="Avora" className="h-8 w-auto object-contain" />
                </Link>

                {/* Scrolled Search Bar */}
                <div className={`absolute inset-0 flex items-center transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isScrolled ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                  <div className="w-full relative">
                    <form onSubmit={handleSearchSubmit}>
                      <div className="flex items-center bg-slate-100 rounded-full pl-3 pr-1 py-1 border border-transparent focus-within:border-red-400 transition-all shadow-inner">
                        <input
                          type="text"
                          placeholder="Tìm món ăn..."
                          className="bg-transparent border-none outline-none flex-1 text-sm text-slate-800 placeholder-slate-500 min-w-0"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onFocus={() => setIsSearchFocused(true)}
                        />
                        {searchQuery && (
                          <button type="button" onClick={() => setSearchQuery('')} className="p-1 text-slate-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button type="button" className="p-1 text-red-600 hover:bg-red-50 rounded-full">
                          <Mic className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1 text-red-600 hover:bg-red-50 rounded-full">
                          <Scan className="w-4 h-4" />
                        </button>
                      </div>
                      {isScrolled && renderSearchDropdown()}
                    </form>
                  </div>
                </div>
              </div>

              {/* Right: Notifications */}
              <div className="relative z-10 shrink-0" ref={mobileNotificationRef}>
                <button 
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative text-slate-700 p-1.5 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
                >
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {renderNotificationDropdown(true)}
              </div>
            </div>
          </div>
        </div>

        {/* ── DESKTOP MAIN ROW ── */}
        <div className="hidden md:flex max-w-7xl mx-auto px-4 lg:px-8 items-center gap-2 h-[68px]">
          {/* Left */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="shrink-0">
              <img src="/avora_logo_ngang.png" alt="Avora" className="h-14 w-auto" />
            </Link>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-0 px-5 relative z-[90]">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="flex items-center bg-slate-100 rounded-full pl-3 pr-1 border border-slate-200 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100 focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm món ăn, combo, nhà hàng..."
                  className="bg-transparent border-none outline-none ml-2 flex-1 text-sm text-slate-700 placeholder-slate-400 py-2 min-w-0"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="submit" className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors shrink-0 ml-1">
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
              {renderSearchDropdown()}
            </form>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Desktop */}
            <div className="flex items-center gap-4">
              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="flex flex-col items-center text-slate-600 hover:text-red-600 transition-colors relative"
                >
                  <div className="relative mb-0.5">
                    <Bell className="w-[18px] h-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 bg-red-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold">Thông báo</span>
                </button>
                {renderNotificationDropdown(false)}
              </div>
              <Link href="#" className="flex flex-col items-center text-slate-600 hover:text-red-600 transition-colors">
                <Heart className="w-[18px] h-[18px] mb-0.5" />
                <span className="text-[9px] font-semibold">Yêu thích</span>
              </Link>
              <Link href="/cart" className="flex flex-col items-center text-slate-600 hover:text-red-600 transition-colors relative">
                <div className="relative mb-0.5">
                  <ShoppingCart className="w-[18px] h-[18px]" />
                  {totalItems > 0 && <span className="absolute -top-1 -right-1.5 bg-red-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">{totalItems}</span>}
                </div>
                <span className="text-[9px] font-semibold">Giỏ hàng</span>
              </Link>
            </div>

            {/* Desktop user */}
            <div className="hidden lg:flex items-center border-l border-slate-200 pl-4 relative">
              {user ? (
                <div className="relative">
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}>
                    <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 overflow-hidden flex items-center justify-center shrink-0">
                      {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-red-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-bold text-slate-900 group-hover:text-red-600 transition-colors leading-tight line-clamp-1">{user.fullName || user.name || 'Tài khoản'}</p>
                        <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap">{user?.membershipTier?.name || 'Thành viên mới'}</span>
                      </div>
                      <p className="text-[10px] font-bold text-red-600 leading-tight mt-0.5">{new Intl.NumberFormat('vi-VN').format(user?.points || 0)} điểm</p>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                  {isUserDropdownOpen && (
                    <div className="absolute top-[calc(100%+8px)] right-0 w-48 bg-white shadow-2xl rounded-xl border border-slate-100 py-1.5 z-50">
                      <Link href="/profile" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors">Tài khoản</Link>
                      <Link href="/orders" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors">Đơn hàng</Link>
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/login" className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors text-sm shadow-sm">
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── SCROLLING NAV AND SEARCH (Slides under sticky header) ── */}
      <div className="relative z-40 bg-white">
        
        {/* ── MOBILE BOTTOM SEARCH ROW ── */}
        <div className="md:hidden shadow-sm px-3 pb-2 border-b border-slate-100">
          <div className="pt-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="flex items-center bg-slate-100 rounded-full pl-4 pr-1.5 py-1.5 border border-transparent focus-within:border-red-400 transition-all shadow-inner">
                <input
                  type="text"
                  placeholder="Tìm món ăn, nhà hàng..."
                  className="bg-transparent border-none outline-none flex-1 text-[15px] text-slate-800 placeholder-slate-500 min-w-0"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="p-1 text-slate-400 mr-1">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button type="button" className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors mr-0.5">
                  <Mic className="w-[18px] h-[18px]" />
                </button>
                <button type="button" className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors">
                  <Scan className="w-[18px] h-[18px]" />
                </button>
              </div>
              {!isScrolled && renderSearchDropdown()}
            </form>
          </div>
        </div>

        {/* ── DESKTOP NAV ── */}
        <div className="hidden md:block border-t border-slate-100 h-[52px]">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 h-full flex items-center gap-6 text-[15px] font-bold text-slate-800">

            {/* ── Danh mục mega menu ── */}
            <div
              ref={megaMenuRef}
              className="relative h-full flex items-center"
              onMouseEnter={() => setIsMegaMenuOpen(true)}
              onMouseLeave={() => setIsMegaMenuOpen(false)}
            >
              <button
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm"
                onClick={() => setIsMegaMenuOpen(v => !v)}
              >
                <Menu className="w-4 h-4" /> Danh mục <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${isMegaMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Mega dropdown — rendered OUTSIDE overflow-hidden flow */}
              {isMegaMenuOpen && (
                <div
                  className="absolute top-full left-0 w-[820px] bg-white rounded-xl rounded-tl-none shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-slate-100 flex z-[200] overflow-hidden"
                  style={{ maxHeight: '480px' }}
                >
                  {/* Left: category list */}
                  <div className="w-[220px] shrink-0 bg-slate-50 border-r border-slate-100 overflow-y-auto">
                    {initialCategories.map(cat => (
                      <Link
                        key={cat.id}
                        href={`/${cat.slug}`}
                        onMouseEnter={() => setActiveCategory(cat.id)}
                        onClick={() => setIsMegaMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors text-sm ${activeCategory === cat.id ? 'bg-white text-red-600 font-bold border-l-[3px] border-red-600' : 'text-slate-600 hover:bg-white border-l-[3px] border-transparent'}`}
                      >
                        <img src={cat.image || cat.imageUrl || 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400'} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        <span className="line-clamp-1">{cat.name}</span>
                      </Link>
                    ))}
                  </div>
                  {/* Right: products */}
                  <div className="flex-1 p-5 bg-white overflow-y-auto">
                    {(() => {
                      const cat = initialCategories.find(c => c.id === activeCategory);
                      if (!cat) return null;
                      return (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base text-slate-900">{cat.name}</h3>
                            <Link href={`/${cat.slug}`} onClick={() => setIsMegaMenuOpen(false)} className="text-xs text-red-600 font-bold hover:underline">Xem tất cả →</Link>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {cat.products?.slice(0, 8).map((item: any) => (
                              <Link key={item.id} href={`/${cat.slug}/${item.slug}`} onClick={() => setIsMegaMenuOpen(false)} className="flex items-center gap-3 group/item hover:bg-slate-50 rounded-lg p-1.5 transition-colors">
                                <img src={item.imageUrl || item.image} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 group-hover/item:text-red-600 line-clamp-1 transition-colors">{item.name}</p>
                                  <p className="text-xs text-red-600 font-bold mt-0.5">{typeof item.price === 'number' ? item.price.toLocaleString('vi-VN') + 'đ' : item.price}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Nav links */}
            {[
              { label: 'Trang chủ', href: '/', active: true },
              { label: 'Thực đơn', href: '/menu' },
              { label: 'Combo', href: '#' },
              { label: 'Nhà hàng', href: '#' },
              { label: 'Khuyến mãi', href: '#' },
              { label: 'Đặt bàn', href: '#' },
              { label: 'Tin tức', href: '#' },
              { label: 'Về chúng tôi', href: '#' },
            ].map(({ label, href, active }) => (
              <Link key={label} href={href}
                className={`relative h-full flex items-center hover:text-red-600 transition-colors whitespace-nowrap ${active ? 'text-red-600' : ''}`}
              >
                {label}
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-red-600 rounded-t-full" />}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          MOBILE SIDEBAR
      ══════════════════════════════════════ */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-[70] md:hidden flex flex-col transition-transform duration-300 ease-out bg-white ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: '288px', maxWidth: '90vw' }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
            <img src="/avora_logo_ngang.png" alt="Avora" className="h-8 w-auto" />
          </Link>
          <button onClick={() => setIsMobileMenuOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Account card */}
          <div className="px-3 pt-3 pb-2">
            {user ? (
              <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-xl p-3.5 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
                <div className="flex items-center gap-2.5 mb-2.5 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 overflow-hidden flex items-center justify-center shrink-0">
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm leading-tight truncate">{user.fullName || user.name || 'Tài khoản'}</p>
                    <p className="text-red-200 text-[11px]">{user.email || ''}</p>
                  </div>
                </div>
                <div className="bg-white/15 rounded-lg px-3 py-1.5 flex items-center justify-between mb-2.5 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                    <span className="text-white text-xs font-bold">{new Intl.NumberFormat('vi-VN').format(user?.points || 0)} điểm</span>
                  </div>
                  <span className="text-red-200 text-[11px] font-bold">{user?.membershipTier?.name || 'Thành viên mới'}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 relative z-10">
                  <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="bg-white text-red-600 font-bold text-xs text-center py-1.5 rounded-lg">Tài khoản</Link>
                  <button onClick={handleLogout} className="bg-white/20 text-white font-bold text-xs py-1.5 rounded-lg flex items-center justify-center gap-1">
                    <LogOut className="w-3 h-3" /> Đăng xuất
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-3.5 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                <p className="text-white font-bold text-sm mb-0.5">Chào mừng đến Avora!</p>
                <p className="text-slate-400 text-xs mb-3">Đăng nhập để tích điểm & nhận ưu đãi</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="bg-red-600 text-white font-bold text-sm text-center py-2 rounded-lg">Đăng nhập</Link>
                  <Link href="/register" onClick={() => setIsMobileMenuOpen(false)} className="bg-white/10 text-white font-bold text-sm text-center py-2 rounded-lg">Đăng ký</Link>
                </div>
              </div>
            )}
          </div>

          {/* Quick icons */}
          <div className="px-3 pb-2">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: Home, label: 'Trang chủ', href: '/' },
                { icon: ClipboardList, label: 'Đơn hàng', href: '/orders' },
                { icon: Heart, label: 'Yêu thích', href: '#' },
                { icon: Gift, label: 'Ưu đãi', href: '#' },
              ].map(({ icon: Icon, label, href }) => (
                <Link key={label} href={href} onClick={() => setIsMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-50 hover:bg-red-50 group transition-colors"
                >
                  <Icon className="w-4 h-4 text-slate-500 group-hover:text-red-600 transition-colors" />
                  <span className="text-[9px] font-bold text-slate-400 group-hover:text-red-600 transition-colors text-center leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Branch */}
          <div className="px-3 pb-2">
            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer" onClick={() => setIsBranchDropdownOpen(v => !v)}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Chi nhánh</p>
                    <p className="text-slate-800 font-bold text-xs leading-tight">{selectedBranch?.name || 'Chọn chi nhánh'}</p>
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              {isBranchDropdownOpen && (
                <div className="border-t border-slate-100 max-h-40 overflow-y-auto bg-white">
                  {initialBranches?.map(b => (
                    <div key={b.id} onClick={() => handleSelectBranch(b)}
                      className={`px-3 py-2.5 border-b border-slate-50 cursor-pointer last:border-0 ${selectedBranch?.id === b.id ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                    >
                      <p className={`font-bold text-xs ${selectedBranch?.id === b.id ? 'text-red-600' : 'text-slate-800'}`}>{b.name}</p>
                      <p className="text-[10px] text-slate-400">{b.street}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{b.openTime || '08:00'} - {b.closeTime || '22:00'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nav links */}
          <div className="px-3 pb-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Khám phá</p>
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              {[
                { label: 'Thực đơn', href: '/menu', icon: '🍱' },
                { label: 'Combo', href: '#', icon: '🎁' },
                { label: 'Nhà hàng', href: '#', icon: '🏠' },
                { label: 'Đặt bàn', href: '#', icon: '📅' },
                { label: 'Tin tức', href: '#', icon: '📰' },
                { label: 'Về chúng tôi', href: '#', icon: 'ℹ️' },
              ].map(({ label, href, icon }, i, arr) => (
                <Link key={label} href={href} onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-3 hover:bg-slate-50 transition-colors group ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{icon}</span>
                    <span className="font-semibold text-slate-700 text-sm group-hover:text-red-600 transition-colors">{label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                </Link>
              ))}
            </div>
          </div>

          {/* Categories (collapsible) */}
          <div className="px-3 pb-3">
            <button
              className="w-full flex items-center justify-between px-1 mb-1.5"
              onClick={() => setMobileCatExpanded(v => !v)}
            >
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Danh mục món ăn</p>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${mobileCatExpanded ? 'rotate-180' : ''}`} />
            </button>
            {mobileCatExpanded && (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {initialCategories.map((cat, i) => (
                  <div key={cat.id} className={i > 0 ? 'border-t border-slate-50' : ''}>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedMobileCategory(expandedMobileCategory === cat.id ? null : cat.id)}
                    >
                      <div className="flex items-center gap-2">
                        <img src={cat.image || cat.imageUrl || ''} className="w-7 h-7 rounded-full object-cover border border-slate-100 shrink-0" />
                        <span className="font-semibold text-slate-700 text-sm text-left">{cat.name}</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expandedMobileCategory === cat.id ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedMobileCategory === cat.id && (
                      <div className="bg-slate-50 px-3 pb-2 pt-0.5 flex flex-col">
                        <Link href={`/${cat.slug}`} onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-bold text-red-600 py-1.5 flex items-center gap-1">
                          Xem tất cả {cat.name} <ChevronRight className="w-3 h-3" />
                        </Link>
                        {cat.products?.map((item: any) => (
                          <Link key={item.id} href={`/${cat.slug}/${item.slug}`} onClick={() => setIsMobileMenuOpen(false)}
                            className="text-xs text-slate-500 hover:text-red-600 py-1 pl-1 line-clamp-1 transition-colors"
                          >{item.name}</Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="px-3 pb-5">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
              <a href="tel:19001234" className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition-colors">
                <Phone className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="text-xs font-semibold">Hotline: <strong>1900 1234</strong></span>
              </a>
              <div className="flex items-center gap-2 text-slate-500">
                <Truck className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="text-xs">Freeship cho đơn từ 300.000đ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
