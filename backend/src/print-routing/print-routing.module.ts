import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrintTemplateModule } from '../print-template/print-template.module';
import { PrintRoutingService } from './print-routing.service';
import { PrinterDispatcherService } from './printer-dispatcher.service';
import { PrintAgentGateway } from './print-agent.gateway';
import { PrintRoutingController } from './print-routing.controller';

@Module({
  imports: [PrismaModule, PrintTemplateModule],
  controllers: [PrintRoutingController],
  providers: [
    PrintRoutingService,
    PrinterDispatcherService,
    PrintAgentGateway,
  ],
  exports: [PrintRoutingService, PrinterDispatcherService],
})
export class PrintRoutingModule {}
