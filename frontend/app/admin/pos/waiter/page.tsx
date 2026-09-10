'use client';

import React from 'react';
import { useWaiterStore } from '@/store/useWaiterStore';
import TableMapView from '@/components/waiter/views/TableMapView';
import ActiveOrdersView from '@/components/waiter/views/ActiveOrdersView';
import QrOrdersView from '@/components/waiter/views/QrOrdersView';
import OrderDetailView from '@/components/waiter/order/OrderDetailView';
import MenuView from '@/components/waiter/views/MenuView';
import SettingsView from '@/components/waiter/views/SettingsView';

export default function WaiterAppPage() {
  const { activeTab, selectedTableId, selectedOrderId } = useWaiterStore();

  // If user is adding items to a selected table/order, show MenuView
  if ((selectedOrderId || selectedTableId) && activeTab === 'MENU') {
    return <MenuView />;
  }

  // If an order or table is selected, drill down to OrderDetailView
  if (selectedOrderId || selectedTableId) {
    return <OrderDetailView />;
  }

  // Otherwise, render the active root tab view
  return (
    <div className="w-full h-full relative bg-slate-50">
      {activeTab === 'TABLES' && <TableMapView />}
      {activeTab === 'ORDERS' && <ActiveOrdersView />}
      {activeTab === 'QR' && <QrOrdersView />}
      {activeTab === 'SETTINGS' && <SettingsView />}
    </div>
  );
}
