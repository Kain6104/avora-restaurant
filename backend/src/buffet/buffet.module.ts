import { Module } from '@nestjs/common';
import { BuffetController } from './buffet.controller';
import { BuffetService } from './buffet.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BuffetController],
  providers: [BuffetService],
  exports: [BuffetService],
})
export class BuffetModule {}
