import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalculateRecipeDto } from './dto/calculate-recipe.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';
import { ArchitectIngredientCategory } from '@prisma/client';

export interface FlavorVector {
  spiciness: number;
  sweetness: number;
  saltiness: number;
  sourness: number;
  richness: number;
  umami: number;
}

export interface SommelierAnalysis {
  flavorBalanceScore: number; // 0 - 100
  dominantNotes: string[];
  pairingTips: string[];
  warnings: string[];
  detectedAllergens: string[];
}

export interface CalculatedItem {
  ingredientId: string;
  code: string;
  name: string;
  category: ArchitectIngredientCategory;
  imageUrl: string;
  gram: number;
  calculatedPrice: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

@Injectable()
export class MealArchitectService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách toàn bộ nguyên liệu chia theo từng tầng đĩa ăn
   */
  async getIngredients() {
    const raw = await this.prisma.architectIngredient.findMany({
      where: { isAvailable: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    const parsed = raw.map((ing) => {
      let allergens: string[] = [];
      try {
        if (ing.allergensJson) allergens = JSON.parse(ing.allergensJson);
      } catch {}
      return {
        ...ing,
        allergens,
      };
    });

    // Gom nhóm theo Category
    const grouped: Record<string, typeof parsed> = {
      [ArchitectIngredientCategory.BASE_CARB]: [],
      [ArchitectIngredientCategory.PROTEIN]: [],
      [ArchitectIngredientCategory.GREENS_VEGGIES]: [],
      [ArchitectIngredientCategory.SIGNATURE_SAUCE]: [],
      [ArchitectIngredientCategory.CRUNCH_TOPPING]: [],
    };

    for (const item of parsed) {
      if (grouped[item.category]) {
        grouped[item.category].push(item);
      }
    }

    return {
      all: parsed,
      grouped,
      categories: [
        { key: ArchitectIngredientCategory.BASE_CARB, title: 'Tinh bột nền', subtitle: 'Nền tảng năng lượng bền bỉ' },
        { key: ArchitectIngredientCategory.PROTEIN, title: 'Đạm chính', subtitle: 'Xây dựng & phục hồi cơ bắp' },
        { key: ArchitectIngredientCategory.GREENS_VEGGIES, title: 'Rau xanh & Chất xơ', subtitle: 'Thanh lọc & vitamin thiết yếu' },
        { key: ArchitectIngredientCategory.SIGNATURE_SAUCE, title: 'Nước sốt Signature', subtitle: 'Chất xúc tác bùng nổ vị giác' },
        { key: ArchitectIngredientCategory.CRUNCH_TOPPING, title: 'Topping giòn tan', subtitle: 'Tầng âm thanh & độ giòn độc bản' },
      ],
    };
  }

  /**
   * Tính toán Macro thời gian thực + AI Flavor Sommelier phân tích tương khắc
   */
  async calculateRecipe(dto: CalculateRecipeDto, user?: any) {
    if (!dto.items || dto.items.length === 0) {
      return {
        totalPrice: 0,
        totalGram: 0,
        macros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodiumMg: 0 },
        macroPercentages: { protein: 0, carbs: 0, fat: 0 },
        sommelier: {
          flavorBalanceScore: 0,
          dominantNotes: [],
          pairingTips: ['Hãy chọn ít nhất 1 loại tinh bột nền hoặc đạm chính để bắt đầu phối đĩa ăn.'],
          warnings: [],
          detectedAllergens: [],
        },
        calculatedItems: [],
      };
    }

    const ingredientIds = dto.items.map((i) => i.ingredientId);
    const dbIngredients = await this.prisma.architectIngredient.findMany({
      where: { id: { in: ingredientIds } },
    });

    const ingMap = new Map(dbIngredients.map((ing) => [ing.id, ing]));

    let totalPrice = 0;
    let totalGram = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalSodium = 0;

    const flavorSum: FlavorVector = {
      spiciness: 0,
      sweetness: 0,
      saltiness: 0,
      sourness: 0,
      richness: 0,
      umami: 0,
    };

    const calculatedItems: CalculatedItem[] = [];
    const allAllergens = new Set<string>();

    for (const item of dto.items) {
      const ing = ingMap.get(item.ingredientId);
      if (!ing) continue;

      const gram = item.gram || ing.baseGram;
      const ratio = gram / ing.baseGram;

      const itemPrice = Math.round(ing.price * ratio);
      const itemCal = Math.round(ing.calories * ratio * 10) / 10;
      const itemProt = Math.round(ing.protein * ratio * 10) / 10;
      const itemCarb = Math.round(ing.carbs * ratio * 10) / 10;
      const itemFat = Math.round(ing.fat * ratio * 10) / 10;
      const itemFiber = Math.round((ing.fiber || 0) * ratio * 10) / 10;
      const itemSodium = Math.round((ing.sodiumMg || 0) * ratio * 10) / 10;

      totalPrice += itemPrice;
      totalGram += gram;
      totalCalories += itemCal;
      totalProtein += itemProt;
      totalCarbs += itemCarb;
      totalFat += itemFat;
      totalFiber += itemFiber;
      totalSodium += itemSodium;

      flavorSum.spiciness += ing.spiciness * ratio;
      flavorSum.sweetness += ing.sweetness * ratio;
      flavorSum.saltiness += ing.saltiness * ratio;
      flavorSum.sourness += ing.sourness * ratio;
      flavorSum.richness += ing.richness * ratio;
      flavorSum.umami += ing.umami * ratio;

      try {
        if (ing.allergensJson) {
          const list: string[] = JSON.parse(ing.allergensJson);
          list.forEach((a) => allAllergens.add(a));
        }
      } catch {}

      calculatedItems.push({
        ingredientId: ing.id,
        code: ing.code,
        name: ing.name,
        category: ing.category,
        imageUrl: ing.imageUrl,
        gram,
        calculatedPrice: itemPrice,
        calories: itemCal,
        protein: itemProt,
        carbs: itemCarb,
        fat: itemFat,
      });
    }

    // Macro Percentages (Theo chuẩn dinh dưỡng năng lượng)
    const calFromProt = totalProtein * 4;
    const calFromCarb = totalCarbs * 4;
    const calFromFat = totalFat * 9;
    const totalMacroCal = calFromProt + calFromCarb + calFromFat || 1;

    const macroPercentages = {
      protein: Math.round((calFromProt / totalMacroCal) * 100),
      carbs: Math.round((calFromCarb / totalMacroCal) * 100),
      fat: Math.round((calFromFat / totalMacroCal) * 100),
    };

    // Flavor Sommelier Analysis
    const totalRatioWeight = totalGram > 0 ? totalGram / 100 : 1;
    const avgFlavor: FlavorVector = {
      spiciness: Math.min(10, Math.round((flavorSum.spiciness / totalRatioWeight) * 10) / 10),
      sweetness: Math.min(10, Math.round((flavorSum.sweetness / totalRatioWeight) * 10) / 10),
      saltiness: Math.min(10, Math.round((flavorSum.saltiness / totalRatioWeight) * 10) / 10),
      sourness: Math.min(10, Math.round((flavorSum.sourness / totalRatioWeight) * 10) / 10),
      richness: Math.min(10, Math.round((flavorSum.richness / totalRatioWeight) * 10) / 10),
      umami: Math.min(10, Math.round((flavorSum.umami / totalRatioWeight) * 10) / 10),
    };

    const sommelier = this.evaluateFlavorSommelier(avgFlavor, calculatedItems, totalProtein, totalFiber, Array.from(allAllergens));

    return {
      totalPrice,
      totalGram: Math.round(totalGram),
      macros: {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein * 10) / 10,
        carbs: Math.round(totalCarbs * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
        fiber: Math.round(totalFiber * 10) / 10,
        sodiumMg: Math.round(totalSodium),
      },
      macroPercentages,
      flavorVector: avgFlavor,
      sommelier,
      calculatedItems,
    };
  }

  private evaluateFlavorSommelier(
    flavor: FlavorVector,
    items: any[],
    totalProtein: number,
    totalFiber: number,
    allergens: string[],
  ): SommelierAnalysis {
    const pairingTips: string[] = [];
    const warnings: string[] = [];
    const dominantNotes: string[] = [];

    // Điểm cân bằng vị giác (Flavor Balance Score): 100 điểm khởi tạo
    let balanceScore = 85;

    if (flavor.umami >= 5) dominantNotes.push('Đậm đà chuẩn vị Umami');
    if (flavor.spiciness >= 4) dominantNotes.push('Cay tê kích thích vị giác');
    if (flavor.sweetness >= 4) dominantNotes.push('Hậu vị ngọt ngào thanh dịu');
    if (flavor.richness >= 5) dominantNotes.push('Béo ngậy cao cấp');
    if (flavor.sourness >= 4) dominantNotes.push('Chua thanh sảng khoái');

    // Kiểm tra xung đột vị giác
    if (flavor.richness >= 6 && flavor.sourness >= 6) {
      balanceScore -= 15;
      warnings.push('Độ béo ngậy và độ chua cùng ở mức cao có thể gây cảm giác ngấy. Gợi ý thêm rau xanh giòn để trung hòa.');
    }

    if (flavor.spiciness >= 5 && flavor.richness < 2) {
      pairingTips.push('Món có vị cay đậm! Kết hợp thêm sốt sữa chua Hy Lạp hoặc quả bơ sẽ làm dịu êm vị giác rất tuyệt.');
    }

    // Kiểm tra tỷ lệ dinh dưỡng
    if (totalProtein >= 35) {
      pairingTips.push('Hàm lượng đạm cực kỳ dồi dào (>35g), rất lý tưởng cho mục tiêu phát triển cơ bắp và siết mỡ.');
    }

    if (totalFiber < 2.5 && items.length >= 3) {
      warnings.push('Lượng chất xơ hiện tại hơi thấp (<2.5g). Hãy bổ sung thêm Bông cải xanh hoặc Măng tây để tốt cho hệ tiêu hóa.');
      balanceScore -= 5;
    }

    // Kiểm tra tính đầy đủ của đĩa ăn
    const hasBase = items.some((i) => i.category === ArchitectIngredientCategory.BASE_CARB);
    const hasProt = items.some((i) => i.category === ArchitectIngredientCategory.PROTEIN);
    const hasGreen = items.some((i) => i.category === ArchitectIngredientCategory.GREENS_VEGGIES);
    const hasSauce = items.some((i) => i.category === ArchitectIngredientCategory.SIGNATURE_SAUCE);

    if (hasBase && hasProt && hasGreen && hasSauce) {
      balanceScore += 10;
      pairingTips.push('Đĩa ăn đã đạt chuẩn cấu trúc 4 tầng vàng: Tinh bột sạch - Đạm cao cấp - Rau xanh - Nước sốt Signature!');
    }

    balanceScore = Math.max(30, Math.min(99, balanceScore));

    return {
      flavorBalanceScore: balanceScore,
      dominantNotes: dominantNotes.length > 0 ? dominantNotes : ['Vị giác cân bằng, hài hòa tự nhiên'],
      pairingTips,
      warnings,
      detectedAllergens: allergens,
    };
  }

  /**
   * Lưu công thức độc bản & sinh mã chia sẻ Viral Affiliate
   */
  async saveRecipe(dto: SaveRecipeDto, user?: any) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Công thức cần ít nhất 1 nguyên liệu.');
    }

    const calcResult = await this.calculateRecipe({ items: dto.items }, user);
    if (calcResult.calculatedItems.length === 0) {
      throw new BadRequestException('Không tìm thấy nguyên liệu hợp lệ trong công thức.');
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const recipeCode = `REC-${randomSuffix}`;
    const affiliateCode = `AFF-${randomSuffix}`;

    const recipe = await this.prisma.customUserRecipe.create({
      data: {
        recipeCode,
        userId: user?.id || null,
        recipeName: dto.recipeName || `Đĩa Ăn Độc Bản #${randomSuffix}`,
        creatorName: dto.creatorName || user?.fullName || 'Thực khách sành ăn',
        description: dto.description || 'Đĩa ăn sáng tạo theo vị giác & mục tiêu dinh dưỡng độc bản tại AVORA Restaurant.',
        coverImageUrl: dto.coverImageUrl || calcResult.calculatedItems[0]?.imageUrl || 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600',
        totalPrice: calcResult.totalPrice,
        totalCalories: calcResult.macros.calories,
        totalProtein: calcResult.macros.protein,
        totalCarbs: calcResult.macros.carbs,
        totalFat: calcResult.macros.fat,
        isPublic: dto.isPublic !== undefined ? dto.isPublic : true,
        affiliateCode,
        items: {
          create: calcResult.calculatedItems.map((it) => ({
            ingredientId: it.ingredientId,
            gram: it.gram,
            calculatedPrice: it.calculatedPrice,
          })),
        },
      },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    });

    return {
      success: true,
      recipeCode: recipe.recipeCode,
      affiliateCode: recipe.affiliateCode,
      shareUrl: `/meal-architect/recipe/${recipe.recipeCode}`,
      recipe,
      macros: calcResult.macros,
      macroPercentages: calcResult.macroPercentages,
      sommelier: calcResult.sommelier,
    };
  }

  /**
   * Xem chi tiết 1 công thức độc bản (cho phép người khác Fork / Thêm vào giỏ)
   */
  async getRecipeByCode(code: string) {
    const recipe = await this.prisma.customUserRecipe.findUnique({
      where: { recipeCode: code },
      include: {
        items: {
          include: { ingredient: true },
        },
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức mang mã [${code}]`);
    }

    return recipe;
  }

  /**
   * Bảng vàng cộng đồng: Top công thức thịnh hành nhất
   */
  async getCommunityGallery(limit = 12) {
    const list = await this.prisma.customUserRecipe.findMany({
      where: { isPublic: true },
      orderBy: [{ forkCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(50, Math.max(1, limit)),
      include: {
        items: {
          include: { ingredient: true },
        },
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return list;
  }

  /**
   * Thả tim (Like) cho công thức cộng đồng
   */
  async likeRecipe(id: string) {
    return this.prisma.customUserRecipe.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });
  }

  /**
   * Fork công thức (ghi nhận số lần người khác dùng công thức này để đặt hàng)
   */
  async forkRecipe(recipeCode: string) {
    return this.prisma.customUserRecipe.update({
      where: { recipeCode },
      data: { forkCount: { increment: 1 } },
    });
  }

  /**
   * ==========================================
   * ADMIN MANAGEMENT APIS FOR MEAL ARCHITECT™
   * ==========================================
   */

  /**
   * 1. Lấy toàn bộ nguyên liệu quản trị (kể cả đang tắt khả dụng)
   */
  async getAdminIngredients() {
    const raw = await this.prisma.architectIngredient.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return raw.map((ing) => {
      let allergens: string[] = [];
      try {
        if (ing.allergensJson) allergens = JSON.parse(ing.allergensJson);
      } catch {}
      return {
        ...ing,
        allergens,
      };
    });
  }

  /**
   * 2. Thêm mới nguyên liệu vào kho Meal Architect™
   */
  async createAdminIngredient(data: any) {
    const code = data.code || `ING_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let allergensJson = '[]';
    if (Array.isArray(data.allergens)) {
      allergensJson = JSON.stringify(data.allergens);
    } else if (typeof data.allergensJson === 'string') {
      allergensJson = data.allergensJson;
    }

    const created = await this.prisma.architectIngredient.create({
      data: {
        code,
        name: data.name,
        category: data.category as ArchitectIngredientCategory,
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        price: Math.max(0, Number(data.price ?? data.basePrice) || 0),
        baseGram: Math.max(1, Number(data.baseGram ?? data.defaultGrams) || 100),
        calories: Math.max(0, Number(data.calories ?? data.caloriesPer100g) || 0),
        protein: Math.max(0, Number(data.protein ?? data.proteinPer100g) || 0),
        carbs: Math.max(0, Number(data.carbs ?? data.carbsPer100g) || 0),
        fat: Math.max(0, Number(data.fat ?? data.fatPer100g) || 0),
        spiciness: Math.max(0, Math.min(5, Number(data.spiciness) || 0)),
        sweetness: Math.max(0, Math.min(5, Number(data.sweetness) || 0)),
        saltiness: Math.max(0, Math.min(5, Number(data.saltiness) || 0)),
        sourness: Math.max(0, Math.min(5, Number(data.sourness) || 0)),
        richness: Math.max(0, Math.min(5, Number(data.richness) || 0)),
        umami: Math.max(0, Math.min(5, Number(data.umami) || 0)),
        allergensJson,
        isAvailable: data.isAvailable !== false,
        sortOrder: Number(data.sortOrder) || 0,
      },
    });

    return {
      success: true,
      message: `Đã thêm nguyên liệu [${created.name}] thành công.`,
      data: created,
    };
  }

  /**
   * 3. Sửa nguyên liệu (Giá bán, macro dinh dưỡng, khả dụng)
   */
  async updateAdminIngredient(id: string, data: any) {
    const existing = await this.prisma.architectIngredient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu ID ${id}`);
    }

    let allergensJson = existing.allergensJson;
    if (Array.isArray(data.allergens)) {
      allergensJson = JSON.stringify(data.allergens);
    } else if (typeof data.allergensJson === 'string') {
      allergensJson = data.allergensJson;
    }

    const updated = await this.prisma.architectIngredient.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.category ? { category: data.category as ArchitectIngredientCategory } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
        ...(data.price !== undefined || data.basePrice !== undefined ? { price: Math.max(0, Number(data.price ?? data.basePrice)) } : {}),
        ...(data.baseGram !== undefined || data.defaultGrams !== undefined ? { baseGram: Math.max(1, Number(data.baseGram ?? data.defaultGrams)) } : {}),
        ...(data.calories !== undefined || data.caloriesPer100g !== undefined ? { calories: Number(data.calories ?? data.caloriesPer100g) } : {}),
        ...(data.protein !== undefined || data.proteinPer100g !== undefined ? { protein: Number(data.protein ?? data.proteinPer100g) } : {}),
        ...(data.carbs !== undefined || data.carbsPer100g !== undefined ? { carbs: Number(data.carbs ?? data.carbsPer100g) } : {}),
        ...(data.fat !== undefined || data.fatPer100g !== undefined ? { fat: Number(data.fat ?? data.fatPer100g) } : {}),
        ...(data.spiciness !== undefined ? { spiciness: Number(data.spiciness) } : {}),
        ...(data.sweetness !== undefined ? { sweetness: Number(data.sweetness) } : {}),
        ...(data.saltiness !== undefined ? { saltiness: Number(data.saltiness) } : {}),
        ...(data.sourness !== undefined ? { sourness: Number(data.sourness) } : {}),
        ...(data.richness !== undefined ? { richness: Number(data.richness) } : {}),
        ...(data.umami !== undefined ? { umami: Number(data.umami) } : {}),
        ...(data.allergens !== undefined || data.allergensJson !== undefined ? { allergensJson } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: Boolean(data.isAvailable) } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: Number(data.sortOrder) } : {}),
      },
    });

    return {
      success: true,
      message: `Đã cập nhật nguyên liệu [${updated.name}] thành công.`,
      data: updated,
    };
  }

  /**
   * 4. Xóa nguyên liệu
   */
  async deleteAdminIngredient(id: string) {
    const existing = await this.prisma.architectIngredient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu ID ${id}`);
    }

    await this.prisma.architectIngredient.delete({ where: { id } });
    return {
      success: true,
      message: `Đã xóa nguyên liệu [${existing.name}].`,
    };
  }

  /**
   * 5. Lấy danh sách công thức khách đã tạo (Phân trang, tìm kiếm)
   */
  async getAdminRecipes(params: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 12));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { recipeCode: { contains: q } },
        { recipeName: { contains: q } },
        { authorName: { contains: q } },
        { user: { fullName: { contains: q } } },
      ];
    }

    const [total, recipes] = await Promise.all([
      this.prisma.customUserRecipe.count({ where }),
      this.prisma.customUserRecipe.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { ingredient: true } },
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: recipes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
