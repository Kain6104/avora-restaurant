'use client';

import React, { useEffect } from 'react';
import { useQrSession, getOrCreateDeviceId } from '@/components/qr-order/QrSessionContext';
import { QrWelcomeView } from '@/components/qr-order/QrWelcomeView';
import { QrDashboardView } from '@/components/qr-order/QrDashboardView';
import { QrMenuView } from '@/components/qr-order/QrMenuView';
import { QrOptionSheet } from '@/components/qr-order/QrOptionSheet';
import { QrCartDrawer } from '@/components/qr-order/QrCartDrawer';
import { QrTableOrdersView } from '@/components/qr-order/QrTableOrdersView';
import { QrRewardsView } from '@/components/qr-order/QrRewardsView';
import { QrActivityHistoryView } from '@/components/qr-order/QrActivityHistoryView';
import { QrCallStaffModal } from '@/components/qr-order/QrCallStaffModal';
import { QrPaymentRequestModal } from '@/components/qr-order/QrPaymentRequestModal';
import { QrChangeGuestModal } from '@/components/qr-order/QrChangeGuestModal';
import { QrRegisterModal } from '@/components/qr-order/QrRegisterModal';
import { QrVatInvoiceModal } from '@/components/qr-order/QrVatInvoiceModal';
import { QrProduct } from '@/components/qr-order/qr-types';
import { Loader2, AlertCircle } from 'lucide-react';

export default function QrOrderPage() {
  const {
    token,
    sessionData,
    isLoadingSession,
    sessionError,
    guest,
    handleJoinSuccess,
    fetchSession,

    cartItems,
    setCartItems,
    totalCartCount,
    handleAddCartItem,
    handleQuickAddProduct,
    handleUpdateSimpleQuantity,
    handleUpdateCartQuantity,
    handleEditCartItem,
    handleSaveEditedCartItem,
    handleRemoveCartItem,

    orderHistory,
    isLoadingHistory,
    fetchOrderHistory,

    availableProductIds,
    setAvailableProductIds,
    productCatalog,
    productCatalogRef,
    setProductCatalog,
    menuCache,
    setMenuCache,
    refreshAvailableMenu,

    menuRefreshTrigger,
    setMenuRefreshTrigger,
    activityRefreshTrigger,
    setActivityRefreshTrigger,

    isSocketConnected,

    selectedProductState,
    setSelectedProductState,
    editingCartItem,
    setEditingCartItem,

    visitedViews,

    activeView,
    activeModal,
    navigateScreen,
    goBackToDashboard,
    openModal,
    closeModal,
  } = useQrSession();

  // Prevent iOS Safari pinch-to-zoom & double-tap zoom on /qr/* (except inside Viewer.js lightbox)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let lastTouchEnd = 0;

    const isInsideImageViewer = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('.viewer-container'));

    const onGestureStart = (e: Event) => {
      if (isInsideImageViewer(e.target)) return;
      e.preventDefault();
    };
    const onTouchStart = (e: TouchEvent) => {
      if (isInsideImageViewer(e.target)) return;
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isInsideImageViewer(e.target)) return;
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (isInsideImageViewer(e.target)) return;
      const now = Date.now();
      if (now - lastTouchEnd <= 280) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('gesturestart', onGestureStart, { passive: false });
    document.addEventListener('gesturechange', onGestureStart, { passive: false });
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', onGestureStart);
      document.removeEventListener('gesturechange', onGestureStart);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Loading State
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-9 h-9 animate-spin text-[#DA251D] mb-3" />
        <h2 className="text-sm font-bold text-slate-800">Đang kết nối bàn ăn...</h2>
        <p className="text-xs text-slate-500 mt-1">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }

  // Error State
  if (sessionError || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-xl bg-red-100 text-[#DA251D] flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Không thể mở phiên gọi món</h2>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          {sessionError || 'Mã QR đã hết hạn, bàn chưa được mở hoặc đã hoàn tất thanh toán.'}
        </p>
        <button
          type="button"
          onClick={() => void fetchSession(true)}
          className="px-5 py-2.5 rounded-xl bg-[#DA251D] text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
        >
          Thử lại
        </button>
      </div>
    );
  }

  // Pre-join Welcome View
  if (!guest) {
    return (
      <>
        <QrWelcomeView
          token={token}
          sessionData={sessionData}
          onJoinSuccess={handleJoinSuccess}
          onOpenRegister={() => openModal('REGISTER')}
        />

        <QrRegisterModal
          isOpen={activeModal === 'REGISTER'}
          token={token}
          guest={{
            id: '',
            guestName: '',
            deviceSessionId: getOrCreateDeviceId(),
            memberVerified: false,
          }}
          onClose={closeModal}
          onRegistered={handleJoinSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-transparent touch-manipulation">
      <div className={activeView === 'DASHBOARD' ? 'block' : 'hidden'}>
        <QrDashboardView
          token={token}
          sessionData={sessionData}
          guest={guest}
          cartCount={totalCartCount}
          orderItemsCount={
            orderHistory?.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) ?? 0
          }
          isSocketConnected={isSocketConnected}
          onOpenMenu={() => navigateScreen('MENU')}
          onOpenTableOrders={() => {
            void fetchOrderHistory();
            navigateScreen('ORDERS');
          }}
          onOpenCallStaff={() => openModal('CALL_STAFF')}
          onOpenPayment={() => openModal('PAYMENT')}
          onOpenVatInvoice={() => openModal('VAT_INVOICE')}
          onOpenChangeGuest={() => openModal('CHANGE_GUEST')}
          onOpenRewards={() => navigateScreen('REWARDS')}
          onOpenActivity={() => navigateScreen('ACTIVITY')}
          onOpenCart={() => openModal('CART')}
        />
      </div>

      {visitedViews.MENU && (
        <div className={activeView === 'MENU' ? 'block' : 'hidden'}>
          <QrMenuView
            token={token}
            sessionData={sessionData}
            cartItems={cartItems}
            initialMenuData={menuCache}
            menuRefreshTrigger={menuRefreshTrigger}
            onBack={goBackToDashboard}
            onSelectProduct={(product, pricingMode) => {
              setEditingCartItem(null);
              setSelectedProductState({ product, pricingMode });
              openModal('PRODUCT');
            }}
            onQuickAddProduct={handleQuickAddProduct}
            onUpdateSimpleQuantity={handleUpdateSimpleQuantity}
            onOpenCart={() => openModal('CART')}
            onCategoriesLoaded={(validSet, catalogProducts) => {
              setAvailableProductIds(validSet);
              if (catalogProducts?.length) {
                const map: Record<string, QrProduct> = { ...productCatalogRef.current };
                catalogProducts.forEach((p) => {
                  map[p.id] = p;
                });
                productCatalogRef.current = map;
                setProductCatalog(map);
              }
            }}
            onMenuDataSynced={(data) => {
              setMenuCache(data);
            }}
          />
        </div>
      )}

      {visitedViews.ORDERS && (
        <div className={activeView === 'ORDERS' ? 'block' : 'hidden'}>
          <QrTableOrdersView
            sessionData={sessionData}
            orderHistory={orderHistory}
            onBack={goBackToDashboard}
            onRefresh={fetchOrderHistory}
            onOpenCallStaff={() => openModal('CALL_STAFF')}
            isLoading={isLoadingHistory}
          />
        </div>
      )}

      {visitedViews.REWARDS && (
        <div className={activeView === 'REWARDS' ? 'block' : 'hidden'}>
          <QrRewardsView
            token={token}
            sessionData={sessionData}
            guest={guest}
            onBack={goBackToDashboard}
            onOpenRegister={() => openModal('REGISTER')}
            onRedeemSuccess={() => {
              void fetchOrderHistory();
              void fetchSession(true);
            }}
          />
        </div>
      )}

      {visitedViews.ACTIVITY && (
        <div className={activeView === 'ACTIVITY' ? 'block' : 'hidden'}>
          <QrActivityHistoryView
            token={token}
            sessionData={sessionData}
            refreshTrigger={activityRefreshTrigger}
            onBack={goBackToDashboard}
            onOpenCallStaff={() => openModal('CALL_STAFF')}
          />
        </div>
      )}

      {/* Bottom Sheet Modals */}
      {activeModal === 'PRODUCT' && selectedProductState && (
        <QrOptionSheet
          key={`${selectedProductState.product.id}_${editingCartItem?.localId || 'new'}`}
          product={selectedProductState.product}
          pricingMode={selectedProductState.pricingMode}
          editingItem={editingCartItem}
          cartItems={cartItems}
          hasActiveBuffet={Boolean(sessionData.buffetSession?.status === 'ACTIVE')}
          maxItemsPerSubmission={
            sessionData.buffetSession?.status === 'ACTIVE'
              ? (sessionData.buffetSession?.buffetPackage?.maxItemsPerSubmission ?? null)
              : null
          }
          onClose={() => {
            if (editingCartItem) {
              setEditingCartItem(null);
              setSelectedProductState(null);
              openModal('CART');
            } else {
              closeModal();
            }
          }}
          onAddToCart={handleAddCartItem}
          onSaveEdit={handleSaveEditedCartItem}
        />
      )}

      {activeModal === 'CART' && (
        <QrCartDrawer
          token={token}
          tableName={sessionData.table.name}
          guest={guest}
          cartItems={cartItems}
          availableProductIds={availableProductIds}
          productCatalog={productCatalog}
          hasActiveBuffet={Boolean(sessionData.buffetSession?.status === 'ACTIVE')}
          maxItemsPerSubmission={
            sessionData.buffetSession?.status === 'ACTIVE'
              ? (sessionData.buffetSession?.buffetPackage?.maxItemsPerSubmission ?? null)
              : null
          }
          onClose={closeModal}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveCartItem}
          onEditItem={handleEditCartItem}
          onClearCart={() => setCartItems([])}
          onSubmitSuccess={() => {
            void fetchOrderHistory();
            void refreshAvailableMenu();
            setMenuRefreshTrigger((n) => n + 1);
            navigateScreen('ORDERS');
          }}
        />
      )}

      <QrCallStaffModal
        isOpen={activeModal === 'CALL_STAFF'}
        token={token}
        onClose={closeModal}
        onSuccess={fetchOrderHistory}
      />

      <QrPaymentRequestModal
        isOpen={activeModal === 'PAYMENT'}
        token={token}
        totalAmount={orderHistory?.totalAmount ?? sessionData.order.totalAmount}
        orderCode={orderHistory?.orderCode ?? sessionData.order.orderCode}
        tableName={sessionData.table.name}
        onClose={closeModal}
        onSuccess={fetchOrderHistory}
      />

      <QrVatInvoiceModal
        isOpen={activeModal === 'VAT_INVOICE'}
        token={token}
        order={sessionData.order}
        guest={guest}
        onClose={closeModal}
        onSuccess={() => {
          void fetchSession(true);
          setActivityRefreshTrigger((n) => n + 1);
        }}
      />

      {activeModal === 'CHANGE_GUEST' && (
        <QrChangeGuestModal
          isOpen={true}
          token={token}
          guest={guest}
          hasRedeemedPoints={Boolean(sessionData?.order?.hasRedeemedPoints)}
          onClose={closeModal}
          onGuestUpdated={handleJoinSuccess}
          onOpenRegister={() => openModal('REGISTER')}
        />
      )}

      <QrRegisterModal
        isOpen={activeModal === 'REGISTER'}
        token={token}
        guest={guest}
        onClose={closeModal}
        onRegistered={handleJoinSuccess}
      />
    </div>
  );
}
