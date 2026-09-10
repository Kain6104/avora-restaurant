import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrintRoutingService } from './print-routing.service';
import { PrinterDispatcherService } from './printer-dispatcher.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import * as crypto from 'crypto';
import {
  CreateKitchenStationDto,
  UpdateKitchenStationDto,
} from './dto/kitchen-station.dto';
import {
  CreatePrinterDto,
  UpdatePrinterDto,
  AssignStationPrinterDto,
} from './dto/printer.dto';
import {
  CreateProductPrintRouteDto,
  UpdateProductPrintRouteDto,
  BulkSetProductPrintRoutesDto,
} from './dto/print-route.dto';
import {
  ReprintJobDto,
  QueryPrintJobsDto,
} from './dto/print-job.dto';
import {
  CreatePrintAgentDto,
  UpdatePrintAgentDto,
} from './dto/print-agent.dto';

@Controller('print-routing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PrintRoutingController {
  constructor(
    private readonly routingService: PrintRoutingService,
    private readonly dispatcherService: PrinterDispatcherService,
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================
  // 1. KITCHEN STATIONS
  // ==========================================

  @Get('stations')
  @RequirePermission('kitchen_settings.view', { branchParam: 'branchId' })
  async getStations(@Query('branchId') branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const data = await this.prisma.kitchenStation.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true, phone: true } },
        stationPrinters: {
          include: {
            printer: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { priority: 'asc' }],
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return { success: true, data };
  }

  @Post('stations')
  @RequirePermission('kitchen_settings.update', { branchParam: 'branchId' })
  async createStation(@Body() dto: CreateKitchenStationDto) {
    const existing = await this.prisma.kitchenStation.findFirst({
      where: { branchId: dto.branchId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã khu vực bếp "${dto.code}" đã tồn tại trong chi nhánh này`);
    }

    const station = await this.prisma.kitchenStation.create({
      data: dto,
    });
    return { success: true, data: station };
  }

  @Put('stations/:id')
  @RequirePermission('kitchen_settings.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.kitchenStation.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateStation(@Param('id') id: string, @Body() dto: UpdateKitchenStationDto) {
    const station = await this.prisma.kitchenStation.update({
      where: { id },
      data: dto,
    });
    return { success: true, data: station };
  }

  @Delete('stations/:id')
  @RequirePermission('kitchen_settings.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.kitchenStation.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async deleteStation(@Param('id') id: string) {
    const routesCount = await this.prisma.productPrintRoute.count({
      where: { stationId: id },
    });
    if (routesCount > 0) {
      throw new BadRequestException(`Không thể xóa khu vực bếp đang được gán cho ${routesCount} món ăn. Hãy chuyển tuyến trước.`);
    }

    await this.prisma.kitchenStationPrinter.deleteMany({
      where: { stationId: id },
    });

    await this.prisma.kitchenStation.delete({
      where: { id },
    });

    return { success: true, message: 'Đã xóa khu vực bếp thành công' };
  }

  @Post('stations/assign-printer')
  @RequirePermission('kitchen_settings.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.kitchenStation.findUnique({ where: { id: req.body.stationId }, select: { branchId: true } }))?.branchId,
  })
  async assignStationPrinter(@Body() dto: AssignStationPrinterDto) {
    if (dto.isPrimary) {
      await this.prisma.kitchenStationPrinter.updateMany({
        where: { stationId: dto.stationId },
        data: { isPrimary: false },
      });
    }

    const record = await this.prisma.kitchenStationPrinter.upsert({
      where: {
        stationId_printerId: {
          stationId: dto.stationId,
          printerId: dto.printerId,
        },
      },
      update: {
        isPrimary: dto.isPrimary ?? true,
        priority: dto.priority ?? 1,
        printPurpose: dto.printPurpose,
        isActive: true,
      },
      create: {
        stationId: dto.stationId,
        printerId: dto.printerId,
        isPrimary: dto.isPrimary ?? true,
        priority: dto.priority ?? 1,
        printPurpose: dto.printPurpose,
      },
    });

    return { success: true, data: record };
  }

  @Delete('stations/printers/:id')
  @RequirePermission('kitchen_settings.update', {
    resourceResolver: async (req, prisma) => {
      const sp = await prisma.kitchenStationPrinter.findUnique({
        where: { id: req.params.id },
        select: { station: { select: { branchId: true } } },
      });
      return sp?.station?.branchId;
    },
  })
  async removeStationPrinter(@Param('id') id: string) {
    await this.prisma.kitchenStationPrinter.delete({
      where: { id },
    });
    return { success: true, message: 'Đã gỡ máy in khỏi khu vực chế biến' };
  }

  // ==========================================
  // 2. PRINTERS
  // ==========================================

  @Get('printers')
  @RequirePermission('printers.view', { branchParam: 'branchId' })
  async getPrinters(@Query('branchId') branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const data = await this.prisma.printer.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true, phone: true } },
        agent: true,
        stationPrinters: {
          include: {
            station: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data };
  }

  @Post('printers')
  @RequirePermission('printers.create', { branchParam: 'branchId' })
  async createPrinter(@Body() dto: CreatePrinterDto) {
    const printer = await this.prisma.printer.create({
      data: dto,
    });
    return { success: true, data: printer };
  }

  @Put('printers/:id')
  @RequirePermission('printers.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printer.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updatePrinter(@Param('id') id: string, @Body() dto: UpdatePrinterDto) {
    const printer = await this.prisma.printer.update({
      where: { id },
      data: dto,
    });
    return { success: true, data: printer };
  }

  @Delete('printers/:id')
  @RequirePermission('printers.delete', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printer.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async deletePrinter(@Param('id') id: string) {
    await this.prisma.kitchenStationPrinter.deleteMany({
      where: { printerId: id },
    });

    await this.prisma.printer.delete({
      where: { id },
    });

    return { success: true, message: 'Đã xóa máy in thành công' };
  }

  @Post('printers/:id/test-print')
  @RequirePermission('printers.test', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printer.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async testPrint(@Param('id') id: string) {
    const res = await this.dispatcherService.testPrint(id);
    return { success: res.success, message: res.message };
  }

  // ==========================================
  // 3. PRINT AGENTS
  // ==========================================

  @Get('agents')
  @RequirePermission('printers.view', { branchParam: 'branchId' })
  async getAgents(@Query('branchId') branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const data = await this.prisma.printAgent.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true, phone: true } },
        printers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data };
  }

  @Post('agents')
  @RequirePermission('printers.create', { branchParam: 'branchId' })
  async createAgent(@Body() dto: CreatePrintAgentDto) {
    const rawToken = 'agt_' + crypto.randomBytes(24).toString('hex');
    const agentCode = dto.agentCode || 'AGT-' + Math.floor(1000 + Math.random() * 9000);
    const name = dto.name || dto.agentName || 'AVORA Print Agent';

    const agent = await this.prisma.printAgent.create({
      data: {
        branchId: dto.branchId,
        agentCode,
        name,
        secretHash: rawToken,
        salt: 'avora_salt',
        ipAddress: dto.ipAddress,
        version: dto.version || '1.0.0',
        isActive: dto.isActive ?? true,
      },
    });

    return {
      success: true,
      data: agent,
      secretToken: rawToken,
    };
  }

  @Put('agents/:id')
  @RequirePermission('printers.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printAgent.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateAgent(@Param('id') id: string, @Body() dto: UpdatePrintAgentDto) {
    const updateData: any = {};
    if (dto.name || dto.agentName) updateData.name = dto.name || dto.agentName;
    if (dto.ipAddress !== undefined) updateData.ipAddress = dto.ipAddress;
    if (dto.version !== undefined) updateData.version = dto.version;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const agent = await this.prisma.printAgent.update({
      where: { id },
      data: updateData,
    });
    return { success: true, data: agent };
  }

  @Delete('agents/:id')
  @RequirePermission('printers.delete', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printAgent.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async deleteAgent(@Param('id') id: string) {
    await this.prisma.printer.updateMany({
      where: { agentId: id },
      data: { agentId: null },
    });

    await this.prisma.printAgent.delete({
      where: { id },
    });

    return { success: true, message: 'Đã xóa Print Agent' };
  }

  // ==========================================
  // 4. PRODUCT PRINT ROUTES
  // ==========================================

  @Get('product-routes')
  @RequirePermission('print_routes.view', { branchParam: 'branchId' })
  async getProductRoutes(@Query('branchId') branchId?: string, @Query('productId') productId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (productId) where.productId = productId;

    const data = await this.prisma.productPrintRoute.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, itemCode: true, imageUrl: true } },
        branch: { select: { id: true, name: true, branchCode: true, phone: true } },
        station: {
          include: {
            stationPrinters: {
              include: { printer: true },
            },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return { success: true, data };
  }

  @Get('product-routes/by-product/:productId')
  @RequirePermission('print_routes.view', { branchParam: 'branchId' })
  async getRoutesByProduct(@Param('productId') productId: string, @Query('branchId') branchId?: string) {
    const where: any = { productId };
    if (branchId) where.branchId = branchId;

    const data = await this.prisma.productPrintRoute.findMany({
      where,
      include: {
        station: {
          include: {
            stationPrinters: {
              include: { printer: true },
            },
          },
        },
      },
      orderBy: { priority: 'asc' },
    });

    return { success: true, data };
  }

  @Post('product-routes')
  @RequirePermission('print_routes.update', { branchParam: 'branchId' })
  async createProductRoute(@Body() dto: CreateProductPrintRouteDto) {
    const route = await this.prisma.productPrintRoute.create({
      data: dto,
    });
    return { success: true, data: route };
  }

  @Post('product-routes/bulk')
  @RequirePermission('print_routes.update', { branchParam: 'branchId' })
  async bulkSetProductRoutes(@Body() dto: BulkSetProductPrintRoutesDto) {
    await this.prisma.productPrintRoute.deleteMany({
      where: {
        productId: dto.productId,
        branchId: dto.branchId,
      },
    });

    if (dto.routes && dto.routes.length > 0) {
      await this.prisma.productPrintRoute.createMany({
        data: dto.routes.map((r, index) => ({
          productId: dto.productId,
          branchId: dto.branchId,
          stationId: r.stationId,
          routeRole: r.routeRole,
          printType: r.printType || 'KITCHEN_TICKET',
          copies: r.copies || 1,
          priority: r.priority || index + 1,
          isActive: true,
        })),
      });
    }

    return { success: true, message: 'Đã lưu cấu hình tuyến in cho món thành công' };
  }

  @Delete('product-routes/:id')
  @RequirePermission('print_routes.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.productPrintRoute.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async deleteProductRoute(@Param('id') id: string) {
    await this.prisma.productPrintRoute.delete({
      where: { id },
    });
    return { success: true, message: 'Đã xóa tuyến in của món' };
  }

  // ==========================================
  // 5. PRINT JOBS & MONITORING
  // ==========================================

  @Get('jobs')
  @RequirePermission('printers.view', { branchParam: 'branchId' })
  async getPrintJobs(@Query() query: QueryPrintJobsDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.orderId) where.orderId = query.orderId;
    if (query.printerId) where.printerId = query.printerId;
    if (query.stationId) where.stationId = query.stationId;
    if (query.status) where.status = query.status;

    const [total, items] = await Promise.all([
      this.prisma.printJob.count({ where }),
      this.prisma.printJob.findMany({
        where,
        include: {
          printer: true,
          station: true,
          order: {
            select: {
              id: true,
              orderCode: true,
              orderType: true,
              table: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  @Post('jobs/:id/reprint')
  @RequirePermission('orders.receipt.reprint', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printJob.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async reprintJob(
    @Param('id') id: string,
    @Body() dto: ReprintJobDto,
    @Request() req: any,
  ) {
    const job = await this.routingService.reprintJob(id, {
      reason: dto.reason,
      reprintedBy: req.user?.id || req.user?.name,
    });
    return { success: true, data: job, message: 'Đã tạo lệnh in lại thành công' };
  }

  @Post('jobs/:id/retry')
  @RequirePermission('orders.receipt.reprint', {
    resourceResolver: async (req, prisma) =>
      (await prisma.printJob.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async retryJob(@Param('id') id: string) {
    const job = await this.routingService.retryJob(id);
    return { success: true, data: job, message: 'Đã đặt lại trạng thái lệnh in' };
  }

  @Get('stats')
  @RequirePermission('printers.view', { branchParam: 'branchId' })
  async getStats(@Query('branchId') branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const [
      totalPrinters,
      onlinePrinters,
      errorPrinters,
      pendingJobs,
      failedJobs,
      printedJobsToday,
    ] = await Promise.all([
      this.prisma.printer.count({ where }),
      this.prisma.printer.count({ where: { ...where, status: 'ONLINE' } }),
      this.prisma.printer.count({ where: { ...where, status: 'ERROR' } }),
      this.prisma.printJob.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.printJob.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.printJob.count({
        where: {
          ...where,
          status: 'PRINTED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        totalPrinters,
        onlinePrinters,
        errorPrinters,
        pendingJobs,
        failedJobs,
        printedJobsToday,
      },
    };
  }
}
