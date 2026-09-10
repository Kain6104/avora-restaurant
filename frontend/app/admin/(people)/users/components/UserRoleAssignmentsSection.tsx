'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Globe,
  Store,
  CheckCircle2,
  X,
  AlertTriangle,
  Building,
} from 'lucide-react';
import { Can } from '@/components/Can';
import { useCan } from '@/hooks/useCan';
import toast from 'react-hot-toast';

interface RoleAssignment {
  id: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  scopeType: string;
  isSystem: boolean;
  branchScope: 'ALL_BRANCHES' | 'SELECTED_BRANCHES';
  isPrimary: boolean;
  branches: { id: string; name: string; branchCode: string }[];
  createdAt: string;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  scopeType: string;
}

interface BranchOption {
  id: string;
  name: string;
  branchCode: string;
}

export default function UserRoleAssignmentsSection({ userId }: { userId: string }) {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form states
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [branchScope, setBranchScope] = useState<'ALL_BRANCHES' | 'SELECTED_BRANCHES'>('ALL_BRANCHES');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canAssign = useCan('staff.roles.assign') || useCan('roles.assign');

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/roles/assignments/user/${userId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setAssignments(json.data ?? (Array.isArray(json) ? json : []));
      }
    } catch (err) {
      console.error('Error fetching user assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRolesAndBranches = async () => {
    try {
      const [rolesRes, branchesRes] = await Promise.all([
        fetch('/api/admin/roles', { credentials: 'include' }),
        fetch('/api/admin/branches', { credentials: 'include' }),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data ?? (Array.isArray(rolesData) ? rolesData : []));
      }
      if (branchesRes.ok) {
        const branchData = await branchesRes.json();
        setBranches(branchData.data ?? (Array.isArray(branchData) ? branchData : []));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchAssignments();
      fetchRolesAndBranches();
    }
  }, [userId]);

  const handleOpenModal = () => {
    setSelectedRoleId(roles[0]?.id || '');
    setBranchScope('ALL_BRANCHES');
    setSelectedBranchIds(branches.length > 0 ? [branches[0].id] : []);
    setIsPrimary(assignments.length === 0);
    setIsModalOpen(true);
  };

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoleId) {
      toast.error('Vui lòng chọn vai trò');
      return;
    }

    if (branchScope === 'SELECTED_BRANCHES' && selectedBranchIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chi nhánh');
      return;
    }

    try {
      setSubmitting(true);
      toast.loading('Đang gán vai trò...', { id: 'assign-role' });

      const res = await fetch('/api/admin/roles/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          roleId: selectedRoleId,
          branchScope,
          branchIds: branchScope === 'SELECTED_BRANCHES' ? selectedBranchIds : [],
          isPrimary,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Đã gán vai trò thành công', { id: 'assign-role' });
        setIsModalOpen(false);
        fetchAssignments();
      } else {
        toast.error(json.message || 'Gán vai trò thất bại', { id: 'assign-role' });
      }
    } catch (err) {
      toast.error('Lỗi khi gửi yêu cầu gán vai trò', { id: 'assign-role' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (roleId: string, roleName: string) => {
    const confirm = window.confirm(
      `Bạn có chắc chắn muốn hủy gán vai trò "${roleName}" khỏi người dùng này?`
    );
    if (!confirm) return;

    try {
      toast.loading('Đang hủy gán vai trò...', { id: 'unassign-role' });
      const res = await fetch(`/api/admin/roles/assignments/${userId}/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã hủy gán vai trò thành công', { id: 'unassign-role' });
        fetchAssignments();
      } else {
        toast.error(json.message || 'Hủy gán vai trò thất bại', { id: 'unassign-role' });
      }
    } catch (err) {
      toast.error('Lỗi khi hủy gán vai trò', { id: 'unassign-role' });
    }
  };

  return (
    <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Vai trò & Quyền hạn phân nhánh (RBAC)</h3>
            <p className="text-[11px] text-slate-400">
              Nhân sự có thể đảm nhiệm nhiều vai trò tại các chi nhánh khác nhau
            </p>
          </div>
        </div>

        {canAssign && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> Gán vai trò
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Đang tải danh sách vai trò...</div>
      ) : assignments.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="text-xs text-slate-500 mb-2">Chưa có vai trò động nào được gán cho tài khoản này.</p>
          {canAssign && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              + Gán vai trò đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800">{assignment.roleName}</span>
                  <code className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {assignment.roleCode}
                  </code>
                  {assignment.isPrimary && (
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-100 text-amber-800 rounded">
                      Chính
                    </span>
                  )}
                  {assignment.isSystem && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-100 text-indigo-700 rounded">
                      Hệ thống
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {assignment.branchScope === 'ALL_BRANCHES' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <Globe className="w-3 h-3 text-blue-500" /> Tất cả chi nhánh
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        <Store className="w-3 h-3 text-amber-500" /> Chi nhánh chỉ định:
                      </span>
                      {assignment.branches.map((b) => (
                        <span
                          key={b.id}
                          className="text-[11px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-medium"
                        >
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {canAssign && (
                <div className="shrink-0 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignment(assignment.roleId, assignment.roleName)}
                    title="Gỡ vai trò này khỏi người dùng"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assign Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">Gán vai trò & Phạm vi chi nhánh</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Select Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chọn vai trò <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full text-sm font-semibold px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white outline-hidden focus:border-indigo-600"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code}) {r.isSystem ? '· Hệ thống' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Scope */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phạm vi chi nhánh <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBranchScope('ALL_BRANCHES')}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${
                      branchScope === 'ALL_BRANCHES'
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Tất cả chi nhánh</div>
                      <div className="text-[10px] text-slate-400 font-normal">Tự động gồm chi nhánh mới</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBranchScope('SELECTED_BRANCHES')}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${
                      branchScope === 'SELECTED_BRANCHES'
                        ? 'border-amber-500 bg-amber-50/50 text-amber-900 font-bold ring-1 ring-amber-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Store className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Chi nhánh chỉ định</div>
                      <div className="text-[10px] text-slate-400 font-normal">Chọn tối thiểu 1 chi nhánh</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Multi-branch Checklist if SELECTED_BRANCHES */}
              {branchScope === 'SELECTED_BRANCHES' && (
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Chọn các chi nhánh được cấp phép ({selectedBranchIds.length} đã chọn):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedBranchIds(branches.map((b) => b.id))}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Chọn tất cả
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {branches.map((b) => {
                      const isChecked = selectedBranchIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none text-xs transition ${
                            isChecked
                              ? 'border-indigo-300 bg-indigo-50/50 text-slate-900 font-bold'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{b.name}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleBranch(b.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Primary Role Checkbox */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-700">
                  Đặt làm vai trò chính (Primary Role) cho nhân sự này
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  Xác nhận gán vai trò
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
