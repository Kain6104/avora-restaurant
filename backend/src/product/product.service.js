"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const promotion_service_1 = require("../promotion/promotion.service");
let ProductService = class ProductService {
    constructor(prisma, promotionService) {
        this.prisma = prisma;
        this.promotionService = promotionService;
    }
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
            hotDeals: await this.promotionService.enrichProductsWithFlashSale(hotDeals)
        };
    }
    async searchProducts(query, categorySlug, sort, minPrice, maxPrice, page = '1', limit = '20', branchId) {
        let whereClause = { available: true };
        if (query) {
            const searchTerms = query.trim().split(/\s+/);
            const searchConditions = searchTerms.map(term => ({
                OR: [
                    { name: { contains: term } },
                    { description: { contains: term } }
                ]
            }));
            whereClause = Object.assign(Object.assign({}, whereClause), { AND: searchConditions });
        }
        if (categorySlug) {
            const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
            if (category) {
                whereClause.categoryId = category.id;
            }
        }
        if (minPrice || maxPrice) {
            whereClause.price = {};
            if (minPrice)
                whereClause.price.gte = parseFloat(minPrice);
            if (maxPrice)
                whereClause.price.lte = parseFloat(maxPrice);
        }
        if (branchId) {
            whereClause.AND = [
                ...(whereClause.AND || []),
                {
                    OR: [
                        { branches: { some: { id: branchId } } },
                        { branches: { none: {} } }
                    ]
                }
            ];
        }
        let orderBy = {};
        if (sort === 'price_asc')
            orderBy = { price: 'asc' };
        else if (sort === 'price_desc')
            orderBy = { price: 'desc' };
        else if (sort === 'sold_desc')
            orderBy = { soldQuantity: 'desc' };
        else
            orderBy = { createdAt: 'desc' };
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
        let categories = [];
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
        }
        else {
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
    async getProductById(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                optionGroups: {
                    include: {
                        optionItems: true
                    }
                }
            }
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with id ${id} not found`);
        }
        const [enrichedProduct] = await this.promotionService.enrichProductsWithFlashSale([product]);
        return enrichedProduct;
    }
    async getProductsBulk(ids) {
        if (!ids || ids.length === 0)
            return [];
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
    async getProductDetails(categorySlug, productSlug, branchId) {
        const category = await this.prisma.category.findUnique({
            where: { slug: categorySlug }
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with slug ${categorySlug} not found`);
        }
        const product = await this.prisma.product.findFirst({
            where: {
                slug: productSlug,
                categoryId: category.id,
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
        if (!product) {
            throw new common_1.NotFoundException(`Product with slug ${productSlug} not found in category ${categorySlug}`);
        }
        const relatedWhere = {
            categoryId: category.id,
            id: { not: product.id },
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
        return {
            product: enrichedProduct,
            relatedDishes: enrichedRelatedDishes
        };
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, promotion_service_1.PromotionService])
], ProductService);
