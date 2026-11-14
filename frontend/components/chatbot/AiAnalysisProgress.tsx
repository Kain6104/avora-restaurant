"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Sparkles,
  Cpu,
} from 'lucide-react';

export interface AiAnalysisProgressProps {
  userQuery?: string;
  branchName?: string;
  cartCount?: number;
  activeTool?: string | null;
  className?: string;
  compact?: boolean;
}

interface PipelineStage {
  step: number;
  totalSteps: number;
  stageName: string;
  title: string;
  moduleTag: string;
}

interface PipelineConfig {
  intentBadge: string;
  stages: PipelineStage[];
}

function buildRealtimePipeline(
  query: string,
  branchName?: string,
  cartCount?: number,
  activeTool?: string | null,
): PipelineConfig {
  const q = (query || '').toLowerCase().trim();
  const branchLabel = branchName || 'chi nhánh AVORA';

  // 1. Branch & GPS Location Intent
  if (
    activeTool === 'findNearestBranch' ||
    activeTool === 'listBranches' ||
    /(?:chi\s*nhánh|cơ\s*sở|địa\s*chỉ|ở\s*đâu|gần\s*nhất|gần\s*đây|bản\s*đồ|chỉ\s*đường|vĩ\s*độ|kinh\s*độ|tọa\s*độ)/i.test(q)
  ) {
    return {
      intentBadge: 'Định vị Chi nhánh & Bản đồ',
      stages: [
        {
          step: 1,
          totalSteps: 3,
          stageName: 'Nhận diện định vị',
          title: 'Phân tích yêu cầu tìm chi nhánh & tọa độ địa lý...',
          moduleTag: 'Intent Router • BRANCH_LOCATION',
        },
        {
          step: 2,
          totalSteps: 3,
          stageName: 'Đang tra cứu cơ sở dữ liệu',
          title: 'Đang tải tọa độ hệ thống chi nhánh & bản đồ tương tác...',
          moduleTag: 'Tool Engine • findNearestBranch',
        },
        {
          step: 3,
          totalSteps: 3,
          stageName: 'Đồng bộ bản đồ',
          title: 'Sẵn sàng bản đồ tương tác & đo khoảng cách thực tế...',
          moduleTag: 'Interactive Map • Ready',
        },
      ],
    };
  }

  // 2. Table Reservation Intent
  if (
    activeTool === 'getReservationSlots' ||
    activeTool === 'previewReservation' ||
    activeTool === 'createReservation' ||
    /(?:đặt\s*bàn|giữ\s*bàn|giữ\s*chỗ|bàn\s*trống|xác\s*nhận\s*đặt\s*bàn)/i.test(q)
  ) {
    return {
      intentBadge: 'Đặt bàn & Giữ chỗ trực tuyến',
      stages: [
        {
          step: 1,
          totalSteps: 3,
          stageName: 'Tiếp nhận thông tin',
          title: 'Phân tích số khách, ngày & khung giờ đặt chỗ...',
          moduleTag: 'Intent Router • RESERVATION',
        },
        {
          step: 2,
          totalSteps: 3,
          stageName: 'Kiểm tra bàn trống',
          title: `Kiểm tra tình trạng bàn thời gian thực tại ${branchLabel}...`,
          moduleTag: 'Tool Engine • getReservationSlots',
        },
        {
          step: 3,
          totalSteps: 3,
          stageName: 'Xác thực lịch hẹn',
          title: 'Đối chiếu thông tin người đặt & xác nhận lịch giữ bàn...',
          moduleTag: 'Reservation Engine • Confirmed',
        },
      ],
    };
  }

  // 3. Voucher & Promotion Intent
  if (
    activeTool === 'findApplicableVouchers' ||
    /(?:voucher|mã\s*giảm|khuyến\s*mãi|ưu\s*đãi|freeship|giảm\s*giá)/i.test(q)
  ) {
    return {
      intentBadge: 'Tối ưu Ưu đãi & Voucher',
      stages: [
        {
          step: 1,
          totalSteps: 3,
          stageName: 'Phân tích giỏ hàng',
          title: 'Phân tích giá trị đơn & quyền lợi thành viên...',
          moduleTag: 'Intent Router • VOUCHER_PROMOTION',
        },
        {
          step: 2,
          totalSteps: 3,
          stageName: 'Quét kho ưu đãi',
          title: 'Quét kho mã giảm giá món & Freeship từ cơ sở dữ liệu...',
          moduleTag: 'Tool Engine • findApplicableVouchers',
        },
        {
          step: 3,
          totalSteps: 3,
          stageName: 'Tối ưu mức giảm',
          title: 'Tính toán phương án tiết kiệm sâu nhất cho đơn hàng...',
          moduleTag: 'Zero-Hallucination Verified',
        },
      ],
    };
  }

  // 4. Order Checkout / Cart / Tracking Intent
  if (
    activeTool === 'previewOrder' ||
    activeTool === 'placeOrder' ||
    activeTool === 'addToCart' ||
    /(?:giỏ\s*hàng|thanh\s*toán|chốt\s*đơn|đặt\s*hàng|giao\s*hàng|phí\s*ship|hủy\s*đơn|mã\s*đơn)/i.test(q)
  ) {
    return {
      intentBadge: 'Xử lý Giỏ hàng & Đơn hàng',
      stages: [
        {
          step: 1,
          totalSteps: 3,
          stageName: 'Đồng bộ giỏ hàng',
          title: `Đồng bộ giỏ hàng${cartCount ? ` (${cartCount} món)` : ''} & thông tin giao nhận...`,
          moduleTag: 'Intent Router • ORDER_CHECKOUT',
        },
        {
          step: 2,
          totalSteps: 3,
          stageName: 'Tính toán giá chuẩn',
          title: 'Tính tổng tiền, phí vận chuyển & điểm thưởng thành viên...',
          moduleTag: 'Tool Engine • Order & Pricing',
        },
        {
          step: 3,
          totalSteps: 3,
          stageName: 'Bảo mật giao dịch',
          title: 'Xác thực phiên đặt hàng an toàn...',
          moduleTag: 'Security & Order Guard',
        },
      ],
    };
  }

  // 5. Capabilities / Greeting / FAQ
  if (
    activeTool === 'getRestaurantInfo' ||
    /(?:làm\s*được\s*gì|giúp\s*được\s*gì|chức\s*năng\s*gì|đậu\s*xe|đỗ\s*xe|phòng\s*vip|hóa\s*đơn\s*đỏ|vat|ghế\s*trẻ\s*em|sinh\s*nhật|giờ\s*mở\s*cửa)/i.test(q)
  ) {
    return {
      intentBadge: 'Thông tin & Dịch vụ AVORA',
      stages: [
        {
          step: 1,
          totalSteps: 3,
          stageName: 'Tiếp nhận câu hỏi',
          title: 'Phân tích câu hỏi dịch vụ, tiện ích & chính sách nhà hàng...',
          moduleTag: 'Intent Router • RESTAURANT_FAQ',
        },
        {
          step: 2,
          totalSteps: 3,
          stageName: 'Tra cứu cẩm nang',
          title: `Tra cứu thông tin chính sách & tiện ích tại ${branchLabel}...`,
          moduleTag: 'Knowledge Base • getRestaurantInfo',
        },
        {
          step: 3,
          totalSteps: 3,
          stageName: 'Tổng hợp phản hồi',
          title: 'Hoàn thiện hướng dẫn chi tiết & gợi ý hữu ích...',
          moduleTag: 'AI Concierge Synthesis',
        },
      ],
    };
  }

  // 6. Default: Menu & Culinary Grounding Pipeline
  const budgetMatch = q.match(/(\d+)\s*(?:k|nghìn|ngàn|triệu|tr|đ|vnd)/i);
  const budgetHint = budgetMatch ? ` theo ngân sách ${budgetMatch[0]}` : '';

  return {
    intentBadge: 'Tra cứu Thực đơn AVORA',
    stages: [
      {
        step: 1,
        totalSteps: 3,
        stageName: 'Tiếp nhận yêu cầu',
        title: `Phân tích khẩu vị & nhu cầu ẩm thực${budgetHint}...`,
        moduleTag: 'Intent Router • MENU_DISH_INQUIRY',
      },
      {
        step: 2,
        totalSteps: 3,
        stageName: 'Kiểm chứng thực đơn',
        title: `Truy vấn dữ liệu món ăn thực tế tại ${branchLabel}...`,
        moduleTag: 'Database Grounding • searchMenu',
      },
      {
        step: 3,
        totalSteps: 3,
        stageName: 'Kiểm tra chống bịa món',
        title: 'Đối chiếu tên món, giá bán & hình ảnh chính thức...',
        moduleTag: 'Zero-Hallucination Guard',
      },
    ],
  };
}

export function AiAnalysisProgress({
  userQuery = '',
  branchName,
  cartCount,
  activeTool = null,
  className = '',
  compact = false,
}: AiAnalysisProgressProps) {
  const pipeline = useMemo(
    () => buildRealtimePipeline(userQuery, branchName, cartCount, activeTool),
    [userQuery, branchName, cartCount, activeTool],
  );

  const [elapsedTenths, setElapsedTenths] = useState(1);

  // Reset elapsed timer when userQuery changes
  useEffect(() => {
    setElapsedTenths(1);
  }, [userQuery]);

  // Real wall-clock elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTenths((prev) => prev + 1);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Format clean query display to prevent awkward cut-offs
  const cleanDisplayQuery = useMemo(() => {
    if (!userQuery) return null;
    const trimmed = userQuery.trim();
    if (trimmed.includes('vĩ độ') && trimmed.includes('kinh độ')) {
      return '📍 Vị trí GPS của bạn';
    }
    if (trimmed.startsWith('[HỆ THỐNG:') || trimmed.startsWith('[')) {
      return '📍 Tọa độ GPS';
    }
    const clean = trimmed.replace(/^["'\s]+|["'\s]+$/g, '');
    return clean.length > 20 ? `"${clean.slice(0, 18)}..."` : `"${clean}"`;
  }, [userQuery]);

  // Derive ONLY the single currently active stage:
  const activeStageIndex = activeTool ? 1 : (elapsedTenths > 12 ? 1 : 0);
  const currentStage = pipeline.stages[activeStageIndex] || pipeline.stages[0];
  const formattedSeconds = (elapsedTenths / 10).toFixed(1);

  return (
    <div className={`flex gap-2 sm:gap-2.5 items-start justify-start animate-in fade-in duration-300 w-full ${className}`}>
      {/* Bot Avatar */}
      <div className="shrink-0 pt-0.5">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-rose-200 p-0.5 shadow-xs overflow-hidden relative">
          <img src="/avt_chatbot.gif" alt="AvoBOT" className="w-full h-full rounded-full object-cover" />
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
      </div>

      {/* Luxury Real-Time Processing Card - Focused Single Active Stage */}
      <div className="bg-white/95 backdrop-blur-xs border border-rose-100/90 rounded-2xl p-2.5 sm:p-3 shadow-[0_4px_18px_-4px_rgba(225,29,72,0.08)] space-y-2 w-full max-w-[340px] sm:max-w-md transition-all overflow-hidden">
        {/* Top Header: Badge + Compact Timer (Anti-Overflow for Mobile) */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200/60 text-[10px] font-bold text-rose-700 min-w-0 max-w-[58%]">
            <Cpu className="w-2.5 h-2.5 text-rose-600 animate-spin shrink-0" style={{ animationDuration: '4s' }} />
            <span className="truncate">{pipeline.intentBadge}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-[10px]">
            <span className="font-mono font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">
              {formattedSeconds}s
            </span>
            <span className="font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-rose-600 shrink-0" />
              <span className="hidden sm:inline">Đang xử lý</span>
              <span className="sm:hidden">Xử lý</span>
            </span>
          </div>
        </div>

        {/* Focused Single Active Stage */}
        <div className="bg-gradient-to-r from-rose-50/70 via-stone-50/60 to-white border border-rose-100 rounded-xl p-2 sm:p-2.5 space-y-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-extrabold tracking-wide uppercase shrink-0">
                Bước {currentStage.step}/{currentStage.totalSteps}
              </span>
              <span className="text-[10.5px] sm:text-[11px] font-bold text-stone-800 truncate">
                {currentStage.stageName}
              </span>
            </div>
            <Sparkles className="w-3 h-3 text-rose-500 animate-pulse shrink-0" />
          </div>

          <p className="text-[11px] sm:text-xs font-semibold text-stone-900 leading-snug">
            {currentStage.title}
          </p>

          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-rose-100/60 text-[9.5px]">
            <span className="font-mono text-stone-400 truncate min-w-0">
              {currentStage.moduleTag}
            </span>
            {cleanDisplayQuery && (
              <span className="text-rose-600 font-medium truncate shrink-0 max-w-[120px]">
                {cleanDisplayQuery}
              </span>
            )}
          </div>
        </div>

        {/* Indeterminate Smooth Progress Track - Running Beam from Left to Right */}
        <div className="relative w-full h-1.5 bg-stone-100/90 rounded-full overflow-hidden shadow-inner">
          <div className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600 animate-avo-progress shadow-[0_0_8px_rgba(225,29,72,0.7)]" />
        </div>
      </div>
    </div>
  );
}
