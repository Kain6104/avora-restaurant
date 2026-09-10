'use client';

import React, { use } from 'react';
import FlashSaleBuilder from '../../components/FlashSaleBuilder';

interface EditFlashSalePageProps {
  params: Promise<{ id: string }>;
}

export default function EditFlashSalePage({ params }: EditFlashSalePageProps) {
  const { id } = use(params);

  return <FlashSaleBuilder initialCampaignId={id} isEditMode={true} />;
}
