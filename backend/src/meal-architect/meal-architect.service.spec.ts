import { Test, TestingModule } from '@nestjs/testing';
import { MealArchitectService } from './meal-architect.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArchitectIngredientCategory } from '@prisma/client';

describe('MealArchitectService', () => {
  let service: MealArchitectService;
  let prisma: PrismaService;

  const mockIngredients = [
    {
      id: 'ing-1',
      code: 'ING_BROWN_RICE',
      name: 'Gạo Lứt Huyết Rồng',
      category: ArchitectIngredientCategory.BASE_CARB,
      baseGram: 150,
      price: 18000,
      calories: 165,
      protein: 3.5,
      carbs: 35,
      fat: 1.2,
      fiber: 2.5,
      sodiumMg: 15,
      spiciness: 0,
      sweetness: 2,
      saltiness: 1,
      sourness: 0,
      richness: 2,
      umami: 3,
      allergensJson: '[]',
      isAvailable: true,
      sortOrder: 1,
    },
    {
      id: 'ing-2',
      code: 'ING_SALMON',
      name: 'Cá Hồi Na-uy',
      category: ArchitectIngredientCategory.PROTEIN,
      baseGram: 140,
      price: 68000,
      calories: 280,
      protein: 32,
      carbs: 0,
      fat: 15,
      fiber: 0,
      sodiumMg: 95,
      spiciness: 0,
      sweetness: 1,
      saltiness: 3,
      sourness: 0,
      richness: 8,
      umami: 8,
      allergensJson: '["SEAFOOD"]',
      isAvailable: true,
      sortOrder: 2,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealArchitectService,
        {
          provide: PrismaService,
          useValue: {
            architectIngredient: {
              findMany: jest.fn().mockResolvedValue(mockIngredients),
            },
            customUserRecipe: {
              create: jest.fn().mockImplementation(({ data }) => ({
                id: 'recipe-uuid',
                recipeCode: 'REC-TEST1',
                affiliateCode: 'AFF-TEST1',
                ...data,
              })),
              findUnique: jest.fn().mockResolvedValue({
                id: 'recipe-uuid',
                recipeCode: 'REC-TEST1',
                recipeName: 'Đĩa Cơm Na-uy Test',
                totalPrice: 86000,
                totalCalories: 445,
                items: [],
              }),
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockImplementation(({ data }) => ({ id: 'recipe-uuid', ...data })),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MealArchitectService>(MealArchitectService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should group ingredients by category', async () => {
    const res = await service.getIngredients();
    expect(res.all).toHaveLength(2);
    expect(res.grouped[ArchitectIngredientCategory.BASE_CARB]).toHaveLength(1);
    expect(res.grouped[ArchitectIngredientCategory.PROTEIN]).toHaveLength(1);
  });

  it('should accurately calculate macros and flavor sommelier score', async () => {
    const calc = await service.calculateRecipe({
      items: [
        { ingredientId: 'ing-1', gram: 150 },
        { ingredientId: 'ing-2', gram: 140 },
      ],
    });

    expect(calc.totalPrice).toBe(86000);
    expect(calc.macros.calories).toBe(445);
    expect(calc.macros.protein).toBe(35.5);
    expect(calc.sommelier.detectedAllergens).toContain('SEAFOOD');
    expect(calc.sommelier.flavorBalanceScore).toBeGreaterThanOrEqual(50);
  });

  it('should save custom recipe and generate unique recipeCode and affiliateCode', async () => {
    const res = await service.saveRecipe({
      recipeName: 'Đĩa Cơm Na-uy Test',
      items: [
        { ingredientId: 'ing-1', gram: 150 },
        { ingredientId: 'ing-2', gram: 140 },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.recipeCode).toMatch(/^REC-/);
    expect(res.affiliateCode).toMatch(/^AFF-/);
    expect(res.shareUrl).toContain(res.recipeCode);
  });
});

