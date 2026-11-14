'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Users,
  Lock,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function Avo1OnboardingWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'queues' | 'submissions' | 'exceptions' | 'gates'>('queues');
  const [exceptionFilter, setExceptionFilter] = useState<string>('ALL');

  // Upload Submission Form
  const [uploadForm, setUploadForm] = useState({
    workstreamId: 'WS-02-RECIPES',
    workstreamType: 'RECIPE_WORKBOOK',
    fileName: '',
    content: '',
    createDraftRevisionIfApproved: false,
  });

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/inventory/onboarding/avo1?branchCode=AVO1', {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Error loading AVO1 onboarding workspace:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleAssignTask = async (workstreamId: string, employeeId: string) => {
    if (!employeeId) return;
    try {
      const res = await fetch(`/api/admin/inventory/onboarding/avo1/tasks/${workstreamId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId }),
      });
      const json = await res.json();
      if (json.success) fetchWorkspace();
      else alert(json.message || 'Lỗi phân công nhân sự');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/onboarding/avo1/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...uploadForm, branchCode: 'AVO1' }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Đã tiếp nhận hồ sơ ${json.data?.id} (SHA-256: ${json.data?.fileSha256?.slice(0, 12)}...)`);
        setUploadForm({ ...uploadForm, fileName: '', content: '' });
        setActiveTab('submissions');
        fetchWorkspace();
      } else {
        alert(json.message || 'Tệp không hợp lệ hoặc trùng lặp');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReviewSubmission = async (id: string, approved: boolean) => {
    const rejectionReason = approved ? undefined : prompt('Nhập lý do từ chối:') || 'Chưa đạt yêu cầu nghiệp vụ';
    try {
      const res = await fetch(`/api/admin/inventory/onboarding/avo1/submissions/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved, rejectionReason }),
      });
      const json = await res.json();
      if (json.success) fetchWorkspace();
      else alert(json.message || 'Lỗi phê duyệt hồ sơ');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCommitSubmission = async (id: string) => {
    if (!confirm('Xác nhận commit hồ sơ đã phê duyệt vào dữ liệu DRAFT/hệ thống?')) return;
    try {
      const res = await fetch(`/api/admin/inventory/onboarding/avo1/submissions/${id}/commit`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        alert(`Commit thành công (${json.data?.commitRef})`);
        fetchWorkspace();
      } else {
        alert(json.message || 'Không thể commit hồ sơ');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAssignException = async (exceptionId: string, employeeId: string) => {
    if (!employeeId) return;
    try {
      const res = await fetch(`/api/admin/inventory/onboarding/avo1/exceptions/${exceptionId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId }),
      });
      const json = await res.json();
      if (json.success) fetchWorkspace();
      else alert(json.message || 'Lỗi gán nhân sự xử lý ngoại lệ');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCloseException = async (exceptionId: string) => {
    const evidenceRef = prompt('Nhập mã bằng chứng xác nhận (VD: SUB-xxx / APR-xxx):');
    if (!evidenceRef) return;
    const closureReason = prompt('Nhập lý do đóng ngoại lệ:') || 'Đã xác minh và phê duyệt';
    try {
      const res = await fetch(`/api/admin/inventory/onboarding/avo1/exceptions/${exceptionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ evidenceRef, closureReason }),
      });
      const json = await res.json();
      if (json.success) fetchWorkspace();
      else alert(json.message || 'Không thể đóng ngoại lệ');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const ov = data?.executiveOverview || {};
  const prog = data?.progress || {};
  const employees = data?.availableEmployees || [];

  const progressBars = [
    { label: '1. Công Thức Published', pct: prog.recipeCompletionPercent || 0 },
    { label: '2. 664 Option Modifiers', pct: prog.modifierResolutionPercent || 0 },
    { label: '3. Quyết Định Set/Buffet', pct: prog.compositeDecisionsPercent || 0 },
    { label: '4. Danh Mục Nguyên Liệu', pct: prog.ingredientCompletenessPercent || 0 },
    { label: '5. Hồ Sơ & HĐ Nhà Cung Cấp', pct: prog.supplierReadinessPercent || 0 },
    { label: '6. Đối Chiếu Seed AVO1', pct: prog.seedReconciliationPercent || 0 },
    { label: '7. Kiểm Kê Tồn Đầu Kỳ', pct: prog.openingStocktakePercent || 0 },
    { label: '8. Kiểm Thử WPF/POS/KDS', pct: prog.hardwareAcceptancePercent || 0 },
    { label: '9. Phân Công Ngoại Lệ', pct: prog.exceptionOwnershipPercent || 0 },
    { label: '10. Phê Duyệt Stage B', pct: prog.stageBAuthorizationPercent || 0 },
  ];

  const filteredExceptions = (data?.exceptions || []).filter((ex: any) => {
    if (exceptionFilter === 'ALL') return true;
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(exceptionFilter)) return ex.severity === exceptionFilter;
    return ex.approvalStatus === exceptionFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="AVO1 Business Onboarding Workspace (Avora West Lake)"
        subtitle="Không gian điều phối thu thập dữ liệu nghiệp vụ, phê duyệt chéo (Maker-Checker), kiểm soát bằng chứng và 12 cổng Stage B"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/operations/inventory-monitor"
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Inventory Monitor
            </Link>
            <button
              onClick={fetchWorkspace}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Đồng Bộ Trạng Thái
            </button>
          </div>
        }
      />

      {/* A. EXECUTIVE ONBOARDING OVERVIEW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <AdminCard className="p-4 border-l-4 border-l-[#da251d]">
          <p className="font-bold uppercase text-[10px] text-slate-500">Sẵn Sàng Pilot AVO1</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{ov.overallReadinessPercent || 0}%</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Stage A An Toàn ({data?.targetBranch?.inventoryPolicy || 'WARN_AND_ALLOW'})
          </p>
        </AdminCard>
        <AdminCard className="p-4 border-l-4 border-l-amber-500">
          <p className="font-bold uppercase text-[10px] text-slate-500">Workstreams Chặn / Hoàn Tất</p>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {ov.blockedWorkstreams || 0} Chặn / {ov.completedWorkstreams || 0} Xong
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Thiếu dữ liệu thực tế: {ov.outstandingDataRequests || 0}</p>
        </AdminCard>
        <AdminCard className="p-4 border-l-4 border-l-indigo-500">
          <p className="font-bold uppercase text-[10px] text-slate-500">Hồ Sơ Chờ Duyệt / Từ Chối</p>
          <p className="text-2xl font-black text-indigo-700 mt-1">
            {ov.pendingApprovals || 0} Chờ / {ov.rejectedSubmissions || 0} Từ chối
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Maker-Checker Bắt Buộc</p>
        </AdminCard>
        <AdminCard className="p-4 border-l-4 border-l-rose-600">
          <p className="font-bold uppercase text-[10px] text-slate-500">Ngoại Lệ Nghiêm Trọng</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{ov.criticalOperationalExceptions || 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Audit: {ov.lastAuditTime ? new Date(ov.lastAuditTime).toLocaleTimeString('vi-VN') : '—'}
          </p>
        </AdminCard>
      </div>

      {/* D. TEN REAL-DATA ONBOARDING PROGRESS BARS */}
      <AdminCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-black uppercase text-slate-800">
            Tiến Độ Thực Tế Theo Dữ Liệu Đã Xác Thực (Không Tính File Mẫu Trống)
          </h4>
          <span className="text-[11px] text-slate-500 font-semibold">
            4 chi nhánh khác (AVO2, AVO-Q2, AVO-Q1, AVO-L81): Cách ly Stage A (OFF)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {progressBars.map((b) => (
            <div key={b.label} className="p-2.5 bg-slate-50 rounded-lg border">
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span className="truncate">{b.label}</span>
                <span>{b.pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${b.pct === 100 ? 'bg-emerald-600' : 'bg-[#da251d]'}`}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* TABS */}
      <div className="flex flex-wrap items-center border-b border-slate-200 gap-1 bg-white px-4 rounded-xl shadow-xs">
        {[
          { key: 'queues', label: 'Hàng Đợi 8 Phòng Ban', count: (data?.tasks || []).length },
          { key: 'submissions', label: 'Nộp & Phê Duyệt Hồ Sơ (SoD)', count: (data?.submissions || []).length },
          { key: 'exceptions', label: 'Sổ Đăng Ký Ngoại Lệ', count: (data?.exceptions || []).length },
          { key: 'gates', label: '12 Cổng Stage B & Cách Ly Chi Nhánh', count: (data?.gates || []).length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
              activeTab === t.key ? 'border-[#da251d] text-[#da251d]' : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">{t.count}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: DEPARTMENT WORK QUEUES */}
      {activeTab === 'queues' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                  <th className="py-2.5 px-4">Workstream / Phòng Ban</th>
                  <th className="py-2.5 px-4">Mô Tả & Đầu Vào Yêu Cầu</th>
                  <th className="py-2.5 px-4">Nhân Sự Phụ Trách (Thực Tế)</th>
                  <th className="py-2.5 px-4">Yêu Cầu Duyệt & Bằng Chứng</th>
                  <th className="py-2.5 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.tasks || []).map((t: any) => (
                  <tr key={t.workstreamId} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-800">{t.workstreamId}</span>
                      <div className="text-[11px] font-bold text-indigo-700 mt-0.5">{t.department}</div>
                      <div className="text-[10px] text-slate-500">{t.responsibleRole}</div>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="font-bold text-slate-900">{t.description}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Input: {t.requiredInput}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800 mb-1">
                        {t.assignedEmployeeName || 'Chưa phân công'}
                      </p>
                      <select
                        value=""
                        onChange={(e) => handleAssignTask(t.workstreamId, e.target.value)}
                        className="border rounded px-2 py-1 text-[11px] bg-white"
                      >
                        <option value="">-- Gán nhân sự thật --</option>
                        {employees.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.role})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      <p className="text-slate-700 font-semibold">{t.approvalRequirement}</p>
                      <p className="text-slate-500 mt-0.5">
                        Bằng chứng: {t.submittedEvidence || 'Chưa có tệp nộp'}
                      </p>
                      {t.rejectionReason && <p className="text-rose-600 mt-0.5">Từ chối: {t.rejectionReason}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB 2: SUBMISSIONS & MAKER-CHECKER APPROVALS */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <AdminCard className="p-4">
            <h4 className="text-xs font-black uppercase text-slate-800 mb-3 flex items-center gap-2">
              <Upload size={15} className="text-indigo-600" />
              Nộp Tệp Dữ Liệu Nghiệp Vụ (Kiểm Tra & Lưu SHA-256 — Không Tự Phê Duyệt / Không Tự Commit)
            </h4>
            <form onSubmit={handleSubmitEvidence} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <select
                value={uploadForm.workstreamId}
                onChange={(e) => setUploadForm({ ...uploadForm, workstreamId: e.target.value })}
                className="border rounded-lg p-2"
              >
                {(data?.tasks || []).map((t: any) => (
                  <option key={t.workstreamId} value={t.workstreamId}>
                    {t.workstreamId} ({t.department})
                  </option>
                ))}
              </select>
              <select
                value={uploadForm.workstreamType}
                onChange={(e) => setUploadForm({ ...uploadForm, workstreamType: e.target.value })}
                className="border rounded-lg p-2"
              >
                <option value="RECIPE_WORKBOOK">RECIPE_WORKBOOK (Dry-run Recipe Import)</option>
                <option value="MODIFIER_MATRIX">MODIFIER_MATRIX (664 OptionItems)</option>
                <option value="CATALOG_ANOMALIES">CATALOG_ANOMALIES (54 Anomalies)</option>
                <option value="SET_BUFFET_SIGNOFF">SET_BUFFET_SIGNOFF (37 SKUs)</option>
                <option value="INGREDIENT_EXPANSION">INGREDIENT_EXPANSION</option>
                <option value="SUPPLIER_DATA">SUPPLIER_DATA</option>
                <option value="DEV_SEED_APPROVAL">DEV_SEED_APPROVAL</option>
                <option value="OPENING_STOCKTAKE">OPENING_STOCKTAKE</option>
                <option value="HARDWARE_ACCEPTANCE">HARDWARE_ACCEPTANCE</option>
              </select>
              <input
                type="file"
                accept=".csv,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    setUploadForm({
                      ...uploadForm,
                      fileName: file.name,
                      content: String(reader.result || ''),
                    });
                  reader.readAsText(file, 'utf-8');
                }}
                className="border rounded-lg p-1.5 bg-slate-50"
              />
              <div className="md:col-span-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  Giới hạn: .csv / .json &le; 5MB, &le; 5,000 dòng, chuẩn UTF-8 tiếng Việt, chặn trùng SHA-256.
                </span>
                <button
                  type="submit"
                  disabled={!uploadForm.fileName || !uploadForm.content}
                  className="px-4 py-2 bg-[#da251d] disabled:opacity-40 text-white font-bold rounded-lg"
                >
                  Nộp & Kiểm Tra Hồ Sơ
                </button>
              </div>
            </form>
          </AdminCard>

          <AdminCard className="overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                  <th className="py-2.5 px-4">Mã Hồ Sơ / Tệp</th>
                  <th className="py-2.5 px-4">Người Nộp & Thời Gian</th>
                  <th className="py-2.5 px-4">SHA-256 & Validation</th>
                  <th className="py-2.5 px-4">Trạng Thái & Người Duyệt</th>
                  <th className="py-2.5 px-4 text-center">Hành Động (SoD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.submissions || []).map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-slate-900">{s.id}</span>
                      <div className="text-[11px] text-slate-700">{s.fileName}</div>
                      <div className="text-[10px] text-slate-500">{s.workstreamId}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="font-bold">{s.submitterName}</p>
                      <p className="text-[10px] text-slate-500">{new Date(s.submittedAt).toLocaleString('vi-VN')}</p>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px]">
                      <div>{s.fileSha256?.slice(0, 16)}...</div>
                      <div className="text-slate-600">{s.rowCount} dòng</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                        {s.status}
                      </span>
                      {s.approverName && <div className="text-[10px] text-emerald-700 mt-0.5">Duyệt: {s.approverName}</div>}
                      {s.commitRef && <div className="text-[10px] font-mono text-indigo-700">Commit: {s.commitRef}</div>}
                    </td>
                    <td className="py-2.5 px-4 text-center space-x-1">
                      {s.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleReviewSubmission(s.id, true)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => handleReviewSubmission(s.id, false)}
                            className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-bold"
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {s.status === 'APPROVED' && (
                        <button
                          onClick={() => handleCommitSubmission(s.id)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px] font-bold"
                        >
                          Commit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!data?.submissions || data.submissions.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có tệp nghiệp vụ nào được nộp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </AdminCard>
        </div>
      )}

      {/* TAB 3: EXCEPTION OWNERSHIP */}
      {activeTab === 'exceptions' && (
        <AdminCard className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {['ALL', 'CRITICAL', 'HIGH', 'PENDING_INPUT', 'PENDING_APPROVAL', 'COMPLETED'].map((f) => (
              <button
                key={f}
                onClick={() => setExceptionFilter(f)}
                className={`px-3 py-1.5 rounded-lg font-bold ${
                  exceptionFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                  <th className="py-2.5 px-3">Mã / Mức Độ</th>
                  <th className="py-2.5 px-3">Tác Động & Phạm Vi</th>
                  <th className="py-2.5 px-3">Nhân Sự Phụ Trách</th>
                  <th className="py-2.5 px-3">Trạng Thái & Bằng Chứng</th>
                  <th className="py-2.5 px-3 text-center">Đóng (SoD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExceptions.map((ex: any) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold">{ex.id}</span>
                      <div className={`text-[10px] font-black ${ex.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-700'}`}>
                        {ex.severity}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-md">
                      <p className="font-bold text-slate-900">{ex.businessImpact}</p>
                      <p className="text-[10px] text-slate-500">{ex.branchWarehouseScope} • {ex.functionalOwner}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold mb-1">{ex.assignedEmployeeName || 'Chưa gán'}</p>
                      <select
                        value=""
                        onChange={(e) => handleAssignException(ex.id, e.target.value)}
                        className="border rounded px-2 py-1 text-[11px] bg-white"
                      >
                        <option value="">-- Chọn nhân sự --</option>
                        {employees.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100">{ex.approvalStatus}</span>
                      {ex.supportingEvidence && <div className="text-[10px] text-slate-600 mt-0.5">Ev: {ex.supportingEvidence}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {ex.approvalStatus !== 'COMPLETED' && (
                        <button
                          onClick={() => handleCloseException(ex.id)}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[11px] font-bold"
                        >
                          Đóng Ngoại Lệ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB 4: 12-GATE STAGE B & BRANCH ISOLATION */}
      {activeTab === 'gates' && (
        <div className="space-y-4">
          <AdminCard className="overflow-hidden">
            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800">
                12 Cổng Kiểm Soát Bắt Buộc Trước Khi Bật Stage B Cho AVO1
              </h4>
              <span className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 font-black text-[11px]">
                AVO1 STAGE B: {ov.overallReadinessPercent === 100 ? 'ELIGIBLE' : 'BLOCKED — STAGE A ACTIVE'}
              </span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b text-[11px] font-black uppercase text-slate-500">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Cổng Kiểm Soát</th>
                  <th className="py-2.5 px-4">Bằng Chứng Yêu Cầu</th>
                  <th className="py-2.5 px-4">Thực Tế Hiện Tại</th>
                  <th className="py-2.5 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.gates || []).map((g: any) => (
                  <tr key={g.gate} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold">{g.gate}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{g.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{g.requiredEvidence}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{g.actualEvidenceRef}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          g.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>

          <AdminCard className="p-4">
            <h4 className="text-xs font-black uppercase text-slate-800 mb-3">
              Trạng Thái Cách Ly 5 Chi Nhánh (Tuyệt Đối Không Kích Hoạt Đồng Loạt)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              {(data?.allBranchesIsolation || []).map((b: any) => (
                <div key={b.branchCode} className="p-3 rounded-xl border bg-slate-50">
                  <p className="font-mono font-black text-slate-900">{b.branchCode}</p>
                  <p className="text-[11px] text-slate-600">{b.name}</p>
                  <p className="mt-2 font-bold text-[11px] text-amber-800">
                    Activated: {String(b.inventoryActivated)} ({b.inventoryPolicy})
                  </p>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
}

