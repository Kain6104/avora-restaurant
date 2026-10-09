'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ShieldAlert,
  Search,
  Eye,
  Activity,
  User as UserIcon,
  RotateCw,
  Terminal,
} from 'lucide-react';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Pagination,
  Modal,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';

interface AuditLog {
  id: string;
  action: string;
  target: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
    role: string;
  };
}

export default function AdminAuditLogsPage() {
  const { role } = useAdmin();
  const { t, locale } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/audit-logs', {
        search,
        page,
        limit: 15,
      });
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotalCount(data.meta?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      key: 'action',
      header: 'Hành động & Đối tượng',
      render: (log: AuditLog) => (
        <div>
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900">
            <span className="font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
              {log.action}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block truncate max-w-[220px]">
            Target: {log.target}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Người thực hiện',
      render: (log: AuditLog) => (
        <div>
          <p className="font-semibold text-xs sm:text-sm text-slate-800">
            {log.user?.fullName || 'Hệ thống'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-slate-400">{log.user?.email || 'SYSTEM'}</span>
            {log.user?.role && <StatusBadge status={log.user.role} size="sm" />}
          </div>
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP Address',
      render: (log: AuditLog) => (
        <span className="font-mono text-xs text-slate-500">
          {log.ipAddress || '127.0.0.1'}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Thời gian',
      render: (log: AuditLog) => (
        <span className="text-xs text-slate-400 font-medium">
          {new Date(log.createdAt).toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Chi tiết',
      align: 'right' as const,
      render: (log: AuditLog) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(log);
          }}
          aria-label="Xem chi tiết log"
          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12">
      {/* Page Header */}
      <PageHeader
        title={t('auditLogs.title', 'Nhật ký Hoạt động (Audit Logs)')}
        subtitle={t('auditLogs.subtitle', 'Lịch sử các thao tác thay đổi dữ liệu, đăng nhập và bảo mật trên toàn hệ thống')}
        breadcrumbs={[
          { label: t('nav.system', 'Hệ thống') },
          { label: t('nav.auditLogs', 'Audit Logs') },
        ]}
        badge={
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {t('common.total', 'Tổng')} {totalCount} {t('common.results', 'bản ghi')}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={fetchLogs}
            aria-label={t('common.refresh', 'Làm mới')}
            className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors min-h-[38px]"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden xs:inline">{t('common.refresh', 'Làm mới')}</span>
          </button>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        actions={
          search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors min-h-[36px]"
            >
              Xóa lọc
            </button>
          )
        }
      >
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Tìm theo hành động, đối tượng tác động..."
          />
        </div>
      </FilterBar>

      {/* Audit Logs DataTable */}
      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={(l) => l.id}
        loading={loading}
        onRowClick={(l) => setSelectedLog(l)}
        emptyTitle="Chưa có nhật ký hoạt động nào"
        emptyDescription="Các hành động quan trọng như sửa thực đơn, đổi trạng thái đơn sẽ được ghi nhận tại đây."
        mobileCardRender={(l) => (
          <MobileDataCard
            title={
              <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded">
                {l.action}
              </span>
            }
            subtitle={`Target: ${l.target}`}
            badge={l.user?.role ? <StatusBadge status={l.user.role} size="sm" /> : undefined}
            details={[
              {
                label: 'Thực hiện bởi',
                value: l.user?.fullName || 'Hệ thống',
              },
              {
                label: 'IP Address',
                value: l.ipAddress || 'Local',
              },
              {
                label: 'Thời gian',
                value: new Date(l.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                }),
              },
            ]}
            actions={
              <button
                type="button"
                onClick={() => setSelectedLog(l)}
                className="w-full py-2 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors min-h-[38px]"
              >
                <Eye size={14} />
                <span>Xem chi tiết</span>
              </button>
            }
          />
        )}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={15}
        onPageChange={setPage}
        itemName="bản ghi"
      />

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Chi tiết Nhật ký Hoạt động"
        subtitle={`ID: ${selectedLog?.id}`}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400 block">Hành động</span>
                <span className="font-bold text-slate-900">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Đối tượng</span>
                <span className="font-bold text-slate-900">{selectedLog.target}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Người thao tác</span>
                <span className="font-semibold text-slate-800">
                  {selectedLog.user?.fullName || 'SYSTEM'} ({selectedLog.user?.email || 'SYSTEM'})
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">IP & Thời gian</span>
                <span className="text-slate-600">
                  {selectedLog.ipAddress || '127.0.0.1'} ·{' '}
                  {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {selectedLog.oldValue && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Giá trị cũ (Old Value)
                </label>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto">
                  {selectedLog.oldValue}
                </pre>
              </div>
            )}

            {selectedLog.newValue && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Giá trị mới (New Value)
                </label>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto">
                  {selectedLog.newValue}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
