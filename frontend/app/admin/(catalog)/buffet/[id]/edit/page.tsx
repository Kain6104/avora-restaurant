'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import BuffetPackageEditor from '../../components/BuffetPackageEditor';

export default function EditBuffetPackagePage() {
  const params = useParams();
  const packageId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  return <BuffetPackageEditor packageId={packageId} />;
}

