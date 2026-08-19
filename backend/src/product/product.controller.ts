import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('search/suggestions')
  async getSearchSuggestions() {
    return this.productService.getSearchSuggestions();
  }

  @Get('search')
  async searchProducts(
    @Query('q') query: string,
    @Query('category') category: string,
    @Query('sort') sort: string,
    @Query('minPrice') minPrice: string,
    @Query('maxPrice') maxPrice: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('branchId') branchId?: string
  ) {
    return this.productService.searchProducts(query, category, sort, minPrice, maxPrice, page, limit, branchId);
  }

  @Get('by-id/:id')
  async getProductById(@Param('id') id: string) {
    return this.productService.getProductById(id);
  }

  @Get(':categorySlug/:productSlug')
  async getProductDetails(
    @Param('categorySlug') categorySlug: string,
    @Param('productSlug') productSlug: string,
    @Query('branchId') branchId?: string
  ) {
    return this.productService.getProductDetails(categorySlug, productSlug, branchId);
  }
}
