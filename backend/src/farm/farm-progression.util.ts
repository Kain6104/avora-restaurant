/**
 * AVORA FARM - Level & EXP Progression Engine
 * Source of truth for all farming experience calculations
 */

export interface ExpProgressionResult {
  levelBefore: number;
  expBefore: number;
  levelAfter: number;
  expAfter: number;
  expGained: number;
  newTotalExp: number;
  leveledUp: boolean;
  canLevelUp: boolean;
  maxExpBefore: number;
  maxExpAfter: number;
}

export interface LevelUpgradeRequirement {
  fromLevel: number;
  toLevel: number;
  expRequired: number;
  coinCost: number;
  requiredCropCode: string;
  requiredCropName: string;
  requiredCropQty: number;
  cropIconUrl: string;
  perks: {
    growSpeedReduction: string;
    energyBoost: string;
    sellPriceBoost: string;
    unlockTitle: string;
  };
}

const LEVEL_REQUIREMENTS: Record<number, {
  coinCost: number;
  cropCode: string;
  cropName: string;
  cropQty: number;
  cropIcon: string;
  speed: string;
  energy: string;
  price: string;
  unlockTitle: string;
}> = {
  1: {
    coinCost: 50,
    cropCode: 'JAPANESE_RICE',
    cropName: 'Gạo Koshihikari',
    cropQty: 3,
    cropIcon: '/game/farm/crops/rice/stage_5.png',
    speed: '+2.0%',
    energy: '+5⚡',
    price: '+5.0%',
    unlockTitle: 'Dâu Tây Tochigi & Thửa đất mới',
  },
  2: {
    coinCost: 120,
    cropCode: 'STRAWBERRY',
    cropName: 'Dâu Tây Tochigi',
    cropQty: 3,
    cropIcon: '/game/farm/crops/strawberry/stage_5.png',
    speed: '+4.0%',
    energy: '+5⚡',
    price: '+8.0%',
    unlockTitle: 'Wasabi Tươi & Hoa Hướng Dương',
  },
  3: {
    coinCost: 250,
    cropCode: 'JAPANESE_RICE',
    cropName: 'Gạo Koshihikari Thượng Hạng',
    cropQty: 5,
    cropIcon: '/game/farm/crops/rice/stage_5.png',
    speed: '+6.5%',
    energy: '+10⚡',
    price: '+12.0%',
    unlockTitle: 'Lá Trà Uji Matcha & Cà Chua Bi',
  },
  4: {
    coinCost: 450,
    cropCode: 'MATCHA_LEAF',
    cropName: 'Lá Trà Uji Matcha',
    cropQty: 5,
    cropIcon: '/game/farm/crops/matcha/stage_5.png',
    speed: '+9.0%',
    energy: '+10⚡',
    price: '+18.0%',
    unlockTitle: 'Quả Yuzu Hoàng Kim & Thửa đất mới',
  },
  5: {
    coinCost: 700,
    cropCode: 'YUZU',
    cropName: 'Quả Yuzu Hoàng Kim',
    cropQty: 6,
    cropIcon: '/game/farm/crops/yuzu/stage_5.png',
    speed: '+12.0%',
    energy: '+15⚡',
    price: '+25.0%',
    unlockTitle: 'Nho Mẫu Đơn Shine Muscat',
  },
  6: {
    coinCost: 1000,
    cropCode: 'GRAPE',
    cropName: 'Nho Shine Muscat',
    cropQty: 6,
    cropIcon: '/game/farm/crops/grape/stage_5.png',
    speed: '+15.0%',
    energy: '+20⚡',
    price: '+35.0%',
    unlockTitle: 'Đào Hồng Yamanashi & Thần Điền',
  },
};

export function getLevelUpgradeRequirements(currentLevel: number): LevelUpgradeRequirement {
  const req = LEVEL_REQUIREMENTS[currentLevel] || {
    coinCost: currentLevel * 180,
    cropCode: 'JAPANESE_RICE',
    cropName: 'Gạo Koshihikari',
    cropQty: Math.min(20, currentLevel * 2),
    cropIcon: '/game/farm/crops/rice/stage_5.png',
    speed: `+${Math.min(30, currentLevel * 2.5)}%`,
    energy: `+${Math.min(50, currentLevel * 5)}⚡`,
    price: `+${Math.min(60, currentLevel * 5)}%`,
    unlockTitle: `Thần Điền Tầng ${currentLevel + 1}`,
  };

  return {
    fromLevel: currentLevel,
    toLevel: currentLevel + 1,
    expRequired: currentLevel * 100,
    coinCost: req.coinCost,
    requiredCropCode: req.cropCode,
    requiredCropName: req.cropName,
    requiredCropQty: req.cropQty,
    cropIconUrl: req.cropIcon,
    perks: {
      growSpeedReduction: req.speed,
      energyBoost: req.energy,
      sellPriceBoost: req.price,
      unlockTitle: req.unlockTitle,
    },
  };
}

export function getUpcomingUpgradeRequirements(currentLevel: number, maxLookahead: number = 15): Array<{
  level: number;
  cropCode: string;
  cropName: string;
  cropQty: number;
}> {
  const result: Array<{ level: number; cropCode: string; cropName: string; cropQty: number }> = [];
  for (let lvl = currentLevel; lvl <= currentLevel + maxLookahead; lvl++) {
    const req = LEVEL_REQUIREMENTS[lvl] || {
      cropCode: 'JAPANESE_RICE',
      cropName: 'Gạo Koshihikari',
      cropQty: Math.min(20, lvl * 2),
    };
    result.push({
      level: lvl,
      cropCode: req.cropCode,
      cropName: req.cropName,
      cropQty: req.cropQty,
    });
  }
  return result;
}

/**
 * Calculates level up and overflow EXP progression
 * NOTE: Level is NOT automatically incremented.
 * Users must manually click Level Up when exp >= maxExp.
 */
export function calculateExpProgression(
  currentLevel: number,
  currentExp: number,
  currentTotalExp: number,
  expGained: number,
): ExpProgressionResult {
  const levelBefore = currentLevel;
  const expBefore = currentExp;
  const maxExpBefore = levelBefore * 100;

  const newExp = currentExp + expGained;
  const newTotalExp = (currentTotalExp || 0) + expGained;
  const canLevelUp = newExp >= maxExpBefore;

  return {
    levelBefore,
    expBefore,
    levelAfter: currentLevel,
    expAfter: newExp,
    expGained,
    newTotalExp,
    leveledUp: false,
    canLevelUp,
    maxExpBefore,
    maxExpAfter: maxExpBefore,
  };
}
