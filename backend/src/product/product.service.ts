import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionService } from '../promotion/promotion.service';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService, private promotionService: PromotionService) {}

  async getSearchSuggestions() {
    // Top searches: using top sold items' names as a proxy for top searches
    const topProducts = await this.prisma.product.findMany({
      where: { 
        available: true,
        id: { notIn: ['prod-ai-meal-architect'] },
        slug: { notIn: ['ai-meal-architect', 'sys-ai-meal-architect-hidden'] }
      },
      orderBy: { soldQuantity: 'desc' },
      take: 7,
      select: { name: true }
    });
    
    // Convert to simple array of names and deduplicate if necessary
    const topSearches = Array.from(new Set(topProducts.map(p => p.name)));

    // Hot deals: products with oldPrice > price, randomly pick 3 (using SQL RAND() if possible, but in Prisma we can fetch a few and shuffle in JS)
    const hotDealCandidates = await this.prisma.product.findMany({
      where: { 
        available: true,
        id: { notIn: ['prod-ai-meal-architect'] },
        oldPrice: { gt: this.prisma.product.fields.price } // valid if using Prisma 5.2+ field ref, but safer to do a raw query or just fetch those with oldPrice not null
      },
      include: {
        optionGroups: { include: { optionItems: true } }
      },
      take: 20
    });
    
    // Prisma workaround for oldPrice > price (since gt field reference might not be fully supported in all setups): 
    const validDeals = hotDealCandidates.filter(p => p.oldPrice && p.oldPrice > p.price);
    const hotDeals = validDeals.sort(() => 0.5 - Math.random()).slice(0, 3);

    return {
      topSearches,
      hotDeals: await this.promotionService.enrichProductsWithFlashSale(hotDeals)
    };
  }

  async quickSearch(query: string) {
    if (!query) return { categories: [], products: [] };
    
    const searchTerms = query.trim().split(/\s+/);
    const searchConditions = searchTerms.map(term => ({
      OR: [
        { name: { contains: term } },
        { description: { contains: term } }
      ]
    }));

    const products = await this.prisma.product.findMany({
      where: { available: true, id: { notIn: ['prod-ai-meal-architect'] }, AND: searchConditions },
      include: { 
        branches: { select: { id: true, name: true } }, 
        category: true,
        optionGroups: { include: { optionItems: true } }
      },
      take: 6
    });

    const categoryConditions = searchTerms.map(term => ({
      name: { contains: term }
    }));
    
    const categories = await this.prisma.category.findMany({
      where: { AND: categoryConditions },
      take: 4
    });

    return { 
      categories, 
      products: await this.promotionService.enrichProductsWithFlashSale(products) 
    };
  }

  async searchProducts(
    query: string, 
    categorySlug?: string, 
    sort?: string,
    minPrice?: string,
    maxPrice?: string,
    page: string = '1',
    limit: string = '20',
    branchId?: string
  ) {
    let whereClause: any = { 
      available: true,
      id: { notIn: ['prod-ai-meal-architect'] },
      slug: { notIn: ['ai-meal-architect', 'sys-ai-meal-architect-hidden'] },
      category: { slug: { not: 'system-hidden' } },
    };
    
    if (query) {
      const searchTerms = query.trim().split(/\s+/);
      const searchConditions = searchTerms.map(term => ({
        OR: [
          { name: { contains: term } },
          { description: { contains: term } }
        ]
      }));

      whereClause = {
        ...whereClause,
        AND: searchConditions
      };
    }

    if (categorySlug) {
      const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
      if (category) {
        whereClause.categoryId = category.id;
      }
    }
    
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
    }
    // We no longer filter by branchId in whereClause because we want global search results.
    // The frontend will use the included 'branches' data to indicate branch availability.
    let orderBy: any = {};
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };
    else if (sort === 'sold_desc') orderBy = { soldQuantity: 'desc' };
    else orderBy = { createdAt: 'desc' };

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const products = await this.prisma.product.findMany({
      where: whereClause,
      orderBy,
      include: { 
        category: true, 
        branches: { select: { id: true, name: true } },
        optionGroups: { include: { optionItems: true } }
      },
      take: parsedLimit,
      skip,
    });

    const total = await this.prisma.product.count({ where: whereClause });
    
    // Compute categories that exist in the search results
    // To do this efficiently, we query the products without pagination but only select categoryId
    // If the query is empty, we just return all categories.
    let categories: any[] = [];
    if (query) {
      const searchTerms = query.trim().split(/\s+/);
      const searchConditions = searchTerms.map(term => ({
        OR: [
          { name: { contains: term } },
          { description: { contains: term } }
        ]
      }));

      const allMatchingProducts = await this.prisma.product.findMany({
        where: { 
          available: true, 
          id: { notIn: ['prod-ai-meal-architect'] },
          slug: { notIn: ['ai-meal-architect', 'sys-ai-meal-architect-hidden'] },
          AND: searchConditions 
        },
        select: { categoryId: true },
        distinct: ['categoryId']
      });
      const categoryIds = allMatchingProducts.map(p => p.categoryId);
      categories = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } }
      });
    } else {
      categories = await this.prisma.category.findMany();
    }

    const enrichedProducts = await this.promotionService.enrichProductsWithFlashSale(products);

    return {
      products: enrichedProducts,
      total,
      categories,
      hasMore: skip + products.length < total
    };
  }

  async getProductById(id: string, branchId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const identifierCondition = isUuid ? { OR: [{ id }, { slug: id }] } : { slug: id };

    let product = await this.prisma.product.findFirst({
      where: {
        ...identifierCondition,
        ...(branchId ? { branches: { some: { id: branchId } } } : {}),
      },
      include: {
        optionGroups: {
          include: {
            optionItems: true,
          },
        },
      },
    });

    if (!product) {
      // Fallback: nếu chi nhánh cụ thể không map trực tiếp thì nạp theo mã món hoặc slug
      product = await this.prisma.product.findFirst({
        where: identifierCondition,
        include: {
          optionGroups: {
            include: {
              optionItems: true,
            },
          },
        },
      });
    }

    if (!product) {
      throw new NotFoundException(`Product with id or slug ${id} not found`);
    }

    const [enrichedProduct] = await this.promotionService.enrichProductsWithFlashSale([product]);

    return enrichedProduct;
  }

  async getProductsBulk(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: {
        optionGroups: {
          include: {
            optionItems: true
          }
        }
      }
    });

    return this.promotionService.enrichProductsWithFlashSale(products);
  }

  async getProductDetails(categorySlug: string, productSlug: string, branchId?: string) {
    if (productSlug === 'ai-meal-architect' || productSlug === 'prod-ai-meal-architect') {
      throw new NotFoundException('Món ăn tùy chỉnh vui lòng truy cập tại /meal-architect');
    }
    let category = await this.prisma.category.findUnique({
      where: { slug: categorySlug }
    });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productSlug);
    let product: any = null;

    if (!category) {
      // Fallback: If categorySlug is 'menu' or 'product' or not found, try to locate product by slug or id directly
      product = await this.prisma.product.findFirst({
        where: isUUID
          ? { id: productSlug, available: true }
          : { slug: productSlug, available: true },
        include: {
          category: true,
          branches: { select: { id: true } },
          optionGroups: {
            include: {
              optionItems: true
            }
          }
        }
      });

      if (product && product.category) {
        category = product.category;
      }
    } else {
      product = await this.prisma.product.findFirst({
        where: isUUID
          ? { id: productSlug, categoryId: category.id, available: true }
          : { slug: productSlug, categoryId: category.id, available: true },
        include: {
          category: true,
          branches: { select: { id: true } },
          optionGroups: {
            include: {
              optionItems: true
            }
          }
        }
      });
    }

    if (!product) {
      // Secondary fallback: find product by slug directly regardless of category in URL
      product = await this.prisma.product.findFirst({
        where: isUUID
          ? { id: productSlug, available: true }
          : { slug: productSlug, available: true },
        include: {
          category: true,
          branches: { select: { id: true } },
          optionGroups: {
            include: {
              optionItems: true
            }
          }
        }
      });

      if (product && product.category) {
        category = product.category;
      }
    }

    if (!product) {
      // Tertiary fallback: check if productSlug has pattern 'san-pham-100-xyz' or 'PRD-100'
      const spMatch = productSlug.match(/san-pham-(\d+)/i);
      if (spMatch) {
        const itemNum = parseInt(spMatch[1], 10);
        const itemCodePadded = `PRD-${itemNum.toString().padStart(3, '0')}`;
        const itemCodeRaw = `PRD-${itemNum}`;

        product = await this.prisma.product.findFirst({
          where: {
            OR: [
              { itemCode: itemCodePadded },
              { itemCode: itemCodeRaw },
              { slug: { contains: `san-pham-${itemNum}` } }
            ],
            available: true
          },
          include: {
            category: true,
            branches: { select: { id: true } },
            optionGroups: {
              include: {
                optionItems: true
              }
            }
          }
        });

        if (product && product.category) {
          category = product.category;
        }
      }
    }

    if (!product) {
      // Quaternary fallback: strip trailing hash from productSlug (e.g. slug-8r7hbq -> slug)
      const cleanSlug = productSlug.replace(/-[a-z0-9]{5,8}$/i, '');
      if (cleanSlug && cleanSlug !== productSlug) {
        product = await this.prisma.product.findFirst({
          where: { slug: cleanSlug, available: true },
          include: {
            category: true,
            branches: { select: { id: true } },
            optionGroups: {
              include: {
                optionItems: true
              }
            }
          }
        });
        if (product && product.category) {
          category = product.category;
        }
      }
    }

    if (!product || product.id === 'prod-ai-meal-architect' || product.slug === 'ai-meal-architect' || product.slug === 'sys-ai-meal-architect-hidden') {
      throw new NotFoundException(`Product with slug ${productSlug} not found`);
    }

    const targetCategoryId = category?.id || product.categoryId;
    const relatedWhere: any = {
      categoryId: targetCategoryId,
      id: { notIn: [product.id, 'prod-ai-meal-architect'] },
      available: true
    };
    
    if (branchId) {
      relatedWhere.OR = [
        { branches: { some: { id: branchId } } },
        { branches: { none: {} } }
      ];
    }

    const relatedDishes = await this.prisma.product.findMany({
      where: relatedWhere,
      include: { branches: { select: { id: true } } },
      take: 10
    });

    const [enrichedProduct] = await this.promotionService.enrichProductsWithFlashSale([product]);
    const enrichedRelatedDishes = await this.promotionService.enrichProductsWithFlashSale(relatedDishes);

    // Lấy danh sách bài viết nhắc đến món ăn này
    let relatedArticles = await this.prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { products: { some: { productId: product.id } } },
          { title: { contains: product.name } },
          { excerpt: { contains: product.name } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailUrl: true,
        excerpt: true,
        articleType: true,
        publishedAt: true,
        viewCount: true,
      },
      take: 4,
      orderBy: { publishedAt: 'desc' },
    });

    // Fallback: nếu món ăn chưa có bài viết riêng thì lấy 3 bài viết cẩm nang ẩm thực mới nhất
    if (!relatedArticles || relatedArticles.length === 0) {
      relatedArticles = await this.prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          excerpt: true,
          articleType: true,
          publishedAt: true,
          viewCount: true,
        },
        take: 3,
        orderBy: { publishedAt: 'desc' },
      });
    }

    return {
      product: enrichedProduct,
      relatedDishes: enrichedRelatedDishes,
      relatedArticles,
    };
  }
}
