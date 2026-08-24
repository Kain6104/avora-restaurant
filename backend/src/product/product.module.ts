import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  imports: [PromotionModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
