import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './services/authorization.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { OrderAuditService } from './services/order-audit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuthorizationService, PermissionsGuard, OrderAuditService],
  exports: [AuthorizationService, PermissionsGuard, OrderAuditService],
})
export class CommonModule {}
