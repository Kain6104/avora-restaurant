'use client';

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Users,
  ShieldCheck,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Area {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
}

interface Table {
  id: string;
  tableCode: string;
  name: string;
  capacity: number;
  minCapacity: number;
  status: 'ACTIVE' | 'OUT_OF_SERVICE';
  areaId?: string;
  area?: Area;
}

export default function AdminTablesPage() {
  const { availableBranches, user } = useAdmin();
  const { t, locale } = useLanguage();
  const branches = availableBranches || [];

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Table Modal
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableCode, setTableCode] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');
  const [capacity, setCapacity] = useState<number>(4);
  const [tableAreaId, setTableAreaId] = useState<string>('');
  const [tableStatus, setTableStatus] = useState<'ACTIVE' | 'OUT_OF_SERVICE'>('ACTIVE');
  const [tableSubmitting, setTableSubmitting] = useState<boolean>(false);

  // Area Modal
  const [isAreaModalOpen, setIsAreaModalOpen] = useState<boolean>(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaName, setAreaName] = useState<string>('');
  const [areaDesc, setAreaDesc] = useState<string>('');
  const [areaSubmitting, setAreaSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.branchId) {
      setSelectedBranchId(user.branchId);
    } else if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [user, branches, selectedBranchId]);

  const fetchData = async () => {
    if (!selectedBranchId) return;
    try {
      setLoading(true);
      const [areasRes, tablesRes] = await Promise.all([
        fetch(`/api/admin/tables/areas?branchId=${selectedBranchId}`, { credentials: 'include' }),
        fetch(`/api/admin/tables?branchId=${selectedBranchId}`, { credentials: 'include' }),
      ]);

      if (areasRes.ok) {
        const json = await areasRes.json();
        setAreas(json?.data || []);
      }
      if (tablesRes.ok) {
        const json = await tablesRes.json();
        setTables(json?.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error(t('tables.loadError', 'Lỗi khi tải dữ liệu bàn và khu vực'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  // Open Table Modal
  const openCreateTable = () => {
    setEditingTable(null);
    setTableCode('');
    setTableName('');
    setCapacity(4);
    setTableAreaId(areas[0]?.id || '');
    setTableStatus('ACTIVE');
    setIsTableModalOpen(true);
  };

  const openEditTable = (table: Table) => {
    setEditingTable(table);
    setTableCode(table.tableCode);
    setTableName(table.name);
    setCapacity(table.capacity);
    setTableAreaId(table.areaId || areas[0]?.id || '');
    setTableStatus(table.status);
    setIsTableModalOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTableSubmitting(true);
      const url = editingTable ? `/api/admin/tables/${editingTable.id}` : '/api/admin/tables';
      const method = editingTable ? 'PUT' : 'POST';

      const payload = {
        branchId: selectedBranchId,
        tableCode: tableCode.trim(),
        name: tableName.trim(),
        capacity: Number(capacity),
        areaId: tableAreaId || undefined,
        status: tableStatus,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          editingTable
            ? (locale === 'en' ? 'Table updated successfully' : 'Đã cập nhật thông tin bàn')
            : (locale === 'en' ? 'Table created successfully' : 'Đã thêm bàn mới')
        );
        setIsTableModalOpen(false);
        fetchData();
      } else {
        toast.error(data?.message || t('common.actionFailed', 'Thao tác không thành công'));
      }
    } catch (err) {
      toast.error(t('common.connError', 'Lỗi kết nối'));
    } finally {
      setTableSubmitting(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm(locale === 'en' ? 'Are you sure you want to delete this table?' : 'Bạn có chắc chắn muốn xóa bàn này?')) return;
    try {
      const res = await fetch(`/api/admin/tables/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(locale === 'en' ? 'Table deleted' : 'Đã xóa bàn');
        fetchData();
      }
    } catch (e) {
      toast.error(locale === 'en' ? 'Failed to delete table' : 'Lỗi xóa bàn');
    }
  };

  // Toggle Table Status
  const handleToggleTableStatus = async (table: Table) => {
    const newStatus = table.status === 'ACTIVE' ? 'OUT_OF_SERVICE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(
          locale === 'en'
            ? `Table ${table.tableCode} status changed to ${newStatus === 'ACTIVE' ? 'Active' : 'Out of service'}`
            : `Bàn ${table.tableCode} chuyển sang ${newStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}`
        );
        fetchData();
      }
    } catch (e) {
      toast.error(t('common.updateError', 'Lỗi cập nhật'));
    }
  };

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 shrink-0" />
            <span>{t('tables.title', 'Sơ Đồ Bàn & Khu Vực')}</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">
            {t('tables.subtitle', 'Quản lý sơ đồ bàn, sức chứa và phân bố chỗ ngồi tại từng chi nhánh AVORA')}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Branch selector */}
          {user?.role === 'ADMIN' && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 shadow-xs focus:outline-none h-9 sm:h-10"
            >
              {branches.map((b: { id: string; name: string }) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={openCreateTable}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[38px] px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('tables.addTable', 'Thêm bàn mới')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-red-600" />
          <span className="text-xs">{t('common.loading', 'Đang tải dữ liệu...')}</span>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Areas summary pills */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {areas.map((area) => {
              const count = tables.filter((t) => t.areaId === area.id).length;
              const totalCap = tables
                .filter((t) => t.areaId === area.id)
                .reduce((sum, t) => sum + t.capacity, 0);

              return (
                <div
                  key={area.id}
                  className="bg-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-100 shadow-xs flex items-center gap-2 sm:gap-2.5"
                >
                  <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <strong className="text-xs text-slate-800 block truncate">{area.name}</strong>
                    <span className="text-[10px] text-slate-400">
                      {count} {locale === 'en' ? 'tables' : 'bàn'} • {totalCap} {locale === 'en' ? 'seats' : 'chỗ'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tables Grid grouped by Area */}
          {areas.map((area) => {
            const areaTables = tables.filter((t) => t.areaId === area.id);

            return (
              <div key={area.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-3 sm:p-5">
                <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-900">{area.name}</h3>
                    <p className="text-[10px] sm:text-xs text-slate-400">{area.description || (locale === 'en' ? 'Dining Area' : 'Khu vực phục vụ')}</p>
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                    {areaTables.length} {locale === 'en' ? 'tables' : 'bàn'} ({areaTables.reduce((s, t) => s + t.capacity, 0)} {locale === 'en' ? 'seats' : 'chỗ'})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                  {areaTables.map((tbl) => {
                    const isActive = tbl.status === 'ACTIVE';

                    return (
                      <div
                        key={tbl.id}
                        className={`p-2.5 sm:p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isActive
                            ? 'bg-slate-50/80 border-slate-200 hover:border-red-300'
                            : 'bg-rose-50/50 border-rose-200 opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-mono font-bold text-slate-900 text-sm">{tbl.tableCode}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleTableStatus(tbl)}
                              title={isActive ? (locale === 'en' ? 'Suspend service' : 'Tạm ngưng phục vụ') : (locale === 'en' ? 'Reactivate' : 'Kích hoạt lại')}
                              className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}
                            />
                          </div>
                          <span className="text-xs text-slate-600 block line-clamp-1">{tbl.name}</span>
                          <span className="text-[11px] font-bold text-slate-800 mt-1 block">
                            {tbl.capacity} {locale === 'en' ? 'seats' : 'chỗ'}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-1 border-t border-slate-100 pt-2 mt-2">
                          <button
                            type="button"
                            onClick={() => openEditTable(tbl)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTable(tbl.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE/EDIT TABLE MODAL */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-1.5 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 max-w-md w-full shadow-2xl max-h-[96vh] overflow-y-auto flex flex-col">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
              {editingTable ? t('tables.editTable', 'Chỉnh Sửa Thông Tin Bàn') : t('tables.addTable', 'Thêm Bàn Mới')}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
              {locale === 'en'
                ? 'Configure table identifier code, guest capacity, and dining area.'
                : 'Cấu hình mã bàn, số chỗ ngồi và khu vực phục vụ tương ứng.'}
            </p>

            <form onSubmit={handleSaveTable} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('tables.tableCode', 'Mã Bàn (Code)')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: M-01, VIP-01"
                  value={tableCode}
                  onChange={(e) => setTableCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-red-500 font-mono h-9 sm:h-10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('tables.tableName', 'Tên Hiển Thị')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Bàn M01"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t('tables.capacity', 'Sức Chứa (Chỗ)')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t('tables.area', 'Khu Vực')}
                  </label>
                  <select
                    value={tableAreaId}
                    onChange={(e) => setTableAreaId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('tables.status', 'Trạng Thái Vận Hành')}
                </label>
                <select
                  value={tableStatus}
                  onChange={(e: any) => setTableStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                >
                  <option value="ACTIVE">{t('tables.statusActive', 'Đang hoạt động (ACTIVE)')}</option>
                  <option value="OUT_OF_SERVICE">{t('tables.statusOutOfService', 'Tạm ngưng phục vụ (OUT_OF_SERVICE)')}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 sm:gap-2.5 pt-2 sm:pt-3">
                <button
                  type="button"
                  onClick={() => setIsTableModalOpen(false)}
                  className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {t('common.cancel', 'Hủy')}
                </button>
                <button
                  type="submit"
                  disabled={tableSubmitting || !tableCode}
                  className="min-h-[40px] px-4 sm:px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {tableSubmitting ? t('tables.saving', 'Đang lưu...') : t('tables.save', 'Lưu bàn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
