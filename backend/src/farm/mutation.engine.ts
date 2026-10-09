import { Injectable } from '@nestjs/common';
import { FarmCropMutation, FarmWeatherType } from '@prisma/client';

export interface MutationResolutionResult {
  isMutated: boolean;
  finalMutationChance: number;
  selectedMutation: FarmCropMutation | null;
}

@Injectable()
export class MutationEngine {
  /**
   * Tính toán và quyết định đột biến hoàn toàn trên Server
   */
  resolveMutation(params: {
    baseMutationRate: number;
    fertilizerBonus: number;
    soilQuality: number;
    activeWeather: FarmWeatherType;
    cropCategory: string;
    mutations: FarmCropMutation[];
    vipMultiplier?: number;
  }): MutationResolutionResult {
    const {
      baseMutationRate,
      fertilizerBonus,
      soilQuality,
      activeWeather,
      cropCategory,
      mutations,
      vipMultiplier = 1.0,
    } = params;

    if (!mutations || mutations.length === 0) {
      return {
        isMutated: false,
        finalMutationChance: 0,
        selectedMutation: null,
      };
    }

    // 1. Tính toán Weather Bonus
    let weatherBonus = 0;
    if (activeWeather === FarmWeatherType.SAKURA_WIND) {
      weatherBonus = 0.15; // +15% gió hoa anh đào
    } else if (activeWeather === FarmWeatherType.MOONLIGHT) {
      weatherBonus = 0.1; // +10% ánh trăng huyền ảo
    } else if (activeWeather === FarmWeatherType.AURORA) {
      weatherBonus = 0.2; // +20% cực quang thần kỳ
    }

    // 2. Tính toán Soil Quality Bonus
    const soilBonus = Math.max(0, (soilQuality - 1.0) * 0.1);

    // 3. Công thức tổng hợp có áp dụng trần bảo vệ (CAP 75%)
    const rawRate =
      (baseMutationRate + fertilizerBonus + soilBonus + weatherBonus) * vipMultiplier;
    const finalMutationChance = Math.min(0.75, Math.max(0.01, rawRate));

    // 4. Bốc thăm ngẫu nhiên
    const roll = Math.random();
    if (roll > finalMutationChance) {
      return {
        isMutated: false,
        finalMutationChance,
        selectedMutation: null,
      };
    }

    // 5. Nếu trúng đột biến: Chọn biến thể theo trọng số mutationChance
    let totalWeight = 0;
    for (const m of mutations) {
      totalWeight += m.mutationChance;
    }

    let randomWeight = Math.random() * totalWeight;
    let chosenMutation: FarmCropMutation = mutations[0];

    for (const m of mutations) {
      if (randomWeight <= m.mutationChance) {
        chosenMutation = m;
        break;
      }
      randomWeight -= m.mutationChance;
    }

    return {
      isMutated: true,
      finalMutationChance,
      selectedMutation: chosenMutation,
    };
  }
}
