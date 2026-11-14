'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import BuffetPackageEditor from '../components/BuffetPackageEditor';

function CreateBuffetInner() {
  const searchParams = useSearchParams();
  const initialBranchId = searchParams?.get('branchId') || undefined;
  return <BuffetPackageEditor initialBranchId={initialBranchId} />;
}

export default function CreateBuffetPackagePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#da251d]" />
        </div>
      }
    >
      <CreateBuffetInner />
    </Suspense>
  );
}

