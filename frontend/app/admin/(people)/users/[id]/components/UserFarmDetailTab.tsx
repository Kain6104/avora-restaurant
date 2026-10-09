'use client';

import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Coins,
  Sparkles,
  Search,
  Filter,
  Clock,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  ShoppingBag,
  Wheat,
  Gift,
} from 'lucide-react';

interface UserFarmDetailTabProps {
  userId: string;
}

export default function UserFarmDetailTab({ userId }: UserFarmDetailTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHistory(1);
  }, [userId, type]);

  const fetchHistory = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      });
      if (type) params.append('type', type);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/farm/users/${userId}/history?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || null);
        setPage(pageNum);
      }
    } catch (e) {
      console.warn('Could not fetch user farm history:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(1);
  };

  const formatVietnamTime = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const userFarm = data?.user;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs text-gray-500 font-bold uppercase block">Cấp Độ Nông Trại</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-serif font-black text-amber-900">
              Lv.{userFarm?.farmLevel || 1}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs text-gray-500 font-bold uppercase block">Số Dư Xu Nông Trại</span>
          <div className="flex items-center gap-1.5 mt-1 text-amber-600 font-mono font-black text-2xl">
            <Coins className="w-5 h-5 fill-amber-400 shrink-0" />
            <span>{(userFarm?.farmCoin || 0).toLocaleString('vi-VN')}</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs text-gray-500 font-bold uppercase block">Điểm AVORA Loyalty Thật</span>
          <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-mono font-black text-2xl">
            <Sparkles className="w-5 h-5 fill-emerald-400 shrink-0" />
            <span>{(userFarm?.currentPoints || userFarm?.points || 0).toLocaleString('vi-VN')}</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs text-gray-500 font-bold uppercase block">Tổng Thu Hoạch</span>
          <div className="flex items-center gap-1 mt-1 text-stone-800 font-mono font-black text-2xl">
            <span>{userFarm?.totalHarvested || 0}</span>
          </div>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Header & Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-serif font-black text-base text-gray-900">
              Sổ Cái Giao Dịch AVORA Farm
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
              {data?.total || 0} bản ghi
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-bold"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="SEED_PURCHASE">Mua Hạt Giống</option>
              <option value="ITEM_PURCHASE">Mua Vật Phẩm</option>
              <option value="PRODUCE_SALE">Bán Nông Sản</option>
              <option value="VOUCHER_REDEMPTION">Đổi Voucher</option>
              <option value="COIN_TO_POINT_EXCHANGE">Đổi Xu Sang Điểm</option>
              <option value="ADMIN_GIFT">Quà Admin</option>
              <option value="MAINTENANCE_GIFT">Quà Bảo Trì</option>
              <option value="LUCKY_ENVELOPE_REWARD">Lì Xì May Mắn</option>
              <option value="FRIEND_STEAL_GAIN">Thu Hoạch Bạn Bè</option>
              <option value="FRIEND_WATER">Tưới Nước Bạn Bè</option>
            </select>

            <form onSubmit={handleSearch} className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Tìm mã / vật phẩm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs w-44"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold"
              >
                Lọc
              </button>
            </form>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-gray-400 font-bold text-xs space-y-2">
              <RotateCcw className="w-6 h-6 mx-auto animate-spin text-amber-600" />
              <p>Đang tải dữ liệu sổ cái...</p>
            </div>
          ) : !data?.transactions || data.transactions.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs font-medium">
              Không tìm thấy giao dịch nào
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100">
                <tr>
                  <th className="p-3 pl-4">Thời Gian (VN)</th>
                  <th className="p-3">Loại Giao Dịch</th>
                  <th className="p-3">Vật Phẩm / Chi Tiết</th>
                  <th className="p-3 text-right">Số Lượng</th>
                  <th className="p-3 text-right">Biến Động Xu</th>
                  <th className="p-3 text-right">Biến Động Điểm</th>
                  <th className="p-3 text-right">Số Dư Sau</th>
                  <th className="p-3 pr-4">Mã Tham Chiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.transactions.map((tx: any) => {
                  const isPositiveCoin = (tx.farmCoinDelta || 0) > 0;
                  const isPositivePoint = (tx.avoraPointDelta || 0) > 0;

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/70 transition font-medium">
                      <td className="p-3 pl-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {formatVietnamTime(tx.createdAt)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 font-bold text-[10px] uppercase border border-stone-200">
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-900 max-w-[200px] truncate">
                        {tx.itemNameSnapshot || 'Vật phẩm Nông Trại'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gray-700">
                        {tx.quantity || 1}
                      </td>
                      <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                        {tx.farmCoinDelta !== 0 ? (
                          <span className={isPositiveCoin ? 'text-emerald-600' : 'text-rose-600'}>
                            {isPositiveCoin ? '+' : ''}
                            {tx.farmCoinDelta?.toLocaleString('vi-VN')} Xu
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                        {tx.avoraPointDelta !== 0 ? (
                          <span className={isPositivePoint ? 'text-purple-600' : 'text-stone-600'}>
                            {isPositivePoint ? '+' : ''}
                            {tx.avoraPointDelta?.toLocaleString('vi-VN')} Điểm
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-500 whitespace-nowrap">
                        {tx.balanceCoinAfter !== null
                          ? `${tx.balanceCoinAfter.toLocaleString('vi-VN')} Xu`
                          : '-'}
                      </td>
                      <td className="p-3 pr-4 font-mono text-[11px] text-gray-400 truncate max-w-[140px]">
                        {tx.referenceId ? `#${tx.referenceId}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data?.totalPages > 1 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>
              Trang {page} / {data.totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => fetchHistory(page - 1)}
                className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => fetchHistory(page + 1)}
                className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
