'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  QrSessionData,
  QrGuest,
  QrCartItem,
  QrProduct,
  QrCartOption,
  QrTableOrderHistory,
} from '@/components/qr-order/qr-types';
import { QrWelcomeView } from '@/components/qr-order/QrWelcomeView';
import { QrDashboardView } from '@/components/qr-order/QrDashboardView';
import { QrMenuView } from '@/components/qr-order/QrMenuView';
import { QrCartDrawer } from '@/components/qr-order/QrCartDrawer';
import { QrTableOrdersView } from '@/components/qr-order/QrTableOrdersView';
import { QrRewardsView } from '@/components/qr-order/QrRewardsView';
import { QrCallStaffModal } from '@/components/qr-order/QrCallStaffModal';
import { QrPaymentRequestModal } from '@/components/qr-order/QrPaymentRequestModal';
import { QrChangeGuestModal } from '@/components/qr-order/QrChangeGuestModal';
import { QrRegisterModal } from '@/components/qr-order/QrRegisterModal';
import { useQrSocket } from '@/components/qr-order/useQrSocket';
import { Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QrOrderPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || '';

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<QrSessionData | null>(null);
  const [guest, setGuest] = useState<QrGuest | null>(null);

  // Active view: 'DASHBOARD' | 'MENU' | 'ORDERS' | 'REWARDS'
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MENU' | 'ORDERS' | 'REWARDS'>('DASHBOARD');

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCallStaffOpen, setIsCallStaffOpen] = useState(false);
  const [isPaymentRequestOpen, setIsPaymentRequestOpen] = useState(false);
  const [isChangeGuestOpen, setIsChangeGuestOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Cart & Menu state
  const [cartItems, setCartItems] = useState<QrCartItem[]>([]);
  const [menuData, setMenuData] = useState<{
    isBuffetActive: boolean;
    buffetPackageName?: string;
    buffetItems: QrProduct[];
    retailProducts: QrProduct[];
    categories: any[];
  } | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);

  // Table order history
  const [orderHistory, setOrderHistory] = useState<QrTableOrderHistory | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 1. Fetch QR Session Data by Token
  const fetchSession = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/qr-order/${token}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Mã QR không hợp lệ hoặc phiên gọi món đã kết thúc');
      }
      setSessionData(data.data);

      // Check saved guest in localStorage or inherit from order member
      let currentGuest: QrGuest | null = null;
      const savedGuestStr = localStorage.getItem(`avora_guest_${token}`);
      if (savedGuestStr) {
        try {
          currentGuest = JSON.parse(savedGuestStr);
        } catch {
          // ignore
        }
      }

      const orderUser = data.data?.order?.user;
      if (orderUser) {
        const memberGuest: QrGuest = {
          id: currentGuest?.id || `guest-${orderUser.id}`,
          guestName: currentGuest?.guestName || orderUser.fullName || data.data.order?.customerName || 'Khách hàng',
          deviceSessionId: currentGuest?.deviceSessionId || `dev-${Date.now()}`,
          memberVerified: true,
          user: {
            id: orderUser.id,
            fullName: orderUser.fullName,
            phone: orderUser.phone,
            email: orderUser.email,
            points: orderUser.currentPoints ?? orderUser.points ?? 0,
            memberCode: orderUser.memberCode,
            tierName: orderUser.membershipTier?.name,
            membershipTier: orderUser.membershipTier,
          },
        };
        setGuest(memberGuest);
        localStorage.setItem(`avora_guest_${token}`, JSON.stringify(memberGuest));
      } else if (currentGuest) {
        setGuest(currentGuest);
      } else if (data.data?.order?.customerName && data.data.order.customerName !== 'Khách vãng lai' && data.data.order.customerName !== 'Khách tại bàn') {
        const guestFromOrder: QrGuest = {
          id: `guest-${Date.now()}`,
          guestName: data.data.order.customerName,
          deviceSessionId: `dev-${Date.now()}`,
          memberVerified: false,
          user: null,
        };
        setGuest(guestFromOrder);
        localStorage.setItem(`avora_guest_${token}`, JSON.stringify(guestFromOrder));
      }
    } catch (err: any) {
      setSessionError(err.message || 'Lỗi tải phiên QR');
    } finally {
      setIsLoadingSession(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // 2. Fetch Menu
  const fetchMenu = useCallback(async () => {
    if (!token) return;
    setIsLoadingMenu(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/menu`);
      const data = await res.json();
      if (data.success) {
        const mappedMenu = {
          isBuffetActive: data.hasActiveBuffet ?? false,
          buffetPackageName: data.buffetPackage?.name,
          buffetItems: data.buffetItems ?? [],
          retailProducts: (data.retailCategories ?? []).flatMap((cat: any) =>
            (cat.products ?? []).map((p: any) => ({ ...p, categoryId: cat.id, categoryName: cat.name }))
          ),
          categories: (data.retailCategories ?? []).map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
          })),
        };
        setMenuData(mappedMenu);

        // Sanitize cart items: remove dishes not available at this branch or without QR channel
        const validProductIds = new Set<string>();
        (data.buffetItems ?? []).forEach((p: any) => validProductIds.add(p.id));
        (data.retailCategories ?? []).forEach((cat: any) => {
          (cat.products ?? []).forEach((p: any) => validProductIds.add(p.id));
        });

        setCartItems((prev) => {
          if (prev.length === 0) return prev;
          const filtered = prev.filter((it) => validProductIds.has(it.productId));
          if (filtered.length < prev.length) {
            toast.error('Đã tự động loại bỏ món không khả dụng tại chi nhánh khỏi giỏ hàng.', {
              id: 'cart-sanitized',
            });
          }
          return filtered;
        });
      }
    } catch (err) {
      console.error('Lỗi tải thực đơn QR', err);
    } finally {
      setIsLoadingMenu(false);
    }
  }, [token]);

  // 3. Fetch Table Order History
  const fetchOrderHistory = useCallback(async () => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/order`);
      const data = await res.json();
      if (data.success && data.order) {
        const items = data.order.orderItems?.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product?.name ?? item.productName ?? '',
          quantity: item.quantity,
          priceAtSale: item.priceAtSale,
          pricingMode: item.pricingMode ?? 'REGULAR',
          kitchenStatus: item.kitchenStatus ?? 'SENT',
          source: item.source ?? 'QR_ORDER',
          orderedByName: item.orderedByGuestName,
          note: item.note,
          optionsTextSnapshot: item.optionsTextSnapshot,
          selectedOptions: item.selectedOptions,
        })) ?? [];

        setOrderHistory({
          orderId: data.order.id,
          orderCode: data.order.orderCode ?? data.order.temporaryOrderCode ?? '',
          totalAmount: data.order.totalAmount ?? 0,
          subTotal: data.order.subTotal ?? 0,
          guestCount: data.order.guestCount ?? 1,
          items,
        });
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử đơn bàn', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  // Load menu and order history once guest is joined
  useEffect(() => {
    if (guest && token) {
      fetchMenu();
      fetchOrderHistory();
    }
  }, [guest, token, fetchMenu, fetchOrderHistory]);

  // Real-time socket sync
  useQrSocket({
    token,
    orderId: sessionData?.order?.id,
    onOrderUpdated: () => {
      fetchOrderHistory();
      fetchSession();
    },
    onKitchenItemUpdated: () => {
      fetchOrderHistory();
    },
    onRoundStatusChanged: (data: any) => {
      fetchOrderHistory();
      if (data?.status === 'APPROVED') {
        toast.success('Nhân viên đã duyệt món và gửi vào bếp!');
      } else if (data?.status === 'REJECTED') {
        toast.error(`Món đã bị từ chối: ${data?.rejectReason || 'Vui lòng liên hệ nhân viên'}`);
      }
    },
    onPaymentCompleted: () => {
      toast.success('Đơn hàng đã thanh toán hoàn tất!');
      fetchSession();
      fetchOrderHistory();
    },
  });

  // Handle Guest Join
  const handleJoinSuccess = (newGuest: QrGuest) => {
    setGuest(newGuest);
    localStorage.setItem(`avora_guest_${token}`, JSON.stringify(newGuest));
  };

  // Add Item to local cart
  const handleAddToCart = (
    product: QrProduct,
    quantity: number,
    selectedOptions: QrCartOption[],
    note?: string,
    pricingMode: 'REGULAR' | 'BUFFET_INCLUDED' = 'REGULAR'
  ) => {
    const basePrice = pricingMode === 'BUFFET_INCLUDED' ? 0 : product.effectivePrice;
    const optionSurcharge = selectedOptions.reduce((sum, o) => sum + o.priceAdjustmentAtSale, 0);
    const finalPrice = basePrice + optionSurcharge;

    const localId = `cart-${product.id}-${pricingMode}-${Date.now()}`;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          it.productId === product.id &&
          it.pricingMode === pricingMode &&
          it.note === note &&
          JSON.stringify(it.selectedOptions) === JSON.stringify(selectedOptions)
      );

      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx ? { ...it, quantity: it.quantity + quantity } : it
        );
      }

      const newItem: QrCartItem = {
        localId,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        unit: product.unit,
        quantity,
        pricingMode,
        basePrice,
        priceAtSale: finalPrice,
        originalPrice: product.price + optionSurcharge,
        selectedOptions,
        note,
      };

      return [...prev, newItem];
    });
  };

  const handleUpdateCartQuantity = (localId: string, quantity: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => (it.localId === localId ? { ...it, quantity } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveCartItem = (localId: string) => {
    setCartItems((prev) => prev.filter((it) => it.localId !== localId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const availableProductIds = useMemo(() => {
    const set = new Set<string>();
    if (!menuData) return set;
    menuData.buffetItems?.forEach((p) => set.add(p.id));
    menuData.retailProducts?.forEach((p) => set.add(p.id));
    return set;
  }, [menuData]);

  // Loading State
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#da251d] mb-3" />
        <h2 className="text-base font-black text-slate-800">Đang kết nối bàn ăn...</h2>
        <p className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }

  // Error State
  if (sessionError || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-[#da251d] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-slate-900 mb-1">Không thể mở phiên gọi món</h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          {sessionError || 'Mã QR đã hết hạn, bàn chưa được mở hoặc đã hoàn tất thanh toán.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-2xl bg-[#da251d] text-white font-black text-xs shadow-md shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
        >
          Thử tải lại trang
        </button>
      </div>
    );
  }

  // 1. If guest has not joined: Welcome & Name entry
  if (!guest) {
    return (
      <>
        <QrWelcomeView
          token={token}
          sessionData={sessionData}
          onJoinSuccess={handleJoinSuccess}
          onOpenRegister={() => setIsRegisterOpen(true)}
        />

        <QrRegisterModal
          isOpen={isRegisterOpen}
          token={token}
          guest={{ id: '', guestName: '', deviceSessionId: '', memberVerified: false }}
          onClose={() => setIsRegisterOpen(false)}
          onRegistered={handleJoinSuccess}
        />
      </>
    );
  }

  // 2. Main In-Session Views
  return (
    <div className="min-h-screen bg-slate-50">
      {activeView === 'DASHBOARD' && (
        <QrDashboardView
          sessionData={sessionData}
          guest={guest}
          onOpenMenu={() => setActiveView('MENU')}
          onOpenTableOrders={() => {
            fetchOrderHistory();
            setActiveView('ORDERS');
          }}
          onOpenCallStaff={() => setIsCallStaffOpen(true)}
          onOpenPaymentRequest={() => setIsPaymentRequestOpen(true)}
          onOpenRewards={() => setActiveView('REWARDS')}
          onOpenChangeGuest={() => setIsChangeGuestOpen(true)}
          orderedItemsCount={orderHistory?.items?.length || 0}
        />
      )}

      {activeView === 'MENU' && menuData && (
        <QrMenuView
          token={token}
          sessionData={sessionData}
          menuData={menuData}
          cartItems={cartItems}
          onAddToCart={handleAddToCart}
          onOpenCart={() => setIsCartOpen(true)}
          onBack={() => setActiveView('DASHBOARD')}
        />
      )}

      {activeView === 'ORDERS' && (
        <QrTableOrdersView
          sessionData={sessionData}
          orderHistory={orderHistory}
          onBack={() => setActiveView('DASHBOARD')}
          onRefresh={fetchOrderHistory}
          onOpenCallStaff={() => setIsCallStaffOpen(true)}
          isLoading={isLoadingHistory}
        />
      )}

      {activeView === 'REWARDS' && (
        <QrRewardsView
          token={token}
          sessionData={sessionData}
          guest={guest}
          onBack={() => setActiveView('DASHBOARD')}
          onOpenRegister={() => setIsRegisterOpen(true)}
          onRedeemSuccess={() => {
            fetchOrderHistory();
            fetchSession();
          }}
        />
      )}

      {/* Cart Drawer */}
      <QrCartDrawer
        isOpen={isCartOpen}
        token={token}
        guest={guest}
        cartItems={cartItems}
        availableProductIds={availableProductIds}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onSubmitSuccess={() => {
          fetchOrderHistory();
          setActiveView('ORDERS');
        }}
      />

      {/* Call Staff Modal */}
      <QrCallStaffModal
        isOpen={isCallStaffOpen}
        token={token}
        onClose={() => setIsCallStaffOpen(false)}
      />

      {/* Payment Request Modal */}
      <QrPaymentRequestModal
        isOpen={isPaymentRequestOpen}
        token={token}
        totalAmount={orderHistory?.totalAmount ?? sessionData.order.totalAmount}
        onClose={() => setIsPaymentRequestOpen(false)}
      />

      {/* Change Guest Modal */}
      <QrChangeGuestModal
        isOpen={isChangeGuestOpen}
        token={token}
        guest={guest}
        hasRedeemedPoints={Boolean(sessionData?.order?.hasRedeemedPoints)}
        onClose={() => setIsChangeGuestOpen(false)}
        onGuestUpdated={handleJoinSuccess}
        onOpenRegister={() => setIsRegisterOpen(true)}
      />

      {/* Quick Register Modal */}
      <QrRegisterModal
        isOpen={isRegisterOpen}
        token={token}
        guest={guest}
        onClose={() => setIsRegisterOpen(false)}
        onRegistered={handleJoinSuccess}
      />
    </div>
  );
}
