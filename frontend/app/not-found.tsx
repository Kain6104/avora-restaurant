import Link from 'next/link';
import { Home, Utensils } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="relative inline-block">
          <span className="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 tracking-wider">
            404
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Không tìm thấy trang hoặc chi nhánh
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Nội dung quý khách đang tìm kiếm không tồn tại hoặc chi nhánh này hiện chưa khả dụng trong hệ thống AVORA.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm transition-colors shadow-md"
          >
            <Home className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
          <Link
            href="/restaurants"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm transition-colors"
          >
            <Utensils className="w-4 h-4" />
            <span>Xem hệ thống chi nhánh</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
