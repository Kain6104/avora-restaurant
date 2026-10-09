'use client';

import React from 'react';
import FarmPlantDetailCard, { PlantDetailData } from '../cards/FarmPlantDetailCard';

interface PlantDetailModalProps {
  data?: PlantDetailData;
  cropCode?: string;
  mutationCode?: string;
  userLevel?: number;
  onClose: () => void;
  onNavigateToShop?: (seedCode: string) => void;
}

export default function PlantDetailModal({
  data,
  cropCode,
  mutationCode,
  userLevel = 1,
  onClose,
  onNavigateToShop,
}: PlantDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[95dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <FarmPlantDetailCard
          data={data}
          cropCode={cropCode}
          mutationCode={mutationCode}
          mode="MODAL"
          userLevel={userLevel}
          onClose={onClose}
          onNavigateToShop={onNavigateToShop}
        />
      </div>
    </div>
  );
}
