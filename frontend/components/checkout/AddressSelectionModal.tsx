'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Circle,
  Loader2,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AddressModal, { Address } from '@/components/AddressModal';

interface AddressSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  addresses: Address[];
  selectedAddressId: string;
  onSelectAddress: (addressId: string) => void;
  onAddressesUpdated: () => Promise<void> | void;
}

export default function AddressSelectionModal({
  isOpen,
  onClose,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddressesUpdated,
}: AddressSelectionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [currentSelectedId, setCurrentSelectedId] = useState<string>(selectedAddressId);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync selected ID when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentSelectedId(selectedAddressId);
    }
  }, [isOpen, selectedAddressId]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddress(addr);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (addrId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa địa chỉ này?')) return;

    setDeletingId(addrId);
    const toastId = toast.loading('Đang xóa địa chỉ...');
    try {
      const res = await fetch(`/api/addresses/${addrId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Đã xóa địa chỉ thành công', { id: toastId });
        await onAddressesUpdated();
      } else {
        toast.error('Không thể xóa địa chỉ', { id: toastId });
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi xóa', { id: toastId });
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmSelect = () => {
    if (currentSelectedId) {
      onSelectAddress(currentSelectedId);
    }
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalElement = (
    <>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Window */}
        <div
          className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-50 text-red-600">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Địa chỉ nhận hàng
                </h3>
                <p className="text-xs text-slate-500 font-normal">
                  Chọn địa chỉ giao hàng hoặc thêm địa chỉ mới
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-3.5">
            {/* Add New Address Button */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="w-full flex items-center justify-center gap-2 p-3.5 bg-red-50/60 hover:bg-red-50 text-red-600 border-2 border-dashed border-red-200 rounded-2xl font-bold text-xs sm:text-sm transition-all hover:border-red-400"
            >
              <Plus size={18} />
              <span>Thêm địa chỉ nhận hàng mới</span>
            </button>

            {/* Address List */}
            {addresses.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                <MapPin className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="font-bold text-slate-700 text-sm">Chưa có địa chỉ nào được lưu</p>
                <p className="text-xs text-slate-400 mt-1">
                  Hãy thêm địa chỉ giao hàng để đặt món nhanh chóng
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {addresses.map((addr) => {
                  const isSelected = currentSelectedId === addr.id;
                  const isDeleting = deletingId === addr.id;

                  return (
                    <div
                      key={addr.id}
                      onClick={() => setCurrentSelectedId(addr.id)}
                      className={`relative flex items-start justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-red-500 bg-red-50/20 shadow-xs'
                          : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                      }`}
                    >
                      {/* Radio Selection Indicator */}
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xs">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
                        )}
                      </div>

                      {/* Address Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {addr.recipientName}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="font-semibold text-xs text-slate-600">
                            {addr.phone}
                          </span>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                              Mặc định
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                          {addr.streetDetail}
                          {addr.ward ? `, ${addr.ward}` : ''}
                          {addr.province ? `, ${addr.province}` : ''}
                        </p>
                      </div>

                      {/* Action Buttons: Edit & Delete */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(addr, e)}
                          title="Chỉnh sửa địa chỉ"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(addr.id, e)}
                          disabled={isDeleting}
                          title="Xóa địa chỉ"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 size={15} className="animate-spin text-red-600" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmSelect}
              disabled={!currentSelectedId || addresses.length === 0}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors"
            >
              Xác nhận chọn địa chỉ
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {isFormModalOpen && (
        <AddressModal
          address={editingAddress}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={async () => {
            await onAddressesUpdated();
            setIsFormModalOpen(false);
          }}
        />
      )}
    </>
  );

  return createPortal(modalElement, document.body);
}
