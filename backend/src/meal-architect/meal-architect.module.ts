import { Module } from '@nestjs/common';
import { MealArchitectController } from './meal-architect.controller';
import { MealArchitectService } from './meal-architect.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MealArchitectController],
  providers: [MealArchitectService],
  exports: [MealArchitectService],
})
export class MealArchitectModule {}

