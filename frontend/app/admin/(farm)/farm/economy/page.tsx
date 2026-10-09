'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Sparkles,
  BarChart3,
  RefreshCw,
  PieChart,
} from 'lucide-react';

export default function AdminFarmEconomyPage() {
  const [economy, setEconomy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEconomy();
  }, []);

  const fetchEconomy = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/economy', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setEconomy(json.data);
      }
    } catch (e) {
      toast.error('Không thể tải dữ liệu kinh tế Farm');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const circulation = economy?.totalCoinsCirculation || 0;
  const spentCoins = economy?.totalCoinsSpentOnRewards || 0;
  const loyaltySpent = economy?.totalLoyaltyPointsSpent || 0;
  const redemptions = economy?.totalRedemptionsCount || 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Scale className="w-7 h-7 text-amber-600" />
            <span>Giám Sát Kinh Tế & Lạm Phát (Economy Control)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi cung tiền Farm Coin, tỉ lệ đốt coin, chi phí đổi điểm thưởng AVORA Loyalty và mức độ cân bằng game
          </p>
        </div>

        <button
          onClick={fetchEconomy}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới chỉ số</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Farm Coin Lưu Hành</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {circulation.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-bold">Tổng tài sản người chơi</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Coin Đã Đốt (Spent)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {spentCoins.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Đổi qua quà & vật phẩm Shop
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Điểm Loyalty Đã Đổi</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 tracking-tight">
            {loyaltySpent.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Điểm AVORA thực đã tiêu thụ
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Lượt Đổi Quà Thành Công</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {redemptions.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            Giao dịch quà hoàn tất
          </div>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economic Balance Policy */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" />
            <span>Nguyên Tắc Cân Bằng Kinh Tế AVORA Farm</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs">
                1
              </div>
              <div>
                <div className="font-bold text-slate-900">Không bao giờ quy đổi ngược Farm Coin sang Tiền mặt</div>
                <div className="text-slate-500 mt-0.5">
                  Farm Coin là đơn vị tiền tệ chỉ có giá trị nội bộ trong trang trại để nâng cấp ô đất, mua giống và phân bón.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold text-xs">
                2
              </div>
              <div>
                <div className="font-bold text-slate-900">Điểm Thưởng Loyalty Đồng Bộ Duy Nhất</div>
                <div className="text-slate-500 mt-0.5">
                  Quà giá trị cao như Voucher giảm giá trực tiếp được hạch toán qua PointTransaction của hệ sinh thái AVORA gốc, không tạo điểm ảo thứ hai.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                3
              </div>
              <div>
                <div className="font-bold text-slate-900">Giới hạn Tỉ lệ Đột biến tối đa 75%</div>
                <div className="text-slate-500 mt-0.5">
                  Dù người chơi có cộng dồn thời tiết, phân bón, bạn bè giúp đỡ và cấp thẻ VIP, tỉ lệ luôn có mức trần để bảo toàn độ hiếm.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Evaluation */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Đánh Giá Sức Khỏe Lưu Thông Tiền Tệ</span>
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Tỉ lệ Tiêu Thụ / Cung Ứng (Burn / Mint Ratio)</span>
                  <span className="text-amber-600">
                    {circulation + spentCoins > 0 ? ((spentCoins / (circulation + spentCoins)) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    style={{
                      width: `${circulation + spentCoins > 0 ? Math.min(100, (spentCoins / (circulation + spentCoins)) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Lý tưởng: 25% - 40% số coin tạo ra được người chơi tiêu vào vật phẩm và hạt giống mới.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-800 mb-1">Trạng thái an toàn hệ thống:</div>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Kinh tế trang trại đang ở trạng thái cân bằng ổn định.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center p-3 border-t border-slate-100 text-slate-400 text-[11px]">
            Hệ thống tự động điều chỉnh độ trễ sản lượng khi phát hiện dấu hiệu lạm phát bất thường.
          </div>
        </div>
      </div>
    </div>
  );
}
