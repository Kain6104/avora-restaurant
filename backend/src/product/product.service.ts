import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async getSearchSuggestions() {
    // Top searches: using top sold items' names as a proxy for top searches
    const topProducts = await this.prisma.product.findMany({
      where: { available: true },
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
        oldPrice: { gt: this.prisma.product.fields.price } // valid if using Prisma 5.2+ field ref, but safer to do a raw query or just fetch those with oldPrice not null
      },
      take: 20
    });
    
    // Prisma workaround for oldPrice > price (since gt field reference might not be fully supported in all setups): 
    const validDeals = hotDealCandidates.filter(p => p.oldPrice && p.oldPrice > p.price);
    const hotDeals = validDeals.sort(() => 0.5 - Math.random()).slice(0, 3);

    return {
      topSearches,
      hotDeals
    };
  }

  async searchProducts(
    query: string, 
    categorySlug?: string, 
    sort?: string,
    minPrice?: string,
    maxPrice?: string,
    page: string = '1',
    limit: string = '20'
  ) {
    let whereClause: any = { available: true };
    
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
      include: { category: true },
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
        where: { available: true, AND: searchConditions },
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

    return {
      products,
      total,
      categories,
      hasMore: skip + products.length < total
    };
  }

  async getProductDetails(categorySlug: string, productSlug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug }
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${categorySlug} not found`);
    }

    const product = await this.prisma.product.findFirst({
      where: { 
        slug: productSlug,
        categoryId: category.id,
        available: true
      },
      include: {
        category: true,
        optionGroups: {
          include: {
            optionItems: true
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${productSlug} not found in category ${categorySlug}`);
    }

    const relatedDishes = await this.prisma.product.findMany({
      where: {
        categoryId: category.id,
        id: { not: product.id },
        available: true
      },
      take: 4
    });

    return {
      product,
      relatedDishes
    };
  }
}
