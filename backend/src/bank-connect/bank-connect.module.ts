import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PosModule } from '../pos/pos.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BankConnectController } from './bank-connect.controller';
import { BankConnectService } from './services/bank-connect.service';
import { BankCryptoService } from './services/bank-crypto.service';
import { BankParserService } from './services/bank-parser.service';
import { OrderMatchingService } from './services/order-matching.service';
import { DeviceAuthGuard } from './guards/device-auth.guard';

@Module({
  imports: [PrismaModule, PosModule, RealtimeModule],
  controllers: [BankConnectController],
  providers: [
    BankConnectService,
    BankCryptoService,
    BankParserService,
    OrderMatchingService,
    DeviceAuthGuard,
  ],
  exports: [
    BankConnectService,
    BankParserService,
    OrderMatchingService,
    BankCryptoService,
  ],
})
export class BankConnectModule {}

