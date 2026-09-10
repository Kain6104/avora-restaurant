'use client';

import React from 'react';
import { SunMedium } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminFooter() {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto border-t border-slate-100 bg-white px-3 sm:px-4 lg:px-6 xl:px-8 py-3.5 pb-20 lg:pb-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 font-medium">
      <p>{t('footer.copyright', '© 2026 Avora Restaurant. All rights reserved.')}</p>
      <div className="flex items-center gap-4 text-[11px]">
        <span>{t('footer.version', 'Phiên bản 2.0.0 Enterprise')}</span>
        <span className="flex items-center gap-1 text-slate-500 font-semibold">
          <SunMedium size={13} className="text-amber-500" />
          <span>{t('footer.lightMode', 'Giao diện Sáng')}</span>
        </span>
      </div>
    </footer>
  );
}
