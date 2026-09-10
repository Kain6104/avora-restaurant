import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PosGateway } from './pos.gateway';
import {
  CreatePosOrderDto,
  UpdatePosOrderDto,
  SendKitchenDto,
  HoldOrderDto,
  SplitOrderDto,
  MergeOrderDto,
  MoveTableDto,
  ProcessPaymentDto,
  RefundPaymentDto,
  OpenShiftDto,
  CloseShiftDto,
  UpdateTableLayoutDto,
  CreateMemberDto,
  ConfirmPrintDto,
  ReprintLabelsDto,
  ReprintKitchenDto,
  AddServiceChargeDto,
  SendTableItemsDto,
} from './dto/pos.dto';
import {
  OrderStatus,
  OrderSource,
  KitchenStatus,
  OrderRelationType,
  TableSessionStatus,
  PaymentRecordStatus,
  ShiftStatus,
  SlotOrderType,
  PointTransactionSource,
  ReservationStatus,
  RoleType,
  PrintJobEventType,
  PrinterConnectionType,
  PrintJobStatus,
  PrintRouteRole,
  PrintTemplateType,
  OrderItemPricingMode,
  OrderItemSource,
  BuffetSessionStatus,
  QrSessionStatus,
} from '@prisma/client';
import { PrintRoutingService } from '../print-routing/print-routing.service';
import { PrinterDispatcherService } from '../print-routing/printer-dispatcher.service';
import { EscPosEncoder } from '../print-routing/esc-pos.encoder';
import { PrintTemplateService } from '../print-template/print-template.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { NotificationEngineService } from '../notification/notification-engine.service';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posGateway: PosGateway,
    private readonly printRoutingService: PrintRoutingService,
    private readonly printerDispatcherService: PrinterDispatcherService,
    private readonly printTemplateService: PrintTemplateService,
    private readonly orderPricingService: OrderPricingService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  /**
   * Helper: Determine KDS Station based on category slug or product name
   */
  private determineStationId(categorySlug?: string, productName?: string): string {
    const slug = (categorySlug || '').toLowerCase();
    const name = (productName || '').toLowerCase();

    if (
      slug.includes('sushi') ||
      slug.includes('sashimi') ||
      slug.includes('hai-san-song') ||
      name.includes('sushi') ||
      name.includes('sashimi')
    ) {
      return 'SUSHI';
    }

    if (
      slug.includes('uong') ||
      slug.includes('drink') ||
      slug.includes('beverage') ||
      slug.includes('ruou') ||
      slug.includes('cocktail') ||
      slug.includes('tra') ||
      slug.includes('ca-phe') ||
      name.includes('nước') ||
      name.includes('trà') ||
      name.includes('bia') ||
      name.includes('rượu')
    ) {
      return 'BAR';
    }

    if (
      slug.includes('trang-mieng') ||
      slug.includes('dessert') ||
      slug.includes('che') ||
      slug.includes('kem') ||
      slug.includes('banh') ||
      name.includes('kem') ||
      name.includes('chè')
    ) {
      return 'DESSERT';
    }

    return 'HOT_KITCHEN';
  }

  /**
   * Helper: Generate unique temporary code for unpaid POS orders (Phase 1)
   * Format: TMP-XXXXXX (e.g. TMP-P8X4K2)
   */
  async generateTemporaryOrderCode(tx?: any): Promise<string> {
    const client = tx || this.prisma;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 15; attempt++) {
      let rand = '';
      for (let i = 0; i < 6; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const code = `TMP-${rand}`;
      const exists = await client.order.findUnique({
        where: { temporaryOrderCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    return `TMP-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Helper: Generate official sequential invoice code for paid POS orders (Phase 2)
   * Format: {branchCode}-DDMMYY-XXXX (e.g. AVO1-070926-0001)
   * Uses OrderSequence table with atomic concurrency protection inside transaction.
   */
  async generateOfficialPosOrderCode(branchId: string, tx: any): Promise<string> {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { branchCode: true },
    });
    const branchCode = (branch?.branchCode || 'AVO1').trim().toUpperCase();

    const d = new Date();
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yy = d.getFullYear().toString().slice(-2);
    const dateStr = `${dd}${mm}${yy}`; // DDMMYY e.g. "070926"

    const seq = await tx.orderSequence.upsert({
      where: {
        branchId_date_type: {
          branchId,
          date: dateStr,
          type: 'POS',
        },
      },
      create: {
        branchId,
        date: dateStr,
        type: 'POS',
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });

    const seqStr = seq.lastNumber.toString().padStart(4, '0');
    return `${branchCode}-${dateStr}-${seqStr}`;
  }

  // ==========================================
  // 1. INITIALIZATION & METADATA
  // ==========================================

  async getInitData(branchId?: string, user?: any) {
    const branches = await this.prisma.branch.findMany({
      where: { onlineOrderingEnabled: true },
      select: {
        id: true,
        name: true,
        branchCode: true,
        phone: true,
        province: true,
        district: true,
        ward: true,
        street: true,
        openTime: true,
        closeTime: true,
        capacity: true,
        splitKitchenTickets: true,
        printCancelTicket: true,
        autoPrintReceipt: true,
        autoPrintTempBill: true,
        receiptCopies: true,
        kitchenCopies: true,
        defaultPaperSize: true,
        defaultReceiptPrinterId: true,
      },
      orderBy: { name: 'asc' },
    });

    const isSystemAdmin = user?.role === RoleType.ADMIN || user?.role === 'ADMIN';
    let currentBranch: any = null;

    if (!isSystemAdmin && user?.branchId) {
      // Non-admin with assigned branch MUST always use their assigned branch
      currentBranch = branches.find((b) => b.id === user.branchId);
    } else {
      if (branchId) {
        currentBranch = branches.find((b) => b.id === branchId);
      }
      if (!currentBranch && user?.branchId) {
        currentBranch = branches.find((b) => b.id === user.branchId);
      }
      if (!currentBranch && branches.length > 0) {
        currentBranch = branches[0];
      }
    }

    let activeShift: any = null;
    if (currentBranch && user?.id) {
      activeShift = await this.prisma.cashShift.findFirst({
        where: {
          branchId: currentBranch.id,
          cashierId: user.id,
          status: ShiftStatus.OPEN,
        },
        include: {
          openedBy: { select: { id: true, fullName: true, email: true } },
        },
      });
    }

    const stations = [
      { id: 'HOT_KITCHEN', name: 'Bếp Nóng & Món Chính', icon: 'Flame' },
      { id: 'SUSHI', name: 'Bếp Lạnh & Sushi/Sashimi', icon: 'Fish' },
      { id: 'BAR', name: 'Quầy Pha Chế & Đồ Uống', icon: 'Wine' },
      { id: 'DESSERT', name: 'Tráng Miệng & Bánh Ngọt', icon: 'IceCream' },
    ];

    const paymentMethods = await this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      branches,
      currentBranch,
      canSwitchBranch: user?.role === RoleType.ADMIN || !user?.branchId,
      activeShift,
      stations,
      paymentMethods,
      taxPercentage: 8, // 8% VAT standard
      vatPriceMode: await this.orderPricingService.getGlobalVatPriceMode(),
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Cash Drawer Kick (Mở két tiền thu ngân POS)
   */
  async openCashDrawer(dto: { branchId: string; reason?: string }, user?: any) {
    if (!dto.branchId) {
      throw new BadRequestException('Vui lòng cung cấp branchId chi nhánh');
    }

    if (user?.role === RoleType.MANAGER && user?.branchId && user.branchId !== dto.branchId) {
      throw new ForbiddenException('Bạn không có quyền mở két tiền ở chi nhánh khác chi nhánh được phân công');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
      select: { id: true, name: true, branchCode: true },
    });
    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }

    // Resolve active printer of the branch (cashier / receipt printer) from BranchPrinterSetting or Printer
    const receiptSetting = await this.prisma.branchPrinterSetting.findUnique({
      where: { branchId_purpose: { branchId: dto.branchId, purpose: 'RECEIPT' } },
    });

    const printer = await this.prisma.printer.findFirst({
      where: { branchId: dto.branchId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const activePrinterName = receiptSetting?.printerName || printer?.name || 'Mặc định';

    const encoder = new EscPosEncoder();
    encoder.kickDrawer();
    const rawBuffer = encoder.toBuffer();

    let dispatched = false;
    if (printer) {
      try {
        if (printer.connectionType === PrinterConnectionType.NETWORK_DIRECT && printer.ipAddress) {
          const res = await this.printerDispatcherService.sendToNetworkPrinter(
            printer.ipAddress,
            printer.port || 9100,
            rawBuffer,
          );
          dispatched = !!res.success;
        }
      } catch (err: any) {
        this.logger.warn(`Could not dispatch physical kick command to printer: ${err.message}`);
      }
    }

    // Log Audit
    if (user?.id) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'OPEN_CASH_DRAWER',
            target: `Branch:${dto.branchId}`,
            newValue: JSON.stringify({
              branchName: branch.name,
              printerId: printer?.id || null,
              printerName: activePrinterName,
              reason: dto.reason || 'Mở két tiền thu ngân POS',
              dispatched,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (e) {
        this.logger.error('Failed to log audit for openCashDrawer', e);
      }
    }

    return {
      success: true,
      message: dispatched
        ? 'Lệnh mở két tiền đã được gửi tới máy in thu ngân thành công'
        : 'Đã phát lệnh mở két tiền và ghi nhận nhật ký kiểm toán (AuditLog)',
      data: {
        branchId: dto.branchId,
        branchName: branch.name,
        printerName: activePrinterName,
        dispatched,
      },
    };
  }

  // ==========================================
  // 2. REAL PRODUCTS & REALTIME AVAILABILITY
  // ==========================================

  async getProducts(branchId: string, categoryId?: string, search?: string) {
    const where: any = {};
    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { itemCode: { contains: search.trim() } },
        { slug: { contains: search.trim() } },
      ];
    }

    const [categories, products, buffetTickets, buffetItems] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: { select: { products: true } },
        },
      }),
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          optionGroups: {
            orderBy: { displayOrder: 'asc' },
            include: {
              optionItems: {
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
          FlashSaleItem: {
            where: {
              flashSale: {
                isActive: true,
                startTime: { lte: new Date() },
                endTime: { gte: new Date() },
              },
            },
            include: { flashSale: true },
          },
        },
        orderBy: [{ isBestSeller: 'desc' }, { soldQuantity: 'desc' }],
      }),
      this.prisma.buffetPackageTicket.findMany({
        where: { buffetPackage: { branchId, active: true } },
        select: {
          productId: true,
          buffetPackageId: true,
          buffetPackage: { select: { name: true } },
        },
      }),
      this.prisma.buffetPackageItem.findMany({
        where: { buffetPackage: { branchId, active: true } },
        select: {
          productId: true,
          buffetPackageId: true,
          availableForQr: true,
          allowRetailPurchase: true,
          buffetPackage: { select: { name: true } },
        },
      }),
    ]);

    const mappedProducts = products.map((prod) => {
      const activeFlashSale = prod.FlashSaleItem?.[0];
      const effectivePrice = activeFlashSale
        ? activeFlashSale.flashSalePrice
        : prod.discountedPrice || prod.price;

      const ticketInfo = buffetTickets.find((t) => t.productId === prod.id);
      const itemInfo = buffetItems.find((i) => i.productId === prod.id);

      return {
        id: prod.id,
        itemCode: prod.itemCode,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        discountedPrice: prod.discountedPrice,
        effectivePrice,
        isFlashSale: !!activeFlashSale,
        flashSalePrice: activeFlashSale?.flashSalePrice || null,
        unit: prod.unit || 'phần',
        imageUrl: prod.imageUrl,
        available: prod.available,
        isBestSeller: prod.isBestSeller,
        soldQuantity: prod.soldQuantity,
        spiciness: prod.spiciness,
        categoryId: prod.categoryId,
        categoryName: prod.category?.name,
        categorySlug: prod.category?.slug,
        isBuffetTicket: !!ticketInfo,
        buffetTicketPackageId: ticketInfo?.buffetPackageId || null,
        buffetTicketPackageName: ticketInfo?.buffetPackage?.name || null,
        isBuffetItem: !!itemInfo,
        buffetItemPackageId: itemInfo?.buffetPackageId || null,
        buffetItemPackageName: itemInfo?.buffetPackage?.name || null,
        optionGroups: prod.optionGroups.map((og) => ({
          id: og.id,
          name: og.name,
          isRequired: og.isRequired,
          multipleChoice: og.multipleChoice,
          minSelect: og.minSelect,
          maxSelect: og.maxSelect,
          optionItems: og.optionItems.map((oi) => ({
            id: oi.id,
            name: oi.name,
            priceAdjustment: oi.priceAdjustment,
            isDefault: oi.isDefault,
            available: oi.available,
          })),
        })),
      };
    });

    const buffetCategoryCount = mappedProducts.filter((p) => p.isBuffetTicket || p.isBuffetItem).length;

    return {
      categories: [
        ...(buffetCategoryCount > 0
          ? [
              {
                id: 'BUFFET',
                name: 'Gói Buffet & Vé',
                slug: 'buffet',
                image: null,
                productCount: buffetCategoryCount,
              },
            ]
          : []),
        ...categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: c.image,
          productCount: c._count.products,
        })),
      ],
      products: mappedProducts,
    };
  }

  async toggleProductAvailability(
    productId: string,
    available: boolean,
    branchId: string,
    user?: any,
  ) {
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { available },
    });

    this.posGateway.emitProductAvailabilityChanged(
      branchId,
      productId,
      available,
      user?.id,
    );

    return product;
  }

  // ==========================================
  // 3. TABLE MANAGEMENT & REALTIME STATE
  // ==========================================

  async getTables(branchId: string) {
    const [areas, tables, activeOrders] = await Promise.all([
      this.prisma.restaurantArea.findMany({
        where: { branchId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.restaurantTable.findMany({
        where: { branchId, isActive: true },
        include: {
          area: true,
          sessions: {
            where: { status: TableSessionStatus.ACTIVE },
            include: {
              order: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      phone: true,
                      email: true,
                      membershipTier: true,
                      points: true,
                      memberCode: true,
                    },
                  },
                  orderItems: {
                    include: {
                      product: true,
                      selectedOptions: { include: { optionItem: true } },
                    },
                  },
                  buffetSessions: {
                    where: { status: BuffetSessionStatus.ACTIVE },
                    include: {
                      buffetPackage: {
                        include: {
                          items: true,
                          tickets: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          reservations: {
            where: {
              reservation: {
                status: { in: ['CONFIRMED', 'CHECKED_IN'] },
                startAt: {
                  gte: new Date(Date.now() - 3 * 3600 * 1000),
                  lte: new Date(Date.now() + 3 * 3600 * 1000),
                },
              },
            },
            include: { reservation: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { tableCode: 'asc' }],
      }),
      this.prisma.order.findMany({
        where: {
          branchId,
          status: {
            in: [
              OrderStatus.DRAFT,
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.DELIVERING,
              OrderStatus.HELD,
            ],
          },
        },
        include: {
          table: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              membershipTier: true,
              points: true,
              memberCode: true,
            },
          },
          orderItems: {
            include: {
              product: true,
              selectedOptions: { include: { optionItem: true } },
            },
          },
          buffetSessions: {
            where: { status: BuffetSessionStatus.ACTIVE },
            include: {
              buffetPackage: {
                include: {
                  items: true,
                  tickets: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const mappedTables = tables.map((t) => {
      const activeSession = t.sessions?.[0] || null;
      const attachedOrder = activeSession?.order || activeOrders.find((o) => o.tableId === t.id) || null;
      const reservation = t.reservations?.[0]?.reservation || null;

      let visualStatus = 'VACANT'; // VACANT, OCCUPIED, BILL_PRINTED, RESERVED
      if (activeSession || attachedOrder) {
        visualStatus = attachedOrder?.status === OrderStatus.HELD ? 'BILL_PRINTED' : 'OCCUPIED';
      } else if (reservation) {
        visualStatus = 'RESERVED';
      }

      let elapsedMinutes = 0;
      if (activeSession) {
        elapsedMinutes = Math.floor(
          (Date.now() - new Date(activeSession.openedAt).getTime()) / 60000,
        );
      } else if (attachedOrder) {
        elapsedMinutes = Math.floor(
          (Date.now() - new Date(attachedOrder.createdAt).getTime()) / 60000,
        );
      }

      return {
        id: t.id,
        tableCode: t.tableCode,
        name: t.name,
        capacity: t.capacity,
        minCapacity: t.minCapacity,
        areaId: t.areaId,
        areaName: t.area?.name || 'Chung',
        sortOrder: t.sortOrder,
        x: t.x || 0,
        y: t.y || 0,
        width: t.width || 80,
        height: t.height || 80,
        shape: t.shape || 'RECTANGLE',
        visualStatus,
        elapsedMinutes,
        activeSession: activeSession
          ? {
              id: activeSession.id,
              openedAt: activeSession.openedAt,
              guestCount: activeSession.guestCount,
              cashierId: activeSession.cashierId,
            }
          : null,
        currentOrder: attachedOrder
          ? {
              id: attachedOrder.id,
              orderCode: attachedOrder.orderCode,
              temporaryOrderCode: (attachedOrder as any).temporaryOrderCode,
              guestCount: attachedOrder.guestCount || activeSession?.guestCount || t.capacity,
              subTotal: attachedOrder.subTotal,
              totalAmount: attachedOrder.totalAmount,
              status: attachedOrder.status,
              kitchenStatus: attachedOrder.kitchenStatus,
              itemCount: attachedOrder.orderItems.reduce((acc, it) => acc + it.quantity, 0),
              createdAt: attachedOrder.createdAt,
              isInvoiceRequested: (attachedOrder as any).isInvoiceRequested || false,
              invoiceTaxCode: (attachedOrder as any).invoiceTaxCode || null,
              invoiceCompanyName: (attachedOrder as any).invoiceCompanyName || null,
              invoiceAddress: (attachedOrder as any).invoiceAddress || null,
              invoiceEmail: (attachedOrder as any).invoiceEmail || null,
              buffetSessions: (attachedOrder as any).buffetSessions || [],
              buffetSession: (attachedOrder as any).buffetSessions?.[0] || null,
            }
          : null,
        reservation: reservation
          ? {
              id: reservation.id,
              reservationCode: reservation.reservationCode,
              customerName: reservation.customerName,
              customerPhone: reservation.customerPhone,
              partySize: reservation.partySize,
              startAt: reservation.startAt,
            }
          : null,
      };
    });

    return {
      areas,
      tables: mappedTables,
      activeOrders: activeOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        temporaryOrderCode: (o as any).temporaryOrderCode,
        tableId: o.tableId,
        table: o.table ? { id: o.table.id, name: o.table.name, tableCode: o.table.tableCode } : null,
        tableName: o.table?.name || (o as any).tableName || null,
        orderType: o.orderType,
        orderSource: (o as any).orderSource,
        status: o.status,
        kitchenStatus: o.kitchenStatus,
        paymentStatus: o.paymentStatus,
        guestCount: o.guestCount,
        subTotal: o.subTotal,
        discountAmount: o.discountAmount,
        serviceChargeTotal: (o as any).serviceChargeTotal || 0,
        taxAmount: (o as any).taxAmount || 0,
        totalAmount: o.totalAmount,
        deliveryAddress: (o as any).deliveryAddress || null,
        customerName: o.user?.fullName || (o as any).customerName || (o as any).shippingAddress?.fullName || null,
        customerPhone: o.user?.phone || (o as any).customerPhone || (o as any).shippingAddress?.phone || null,
        itemCount: o.orderItems?.reduce((sum, it) => sum + it.quantity, 0) || 0,
        buffetSessions: (o as any).buffetSessions || [],
        buffetSession: (o as any).buffetSessions?.[0] || null,
        items: o.orderItems?.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.product?.name || (it as any).productName,
          quantity: it.quantity,
          priceAtSale: it.priceAtSale,
          kitchenStatus: it.kitchenStatus,
          sentQuantity: (it as any).sentQuantity,
          printedQuantity: (it as any).printedQuantity,
        })) || [],
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    };
  }

  async getTableSessionDetail(tableId: string, branchId?: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: {
        area: true,
        sessions: {
          where: { status: TableSessionStatus.ACTIVE },
          orderBy: { openedAt: 'desc' },
          take: 1,
          include: {
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    phone: true,
                    email: true,
                    membershipTier: true,
                    points: true,
                    memberCode: true,
                  },
                },
                buffetSessions: {
                  where: { status: BuffetSessionStatus.ACTIVE },
                  include: {
                    buffetPackage: {
                      include: {
                        items: true,
                        tickets: true,
                      },
                    },
                  },
                },
                qrOrderSessions: {
                  where: { status: QrSessionStatus.ACTIVE },
                  take: 1,
                },
                orderItems: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        price: true,
                        imageUrl: true,
                        unit: true,
                        category: { select: { id: true, name: true, slug: true } },
                      },
                    },
                    selectedOptions: {
                      include: { optionItem: true },
                    },
                  },
                  orderBy: { id: 'asc' },
                },
                serviceCharges: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Bàn không tồn tại');
    }

    const activeSession = table.sessions?.[0] || null;
    let order = activeSession?.order || null;

    if (!order) {
      const attachedOrder = await this.prisma.order.findFirst({
        where: {
          tableId,
          ...(branchId ? { branchId } : {}),
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.HELD, OrderStatus.DRAFT] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              membershipTier: true,
              points: true,
              memberCode: true,
            },
          },
          buffetSessions: {
            where: { status: BuffetSessionStatus.ACTIVE },
            include: {
              buffetPackage: {
                include: {
                  items: true,
                  tickets: true,
                },
              },
            },
          },
          qrOrderSessions: {
            where: { status: QrSessionStatus.ACTIVE },
            take: 1,
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  imageUrl: true,
                  unit: true,
                  category: { select: { id: true, name: true, slug: true } },
                },
              },
              selectedOptions: {
                include: { optionItem: true },
              },
            },
            orderBy: { id: 'asc' },
          },
          serviceCharges: true,
        },
      });
      if (attachedOrder) {
        order = attachedOrder;
      }
    }

    return {
      table: {
        id: table.id,
        tableCode: table.tableCode,
        name: table.name,
        capacity: table.capacity,
        areaId: table.areaId,
        areaName: table.area?.name || 'Khu vực chung',
        status: table.status,
      },
      activeSession: activeSession
        ? {
            id: activeSession.id,
            openedAt: activeSession.openedAt,
            guestCount: activeSession.guestCount,
            cashierId: activeSession.cashierId,
          }
        : null,
      order: order
        ? {
            id: order.id,
            orderCode: order.orderCode,
            temporaryOrderCode: (order as any).temporaryOrderCode,
            orderType: order.orderType,
            status: order.status,
            kitchenStatus: order.kitchenStatus,
            guestCount: order.guestCount,
            subTotal: order.subTotal,
            discountAmount: order.discountAmount,
            taxAmount: order.taxAmount,
            serviceChargeTotal: order.serviceChargeTotal,
            totalAmount: order.totalAmount,
            note: order.note,
            createdAt: order.createdAt,
            user: order.user,
            buffetSession: (order as any).buffetSessions?.[0] || null,
            qrSession: (order as any).qrOrderSessions?.[0] || null,
            orderItems: (order.orderItems || []).map((it) => ({
              id: it.id,
              productId: it.productId,
              productName: it.product?.name || 'Món ăn',
              imageUrl: it.product?.imageUrl,
              unit: it.product?.unit || 'phần',
              quantity: it.quantity,
              priceAtSale: it.priceAtSale,
              note: it.note,
              optionsTextSnapshot: it.optionsTextSnapshot,
              kitchenStatus: it.kitchenStatus,
              sentQuantity: it.sentQuantity,
              pricingMode: (it as any).pricingMode,
              buffetSessionId: (it as any).buffetSessionId,
              buffetPackageId: (it as any).buffetPackageId,
              source: (it as any).source,
              orderedById: (it as any).orderedById,
              orderedByName: (it as any).orderedByName,
              selectedOptions: (it.selectedOptions || []).map((so) => ({
                id: so.id,
                optionItemId: so.optionItemId,
                nameAtSale: so.nameAtSale,
                priceAdjustmentAtSale: so.priceAdjustmentAtSale,
              })),
            })),
          }
        : null,
    };
  }

  async sendTableItemsToKitchen(tableId: string, dto: SendTableItemsDto, user?: any) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: {
        sessions: {
          where: { status: TableSessionStatus.ACTIVE },
          include: { order: true },
        },
      },
    });

    if (!table) throw new NotFoundException('Bàn không tồn tại');

    const activeSession = table.sessions?.[0] || null;
    let order = activeSession?.order || null;

    if (!order) {
      order = await this.prisma.order.findFirst({
        where: {
          tableId,
          branchId: dto.branchId,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.HELD, OrderStatus.DRAFT] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!order) {
      // 1. Create order for table
      const created = await this.createOrder(
        {
          branchId: dto.branchId,
          tableId,
          guestCount: dto.guestCount || 2,
          note: dto.note,
          items: dto.items,
        },
        user,
      );
      let printStatus: any = null;
      if (dto.items && dto.items.length > 0) {
        const sendKitchenRes = await this.sendToKitchen(created.id, {}, user);
        printStatus = (sendKitchenRes as any)?.printStatus;
      }
      const sessionDetail = await this.getTableSessionDetail(tableId, dto.branchId);
      return {
        ...sessionDetail,
        printStatus,
      };
    }

    // 2. Order already exists: Append new items
    if (dto.items && dto.items.length > 0) {
      const productIds = dto.items.map((it) => it.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          category: true,
          optionGroups: {
            include: { optionItems: true },
          },
          FlashSaleItem: {
            where: {
              flashSale: {
                isActive: true,
                startTime: { lte: new Date() },
                endTime: { gte: new Date() },
              },
            },
          },
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      let addedSubTotal = 0;
      const newItemsData: any[] = [];

      for (const item of dto.items) {
        const prod = productMap.get(item.productId);
        if (!prod) continue;

        const activeFlashSale = prod.FlashSaleItem?.[0];
        const baseUnitPrice = activeFlashSale
          ? activeFlashSale.flashSalePrice
          : prod.discountedPrice || prod.price;

        let optionsAdjustment = 0;
        const selectedOptionsData: any[] = [];
        const optionsTextParts: string[] = [];

        if (item.selectedOptionIds && item.selectedOptionIds.length > 0) {
          for (const og of prod.optionGroups) {
            for (const oi of og.optionItems) {
              if (item.selectedOptionIds.includes(oi.id)) {
                optionsAdjustment += oi.priceAdjustment;
                selectedOptionsData.push({
                  optionItemId: oi.id,
                  nameAtSale: oi.name,
                  priceAdjustmentAtSale: oi.priceAdjustment,
                });
                optionsTextParts.push(
                  oi.priceAdjustment > 0
                    ? `${oi.name} (+${oi.priceAdjustment.toLocaleString('vi-VN')}đ)`
                    : oi.name,
                );
              }
            }
          }
        }

        const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';
        const effectiveBasePrice = isBuffet ? 0 : baseUnitPrice;
        const itemDiscount = Math.max(0, Number(item.discountAmount || 0));
        const finalItemUnitPrice = Math.max(0, effectiveBasePrice + optionsAdjustment - itemDiscount);
        const itemTotalPrice = finalItemUnitPrice * item.quantity;
        addedSubTotal += itemTotalPrice;

        newItemsData.push({
          orderId: order.id,
          productId: prod.id,
          quantity: item.quantity,
          priceAtSale: finalItemUnitPrice,
          originalPriceAtSale: prod.price,
          discountAmount: itemDiscount,
          discountReason: item.discountReason || (isBuffet ? 'Trong gói Buffet' : null),
          note: item.note || null,
          optionsTextSnapshot: optionsTextParts.join(', ') || null,
          stationId: this.determineStationId(prod.category?.slug, prod.name),
          kitchenStatus: KitchenStatus.PENDING,
          pricingMode: (item.pricingMode as OrderItemPricingMode) || OrderItemPricingMode.REGULAR,
          buffetSessionId: item.buffetSessionId || null,
          buffetPackageId: item.buffetPackageId || null,
          buffetPackageNameSnapshot: item.buffetPackageNameSnapshot || null,
          buffetReferencePriceSnapshot: isBuffet ? prod.price : null,
          source: (item.source as OrderItemSource) || OrderItemSource.WAITER,
          orderedById: user?.id || null,
          orderedByName: user?.fullName || 'Phục vụ bàn',
          selectedOptions: {
            create: selectedOptionsData,
          },
        });
      }

      // Insert new items into database
      const createdItemIds: string[] = [];
      await this.prisma.$transaction(async (tx) => {
        for (const it of newItemsData) {
          const created = await tx.orderItem.create({
            data: it,
            select: { id: true },
          });
          createdItemIds.push(created.id);
        }
      });

      // Calculate exact pricing & VAT matching POS (Rule #13)
      const allOrderItems = await this.prisma.orderItem.findMany({
        where: { orderId: order.id },
        include: { product: true },
      });

      const existingCharges = await this.prisma.orderServiceCharge.findMany({
        where: { orderId: order.id },
      });

      const pricing = await this.orderPricingService.calculatePricing({
        items: allOrderItems.map((oi) => ({
          productId: oi.productId,
          name: oi.product?.name || 'Món',
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: oi.taxPercentageAtSale || oi.product?.taxPercentage || 0,
        })),
        orderDiscountAmount: order.discountAmount || 0,
        serviceCharges: existingCharges.map((c) => ({
          name: c.name,
          amount: c.amount,
          isTaxable: c.isTaxable,
          taxPercentage: c.taxPercentage,
        })),
      });

      if (pricing.itemTaxDetails && pricing.itemTaxDetails.length > 0) {
        for (let idx = 0; idx < allOrderItems.length; idx++) {
          const oi = allOrderItems[idx];
          const detail = pricing.itemTaxDetails[idx];
          if (detail && oi) {
            await this.prisma.orderItem.update({
              where: { id: oi.id },
              data: {
                taxPercentageAtSale: detail.taxPercentage,
                taxableAmountAtSale: detail.netTaxableAmount,
                taxAmountAtSale: detail.taxAmount,
              },
            });
          }
        }
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          subTotal: pricing.subTotal,
          serviceChargeTotal: pricing.serviceChargeTotal,
          taxAmount: pricing.taxAmount,
          vatPriceModeSnapshot: pricing.vatPriceMode,
          totalAmount: pricing.totalAmount,
          status: order.status === OrderStatus.DRAFT ? OrderStatus.PENDING : order.status,
          version: { increment: 1 },
        },
        include: {
          table: true,
          tableSession: true,
          user: true,
          orderItems: { include: { product: true, selectedOptions: true } },
          serviceCharges: true,
        },
      });

      // Dispatch newly added items to kitchen
      const sendKitchenRes = await this.sendToKitchen(order.id, { itemIds: createdItemIds }, user);
      const printStatus = (sendKitchenRes as any)?.printStatus;

      // Realtime event emission to both POS and Waiter
      const tableInfo = await this.prisma.restaurantTable.findUnique({
        where: { id: tableId },
        select: { name: true, tableCode: true },
      });
      const tableName = tableInfo?.name || tableInfo?.tableCode || '';
      this.posGateway.emitOrderUpdated(updatedOrder, user?.id, tableName);
      this.posGateway.emitTableStatusChanged(
        dto.branchId,
        tableId,
        'OCCUPIED',
        (updatedOrder as any).tableSession,
        updatedOrder,
        user?.id,
        tableName,
      );

      const sessionDetail = await this.getTableSessionDetail(tableId, dto.branchId);
      return {
        ...sessionDetail,
        printStatus,
      };
    }

    return this.getTableSessionDetail(tableId, dto.branchId);
  }

  async getQrOrders(branchId: string) {
    const qrOrders = await this.prisma.order.findMany({
      where: {
        branchId,
        orderSource: OrderSource.QR_ORDER,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
      },
      include: {
        table: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      qrOrders: qrOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode || (o as any).temporaryOrderCode,
        tableId: o.tableId,
        table: o.table ? { id: o.table.id, name: o.table.name, tableCode: o.table.tableCode } : null,
        status: o.status,
        kitchenStatus: o.kitchenStatus,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        items: o.orderItems.map((it) => ({
          id: it.id,
          product: { id: it.product.id, name: it.product.name },
          quantity: it.quantity,
          price: it.priceAtSale,
          note: it.note,
          optionsTextSnapshot: it.optionsTextSnapshot,
        })),
      })),
    };
  }

  async confirmQrOrder(orderId: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('Đơn QR không tồn tại');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PREPARING,
        kitchenStatus: KitchenStatus.SENT,
        version: { increment: 1 },
      },
      include: { table: true, orderItems: { include: { product: true } } },
    });

    await this.sendToKitchen(orderId, {}, user);
    this.posGateway.emitOrderUpdated(updated, user?.id);
    return updated;
  }

  async rejectQrOrder(orderId: string, reason?: string, user?: any) {
    return this.cancelOrder(orderId, reason || 'Phục vụ từ chối yêu cầu QR', user?.id);
  }

  async updateTableLayout(branchId: string, dto: UpdateTableLayoutDto) {
    const updates = dto.tables.map((t) =>
      this.prisma.restaurantTable.update({
        where: { id: t.id },
        data: {
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
          shape: t.shape,
        },
      }),
    );
    await this.prisma.$transaction(updates);
    return { success: true };
  }

  // ==========================================
  // 4. ORDER CREATION & ATOMIC SECURE ENGINE
  // ==========================================

  async createOrder(dto: CreatePosOrderDto, user?: any) {
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent hit for key: ${dto.idempotencyKey}`);
        return JSON.parse(existing.response);
      }
    }

    let actorName = user?.fullName;
    if (!actorName && user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      });
      actorName = dbUser?.fullName;
    }
    if (!actorName) actorName = 'HTP Official';

    // 2. Fetch products & options from DB for tamper-proof server-side pricing
    const productIds = dto.items.map((it) => it.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: true,
        optionGroups: { include: { optionItems: true } },
        FlashSaleItem: {
          where: {
            flashSale: {
              isActive: true,
              startTime: { lte: new Date() },
              endTime: { gte: new Date() },
            },
          },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Compute items and options
    let computedSubTotal = 0;
    const validatedItemsData: any[] = [];

    for (const item of dto.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new NotFoundException(`Sản phẩm không tồn tại: ${item.productId}`);
      }

      const activeFlashSale = prod.FlashSaleItem?.[0];
      const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';
      const baseUnitPrice = isBuffet
        ? 0
        : (activeFlashSale
          ? activeFlashSale.flashSalePrice
          : prod.discountedPrice || prod.price);

      let optionsAdjustment = 0;
      const selectedOptionsData: any[] = [];
      const optionsTextParts: string[] = [];

      if (item.selectedOptionIds && item.selectedOptionIds.length > 0) {
        for (const og of prod.optionGroups) {
          for (const oi of og.optionItems) {
            if (item.selectedOptionIds.includes(oi.id)) {
              optionsAdjustment += oi.priceAdjustment;
              selectedOptionsData.push({
                optionItemId: oi.id,
                nameAtSale: oi.name,
                priceAdjustmentAtSale: oi.priceAdjustment,
              });
              optionsTextParts.push(
                oi.priceAdjustment > 0
                  ? `${oi.name} (+${oi.priceAdjustment.toLocaleString('vi-VN')}đ)`
                  : oi.name,
              );
            }
          }
        }
      }

      const itemDiscount = Math.max(0, Number(item.discountAmount || 0));
      if (itemDiscount > 0 && !item.discountReason?.trim()) {
        throw new BadRequestException(`Vui lòng nhập lý do giảm giá cho món: ${prod.name}`);
      }
      const finalItemUnitPrice = Math.max(0, baseUnitPrice + optionsAdjustment - itemDiscount);
      const itemTotalPrice = finalItemUnitPrice * item.quantity;
      computedSubTotal += itemTotalPrice;

      validatedItemsData.push({
        productId: prod.id,
        quantity: item.quantity,
        priceAtSale: finalItemUnitPrice,
        originalPriceAtSale: prod.price,
        discountAmount: itemDiscount,
        discountReason: item.discountReason || (isBuffet ? 'Trong gói Buffet' : null),
        note: item.note || null,
        optionsTextSnapshot: optionsTextParts.join(', ') || null,
        stationId: this.determineStationId(prod.category?.slug, prod.name),
        kitchenStatus: KitchenStatus.PENDING,
        pricingMode: (item.pricingMode as OrderItemPricingMode) || OrderItemPricingMode.REGULAR,
        buffetSessionId: item.buffetSessionId || null,
        buffetPackageId: item.buffetPackageId || null,
        buffetPackageNameSnapshot: item.buffetPackageNameSnapshot || null,
        buffetReferencePriceSnapshot: isBuffet ? prod.price : null,
        source: (item.source as OrderItemSource) || OrderItemSource.POS,
        orderedById: user?.id || null,
        orderedByName: actorName,
        selectedOptions: {
          create: selectedOptionsData,
        },
      });
    }

    const orderDiscount = Math.max(0, Number(dto.discountAmount || 0));
    if (orderDiscount > 0 && !dto.discountReason?.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do giảm giá cho đơn hàng');
    }

    const pricing = await this.orderPricingService.calculatePricing({
      items: validatedItemsData.map((item) => ({
        productId: item.productId,
        name: productMap.get(item.productId)?.name || 'Món',
        priceAtSale: item.priceAtSale,
        quantity: item.quantity,
        taxPercentage: productMap.get(item.productId)?.taxPercentage || 0,
      })),
      orderDiscountAmount: orderDiscount,
    });

    // Gắn financial tax snapshot tại thời điểm bán (Rule #13)
    validatedItemsData.forEach((it: any, idx: number) => {
      const detail = pricing.itemTaxDetails[idx];
      it.taxPercentageAtSale = detail?.taxPercentage ?? (productMap.get(it.productId)?.taxPercentage || 0);
      it.taxableAmountAtSale = detail?.netTaxableAmount ?? Math.round(it.priceAtSale * it.quantity);
      it.taxAmountAtSale = detail?.taxAmount ?? 0;
      it.vatPriceModeSnapshot = detail?.vatPriceMode ?? pricing.vatPriceMode;
      it.isVatInclusive = detail?.isVatInclusive ?? (pricing.vatPriceMode === 'VAT_INCLUDED');
    });

    // 4. Atomic Transaction: create TableSession (if table), Order, OrderItems
    const newOrder = await this.prisma.$transaction(async (tx) => {
      let tableSessionId: string | null = null;

      if (dto.tableId) {
        let activeSession = await tx.tableSession.findFirst({
          where: {
            tableId: dto.tableId,
            branchId: dto.branchId,
            status: TableSessionStatus.ACTIVE,
          },
        });

        if (!activeSession) {
          activeSession = await tx.tableSession.create({
            data: {
              branchId: dto.branchId,
              tableId: dto.tableId,
              guestCount: dto.guestCount || 1,
              cashierId: user?.id || null,
              status: TableSessionStatus.ACTIVE,
            },
          });
        } else if (dto.guestCount) {
          activeSession = await tx.tableSession.update({
            where: { id: activeSession.id },
            data: { guestCount: dto.guestCount },
          });
        }

        tableSessionId = activeSession.id;
      }

      const temporaryOrderCode = await this.generateTemporaryOrderCode(tx);

      const created = await tx.order.create({
        data: {
          orderCode: null,
          temporaryOrderCode,
          orderSource: OrderSource.POS,
          branchId: dto.branchId,
          tableId: dto.tableId || null,
          tableSessionId,
          guestCount: dto.guestCount || 1,
          customerName: dto.customerName || 'Khách vãng lai',
          customerPhone: dto.customerPhone || '',
          deliveryAddress: dto.deliveryAddress || (dto.tableId ? 'Tại bàn - Dine in' : (dto.orderType === SlotOrderType.DELIVERY ? 'Giao hàng tận nơi' : 'Mang về - Take away')),
          discountAmount: dto.discountAmount || 0,
          discountReason: dto.discountReason || null,
          discountPercent: dto.discountPercent || null,
          discountType: dto.discountType || null,
          note: dto.note || null,
          orderType: dto.orderType || (dto.tableId ? SlotOrderType.DINE_IN : SlotOrderType.TAKEAWAY),
          status: validatedItemsData.length > 0 ? OrderStatus.PENDING : OrderStatus.DRAFT,
          kitchenStatus: KitchenStatus.PENDING,
          cashierId: user?.id || null,
          cashierName: actorName,
          userId: dto.userId || null,
          version: 1,
          subTotal: computedSubTotal,
          serviceChargeTotal: 0,
          taxAmount: 0,
          totalAmount: computedSubTotal,
          orderItems: {
            create: validatedItemsData,
          },
        },
        include: {
          table: true,
          tableSession: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              membershipTier: true,
              points: true,
              memberCode: true,
            },
          },
          orderItems: {
            include: {
              product: true,
              selectedOptions: { include: { optionItem: true } },
            },
          },
          serviceCharges: true,
          buffetSessions: {
            where: { status: BuffetSessionStatus.ACTIVE },
            include: {
              buffetPackage: {
                include: {
                  items: true,
                  tickets: true,
                },
              },
            },
          },
        },
      });

      // Save Idempotency Record if key provided
      if (dto.idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: dto.idempotencyKey,
            action: 'CREATE_POS_ORDER',
            response: JSON.stringify(created),
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        });
      }

      // Tự động kích hoạt Buffet Session nếu đơn tạo mới có chứa vé Buffet
      const hasBuffetTicket = validatedItemsData.some(
        (it) => it.pricingMode === OrderItemPricingMode.BUFFET_TICKET,
      );
      if (hasBuffetTicket) {
        const ticketItem = validatedItemsData.find(
          (it) => it.pricingMode === OrderItemPricingMode.BUFFET_TICKET,
        );
        if (ticketItem) {
          const pkg = await tx.buffetPackage.findFirst({
            where: {
              tickets: { some: { productId: ticketItem.productId } },
              branchId: dto.branchId,
              active: true,
            },
          });
          if (pkg) {
            const activeSession = await tx.buffetSession.create({
              data: {
                orderId: created.id,
                buffetPackageId: pkg.id,
                packageNameSnapshot: pkg.name,
                status: BuffetSessionStatus.ACTIVE,
                activatedById: user?.id || null,
              },
              include: {
                buffetPackage: {
                  include: {
                    items: true,
                    tickets: true,
                  },
                },
              },
            });
            (created as any).buffetSessions = [activeSession];
            (created as any).buffetSession = activeSession;
            this.posGateway.emitEvent({
              eventType: 'BUFFET_SESSION_STATUS_CHANGED',
              entityType: 'ORDER',
              entityId: created.id,
              branchId: dto.branchId,
              payload: { orderId: created.id, status: 'ACTIVE', package: pkg },
            });
          }
        }
      }

      (created as any).buffetSession = (created as any).buffetSessions?.[0] || null;
      return created;
    });

    // 5. Build Financial Breakdown
    const financialBreakdown = {
      subTotal: newOrder.subTotal,
      itemDiscountTotal: validatedItemsData.reduce(
        (acc, it) => acc + (it.discountAmount || 0) * it.quantity,
        0,
      ),
      orderDiscountAmount: newOrder.discountAmount || 0,
      serviceChargeTotal: newOrder.serviceChargeTotal,
      shippingFee: 0,
      shippingDiscount: 0,
      taxAmount: newOrder.taxAmount,
      totalAmount: newOrder.totalAmount,
      discountBreakdown: [
        ...(newOrder.discountAmount && newOrder.discountAmount > 0
          ? [
              {
                label: 'Giảm giá đơn hàng',
                amount: newOrder.discountAmount,
                reason: newOrder.discountReason || 'Chiết khấu đơn',
              },
            ]
          : []),
      ],
    };
    const orderWithBreakdown = { ...newOrder, financialBreakdown };

    // 6. Emit Realtime Events AFTER transaction commit
    this.posGateway.emitOrderCreated(orderWithBreakdown, user?.id);
    let tableName = '';
    if (newOrder.tableId) {
      const tableInfo = await this.prisma.restaurantTable.findUnique({
        where: { id: newOrder.tableId },
        select: { name: true, tableCode: true },
      });
      tableName = tableInfo?.name || tableInfo?.tableCode || '';
      this.posGateway.emitTableStatusChanged(
        newOrder.branchId,
        newOrder.tableId,
        'OCCUPIED',
        (newOrder as any).tableSession,
        newOrder,
        user?.id,
        tableName,
      );
    }

    const displayCode = newOrder.orderCode || newOrder.temporaryOrderCode || '';
    const tableDisplay = tableName ? `Bàn ${tableName}` : 'mang về';
    const orderCreatorName = user?.fullName || actorName || 'Nhân viên';

    this.notificationEngine.publishEvent({
      eventType: 'POS_ORDER_CREATED',
      category: 'ORDER',
      priority: 1, // NORMAL
      branchId: newOrder.branchId,
      entityId: newOrder.id,
      title: 'Đơn hàng mới',
      message: `Đơn tại ${tableDisplay} #${displayCode} trị giá ${(newOrder.totalAmount || 0).toLocaleString('vi-VN')}₫ vừa được tạo bởi ${orderCreatorName}.`,
      actor: {
        id: user?.id,
        name: orderCreatorName,
        avatarUrl: user?.avatarUrl,
      },
      reference: {
        type: 'ORDER',
        id: newOrder.id,
        url: `/admin/pos?orderId=${newOrder.id}`,
      },
      metadata: {
        orderId: newOrder.id,
        orderCode: displayCode,
        tableId: newOrder.tableId,
        tableName,
        totalAmount: newOrder.totalAmount,
      },
      requiredPermissions: ['pos.order.view', 'waiter.access'],
      appScopes: ['POS', 'WAITER'],
      excludeActor: true,
      legacyType: 'ORDER',
    }).catch((err) => this.logger.error('Error publishing POS_ORDER_CREATED:', err));

    return orderWithBreakdown;
  }

  // ==========================================
  // 5. UPDATE ORDER & OPTIMISTIC CONCURRENCY
  // ==========================================

  async updateOrder(orderId: string, dto: UpdatePosOrderDto, user?: any) {
    const currentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: { selectedOptions: true },
        },
      },
    });

    if (!currentOrder) {
      throw new NotFoundException('Đơn hàng không tồn tại');
    }

    let actorName = user?.fullName;
    if (!actorName && user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      });
      actorName = dbUser?.fullName;
    }
    if (!actorName) actorName = 'HTP Official';

    // Check Optimistic Concurrency Version Lock
    if (dto.expectedVersion !== undefined && currentOrder.version !== dto.expectedVersion) {
      throw new ConflictException({
        errorCode: 'ORDER_VERSION_CONFLICT',
        currentVersion: currentOrder.version,
        message:
          'Đơn hàng đã được cập nhật bởi một nhân viên hoặc thiết bị khác. Dữ liệu đã được làm mới tự động!',
      });
    }

    // Không cho phép đổi hoặc gỡ tài khoản nếu đơn hàng đã đổi điểm thưởng
    if (dto.userId !== undefined && dto.userId !== currentOrder.userId) {
      const hasRedeemedPoints =
        (currentOrder.pointsUsed && currentOrder.pointsUsed > 0) ||
        (await this.prisma.pointTransaction.count({
          where: { orderId: currentOrder.id, source: PointTransactionSource.REWARD },
        })) > 0;

      if (hasRedeemedPoints) {
        throw new BadRequestException(
          'Đơn hàng này đã thực hiện đổi điểm thưởng. Không thể thay đổi hoặc gỡ tài khoản hội viên!',
        );
      }
    }

    let computedSubTotal = currentOrder.subTotal;
    let validatedItemsData: any[] | null = null;

    if (dto.items) {
      const productIds = dto.items.map((it) => it.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          category: true,
          optionGroups: { include: { optionItems: true } },
          FlashSaleItem: {
            where: {
              flashSale: {
                isActive: true,
                startTime: { lte: new Date() },
                endTime: { gte: new Date() },
              },
            },
          },
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      computedSubTotal = 0;
      validatedItemsData = [];

      for (const item of dto.items) {
        const prod = productMap.get(item.productId);
        if (!prod) continue;

        const activeFlashSale = prod.FlashSaleItem?.[0];
        const baseUnitPrice = activeFlashSale
          ? activeFlashSale.flashSalePrice
          : prod.discountedPrice || prod.price;

        let optionsAdjustment = 0;
        const selectedOptionsData: any[] = [];
        const optionsTextParts: string[] = [];

        if (item.selectedOptionIds && item.selectedOptionIds.length > 0) {
          for (const og of prod.optionGroups) {
            for (const oi of og.optionItems) {
              if (item.selectedOptionIds.includes(oi.id)) {
                optionsAdjustment += oi.priceAdjustment;
                selectedOptionsData.push({
                  optionItemId: oi.id,
                  nameAtSale: oi.name,
                  priceAdjustmentAtSale: oi.priceAdjustment,
                });
                optionsTextParts.push(
                  oi.priceAdjustment > 0
                    ? `${oi.name} (+${oi.priceAdjustment.toLocaleString('vi-VN')}đ)`
                    : oi.name,
                );
              }
            }
          }
        }

        const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';
        const effectiveBasePrice = isBuffet ? 0 : baseUnitPrice;
        const priceAtSale = effectiveBasePrice + optionsAdjustment;
        const lineNet = Math.max(0, (priceAtSale - (item.discountAmount || 0)) * item.quantity);
        computedSubTotal += lineNet;

        validatedItemsData.push({
          _clientItemId: item.id || null,
          _selectedOptionIds: item.selectedOptionIds || [],
          productId: prod.id,
          quantity: item.quantity,
          priceAtSale,
          originalPriceAtSale: prod.price,
          discountAmount: item.discountAmount || 0,
          discountReason: item.discountReason || (isBuffet ? 'Trong gói Buffet' : null),
          note: item.note || null,
          optionsTextSnapshot: optionsTextParts.join(', ') || null,
          stationId: this.determineStationId(prod.category?.slug, prod.name),
          kitchenStatus: KitchenStatus.PENDING,
          pricingMode: (item.pricingMode as OrderItemPricingMode) || OrderItemPricingMode.REGULAR,
          buffetSessionId: item.buffetSessionId || null,
          buffetPackageId: item.buffetPackageId || null,
          buffetPackageNameSnapshot: item.buffetPackageNameSnapshot || null,
          buffetReferencePriceSnapshot: isBuffet ? prod.price : null,
          source: (item.source as OrderItemSource) || OrderItemSource.POS,
          orderedById: user?.id || null,
          orderedByName: actorName,
          selectedOptions: {
            create: selectedOptionsData,
          },
        });
      }
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // If items replaced, preserve print and dispatch quantities with accurate id/key matching
      if (validatedItemsData !== null) {
        // Bảo vệ món đổi điểm (Rule: Tránh lạm dụng món đổi điểm - Không được xóa, không được tăng/giảm SL, giá 0đ, chỉ cho phép sửa ghi chú)
        const isRedeemedItem = (oi: any) =>
          oi.priceAtSale === 0 &&
          (oi.discountReason?.includes('đổi điểm') ||
            oi.discountReason?.includes('Đổi điểm') ||
            oi.note?.includes('ĐỔI ĐIỂM') ||
            oi.orderedByName?.includes('Đổi điểm') ||
            Boolean(oi.orderedById && oi.priceAtSale === 0));

        const existingRedeemedItems = (currentOrder.orderItems || []).filter(isRedeemedItem);
        const processedRedeemedIds = new Set<string>();

        const exMapById = new Map(currentOrder.orderItems.map((oi) => [oi.id, oi]));
        const exKey = (ex: any) =>
          `${ex.productId}::${(ex.selectedOptions || [])
            .map((so: any) => so.optionItemId)
            .sort()
            .join('|')}::${(ex.note || '').trim().toLowerCase()}::${ex.pricingMode || 'REGULAR'}::${ex.buffetSessionId || ''}`;
        const exMapByKey = new Map(currentOrder.orderItems.map((oi) => [exKey(oi), oi]));

        for (const it of validatedItemsData) {
          const itemKeyStr = `${it.productId}::${(it._selectedOptionIds || [])
            .slice()
            .sort()
            .join('|')}::${(it.note || '').trim().toLowerCase()}::${it.pricingMode || 'REGULAR'}::${it.buffetSessionId || ''}`;
          const ex =
            (it._clientItemId && exMapById.get(it._clientItemId)) ||
            exMapByKey.get(itemKeyStr);
          if (ex) {
            it.sentQuantity = ex.sentQuantity || 0;
            it.printedQuantity = ex.printedQuantity || 0;
            it.printVersion = ex.printVersion || 0;
            it.stationId = ex.stationId || it.stationId;
            it.orderedById = ex.orderedById || user?.id || null;
            it.orderedByName = ex.orderedByName || actorName;
            it.kitchenStatus =
              it.sentQuantity > 0 && it.quantity > it.sentQuantity
                ? KitchenStatus.PENDING
                : ex.kitchenStatus;

            // Nếu đây là món đổi điểm:
            if (isRedeemedItem(ex)) {
              processedRedeemedIds.add(ex.id);
              // Khóa số lượng, giá 0đ, chiết khấu 0 (chống lạm dụng món đổi điểm)
              it.quantity = ex.quantity;
              it.priceAtSale = 0;
              it.originalPriceAtSale = 0;
              it.discountAmount = 0;
              it.discountReason = ex.discountReason;
              it.orderedById = ex.orderedById;
              it.orderedByName = ex.orderedByName;
              // Cho phép cập nhật ghi chú phục vụ
              if (it.note && !it.note.includes('[ĐỔI ĐIỂM')) {
                it.note = ex.note ? `${it.note} (${ex.note})` : it.note;
              } else if (!it.note) {
                it.note = ex.note;
              }
            }
          } else {
            it.orderedById = user?.id || null;
            it.orderedByName = actorName;
          }
          delete it._clientItemId;
          delete it._selectedOptionIds;
        }

        // Tự động bảo toàn các món đổi điểm đã có trong đơn nếu client gửi thiếu (chống xóa lén)
        for (const exRed of existingRedeemedItems) {
          if (!processedRedeemedIds.has(exRed.id)) {
            validatedItemsData.push({
              productId: exRed.productId,
              quantity: exRed.quantity,
              priceAtSale: 0,
              originalPriceAtSale: 0,
              discountAmount: 0,
              discountReason: exRed.discountReason,
              note: exRed.note,
              optionsTextSnapshot: exRed.optionsTextSnapshot,
              stationId: exRed.stationId,
              kitchenStatus: exRed.kitchenStatus,
              pricingMode: exRed.pricingMode,
              buffetSessionId: exRed.buffetSessionId,
              buffetPackageId: exRed.buffetPackageId,
              buffetPackageNameSnapshot: exRed.buffetPackageNameSnapshot,
              buffetReferencePriceSnapshot: null,
              source: exRed.source,
              orderedById: exRed.orderedById,
              orderedByName: exRed.orderedByName,
              sentQuantity: exRed.sentQuantity || 0,
              printedQuantity: exRed.printedQuantity || 0,
              printVersion: exRed.printVersion || 0,
              selectedOptions: {
                create: (exRed.selectedOptions || []).map((so: any) => ({
                  optionItemId: so.optionItemId,
                  nameAtSale: so.nameAtSale,
                  priceAdjustmentAtSale: so.priceAdjustmentAtSale,
                })),
              },
            });
          }
        }

        // Tự động kiểm tra kích hoạt hoặc đóng Buffet Session (Rule V & XLIV)
        const hasBuffetTicket = validatedItemsData.some(
          (it) => it.pricingMode === OrderItemPricingMode.BUFFET_TICKET,
        );
        const currentActiveBuffetSession = await tx.buffetSession.findFirst({
          where: { orderId, status: BuffetSessionStatus.ACTIVE },
        });

        if (hasBuffetTicket && !currentActiveBuffetSession) {
          const ticketItem = validatedItemsData.find(
            (it) => it.pricingMode === OrderItemPricingMode.BUFFET_TICKET,
          );
          if (ticketItem) {
            const pkg = await tx.buffetPackage.findFirst({
              where: {
                tickets: { some: { productId: ticketItem.productId } },
                branchId: currentOrder.branchId,
                active: true,
              },
            });
            if (pkg) {
              await tx.buffetSession.create({
                data: {
                  orderId,
                  buffetPackageId: pkg.id,
                  packageNameSnapshot: pkg.name,
                  status: BuffetSessionStatus.ACTIVE,
                  activatedById: user?.id || null,
                },
              });
              this.posGateway.emitEvent({
                eventType: 'BUFFET_SESSION_STATUS_CHANGED',
                entityType: 'ORDER',
                entityId: orderId,
                branchId: currentOrder.branchId,
                payload: { orderId, status: 'ACTIVE', package: pkg },
              });
            }
          }
        } else if (!hasBuffetTicket && currentActiveBuffetSession) {
          // Khi ticket bị xóa về 0: Deactivate session (Rule XLIV)
          await tx.buffetSession.update({
            where: { id: currentActiveBuffetSession.id },
            data: {
              status: BuffetSessionStatus.INACTIVE,
              deactivatedAt: new Date(),
            },
          });
          if (user?.id) {
            await tx.auditLog.create({
              data: {
                userId: user.id,
                action: 'DEACTIVATE_BUFFET_SESSION_TICKETS_REMOVED',
                target: `BuffetSession:${currentActiveBuffetSession.id}`,
                oldValue: JSON.stringify({ packageName: currentActiveBuffetSession.packageNameSnapshot }),
              },
            });
          }
          this.posGateway.emitEvent({
            eventType: 'BUFFET_SESSION_STATUS_CHANGED',
            entityType: 'ORDER',
            entityId: orderId,
            branchId: currentOrder.branchId,
            payload: { orderId, status: 'INACTIVE' },
          });
        }

        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.update({
          where: { id: orderId },
          data: {
            orderItems: {
              create: validatedItemsData,
            },
          },
        });
      }

      let orderDiscount = dto.discountAmount !== undefined ? Math.max(0, Number(dto.discountAmount)) : (currentOrder.discountAmount || 0);
      const effectiveDiscountType = dto.discountType !== undefined ? dto.discountType : (currentOrder as any).discountType;
      const effectiveDiscountPercent = dto.discountPercent !== undefined ? dto.discountPercent : (currentOrder as any).discountPercent;

      // If percentage discount and items changed without explicit new fixed discountAmount, scale percentage!
      if (effectiveDiscountType === 'PERCENT' && effectiveDiscountPercent && (dto.discountAmount === undefined || dto.discountAmount === null)) {
        orderDiscount = Math.round((computedSubTotal * effectiveDiscountPercent) / 100);
      }

      if (dto.discountAmount !== undefined && orderDiscount > 0 && !dto.discountReason?.trim() && !currentOrder.discountReason?.trim()) {
        throw new BadRequestException('Vui lòng nhập lý do giảm giá cho đơn hàng');
      }

      // Fetch all existing service charges for this order to calculate correct totalAmount
      const existingCharges = await tx.orderServiceCharge.findMany({ where: { orderId } });
      const currentItems = await tx.orderItem.findMany({
        where: { orderId },
        include: { product: true },
      });

      const pricing = await this.orderPricingService.calculatePricing({
        items: currentItems.map((oi) => ({
          productId: oi.productId,
          name: oi.product?.name || 'Món',
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: oi.taxPercentageAtSale || oi.product?.taxPercentage || 0,
        })),
        orderDiscountAmount: orderDiscount,
        serviceCharges: existingCharges.map((c) => ({
          name: c.name,
          amount: c.amount,
          isTaxable: c.isTaxable,
          taxPercentage: c.taxPercentage,
        })),
      });

      if (pricing.itemTaxDetails && pricing.itemTaxDetails.length > 0) {
        for (let idx = 0; idx < currentItems.length; idx++) {
          const oi = currentItems[idx];
          const detail = pricing.itemTaxDetails[idx];
          if (detail && oi) {
            await tx.orderItem.update({
              where: { id: oi.id },
              data: {
                taxPercentageAtSale: detail.taxPercentage,
                taxableAmountAtSale: detail.netTaxableAmount,
                taxAmountAtSale: detail.taxAmount,
                vatPriceModeSnapshot: detail.vatPriceMode ?? pricing.vatPriceMode,
                isVatInclusive: detail.isVatInclusive ?? (pricing.vatPriceMode === 'VAT_INCLUDED'),
              },
            });
          }
        }
      }

      const res = await tx.order.update({
        where: { id: orderId },
        data: {
          subTotal: pricing.subTotal,
          serviceChargeTotal: pricing.serviceChargeTotal,
          taxAmount: pricing.taxAmount,
          vatPriceModeSnapshot: pricing.vatPriceMode,
          totalAmount: pricing.totalAmount,
          discountAmount: orderDiscount,
          discountReason: dto.discountReason !== undefined ? dto.discountReason : currentOrder.discountReason,
          discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : (currentOrder as any).discountPercent,
          discountType: dto.discountType !== undefined ? dto.discountType : (currentOrder as any).discountType,
          cashierName: actorName || currentOrder.cashierName || 'HTP Official',
          deliveryAddress: dto.deliveryAddress !== undefined ? dto.deliveryAddress : currentOrder.deliveryAddress,
          orderType: dto.orderType !== undefined ? dto.orderType : currentOrder.orderType,
          guestCount: dto.guestCount !== undefined ? dto.guestCount : currentOrder.guestCount,
          customerName: dto.customerName !== undefined ? dto.customerName : currentOrder.customerName,
          customerPhone: dto.customerPhone !== undefined ? dto.customerPhone : currentOrder.customerPhone,
          userId: dto.userId !== undefined ? dto.userId : currentOrder.userId,
          note: dto.note !== undefined ? dto.note : currentOrder.note,
          isInvoiceRequested: dto.isInvoiceRequested !== undefined ? Boolean(dto.isInvoiceRequested) : currentOrder.isInvoiceRequested,
          invoiceTaxCode: dto.invoiceTaxCode !== undefined ? dto.invoiceTaxCode : currentOrder.invoiceTaxCode,
          invoiceCompanyName: dto.invoiceCompanyName !== undefined ? dto.invoiceCompanyName : currentOrder.invoiceCompanyName,
          invoiceAddress: dto.invoiceAddress !== undefined ? dto.invoiceAddress : currentOrder.invoiceAddress,
          invoiceEmail: dto.invoiceEmail !== undefined ? dto.invoiceEmail : currentOrder.invoiceEmail,
          version: currentOrder.version + 1,
        },
        include: {
          table: true,
          tableSession: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              membershipTier: true,
              points: true,
              memberCode: true,
            },
          },
          orderItems: {
            include: {
              product: true,
              selectedOptions: { include: { optionItem: true } },
            },
          },
          serviceCharges: true,
          buffetSessions: {
            where: { status: BuffetSessionStatus.ACTIVE },
            include: {
              buffetPackage: {
                include: {
                  items: true,
                  tickets: true,
                },
              },
            },
          },
        },
      });

      return res;
    });

    if (currentOrder.tableSessionId && dto.guestCount !== undefined) {
      await this.prisma.tableSession.update({
        where: { id: currentOrder.tableSessionId },
        data: { guestCount: dto.guestCount },
      });
    }

    const itemDiscountTotal = (updatedOrder.orderItems || []).reduce(
      (acc: number, it: any) => acc + (it.discountAmount || 0) * it.quantity,
      0,
    );
    const financialBreakdown = {
      subTotal: updatedOrder.subTotal,
      itemDiscountTotal,
      orderDiscountAmount: updatedOrder.discountAmount || 0,
      shippingFee: updatedOrder.shippingFee || 0,
      shippingDiscount: updatedOrder.shippingDiscount || 0,
      taxAmount: Math.round(updatedOrder.totalAmount * 0.08),
      totalAmount: updatedOrder.totalAmount,
      discountBreakdown: [
        ...(updatedOrder.discountAmount && updatedOrder.discountAmount > 0
          ? [
              {
                label: 'Giảm giá đơn hàng',
                amount: updatedOrder.discountAmount,
                reason: updatedOrder.discountReason || 'Chiết khấu đơn',
              },
            ]
          : []),
      ],
    };
    const orderWithBreakdown = {
      ...updatedOrder,
      buffetSession: (updatedOrder as any).buffetSessions?.[0] || null,
      financialBreakdown,
    };

    const tableName = updatedOrder.table?.name || updatedOrder.table?.tableCode;
    this.posGateway.emitOrderUpdated(orderWithBreakdown, user?.id, tableName);
    if (updatedOrder.tableId) {
      this.posGateway.emitTableStatusChanged(
        updatedOrder.branchId,
        updatedOrder.tableId,
        'OCCUPIED',
        (updatedOrder as any).tableSession,
        orderWithBreakdown,
        user?.id,
        tableName,
      );
    }
    return orderWithBreakdown;
  }

  // ==========================================
  // 5.1 UPDATE ITEM DISCOUNT IMMEDIATELY
  // ==========================================

  async updateItemDiscount(
    orderId: string,
    itemId: string,
    discountAmount: number,
    discountReason?: string,
    user?: any,
  ) {
    const currentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
      },
    });
    if (!currentOrder) {
      throw new NotFoundException('Đơn hàng không tồn tại');
    }

    const item = currentOrder.orderItems.find((oi) => oi.id === itemId);
    if (!item) {
      throw new NotFoundException('Món không tồn tại trong đơn');
    }

    const validDiscount = Math.max(0, Number(discountAmount) || 0);

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        discountAmount: validDiscount,
        discountReason: discountReason?.trim() || null,
      },
    });

    const updatedItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });

    let effectiveOrderDiscount = currentOrder.discountAmount || 0;
    if ((currentOrder as any).discountType === 'PERCENT' && (currentOrder as any).discountPercent) {
      const itemsNetSubTotal = updatedItems.reduce(
        (sum, it) => sum + Math.max(0, it.priceAtSale - (it.discountAmount || 0)) * it.quantity,
        0,
      );
      effectiveOrderDiscount = Math.round((itemsNetSubTotal * (currentOrder as any).discountPercent) / 100);
    }

    const pricing = await this.orderPricingService.calculatePricing({
      items: updatedItems.map((oi) => ({
        productId: oi.productId,
        name: oi.product?.name || 'Món',
        priceAtSale: oi.priceAtSale,
        quantity: oi.quantity,
        taxPercentage: oi.taxPercentageAtSale || oi.product?.taxPercentage || 0,
      })),
      orderDiscountAmount: effectiveOrderDiscount,
      serviceCharges: currentOrder.serviceCharges.map((c) => ({
        name: c.name,
        amount: c.amount,
        isTaxable: c.isTaxable,
        taxPercentage: c.taxPercentage,
      })),
    });

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subTotal: pricing.subTotal,
        discountAmount: effectiveOrderDiscount,
        serviceChargeTotal: pricing.serviceChargeTotal,
        taxAmount: pricing.taxAmount,
        vatPriceModeSnapshot: pricing.vatPriceMode,
        totalAmount: pricing.totalAmount,
        version: currentOrder.version + 1,
      },
      include: {
        table: true,
        tableSession: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            membershipTier: true,
            points: true,
            memberCode: true,
          },
        },
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
        buffetSessions: {
          where: { status: BuffetSessionStatus.ACTIVE },
          include: {
            buffetPackage: {
              include: {
                items: true,
                tickets: true,
              },
            },
          },
        },
      },
    });

    const tableName = updatedOrder.table?.name || updatedOrder.table?.tableCode;
    this.posGateway.emitOrderUpdated(updatedOrder, user?.id, tableName);
    return updatedOrder;
  }

  // ==========================================
  // 6. KITCHEN DISPATCH (KDS ROUTING)
  // ==========================================

  private async getValidPrinterId(branchId: string, preferredPrinterId?: string | null): Promise<string> {
    if (preferredPrinterId) {
      const exists = await this.prisma.printer.findUnique({ where: { id: preferredPrinterId }, select: { id: true } });
      if (exists) return exists.id;
    }
    const branchPrinter = await this.prisma.printer.findFirst({
      where: { branchId },
      select: { id: true },
    });
    if (branchPrinter) return branchPrinter.id;

    const anyPrinter = await this.prisma.printer.findFirst({ select: { id: true } });
    if (anyPrinter) return anyPrinter.id;

    const created = await this.prisma.printer.create({
      data: {
        branchId,
        name: 'Default Printer',
        connectionType: 'PRINT_AGENT',
        payloadType: 'ESC_POS',
        isActive: true,
      },
    });
    return created.id;
  }

  private async getValidStationId(branchId: string, preferredStationId?: string | null): Promise<string> {
    if (preferredStationId) {
      const exists = await this.prisma.kitchenStation.findUnique({ where: { id: preferredStationId }, select: { id: true } });
      if (exists) return exists.id;
    }
    const branchStation = await this.prisma.kitchenStation.findFirst({
      where: { branchId },
      select: { id: true },
    });
    if (branchStation) return branchStation.id;

    const anyStation = await this.prisma.kitchenStation.findFirst({ select: { id: true } });
    if (anyStation) return anyStation.id;

    const created = await this.prisma.kitchenStation.create({
      data: {
        branchId,
        name: 'Trạm Bếp Mặc Định',
        code: 'DEFAULT_STATION',
        isActive: true,
      },
    });
    return created.id;
  }

  async sendToKitchen(orderId: string, dto: SendKitchenDto, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        branch: true,
        orderItems: {
          include: {
            product: {
              include: {
                category: true,
                printRoutes: {
                  where: { isActive: true },
                  include: { station: true },
                },
              },
            },
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // 1. Tải danh sách tất cả PrintJob đã in THÀNH CÔNG (status = PRINTED) của đơn này
    // (Bỏ qua REPRINT để không làm sai lệch số lượng đã gửi gốc)
    const successfulJobs = await this.prisma.printJob.findMany({
      where: {
        orderId,
        status: PrintJobStatus.PRINTED,
        eventType: { in: [PrintJobEventType.NEW_ITEM, PrintJobEventType.ADD_QUANTITY, PrintJobEventType.ITEM_LABEL] },
      },
      select: {
        orderItemId: true,
        stationId: true,
        routeRole: true,
        printType: true,
        quantityDelta: true,
      },
    });

    // 2. Lấy cấu hình máy in chi nhánh đang hoạt động (BranchPrinterSetting)
    const branchSettings = await this.prisma.branchPrinterSetting.findMany({
      where: { branchId: order.branchId, isEnabled: true },
    });

    const directKitchenSetting = branchSettings.find((s) => s.purpose === 'KITCHEN' && s.printerName);
    const directBarSetting = branchSettings.find((s) => s.purpose === 'BAR' && s.printerName);
    const labelSetting = branchSettings.find((s) => s.purpose === 'ITEM_LABEL' && s.printerName);

    const kitchenSetting = directKitchenSetting || directBarSetting;
    const barSetting = directBarSetting || directKitchenSetting;

    const now = new Date();

    // 2.1 Tải danh sách các Station của chi nhánh để fallback khi món chưa gắn route thủ công
    const branchStations = await this.prisma.kitchenStation.findMany({
      where: { branchId: order.branchId, isActive: true },
    });

    const defaultBarStation = branchStations.find((s) => {
      const code = (s.code || '').toUpperCase();
      const name = (s.name || '').toLowerCase();
      return code.includes('BAR') || name.includes('bar') || code === 'DRINK_BAR';
    });

    const defaultKitchenStation =
      branchStations.find((s) => {
        const code = (s.code || '').toUpperCase();
        return code === 'HOT_KITCHEN' || code.includes('KITCHEN');
      }) ||
      branchStations.find((s) => s.id !== defaultBarStation?.id) ||
      branchStations[0];

    // 3. Phân tuyến từng món theo ProductPrintRoute trong DB hoặc fallback Bếp / Bar
    interface DispatchItem {
      orderItem: any;
      delta: number;
      station: any;
      routeRole: PrintRouteRole;
      sentSoFar: number;
    }

    const kitchenItemsToDispatch: DispatchItem[] = [];
    const barItemsToDispatch: DispatchItem[] = [];
    const labelItemsToDispatch: Array<{ orderItem: any; delta: number }> = [];

    for (const item of order.orderItems) {
      if (dto.itemIds && dto.itemIds.length > 0 && !dto.itemIds.includes(item.id)) {
        continue;
      }

      const activeRoutes = (item.product.printRoutes || []).filter(
        (r: any) => r.isActive && (!r.branchId || r.branchId === order.branchId),
      );

      if (activeRoutes.length > 0) {
        // A. Có cấu hình ProductPrintRoute trong CSDL
        // Xử lý các tuyến PREPARATION (Bếp / Bar)
        const prepRoutes = activeRoutes.filter((r: any) => r.routeRole === PrintRouteRole.PREPARATION);
        for (const route of prepRoutes) {
          const station = route.station;
          const sentSoFar = Math.max(
            Number(item.sentQuantity || 0),
            successfulJobs
              .filter(
                (j) =>
                  j.orderItemId === item.id &&
                  j.stationId === station.id &&
                  j.routeRole === PrintRouteRole.PREPARATION,
              )
              .reduce((sum, j) => sum + j.quantityDelta, 0),
          );

          const delta = item.quantity - sentSoFar;
          if (delta > 0) {
            const code = (station.code || '').toUpperCase();
            const name = (station.name || '').toLowerCase();
            const isBar = code.includes('BAR') || name.includes('bar');

            if (isBar) {
              barItemsToDispatch.push({ orderItem: item, delta, station, routeRole: PrintRouteRole.PREPARATION, sentSoFar });
            } else {
              kitchenItemsToDispatch.push({ orderItem: item, delta, station, routeRole: PrintRouteRole.PREPARATION, sentSoFar });
            }
          }
        }

        // Xử lý tuyến LABEL (Tem nhãn)
        const hasLabelRoute = activeRoutes.some(
          (r: any) => r.routeRole === PrintRouteRole.LABEL || r.printType === PrintTemplateType.ITEM_LABEL,
        );

        if (hasLabelRoute) {
          const labelsPrintedSoFar = Math.max(
            Number(item.printedQuantity || 0),
            successfulJobs
              .filter(
                (j) =>
                  j.orderItemId === item.id &&
                  (j.routeRole === PrintRouteRole.LABEL || j.printType === PrintTemplateType.ITEM_LABEL),
              )
              .reduce((sum, j) => sum + j.quantityDelta, 0),
          );

          const deltaLabel = item.quantity - labelsPrintedSoFar;
          if (deltaLabel > 0) {
            labelItemsToDispatch.push({ orderItem: item, delta: deltaLabel });
          }
        }
      } else {
        // B. Món chưa cấu hình ProductPrintRoute trong DB -> Kiểm tra phân loại Bếp / Bar theo danh mục & tên món
        const stationType = this.determineStationId(item.product.category?.slug, item.product.name);
        const isBar = stationType === 'BAR';
        const targetStation = isBar
          ? (defaultBarStation || defaultKitchenStation)
          : (defaultKitchenStation || defaultBarStation);

        if (targetStation) {
          const sentSoFar = Math.max(
            Number(item.sentQuantity || 0),
            successfulJobs
              .filter((j) => j.orderItemId === item.id && j.routeRole === PrintRouteRole.PREPARATION)
              .reduce((sum, j) => sum + j.quantityDelta, 0),
          );

          const delta = item.quantity - sentSoFar;
          if (delta > 0) {
            if (isBar) {
              barItemsToDispatch.push({ orderItem: item, delta, station: targetStation, routeRole: PrintRouteRole.PREPARATION, sentSoFar });
            } else {
              kitchenItemsToDispatch.push({ orderItem: item, delta, station: targetStation, routeRole: PrintRouteRole.PREPARATION, sentSoFar });
            }
          }
        }
      }
    }

    const totalDispatches =
      kitchenItemsToDispatch.length + barItemsToDispatch.length + labelItemsToDispatch.length;

    if (totalDispatches === 0) {
      return {
        ...order,
        success: true,
        message: 'Không có món mới hoặc lượng gọi thêm cần gửi bếp/bar/tem',
        printPayloads: [],
        printStatus: null,
      };
    }

    // 4. Tạo PrintJob ở trạng thái PENDING và render Payload in
    const printPayloads: any[] = [];
    const isSplitKitchen = Boolean(order.branch?.splitKitchenTickets);
    const staffName = user?.fullName || (order as any).user?.fullName || 'Thu ngân / Waiter';
    const tableName = order.table?.name || (order.orderType === 'TAKEAWAY' ? 'Mang đi / Mang về' : 'Giao hàng / Online');

    // --- A. GỬI BẾP (KITCHEN) ---
    if (kitchenSetting && kitchenItemsToDispatch.length > 0) {
      const kitchenPrinterId = await this.getValidPrinterId(order.branchId, kitchenSetting.printerId);

      if (isSplitKitchen) {
        // CHẾ ĐỘ 1: TÁCH RIÊNG TỪNG MÓN ĂN (Mỗi món in 1 phiếu độc lập)
        for (const d of kitchenItemsToDispatch) {
          const isAdditional = d.sentSoFar > 0;
          const ticketData: any = {
            branchName: order.branch?.name || 'AVORA Restaurant',
            stationName: d.station?.name || 'BẾP CHẾ BIẾN',
            orderCode: order.orderCode,
            tableName,
            orderTypeStr: order.orderType,
            orderNote: order.note || undefined,
            staffName,
            eventType: isAdditional ? 'ADD_QUANTITY' : 'NEW_ITEM',
            sentAt: now,
            items: [
              {
                name: d.orderItem.product.name,
                quantity: d.delta, // In đúng lượng delta chưa gửi
                note: d.orderItem.note || undefined,
                options: d.orderItem.optionsTextSnapshot || undefined,
                isAdditional,
              },
            ],
          };

          const html = this.buildKitchenTicketHtml(ticketData);
          const job = await this.prisma.printJob.create({
            data: {
              orderId: order.id,
              orderItemId: d.orderItem.id,
              branchId: order.branchId,
              stationId: d.station.id,
              printerId: kitchenPrinterId,
              routeRole: PrintRouteRole.PREPARATION,
              printType: PrintTemplateType.KITCHEN_TICKET,
              eventType: isAdditional ? PrintJobEventType.ADD_QUANTITY : PrintJobEventType.NEW_ITEM,
              quantity: d.orderItem.quantity,
              quantityDelta: d.delta,
              copies: kitchenSetting.copies || 1,
              contentHtml: html,
              status: PrintJobStatus.PENDING,
              idempotencyKey: `kjob_${order.id}_${d.orderItem.id}_${d.station.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
            },
          });

          printPayloads.push({
            printJobIds: [job.id],
            purpose: 'KITCHEN',
            printerName: kitchenSetting.printerName,
            paperSize: kitchenSetting.paperSize || '80mm',
            copies: kitchenSetting.copies || 1,
            htmlContent: html,
            ticketData,
            itemDeltas: [{ orderItemId: d.orderItem.id, delta: d.delta }],
          });
        }
      } else {
        // CHẾ ĐỘ 2: GỘP CHUNG MÓN CÙNG KHU VỰC CHẾ BIẾN
        const ticketData: any = {
          branchName: order.branch?.name || 'AVORA Restaurant',
          stationName: 'BẾP CHẾ BIẾN',
          orderCode: order.orderCode,
          tableName,
          orderTypeStr: order.orderType,
          orderNote: order.note || undefined,
          staffName,
          eventType: kitchenItemsToDispatch.some((d) => d.sentSoFar > 0) ? 'ADD_QUANTITY' : 'NEW_ITEM',
          sentAt: now,
          items: kitchenItemsToDispatch.map((d) => ({
            name: d.orderItem.product.name,
            quantity: d.delta,
            note: d.orderItem.note || undefined,
            options: d.orderItem.optionsTextSnapshot || undefined,
            isAdditional: d.sentSoFar > 0,
          })),
        };

        const html = this.buildKitchenTicketHtml(ticketData);
        const printJobIds: string[] = [];
        for (const d of kitchenItemsToDispatch) {
          const isAdditional = d.sentSoFar > 0;
          const job = await this.prisma.printJob.create({
            data: {
              orderId: order.id,
              orderItemId: d.orderItem.id,
              branchId: order.branchId,
              stationId: d.station.id,
              printerId: kitchenPrinterId,
              routeRole: PrintRouteRole.PREPARATION,
              printType: PrintTemplateType.KITCHEN_TICKET,
              eventType: isAdditional ? PrintJobEventType.ADD_QUANTITY : PrintJobEventType.NEW_ITEM,
              quantity: d.orderItem.quantity,
              quantityDelta: d.delta,
              copies: kitchenSetting.copies || 1,
              contentHtml: html,
              status: PrintJobStatus.PENDING,
              idempotencyKey: `kjob_${order.id}_${d.orderItem.id}_${d.station.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
            },
          });
          printJobIds.push(job.id);
        }

        printPayloads.push({
          printJobIds,
          purpose: 'KITCHEN',
          printerName: kitchenSetting.printerName,
          paperSize: kitchenSetting.paperSize || '80mm',
          copies: kitchenSetting.copies || 1,
          htmlContent: html,
          ticketData,
          itemDeltas: kitchenItemsToDispatch.map((d) => ({ orderItemId: d.orderItem.id, delta: d.delta })),
        });
      }
    }

    // --- B. GỬI BAR (DRINK_BAR) ---
    if (barSetting && barItemsToDispatch.length > 0) {
      const barPrinterId = await this.getValidPrinterId(order.branchId, barSetting.printerId);

      if (isSplitKitchen) {
        // TÁCH RIÊNG TỪNG MÓN CHO QUẦY BAR
        for (const d of barItemsToDispatch) {
          const isAdditional = d.sentSoFar > 0;
          const ticketData: any = {
            branchName: order.branch?.name || 'AVORA Restaurant',
            stationName: d.station?.name || 'QUẦY BAR (PHA CHẾ)',
            orderCode: order.orderCode,
            tableName,
            orderTypeStr: order.orderType,
            orderNote: order.note || undefined,
            staffName,
            eventType: isAdditional ? 'ADD_QUANTITY' : 'NEW_ITEM',
            sentAt: now,
            items: [
              {
                name: d.orderItem.product.name,
                quantity: d.delta,
                note: d.orderItem.note || undefined,
                options: d.orderItem.optionsTextSnapshot || undefined,
                isAdditional,
              },
            ],
          };

          const html = this.buildKitchenTicketHtml(ticketData);
          const job = await this.prisma.printJob.create({
            data: {
              orderId: order.id,
              orderItemId: d.orderItem.id,
              branchId: order.branchId,
              stationId: d.station.id,
              printerId: barPrinterId,
              routeRole: PrintRouteRole.PREPARATION,
              printType: PrintTemplateType.KITCHEN_TICKET,
              eventType: isAdditional ? PrintJobEventType.ADD_QUANTITY : PrintJobEventType.NEW_ITEM,
              quantity: d.orderItem.quantity,
              quantityDelta: d.delta,
              copies: barSetting.copies || 1,
              contentHtml: html,
              status: PrintJobStatus.PENDING,
              idempotencyKey: `bjob_${order.id}_${d.orderItem.id}_${d.station.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
            },
          });

          printPayloads.push({
            printJobIds: [job.id],
            purpose: 'BAR',
            printerName: barSetting.printerName,
            paperSize: barSetting.paperSize || '80mm',
            copies: barSetting.copies || 1,
            htmlContent: html,
            ticketData,
            itemDeltas: [{ orderItemId: d.orderItem.id, delta: d.delta }],
          });
        }
      } else {
        // GỘP MÓN QUẦY BAR
        const ticketData: any = {
          branchName: order.branch?.name || 'AVORA Restaurant',
          stationName: 'QUẦY BAR (PHA CHẾ)',
          orderCode: order.orderCode,
          tableName,
          orderTypeStr: order.orderType,
          orderNote: order.note || undefined,
          staffName,
          eventType: barItemsToDispatch.some((d) => d.sentSoFar > 0) ? 'ADD_QUANTITY' : 'NEW_ITEM',
          sentAt: now,
          items: barItemsToDispatch.map((d) => ({
            name: d.orderItem.product.name,
            quantity: d.delta,
            note: d.orderItem.note || undefined,
            options: d.orderItem.optionsTextSnapshot || undefined,
            isAdditional: d.sentSoFar > 0,
          })),
        };

        const html = this.buildKitchenTicketHtml(ticketData);
        const printJobIds: string[] = [];
        for (const d of barItemsToDispatch) {
          const isAdditional = d.sentSoFar > 0;
          const job = await this.prisma.printJob.create({
            data: {
              orderId: order.id,
              orderItemId: d.orderItem.id,
              branchId: order.branchId,
              stationId: d.station.id,
              printerId: barPrinterId,
              routeRole: PrintRouteRole.PREPARATION,
              printType: PrintTemplateType.KITCHEN_TICKET,
              eventType: isAdditional ? PrintJobEventType.ADD_QUANTITY : PrintJobEventType.NEW_ITEM,
              quantity: d.orderItem.quantity,
              quantityDelta: d.delta,
              copies: barSetting.copies || 1,
              contentHtml: html,
              status: PrintJobStatus.PENDING,
              idempotencyKey: `bjob_${order.id}_${d.orderItem.id}_${d.station.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
            },
          });
          printJobIds.push(job.id);
        }

        printPayloads.push({
          printJobIds,
          purpose: 'BAR',
          printerName: barSetting.printerName,
          paperSize: barSetting.paperSize || '80mm',
          copies: barSetting.copies || 1,
          htmlContent: html,
          ticketData,
          itemDeltas: barItemsToDispatch.map((d) => ({ orderItemId: d.orderItem.id, delta: d.delta })),
        });
      }
    }

    // --- C. GỬI IN TEM NHÃN (ITEM_LABEL) ---
    if (labelSetting && labelItemsToDispatch.length > 0) {
      try {
        const itemsForLabel = labelItemsToDispatch.map((d) => ({
          ...d.orderItem,
          delta: d.delta,
        }));

        const renderedLabels = await this.printTemplateService.renderItemLabelsForOrder(
          order,
          itemsForLabel,
          labelSetting,
        );

        const labelPrinterId = await this.getValidPrinterId(order.branchId, labelSetting.printerId);

        for (const rl of renderedLabels) {
          const stationId = await this.getValidStationId(order.branchId, rl.item?.stationId || rl.item?.product?.printRoutes?.[0]?.stationId);
          const labelJob = await this.prisma.printJob.create({
            data: {
              orderId: order.id,
              orderItemId: rl.item.id,
              branchId: order.branchId,
              stationId,
              printerId: labelPrinterId,
              routeRole: PrintRouteRole.LABEL,
              printType: PrintTemplateType.ITEM_LABEL,
              eventType: PrintJobEventType.ITEM_LABEL,
              quantity: rl.item.quantity,
              quantityDelta: 1, // Mỗi con tem in cho 1 sản phẩm đơn vị
              copies: rl.copies,
              contentHtml: rl.htmlContent,
              status: PrintJobStatus.PENDING,
              idempotencyKey: rl.idempotencyKey,
            },
          });

          printPayloads.push({
            printJobIds: [labelJob.id],
            purpose: 'ITEM_LABEL',
            type: 'LABEL',
            printerName: labelSetting.printerName,
            labelSize: rl.labelSize,
            paperSize: rl.paperSize,
            copies: rl.copies,
            htmlContent: rl.htmlContent,
            idempotencyKey: rl.idempotencyKey,
            itemDeltas: [{ orderItemId: rl.item.id, delta: 1 }],
          });
        }
      } catch (err: any) {
        this.logger.error(`Lỗi render tem nhãn ITEM_LABEL từ PrintTemplate: ${err.message}`);
      }
    }

    // 5. Cập nhật trạng thái đơn hàng và các món sang SENT
    await this.prisma.orderItem.updateMany({
      where: {
        orderId,
        kitchenStatus: KitchenStatus.PENDING,
      },
      data: {
        kitchenStatus: KitchenStatus.SENT,
        sentToKitchenAt: now,
      },
    });

    // Cập nhật số lượng đã gửi (sentQuantity) và đã in (printedQuantity) cho từng món
    for (const d of [...kitchenItemsToDispatch, ...barItemsToDispatch]) {
      const curItem = await this.prisma.orderItem.findUnique({ where: { id: d.orderItem.id } });
      const curSent = curItem?.sentQuantity || 0;
      const curPrinted = curItem?.printedQuantity || 0;
      const maxQty = curItem?.quantity || d.orderItem.quantity;
      await this.prisma.orderItem.update({
        where: { id: d.orderItem.id },
        data: {
          sentQuantity: Math.min(maxQty, curSent + d.delta),
          printedQuantity: Math.min(maxQty, curPrinted + d.delta),
          isKitchenPrinted: true,
          kitchenStatus: KitchenStatus.SENT,
          sentToKitchenAt: now,
        },
      }).catch((err) => {
        this.logger.warn(`Không thể cập nhật sentQuantity cho OrderItem ${d.orderItem.id}: ${err.message}`);
      });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        kitchenStatus: KitchenStatus.SENT,
        sentToKitchenAt: order.sentToKitchenAt || now,
        status: order.status === OrderStatus.PENDING ? OrderStatus.PREPARING : order.status,
        version: order.version + 1,
      },
      include: {
        table: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    // Kiểm tra trạng thái máy chủ POS & Print Agent của chi nhánh
    const posStatus = this.posGateway.checkBranchPosStatus(order.branchId);
    const isAgentDirect = this.printerDispatcherService.isAgentOnlineForBranch(order.branchId);
    const isPosReady = posStatus.isOnline || isAgentDirect;

    let printStatus: any = {
      isPosOnline: true,
      hasError: false,
      dispatchedCount: printPayloads.length,
      warningMessage: null,
    };

    if (printPayloads.length > 0) {
      if (isPosReady) {
        // Gửi lệnh in trực tiếp đến máy chủ POS chi nhánh qua WebSocket
        this.posGateway.emitPrintDispatch(order.branchId, {
          orderId: order.id,
          orderCode: order.orderCode || order.temporaryOrderCode,
          tableName: order.table?.name || (order.orderType === 'TAKEAWAY' ? 'Mang đi' : 'Giao hàng / Online'),
          printPayloads,
          sentAt: now.toISOString(),
          sender: user?.fullName || 'Nhân viên Waiter',
        });
      } else {
        // Máy chủ POS hoặc Print Agent đang offline / tắt / mất mạng
        const hasKitchen = printPayloads.some((p: any) => p.purpose === 'KITCHEN');
        const hasBar = printPayloads.some((p: any) => p.purpose === 'BAR');
        let stationLabel = 'Bếp';
        if (hasKitchen && hasBar) {
          stationLabel = 'Bếp & Bar';
        } else if (hasBar) {
          stationLabel = 'Bar';
        }

        const warningMessage = `Máy in [${stationLabel}] lỗi: Máy chủ POS (Print Agent) đang tắt/ mất mạng/ máy chủ in POS chưa được mở. Hãy kiểm tra lại!`;
        printStatus = {
          isPosOnline: false,
          hasError: true,
          dispatchedCount: 0,
          warningMessage,
          stationLabel,
        };

        this.logger.warn(`Chi nhánh [${order.branchId}] - ${warningMessage}`);

        // Đánh dấu các lệnh in vừa tạo kèm lý do để thu ngân biết khi mở lại POS
        for (const payload of printPayloads) {
          if (payload.printJobIds && payload.printJobIds.length > 0) {
            await this.prisma.printJob.updateMany({
              where: { id: { in: payload.printJobIds } },
              data: {
                status: PrintJobStatus.PENDING,
                errorMessage: warningMessage,
              },
            }).catch(() => {});
          }
        }
      }
    }

    this.posGateway.emitOrderUpdated(updated, user?.id);

    return {
      ...updated,
      printPayloads,
      printStatus,
    };
  }

  // ==========================================
  // CONFIRM PRINT (Xác nhận an toàn qua PrintJob)
  // ==========================================

  async confirmPrint(orderId: string, dto: ConfirmPrintDto) {
    const { printJobId, status, errorMessage } = dto;
    const job = await this.prisma.printJob.findUnique({
      where: { id: printJobId },
      include: { orderItem: true },
    });

    if (!job || job.orderId !== orderId) {
      throw new NotFoundException(`Lệnh in không tồn tại hoặc không thuộc đơn hàng: ${printJobId}`);
    }

    // Đảm bảo tính idempotent: nếu đã xác nhận thành công rồi thì không cộng dồn nữa
    if (job.status === PrintJobStatus.PRINTED && status === 'SUCCESS') {
      return { success: true, message: 'Lệnh in đã được xác nhận trước đó' };
    }

    if (status === 'SUCCESS') {
      await this.prisma.$transaction(async (tx) => {
        await tx.printJob.update({
          where: { id: printJobId },
          data: {
            status: PrintJobStatus.PRINTED,
            printedAt: new Date(),
            errorMessage: null,
          },
        });

        if (job.orderItemId) {
          const curItem = await tx.orderItem.findUnique({ where: { id: job.orderItemId } });
          if (curItem) {
            if (job.routeRole === PrintRouteRole.LABEL || job.printType === PrintTemplateType.ITEM_LABEL) {
              const newPrinted = Math.min(curItem.quantity, (curItem.printedQuantity || 0) + job.quantityDelta);
              await tx.orderItem.update({
                where: { id: job.orderItemId },
                data: {
                  printedQuantity: newPrinted,
                },
              });
            } else {
              // Bếp / Bar: Đảm bảo sentQuantity & printedQuantity đạt tối đa là item.quantity
              const newSent = Math.min(curItem.quantity, Math.max(curItem.sentQuantity || 0, (curItem.sentQuantity || 0) + (job.quantityDelta || 0)));
              const newPrinted = Math.min(curItem.quantity, Math.max(curItem.printedQuantity || 0, (curItem.printedQuantity || 0) + (job.quantityDelta || 0)));
              await tx.orderItem.update({
                where: { id: job.orderItemId },
                data: {
                  sentQuantity: newSent,
                  printedQuantity: newPrinted,
                  kitchenStatus: KitchenStatus.SENT,
                  isKitchenPrinted: true,
                  sentToKitchenAt: new Date(),
                },
              });
            }
          }
        }
      });

      return { success: true, message: 'Đã xác nhận in thành công' };
    } else {
      await this.prisma.printJob.update({
        where: { id: printJobId },
        data: {
          status: PrintJobStatus.FAILED,
          errorMessage: errorMessage || 'Máy in báo lỗi',
        },
      });

      return { success: true, message: 'Đã ghi nhận lỗi in, sẵn sàng thử lại' };
    }
  }

  // ==========================================
  // REPRINT LABELS (Validate Product từ DB)
  // ==========================================

  async reprintLabels(orderId: string, dto: ReprintLabelsDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        table: true,
        orderItems: {
          include: {
            product: {
              include: {
                printRoutes: {
                  where: { isActive: true },
                },
              },
            },
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const branchSettings = await this.prisma.branchPrinterSetting.findMany({
      where: { branchId: order.branchId, isEnabled: true },
    });
    const labelSetting = branchSettings.find((s) => s.purpose === 'ITEM_LABEL' && s.printerName);
    if (!labelSetting) {
      throw new BadRequestException('Chi nhánh chưa cấu hình hoặc chưa bật máy in tem nhãn (ITEM_LABEL)');
    }

    const payloads: any[] = [];
    const now = new Date();

    for (const reqItem of dto.items) {
      const orderItem = order.orderItems.find((oi) => oi.id === reqItem.orderItemId);
      if (!orderItem) {
        throw new NotFoundException(`Món với id ${reqItem.orderItemId} không tồn tại trong đơn hàng`);
      }

      // Kiểm tra cấu hình ITEM_LABEL trên Product
      const hasLabelRoute = (orderItem.product.printRoutes || []).some(
        (r: any) => r.routeRole === PrintRouteRole.LABEL || r.printType === PrintTemplateType.ITEM_LABEL,
      );

      if (!hasLabelRoute) {
        throw new BadRequestException(`Món [${orderItem.product.name}] không được cấu hình in tem nhãn (ITEM_LABEL).`);
      }

      const qty = Math.max(1, reqItem.quantity || 1);

      // Tạo PrintJob REPRINT (không thay đổi printedQuantity gốc)
      const labelPrinterId = await this.getValidPrinterId(order.branchId, labelSetting.printerId);
      const stationId = await this.getValidStationId(order.branchId, orderItem.product.printRoutes[0]?.stationId);

      const reprintJob = await this.prisma.printJob.create({
        data: {
          orderId: order.id,
          orderItemId: orderItem.id,
          branchId: order.branchId,
          stationId,
          printerId: labelPrinterId,
          routeRole: PrintRouteRole.LABEL,
          printType: PrintTemplateType.ITEM_LABEL,
          eventType: PrintJobEventType.REPRINT,
          quantity: qty,
          quantityDelta: qty,
          copies: 1,
          contentHtml: '',
          status: PrintJobStatus.PENDING,
          idempotencyKey: `reprint_label_${order.id}_${orderItem.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
        },
      });

      const rendered = await this.printTemplateService.renderItemLabelsForOrder(
        order,
        [{ ...orderItem, delta: qty }],
        labelSetting,
      );

      for (const rl of rendered) {
        payloads.push({
          printJobIds: [reprintJob.id],
          purpose: 'ITEM_LABEL',
          type: 'LABEL',
          printerName: labelSetting.printerName,
          labelSize: rl.labelSize,
          paperSize: rl.paperSize,
          copies: rl.copies,
          htmlContent: rl.htmlContent,
          idempotencyKey: rl.idempotencyKey,
        });
      }
    }

    return { success: true, printPayloads: payloads };
  }

  // ==========================================
  // REPRINT KITCHEN TICKET (Không tăng sentQuantity)
  // ==========================================

  async reprintKitchenTicket(orderId: string, dto: ReprintKitchenDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        table: true,
        orderItems: {
          include: {
            product: {
              include: {
                printRoutes: {
                  where: { isActive: true },
                  include: { station: true },
                },
              },
            },
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const branchSettings = await this.prisma.branchPrinterSetting.findMany({
      where: { branchId: order.branchId, isEnabled: true },
    });

    const kitchenSetting = branchSettings.find((s) => s.purpose === 'KITCHEN' && s.printerName);
    const barSetting = branchSettings.find((s) => s.purpose === 'BAR' && s.printerName);

    const targetItems = dto.orderItemIds && dto.orderItemIds.length > 0
      ? order.orderItems.filter((it) => dto.orderItemIds!.includes(it.id))
      : order.orderItems;

    const now = new Date();
    const payloads: any[] = [];

    // Tách items cho Bếp và Bar
    const kitchenItems = targetItems.filter((it) =>
      (it.product.printRoutes || []).some(
        (r: any) =>
          r.routeRole === PrintRouteRole.PREPARATION &&
          !r.station?.code?.toUpperCase().includes('BAR') &&
          !r.station?.name?.toLowerCase().includes('bar'),
      ),
    );

    const barItems = targetItems.filter((it) =>
      (it.product.printRoutes || []).some(
        (r: any) =>
          r.routeRole === PrintRouteRole.PREPARATION &&
          (r.station?.code?.toUpperCase().includes('BAR') || r.station?.name?.toLowerCase().includes('bar')),
      ),
    );

    if (kitchenSetting && kitchenItems.length > 0) {
      const ticketData: any = {
        branchName: order.branch?.name || 'AVORA Restaurant',
        stationName: 'BẾP CHẾ BIẾN (IN LẠI)',
        orderCode: order.orderCode,
        tableName: order.table?.name || (order.orderType === 'TAKEAWAY' ? 'Mang đi' : 'Giao hàng / Online'),
        orderTypeStr: order.orderType,
        orderNote: order.note || undefined,
        eventType: 'REPRINT',
        sentAt: now,
        items: kitchenItems.map((it) => ({
          name: it.product.name,
          quantity: it.quantity,
          note: it.note || undefined,
          options: it.optionsTextSnapshot || undefined,
        })),
      };

      const html = this.buildKitchenTicketHtml(ticketData);
      const kitchenPrinterId = await this.getValidPrinterId(order.branchId, kitchenSetting.printerId);
      const kStationId = await this.getValidStationId(order.branchId, kitchenItems[0]?.product?.printRoutes?.[0]?.stationId);

      const job = await this.prisma.printJob.create({
        data: {
          orderId: order.id,
          branchId: order.branchId,
          stationId: kStationId,
          printerId: kitchenPrinterId,
          routeRole: PrintRouteRole.PREPARATION,
          printType: PrintTemplateType.KITCHEN_TICKET,
          eventType: PrintJobEventType.REPRINT,
          quantity: kitchenItems.reduce((s, i) => s + i.quantity, 0),
          quantityDelta: 0, // REPRINT không tính delta vào món
          copies: 1,
          contentHtml: html,
          status: PrintJobStatus.PENDING,
          idempotencyKey: `reprint_k_${order.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
        },
      });

      payloads.push({
        printJobIds: [job.id],
        purpose: 'KITCHEN',
        printerName: kitchenSetting.printerName,
        paperSize: kitchenSetting.paperSize || '80mm',
        copies: kitchenSetting.copies || 1,
        htmlContent: html,
        ticketData,
      });
    }

    if (barSetting && barItems.length > 0) {
      const ticketData: any = {
        branchName: order.branch?.name || 'AVORA Restaurant',
        stationName: 'QUẦY BAR (IN LẠI)',
        orderCode: order.orderCode,
        tableName: order.table?.name || (order.orderType === 'TAKEAWAY' ? 'Mang đi' : 'Giao hàng / Online'),
        orderTypeStr: order.orderType,
        orderNote: order.note || undefined,
        eventType: 'REPRINT',
        sentAt: now,
        items: barItems.map((it) => ({
          name: it.product.name,
          quantity: it.quantity,
          note: it.note || undefined,
          options: it.optionsTextSnapshot || undefined,
        })),
      };

      const html = this.buildKitchenTicketHtml(ticketData);
      const barPrinterId = await this.getValidPrinterId(order.branchId, barSetting.printerId);
      const bStationId = await this.getValidStationId(order.branchId, barItems[0]?.product?.printRoutes?.[0]?.stationId);

      const job = await this.prisma.printJob.create({
        data: {
          orderId: order.id,
          branchId: order.branchId,
          stationId: bStationId,
          printerId: barPrinterId,
          routeRole: PrintRouteRole.PREPARATION,
          printType: PrintTemplateType.KITCHEN_TICKET,
          eventType: PrintJobEventType.REPRINT,
          quantity: barItems.reduce((s, i) => s + i.quantity, 0),
          quantityDelta: 0,
          copies: 1,
          contentHtml: html,
          status: PrintJobStatus.PENDING,
          idempotencyKey: `reprint_b_${order.id}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
        },
      });

      payloads.push({
        printJobIds: [job.id],
        purpose: 'BAR',
        printerName: barSetting.printerName,
        paperSize: barSetting.paperSize || '80mm',
        copies: barSetting.copies || 1,
        htmlContent: html,
        ticketData,
      });
    }

    return { success: true, printPayloads: payloads };
  }

  // ==========================================
  // 7. HOLD & RESUME ORDERS
  // ==========================================

  async holdOrder(orderId: string, dto: HoldOrderDto, user?: any) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.HELD,
        note: dto.note ? `${order.note || ''} [Giữ đơn: ${dto.note}]`.trim() : order.note,
        version: order.version + 1,
      },
      include: {
        table: true,
        orderItems: { include: { product: true } },
      },
    });

    this.posGateway.emitOrderUpdated(updated, user?.id);
    return updated;
  }

  async resumeOrder(orderId: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { product: true } } },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING,
        version: order.version + 1,
      },
      include: {
        table: true,
        orderItems: { include: { product: true, selectedOptions: true } },
      },
    });

    this.posGateway.emitOrderUpdated(updated, user?.id);
    return updated;
  }

  async requestPayment(orderId: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        orderItems: { include: { product: true } },
      },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.HELD,
        paymentStatus: 'PAYMENT_REQUESTED',
        version: order.version + 1,
      },
      include: {
        table: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            membershipTier: true,
            points: true,
            memberCode: true,
          },
        },
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
      },
    });

    const tableName = updated.table?.name || updated.table?.tableCode || '';
    this.posGateway.emitOrderUpdated(updated, user?.id, tableName);

    if (updated.tableId) {
      this.posGateway.emitTableStatusChanged(
        updated.branchId,
        updated.tableId,
        'BILL_PRINTED',
        (updated as any).tableSession,
        updated,
        user?.id,
        tableName,
      );
    }

    return updated;
  }

  async cancelPaymentRequest(orderId: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        orderItems: { include: { product: true } },
      },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
        version: order.version + 1,
      },
      include: {
        table: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            membershipTier: true,
            points: true,
            memberCode: true,
          },
        },
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
      },
    });

    const tableName = updated.table?.name || updated.table?.tableCode || '';
    this.posGateway.emitOrderUpdated(updated, user?.id, tableName);

    if (updated.tableId) {
      this.posGateway.emitTableStatusChanged(
        updated.branchId,
        updated.tableId,
        'OCCUPIED',
        (updated as any).tableSession,
        updated,
        user?.id,
        tableName,
      );
    }

    return updated;
  }

  // ==========================================
  // 8. SPLIT & MERGE ORDERS
  // ==========================================

  async splitOrder(dto: SplitOrderDto, user?: any) {
    const sourceOrder = await this.prisma.order.findUnique({
      where: { id: dto.sourceOrderId },
      include: {
        orderItems: { include: { selectedOptions: true, product: true } },
      },
    });
    if (!sourceOrder) throw new NotFoundException('Đơn hàng gốc không tồn tại');

    const result = await this.prisma.$transaction(async (tx) => {
      const childTempCode = await this.generateTemporaryOrderCode(tx);
      // Create child order
      const childOrder = await tx.order.create({
        data: {
          orderCode: null,
          temporaryOrderCode: childTempCode,
          orderSource: OrderSource.POS,
          branchId: sourceOrder.branchId,
          tableId: dto.targetTableId || sourceOrder.tableId,
          guestCount: 1,
          customerName: `${sourceOrder.customerName} (Tách)`,
          customerPhone: sourceOrder.customerPhone,
          deliveryAddress: sourceOrder.deliveryAddress,
          orderType: sourceOrder.orderType,
          status: OrderStatus.PENDING,
          kitchenStatus: KitchenStatus.PENDING,
          cashierId: user?.id || sourceOrder.cashierId,
          subTotal: 0,
          totalAmount: 0,
          version: 1,
        },
      });

      let transferredSubTotal = 0;

      for (const splitItem of dto.items) {
        const item = sourceOrder.orderItems.find((oi) => oi.id === splitItem.orderItemId);
        if (!item || item.quantity < splitItem.quantity) {
          throw new BadRequestException(`Số lượng tách không hợp lệ cho món: ${item?.product.name || splitItem.orderItemId}`);
        }

        const itemTotal = item.priceAtSale * splitItem.quantity;
        transferredSubTotal += itemTotal;

        // Create child item
        await tx.orderItem.create({
          data: {
            orderId: childOrder.id,
            productId: item.productId,
            quantity: splitItem.quantity,
            priceAtSale: item.priceAtSale,
            originalPriceAtSale: item.originalPriceAtSale,
            note: item.note,
            optionsTextSnapshot: item.optionsTextSnapshot,
            stationId: item.stationId,
            kitchenStatus: item.kitchenStatus,
            selectedOptions: {
              create: item.selectedOptions.map((so) => ({
                optionItemId: so.optionItemId,
                nameAtSale: so.nameAtSale,
                priceAdjustmentAtSale: so.priceAdjustmentAtSale,
              })),
            },
          },
        });

        // Update or remove from source order
        if (item.quantity === splitItem.quantity) {
          await tx.orderItem.delete({ where: { id: item.id } });
        } else {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { quantity: item.quantity - splitItem.quantity },
          });
        }

        // Audit Log in OrderItemTransferLog
        await tx.orderItemTransferLog.create({
          data: {
            sourceOrderId: sourceOrder.id,
            targetOrderId: childOrder.id,
            productId: item.productId,
            quantity: splitItem.quantity,
            actorId: user?.id || null,
            reason: dto.reason || 'Tách đơn POS',
            sourceItemSnapshot: JSON.stringify(item),
          },
        });
      }

      // Update source order totals
      const newSourceSubTotal = Math.max(0, sourceOrder.subTotal - transferredSubTotal);
      const updatedSource = await tx.order.update({
        where: { id: sourceOrder.id },
        data: {
          subTotal: newSourceSubTotal,
          totalAmount: Math.max(0, newSourceSubTotal - (sourceOrder.discountAmount || 0)),
          version: sourceOrder.version + 1,
        },
        include: {
          orderItems: { include: { product: true, selectedOptions: true } },
        },
      });

      // Update child order totals
      const updatedChild = await tx.order.update({
        where: { id: childOrder.id },
        data: {
          subTotal: transferredSubTotal,
          totalAmount: transferredSubTotal,
        },
        include: {
          orderItems: { include: { product: true, selectedOptions: true } },
        },
      });

      // Create OrderRelation
      await tx.orderRelation.create({
        data: {
          parentOrderId: sourceOrder.id,
          childOrderId: childOrder.id,
          type: OrderRelationType.SPLIT_FROM,
          metadata: JSON.stringify({ reason: dto.reason, splitItems: dto.items }),
        },
      });

      return { sourceOrder: updatedSource, childOrder: updatedChild };
    });

    this.posGateway.emitOrderUpdated(result.sourceOrder, user?.id);
    this.posGateway.emitOrderCreated(result.childOrder, user?.id);

    return result;
  }

  async mergeOrder(dto: MergeOrderDto, user?: any) {
    const [sourceOrder, targetOrder] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: dto.sourceOrderId },
        include: {
          orderItems: { include: { selectedOptions: true } },
          tableSession: true,
        },
      }),
      this.prisma.order.findUnique({
        where: { id: dto.targetOrderId },
        include: {
          orderItems: { include: { selectedOptions: true } },
        },
      }),
    ]);

    if (!sourceOrder || !targetOrder) {
      throw new NotFoundException('Một trong hai đơn hàng không tồn tại');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let addedSubTotal = 0;

      for (const item of sourceOrder.orderItems) {
        addedSubTotal += item.priceAtSale * item.quantity;

        await tx.orderItem.create({
          data: {
            orderId: targetOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            originalPriceAtSale: item.originalPriceAtSale,
            note: item.note,
            optionsTextSnapshot: item.optionsTextSnapshot,
            stationId: item.stationId,
            kitchenStatus: item.kitchenStatus,
            selectedOptions: {
              create: item.selectedOptions.map((so) => ({
                optionItemId: so.optionItemId,
                nameAtSale: so.nameAtSale,
                priceAdjustmentAtSale: so.priceAdjustmentAtSale,
              })),
            },
          },
        });

        await tx.orderItemTransferLog.create({
          data: {
            sourceOrderId: sourceOrder.id,
            targetOrderId: targetOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            actorId: user?.id || null,
            reason: dto.reason || 'Gộp đơn POS',
          },
        });
      }

      // Mark source order as CANCELLED (merged)
      await tx.order.update({
        where: { id: sourceOrder.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: `Đã gộp toàn bộ vào đơn ${targetOrder.orderCode}`,
          canceledBy: user?.fullName || 'Cashier',
          canceledAt: new Date(),
          version: sourceOrder.version + 1,
        },
      });

      // If source order held a table session, close it
      if (sourceOrder.tableSessionId) {
        await tx.tableSession.update({
          where: { id: sourceOrder.tableSessionId },
          data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
        });
      }

      // Update target order totals
      const newTargetSubTotal = targetOrder.subTotal + addedSubTotal;
      const updatedTarget = await tx.order.update({
        where: { id: targetOrder.id },
        data: {
          subTotal: newTargetSubTotal,
          totalAmount: Math.max(0, newTargetSubTotal - (targetOrder.discountAmount || 0)),
          guestCount: targetOrder.guestCount + (sourceOrder.guestCount || 1),
          version: targetOrder.version + 1,
        },
        include: {
          table: true,
          orderItems: { include: { product: true, selectedOptions: true } },
        },
      });

      // Log OrderRelation
      await tx.orderRelation.create({
        data: {
          parentOrderId: sourceOrder.id,
          childOrderId: targetOrder.id,
          type: OrderRelationType.MERGED_INTO,
          metadata: JSON.stringify({ reason: dto.reason }),
        },
      });

      return { sourceOrderId: sourceOrder.id, targetOrder: updatedTarget };
    });

    this.posGateway.emitOrderUpdated(result.targetOrder, user?.id);
    if (sourceOrder.tableId) {
      this.posGateway.emitTableStatusChanged(
        sourceOrder.branchId,
        sourceOrder.tableId,
        'VACANT',
        null,
        null,
        user?.id,
      );
    }

    return result;
  }

  // ==========================================
  // 9. MOVE / TRANSFER TABLE
  // ==========================================

  async moveTable(dto: MoveTableDto, user?: any) {
    const [order, targetTable] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { tableSession: true },
      }),
      this.prisma.restaurantTable.findUnique({
        where: { id: dto.targetTableId },
        include: {
          sessions: { where: { status: TableSessionStatus.ACTIVE } },
        },
      }),
    ]);

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (!targetTable) throw new NotFoundException('Bàn đích không tồn tại');

    if (targetTable.sessions && targetTable.sessions.length > 0) {
      throw new ConflictException('Bàn đích hiện đang có khách. Không thể chuyển sang bàn này!');
    }

    const oldTableId = order.tableId;

    const result = await this.prisma.$transaction(async (tx) => {
      // Close old session
      if (order.tableSessionId) {
        await tx.tableSession.update({
          where: { id: order.tableSessionId },
          data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
        });
      }

      // Create new session for target table
      const newSession = await tx.tableSession.create({
        data: {
          branchId: targetTable.branchId,
          tableId: targetTable.id,
          guestCount: order.guestCount,
          cashierId: user?.id || order.cashierId,
          status: TableSessionStatus.ACTIVE,
        },
      });

      // Update order tableId and tableSessionId
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          tableId: targetTable.id,
          tableSessionId: newSession.id,
          version: order.version + 1,
        },
        include: {
          table: true,
          tableSession: true,
          orderItems: { include: { product: true } },
        },
      });

      return { updatedOrder, newSession };
    });

    if (oldTableId) {
      this.posGateway.emitTableStatusChanged(
        order.branchId,
        oldTableId,
        'VACANT',
        null,
        null,
        user?.id,
      );
    }

    this.posGateway.emitTableStatusChanged(
      targetTable.branchId,
      targetTable.id,
      'OCCUPIED',
      result.newSession,
      result.updatedOrder,
      user?.id,
    );

    this.posGateway.emitOrderUpdated(result.updatedOrder, user?.id);

    return result.updatedOrder;
  }

  // ==========================================
  // 10. PAYMENT PROCESSING & DUAL VOUCHERS
  // ==========================================

  async processPayment(orderId: string, dto: ProcessPaymentDto, user?: any) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: dto.idempotencyKey },
      });
      if (existing) {
        return JSON.parse(existing.response);
      }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tableSession: true,
        orderItems: { include: { product: true } },
        branch: true,
        serviceCharges: true,
      },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // Find active shift for cashier
    let activeShift: any = null;
    if (user?.id) {
      activeShift = await this.prisma.cashShift.findFirst({
        where: {
          branchId: order.branchId,
          cashierId: user.id,
          status: ShiftStatus.OPEN,
        },
      });
    }

    // Process voucher discounts or preserve/update order discount
    let orderDiscount = dto.discountAmount !== undefined
      ? Math.max(0, Number(dto.discountAmount))
      : (Number(order.discountAmount) || 0);
    let discountReason = dto.discountReason !== undefined
      ? (dto.discountReason || null)
      : (order.discountReason || null);
    let discountVoucherCodeSnapshot: string | null = null;
    let voucherId: string | null = null;

    if (dto.discountVoucherCode) {
      const v = await this.prisma.voucher.findUnique({
        where: { code: dto.discountVoucherCode.trim().toUpperCase() },
      });
      if (v && v.isActive && v.startDate <= new Date() && v.endDate >= new Date()) {
        voucherId = v.id;
        discountVoucherCodeSnapshot = v.code;
        if (v.discountType === 'PERCENTAGE') {
          orderDiscount = (order.subTotal * v.discountValue) / 100;
          if (v.maxDiscount) orderDiscount = Math.min(orderDiscount, v.maxDiscount);
        } else {
          orderDiscount = v.discountValue;
        }
      }
    }

    // Points discount based on branch configuration
    let pointsDiscount = 0;
    const pointsUsedInt = dto.pointsUsed ? Math.max(0, Math.floor(dto.pointsUsed)) : 0;
    if (pointsUsedInt > 0 && order.userId) {
      const branch = order.branch;
      if (branch && branch.allowDirectDiscount === false) {
        throw new BadRequestException('Chi nhánh này hiện không áp dụng quy đổi điểm thành giảm giá trực tiếp');
      }
      const customer = await this.prisma.user.findUnique({ where: { id: order.userId } });
      if (!customer || customer.points < pointsUsedInt) {
        throw new BadRequestException(
          `Số điểm của khách không đủ (Hiện có: ${customer?.points || 0} điểm, yêu cầu: ${pointsUsedInt} điểm)`
        );
      }
      const pointRedeemRate = (branch?.pointRedeemRate && branch.pointRedeemRate > 0) ? branch.pointRedeemRate : 1;
      pointsDiscount = Math.round(pointsUsedInt * pointRedeemRate);
    }

    // Single source of truth pricing calculation
    const pricing = await this.orderPricingService.calculatePricing({
      items: order.orderItems.map((oi) => ({
        priceAtSale: oi.priceAtSale,
        quantity: oi.quantity,
        taxPercentage: oi.product?.taxPercentage || 0,
      })),
      orderDiscountAmount: orderDiscount,
      serviceCharges: order.serviceCharges.map((sc) => ({
        name: sc.name,
        amount: sc.amount,
        isTaxable: sc.isTaxable,
        taxPercentage: sc.taxPercentage,
      })),
      pointsDiscount,
    });

    const finalAmount = pricing.totalAmount;

    // Sum all payment methods provided
    const totalPaid = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid < finalAmount) {
      throw new BadRequestException(
        `Số tiền thanh toán (${totalPaid.toLocaleString('vi-VN')}đ) chưa đủ so với tổng cần thanh toán (${finalAmount.toLocaleString('vi-VN')}đ)`,
      );
    }

    // Atomic transaction for payment, shift counters, table release
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create OrderPayment records
      const paymentsCreated: any[] = [];
      let cashTotal = 0;
      let cardTotal = 0;
      let transferTotal = 0;

      for (const p of dto.payments) {
        const payRecord = await tx.orderPayment.create({
          data: {
            orderId: order.id,
            paymentMethod: p.paymentMethod,
            amount: p.amount,
            status: PaymentRecordStatus.COMPLETED,
            transactionRef: p.transactionRef || null,
            cashReceived: p.cashReceived || null,
            cashChange: p.cashChange || null,
            cardType: p.cardType || null,
            cardLast4: p.cardLast4 || null,
            note: p.note || null,
            cashierId: user?.id || null,
            shiftId: activeShift?.id || null,
          },
        });
        paymentsCreated.push(payRecord);

        const methodUpper = p.paymentMethod.toUpperCase();
        if (methodUpper.includes('CASH') || methodUpper === 'TIỀN MẶT') cashTotal += p.amount;
        else if (methodUpper.includes('CARD') || methodUpper === 'THẺ') cardTotal += p.amount;
        else transferTotal += p.amount;
      }

      // 2. Issue official sequential invoice order code if missing or temporary
      let officialOrderCode = order.orderCode;
      let tempCode = order.temporaryOrderCode;

      if (!officialOrderCode || officialOrderCode.startsWith('POS-') || officialOrderCode.startsWith('TMP-')) {
        officialOrderCode = await this.generateOfficialPosOrderCode(order.branchId, tx);
      }
      if (!tempCode) {
        tempCode = order.orderCode || (await this.generateTemporaryOrderCode(tx));
      }

      // 3. Update Order
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          orderCode: officialOrderCode,
          temporaryOrderCode: tempCode,
          status: OrderStatus.COMPLETED,
          paymentStatus: 'PAID',
          totalAmount: finalAmount,
          subTotal: pricing.subTotal,
          serviceChargeTotal: pricing.serviceChargeTotal,
          taxAmount: pricing.taxAmount,
          vatPriceModeSnapshot: pricing.vatPriceMode,
          discountAmount: orderDiscount,
          discountReason: discountReason,
          shippingFee: 0,
          shippingDiscount: 0,
          pointsUsed: dto.pointsUsed || 0,
          voucherId,
          discountVoucherCodeSnapshot,
          isInvoiceRequested: dto.isInvoiceRequested !== undefined ? dto.isInvoiceRequested : (order.isInvoiceRequested || false),
          invoiceCompanyName: dto.invoiceCompanyName ?? order.invoiceCompanyName,
          invoiceTaxCode: dto.invoiceTaxCode ?? order.invoiceTaxCode,
          invoiceAddress: dto.invoiceAddress ?? order.invoiceAddress,
          invoiceEmail: dto.invoiceEmail ?? order.invoiceEmail,
          version: order.version + 1,
        },
        include: {
          table: true,
          payments: true,
          orderItems: { include: { product: true } },
          serviceCharges: true,
        },
      });

      // Cập nhật financial tax snapshot tại thời điểm thanh toán cho từng OrderItem (Rule #13, #14)
      if (pricing.itemTaxDetails && pricing.itemTaxDetails.length > 0) {
        for (let idx = 0; idx < order.orderItems.length; idx++) {
          const oi = order.orderItems[idx];
          const detail = pricing.itemTaxDetails[idx];
          if (detail && oi) {
            await tx.orderItem.update({
              where: { id: oi.id },
              data: {
                taxPercentageAtSale: detail.taxPercentage,
                taxableAmountAtSale: detail.netTaxableAmount,
                taxAmountAtSale: detail.taxAmount,
                vatPriceModeSnapshot: detail.vatPriceMode ?? pricing.vatPriceMode,
                isVatInclusive: detail.isVatInclusive ?? (pricing.vatPriceMode === 'VAT_INCLUDED'),
              },
            });
          }
        }
      }

      // Audit log (Requirement 10)
      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'POS_PAYMENT_COMPLETED',
            target: `Order:${order.id}`,
            oldValue: JSON.stringify({
              orderCode: order.orderCode,
              temporaryOrderCode: order.temporaryOrderCode,
              status: order.status,
              totalAmount: order.totalAmount,
            }),
            newValue: JSON.stringify({
              orderCode: officialOrderCode,
              temporaryOrderCode: tempCode,
              status: 'COMPLETED',
              totalAmount: finalAmount,
              serviceChargeTotal: pricing.serviceChargeTotal,
            }),
          },
        }).catch(() => {});
      }

      // Update user's saved tax info if provided
      if (dto.userId && (dto.invoiceTaxCode || dto.invoiceCompanyName)) {
        await tx.user.update({
          where: { id: dto.userId },
          data: {
            companyName: dto.invoiceCompanyName || undefined,
            taxCode: dto.invoiceTaxCode || undefined,
            taxAddress: dto.invoiceAddress || undefined,
            invoiceEmail: dto.invoiceEmail || undefined,
          },
        }).catch(() => {});
      }

      // 3. Close Table Session
      if (order.tableSessionId) {
        await tx.tableSession.update({
          where: { id: order.tableSessionId },
          data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
        });
      }

      // 4. Update CashShift counters
      if (activeShift) {
        await tx.cashShift.update({
          where: { id: activeShift.id },
          data: {
            totalRevenue: { increment: finalAmount },
            totalCash: { increment: cashTotal },
            totalCard: { increment: cardTotal },
            totalTransfer: { increment: transferTotal },
            orderCount: { increment: 1 },
          },
        });
      }

      // 5. Deduct customer points if used & log PointTransaction
      if (pointsUsedInt > 0 && order.userId) {
        const customer = await tx.user.findUnique({
          where: { id: order.userId },
          include: { membershipTier: true },
        });
        if (customer) {
          const balanceBefore = customer.points;
          const balanceAfter = customer.points - pointsUsedInt;

          await tx.user.update({
            where: { id: order.userId },
            data: {
              points: { decrement: pointsUsedInt },
              currentPoints: { decrement: pointsUsedInt },
            },
          });

          const branch = order.branch;
          const pointRedeemRate = (branch?.pointRedeemRate && branch.pointRedeemRate > 0) ? branch.pointRedeemRate : 1;
          const discountVal = pointsUsedInt * pointRedeemRate;
          const finalCode = officialOrderCode || tempCode || order.orderCode || '';

          await tx.pointTransaction.create({
            data: {
              userId: order.userId,
              membershipTierId: customer.membershipTierId || null,
              membershipTierName: customer.membershipTier?.name || null,
              balanceBefore,
              amount: -pointsUsedInt,
              balanceAfter,
              source: PointTransactionSource.ORDER,
              orderId: order.id,
              orderCode: finalCode,
              referenceCode: finalCode,
              description: `Sử dụng ${pointsUsedInt} điểm thanh toán tại quầy POS giảm ${discountVal.toLocaleString('vi-VN')}đ cho đơn hàng ${finalCode}`,
            },
          });
        }
      }

      // 6. Award loyalty points for POS order if enabled
      if (order.userId && order.branch?.isLoyaltyPosEnabled !== false) {
        const branch = order.branch;
        const earnRate = (branch?.loyaltyEarnRatePos && branch.loyaltyEarnRatePos > 0) ? branch.loyaltyEarnRatePos : 40;
        const customer = await tx.user.findUnique({
          where: { id: order.userId },
          include: { membershipTier: true },
        });

        if (customer) {
          const pointMultiplier = customer.membershipTier?.pointMultiplier || 1.0;
          const pointsEarned = Math.floor((finalAmount / earnRate) * pointMultiplier);

          if (pointsEarned > 0) {
            const balanceBefore = customer.points;
            const balanceAfter = customer.points + pointsEarned;

            await tx.user.update({
              where: { id: order.userId },
              data: {
                points: { increment: pointsEarned },
                currentPoints: { increment: pointsEarned },
                totalSpending: { increment: finalAmount },
              },
            });

            const finalCode = officialOrderCode || tempCode || order.orderCode || '';
            await tx.pointTransaction.create({
              data: {
                userId: order.userId,
                membershipTierId: customer.membershipTierId || null,
                membershipTierName: customer.membershipTier?.name || null,
                balanceBefore,
                amount: pointsEarned,
                balanceAfter,
                source: PointTransactionSource.ORDER,
                orderId: order.id,
                orderCode: finalCode,
                referenceCode: finalCode,
                description: `Tích ${pointsEarned} điểm tại cửa hàng POS cho đơn ${finalCode} (Tỷ lệ: ${earnRate}đ/điểm, Hạng ${customer.membershipTier?.name || 'Thành viên'} x${pointMultiplier})`,
              },
            });

            await tx.order.update({
              where: { id: order.id },
              data: { pointsAwarded: pointsEarned },
            });
          }
        }
      }

      // Cấu hình: Xóa món Buffet khi Thanh toán (Rule XXXV & XXXVII)
      const branchInfo = await tx.branch.findUnique({
        where: { id: order.branchId },
        select: { removeBuffetItemsOnCheckout: true },
      });
      if (branchInfo?.removeBuffetItemsOnCheckout) {
        // Đánh dấu excludedFromFinalReceipt = true cho các món Buffet 0đ (không có phụ thu)
        await tx.orderItem.updateMany({
          where: {
            orderId: order.id,
            pricingMode: OrderItemPricingMode.BUFFET_INCLUDED,
            priceAtSale: 0,
          },
          data: {
            excludedFromFinalReceipt: true,
          },
        });
      }

      // Đóng toàn bộ QrOrderSession và BuffetSession của Order khi thanh toán hoàn tất (Rule XII & V)
      await tx.qrOrderSession.updateMany({
        where: { orderId: order.id, status: QrSessionStatus.ACTIVE },
        data: { status: QrSessionStatus.CLOSED, closedAt: new Date() },
      });
      await tx.buffetSession.updateMany({
        where: { orderId: order.id, status: BuffetSessionStatus.ACTIVE },
        data: { status: BuffetSessionStatus.CLOSED, deactivatedAt: new Date() },
      });

      // Save Idempotency
      if (dto.idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: dto.idempotencyKey,
            action: 'PROCESS_POS_PAYMENT',
            response: JSON.stringify({ order: updatedOrder, payments: paymentsCreated }),
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        });
      }

      return { updatedOrder, paymentsCreated };
    });

    // Emits
    this.posGateway.emitPaymentCompleted(
      result.updatedOrder,
      result.paymentsCreated[0],
      user?.id,
    );
    this.posGateway.emitOrderUpdated(result.updatedOrder, user?.id);

    if (order.tableId) {
      this.posGateway.emitTableStatusChanged(
        order.branchId,
        order.tableId,
        'VACANT',
        null,
        null,
        user?.id,
      );
    }

    if (activeShift) {
      const refreshedShift = await this.prisma.cashShift.findUnique({
        where: { id: activeShift.id },
      });
      this.posGateway.emitShiftUpdated(order.branchId, refreshedShift, user?.id);
    }

    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
    const payment = result.paymentsCreated[0];
    this.notificationEngine.publishEvent({
      eventType: 'PAYMENT_SUCCESS',
      category: 'PAYMENT',
      priority: 1, // NORMAL
      branchId: order.branchId,
      entityId: order.id,
      subId: payment?.id || 'POS',
      title: 'Thanh toán thành công',
      message: `Đơn ${displayCode} đã được thanh toán thành công số tiền ${Number(order.totalAmount || 0).toLocaleString('vi-VN')}₫.`,
      actor: {
        id: user?.id,
        name: user?.fullName || 'Thu ngân',
        avatarUrl: user?.avatarUrl,
      },
      reference: {
        type: 'ORDER',
        id: order.id,
        url: `/admin/orders/${order.id}`,
      },
      metadata: {
        orderId: order.id,
        orderCode: displayCode,
        amount: order.totalAmount,
        paymentMethod: payment?.paymentMethod || 'CASH',
      },
      requiredPermissions: ['orders.view', 'pos.payment.view'],
      appScopes: ['ADMIN', 'POS', 'WAITER'],
      excludeActor: true,
      legacyType: 'ORDER',
    }).catch((err) => this.logger.error('Error publishing PAYMENT_SUCCESS:', err));

    return { ...result.updatedOrder, ...result };
  }

  /**
   * Update ONLY Member VAT Invoice Info (Strict Security: cannot edit name/phone/email)
   */
  async updateMemberTaxInfo(
    userId: string,
    dto: { taxCode?: string; companyName?: string; taxAddress?: string; invoiceEmail?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Khách hàng không tồn tại');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        taxCode: dto.taxCode !== undefined ? (dto.taxCode?.trim() || null) : user.taxCode,
        companyName: dto.companyName !== undefined ? (dto.companyName?.trim() || null) : user.companyName,
        taxAddress: dto.taxAddress !== undefined ? (dto.taxAddress?.trim() || null) : user.taxAddress,
        invoiceEmail: dto.invoiceEmail !== undefined ? (dto.invoiceEmail?.trim() || null) : user.invoiceEmail,
      },
      include: {
        membershipTier: true,
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    });
    return updated;
  }

  // ==========================================
  // SERVICE CHARGES / SURCHARGES (POS)
  // ==========================================

  async addServiceCharge(orderId: string, dto: AddServiceChargeDto, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: { include: { product: true } },
        serviceCharges: true,
      },
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Không thể thêm phụ thu vào đơn hàng đã hoàn tất hoặc đã hủy');
    }

    const createdCharge = await this.prisma.$transaction(async (tx) => {
      const charge = await tx.orderServiceCharge.create({
        data: {
          orderId,
          name: dto.name.trim(),
          amount: Math.max(0, Math.round(dto.amount)),
          note: dto.note?.trim() || null,
          isTaxable: !!dto.isTaxable,
          taxPercentage: dto.taxPercentage || 0,
          createdBy: user?.id || null,
          createdByName: user?.fullName || 'Thu ngân POS',
        },
      });

      const allCharges = await tx.orderServiceCharge.findMany({ where: { orderId } });
      const pricing = await this.orderPricingService.calculatePricing({
        items: order.orderItems.map((oi) => ({
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: oi.product?.taxPercentage || 0,
        })),
        orderDiscountAmount: order.discountAmount || 0,
        serviceCharges: allCharges.map((c) => ({
          name: c.name,
          amount: c.amount,
          isTaxable: c.isTaxable,
          taxPercentage: c.taxPercentage,
        })),
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          serviceChargeTotal: pricing.serviceChargeTotal,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          version: order.version + 1,
        },
        include: {
          table: true,
          tableSession: true,
          orderItems: {
            include: {
              product: true,
              selectedOptions: { include: { optionItem: true } },
            },
          },
          serviceCharges: true,
        },
      });

      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ADD_SERVICE_CHARGE',
            target: `Order:${orderId}`,
            oldValue: JSON.stringify({ serviceChargeTotal: order.serviceChargeTotal, totalAmount: order.totalAmount }),
            newValue: JSON.stringify({ charge, newServiceChargeTotal: pricing.serviceChargeTotal, newTotalAmount: pricing.totalAmount }),
          },
        }).catch(() => {});
      }

      return { charge, updatedOrder };
    });

    this.posGateway.emitOrderUpdated(createdCharge.updatedOrder, user?.id);
    return createdCharge;
  }

  async removeServiceCharge(orderId: string, chargeId: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: { include: { product: true } },
        serviceCharges: true,
      },
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Không thể xóa phụ thu khỏi đơn hàng đã hoàn tất hoặc đã hủy');
    }

    const targetCharge = order.serviceCharges.find((sc) => sc.id === chargeId);
    if (!targetCharge) throw new NotFoundException('Không tìm thấy khoản phụ thu');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.orderServiceCharge.delete({ where: { id: chargeId } });

      const allCharges = await tx.orderServiceCharge.findMany({ where: { orderId } });
      const pricing = await this.orderPricingService.calculatePricing({
        items: order.orderItems.map((oi) => ({
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: oi.product?.taxPercentage || 0,
        })),
        orderDiscountAmount: order.discountAmount || 0,
        serviceCharges: allCharges.map((c) => ({
          name: c.name,
          amount: c.amount,
          isTaxable: c.isTaxable,
          taxPercentage: c.taxPercentage,
        })),
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          serviceChargeTotal: pricing.serviceChargeTotal,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          version: order.version + 1,
        },
        include: {
          table: true,
          tableSession: true,
          orderItems: {
            include: {
              product: true,
              selectedOptions: { include: { optionItem: true } },
            },
          },
          serviceCharges: true,
        },
      });

      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'REMOVE_SERVICE_CHARGE',
            target: `Order:${orderId}`,
            oldValue: JSON.stringify({ removedCharge: targetCharge }),
            newValue: JSON.stringify({ newServiceChargeTotal: pricing.serviceChargeTotal, newTotalAmount: pricing.totalAmount }),
          },
        }).catch(() => {});
      }

      return updatedOrder;
    });

    this.posGateway.emitOrderUpdated(result, user?.id);
    return result;
  }

  async getServiceCharges(orderId: string) {
    return this.prisma.orderServiceCharge.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==========================================
  // 11. KITCHEN KDS TICKETS & STATUS UPDATE
  // ==========================================

  async getKitchenTickets(branchId: string, stationId?: string) {
    const whereItem: any = {
      kitchenStatus: {
        in: [KitchenStatus.SENT, KitchenStatus.ACKNOWLEDGED, KitchenStatus.PREPARING],
      },
    };
    if (stationId && stationId !== 'ALL') {
      whereItem.stationId = stationId;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
        orderItems: { some: whereItem },
      },
      include: {
        table: true,
        orderItems: {
          where: whereItem,
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
      orderBy: { sentToKitchenAt: 'asc' },
    });

    return orders.map((o) => {
      const elapsedSeconds = o.sentToKitchenAt
        ? Math.floor((Date.now() - new Date(o.sentToKitchenAt).getTime()) / 1000)
        : 0;

      return {
        id: o.id,
        orderCode: o.orderCode,
        tableName: o.table?.name || 'Mang về',
        guestCount: o.guestCount,
        note: o.note,
        sentToKitchenAt: o.sentToKitchenAt,
        elapsedSeconds,
        items: o.orderItems.map((it) => ({
          id: it.id,
          productId: it.productId,
          name: it.product.name,
          quantity: it.quantity,
          note: it.note,
          optionsText: it.optionsTextSnapshot,
          stationId: it.stationId,
          kitchenStatus: it.kitchenStatus,
          sentToKitchenAt: it.sentToKitchenAt,
          acknowledgedAt: it.acknowledgedAt,
          readyAt: it.readyAt,
        })),
      };
    });
  }

  async updateKitchenItemStatus(itemId: string, status: KitchenStatus, user?: any) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        order: {
          include: { table: true },
        },
        product: true,
      },
    });
    if (!item) throw new NotFoundException('Món bếp không tồn tại');

    const now = new Date();
    const dataToUpdate: any = { kitchenStatus: status };
    if (status === KitchenStatus.ACKNOWLEDGED) dataToUpdate.acknowledgedAt = now;
    if (status === KitchenStatus.READY) dataToUpdate.readyAt = now;
    if (status === KitchenStatus.SERVED) dataToUpdate.servedAt = now;

    const updatedItem = await this.prisma.$transaction(async (tx) => {
      const it = await tx.orderItem.update({
        where: { id: itemId },
        data: dataToUpdate,
        include: { product: true },
      });

      // Check all items in order
      const allItems = await tx.orderItem.findMany({
        where: { orderId: item.orderId },
      });

      const allReady = allItems.every((i) => i.kitchenStatus === KitchenStatus.READY || i.kitchenStatus === KitchenStatus.SERVED || i.kitchenStatus === KitchenStatus.CANCELLED);
      const allServed = allItems.every((i) => i.kitchenStatus === KitchenStatus.SERVED || i.kitchenStatus === KitchenStatus.CANCELLED);

      if (allServed) {
        await tx.order.update({
          where: { id: item.orderId },
          data: { kitchenStatus: KitchenStatus.SERVED, servedAt: now },
        });
      } else if (allReady) {
        await tx.order.update({
          where: { id: item.orderId },
          data: { kitchenStatus: KitchenStatus.READY, kitchenReadyAt: now },
        });
      }

      return it;
    });

    this.posGateway.emitKitchenItemUpdated(item.order.branchId, updatedItem, user?.id);

    if (status === KitchenStatus.READY) {
      const tableName = item.order?.table?.name || item.order?.table?.tableCode || 'mang về';
      const itemName = (updatedItem as any)?.product?.name || item.product?.name || 'Món ăn';
      this.notificationEngine.publishEvent({
        eventType: 'KITCHEN_ITEM_READY',
        category: 'KITCHEN',
        priority: 2, // HIGH
        branchId: item.order.branchId,
        entityId: item.orderId,
        subId: item.id,
        title: 'Món đã sẵn sàng',
        message: `Bàn ${tableName}: Món "${itemName}" đã hoàn tất chế biến.`,
        actor: {
          id: user?.id,
          name: user?.fullName || 'Bếp chi nhánh',
          avatarUrl: user?.avatarUrl,
        },
        reference: {
          type: 'ORDER',
          id: item.orderId,
          url: `/admin/pos?orderId=${item.orderId}`,
        },
        metadata: {
          orderId: item.orderId,
          itemId: item.id,
          tableName,
          productName: itemName,
          quantity: item.quantity,
        },
        requiredPermissions: ['waiter.access', 'pos.order.view'],
        appScopes: ['WAITER', 'POS'],
        legacyType: 'KITCHEN' as any,
      }).catch((err) => this.logger.error('Error publishing KITCHEN_ITEM_READY:', err));
    }

    return updatedItem;
  }

  // ==========================================
  // 12. CASH SHIFT MANAGEMENT
  // ==========================================

  async openShift(branchId: string, dto: OpenShiftDto, user: any) {
    if (!user?.id) throw new BadRequestException('User identification missing');

    const existingOpen = await this.prisma.cashShift.findFirst({
      where: {
        branchId,
        cashierId: user.id,
        status: ShiftStatus.OPEN,
      },
    });

    if (existingOpen) {
      return existingOpen;
    }

    const shift = await this.prisma.cashShift.create({
      data: {
        branchId,
        cashierId: user.id,
        openedById: user.id,
        openingBalance: dto.openingBalance,
        note: dto.note || null,
        status: ShiftStatus.OPEN,
      },
      include: {
        cashier: { select: { id: true, fullName: true, email: true } },
      },
    });

    this.posGateway.emitShiftUpdated(branchId, shift, user.id);
    return shift;
  }

  async closeShift(shiftId: string, dto: CloseShiftDto, user: any) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      include: { payments: true },
    });
    if (!shift) throw new NotFoundException('Ca thu ngân không tồn tại');

    const expectedBalance = shift.openingBalance + shift.totalCash;
    const cashDifference = dto.closingBalance - expectedBalance;

    const closedShift = await this.prisma.cashShift.update({
      where: { id: shiftId },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        closedById: user.id,
        closingBalance: dto.closingBalance,
        expectedBalance,
        cashDifference,
        note: dto.note ? `${shift.note || ''} [Kết ca: ${dto.note}]`.trim() : shift.note,
      },
      include: {
        cashier: { select: { id: true, fullName: true } },
        closedBy: { select: { id: true, fullName: true } },
      },
    });

    this.posGateway.emitShiftUpdated(shift.branchId, closedShift, user.id);
    return closedShift;
  }

  async getCurrentShift(branchId: string, cashierId: string) {
    return this.prisma.cashShift.findFirst({
      where: {
        branchId,
        cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  // ==========================================
  // 13. SNAPSHOT RECONNECT & RESYNC API
  // ==========================================

  async getSnapshot(branchId: string) {
    const [tablesData, activeOrders, currentShifts] = await Promise.all([
      this.getTables(branchId),
      this.prisma.order.findMany({
        where: {
          branchId,
          status: {
            in: [
              OrderStatus.DRAFT,
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.DELIVERING,
              OrderStatus.HELD,
            ],
          },
        },
        include: {
          table: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              membershipTier: true,
              points: true,
              memberCode: true,
            },
          },
          orderItems: {
            include: {
              product: true,
              selectedOptions: { include: { optionItem: true } },
            },
          },
          serviceCharges: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.cashShift.findMany({
        where: { branchId, status: ShiftStatus.OPEN },
        include: { cashier: { select: { id: true, fullName: true } } },
      }),
    ]);

    return {
      branchId,
      serverTime: new Date().toISOString(),
      tables: tablesData.tables,
      areas: tablesData.areas,
      activeOrders,
      currentShifts,
      vatPriceMode: await this.orderPricingService.getGlobalVatPriceMode(),
    };
  }

  async getInvoices(branchId: string, query?: any) {
    const where: any = { branchId };

    // Default status: COMPLETED and CANCELLED only!
    if (query?.status === 'COMPLETED') {
      where.status = OrderStatus.COMPLETED;
    } else if (query?.status === 'CANCELLED') {
      where.status = OrderStatus.CANCELLED;
    } else {
      where.status = { in: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] };
    }

    // Filter by order source / type
    if (query?.orderType && query.orderType !== 'ALL') {
      if (query.orderType === 'DINE_IN') {
        where.orderType = SlotOrderType.DINE_IN;
      } else if (query.orderType === 'TAKEAWAY') {
        where.orderType = SlotOrderType.TAKEAWAY;
      } else if (query.orderType === 'DELIVERY') {
        where.orderType = SlotOrderType.DELIVERY;
      } else if (query.orderType === 'QR_ORDER') {
        where.orderSource = OrderSource.QR_ORDER;
      }
    }

    // Filter by payment method
    if (query?.paymentMethod && query.paymentMethod !== 'ALL') {
      where.paymentMethod = query.paymentMethod;
    }

    // Filter by VAT invoice status
    if (query?.invoiceStatus && query.invoiceStatus !== 'ALL') {
      if (query.invoiceStatus === 'ISSUED') {
        where.isInvoiceExported = true;
      } else if (query.invoiceStatus === 'NOT_ISSUED') {
        where.isInvoiceExported = false;
      } else if (query.invoiceStatus === 'COMPANY_REQUESTED' || query.invoiceStatus === 'REQUESTED') {
        where.isInvoiceRequested = true;
        where.isInvoiceExported = false;
      }
    }

    // Filter by Cashier / Waiter
    if (query?.cashierId && query.cashierId !== 'ALL') {
      where.cashierId = query.cashierId;
    }
    if (query?.createdById && query.createdById !== 'ALL') {
      where.userId = query.createdById;
    }

    // Filter by Amount range
    if (query?.minAmount !== undefined && query.minAmount !== '') {
      where.totalAmount = { ...(where.totalAmount || {}), gte: parseFloat(query.minAmount) };
    }
    if (query?.maxAmount !== undefined && query.maxAmount !== '') {
      where.totalAmount = { ...(where.totalAmount || {}), lte: parseFloat(query.maxAmount) };
    }

    // Filter by date range
    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    // Search query
    if (query?.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { orderCode: { contains: q, mode: 'insensitive' } },
        { temporaryOrderCode: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { table: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const take = query?.limit ? parseInt(query.limit, 10) : 300;

    const invoices = await this.prisma.order.findMany({
      where,
      take,
      include: {
        table: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            membershipTier: true,
          },
        },
        orderItems: {
          include: {
            product: true,
            selectedOptions: {
              include: { optionItem: true },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices;
  }

  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        tableSession: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            membershipTier: true,
            points: true,
            memberCode: true,
          },
        },
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Đơn hàng không tồn tại');
    }
    return order;
  }

  // ==========================================
  // 14. CANCEL ORDER (WITH MANDATORY REASON)
  // ==========================================
  async cancelOrder(orderId: string, reason: string, cashierId?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Lý do hủy đơn không được để trống');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        orderItems: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng cần hủy');
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Đơn hàng đã thanh toán hoàn tất, không thể hủy. Vui lòng sử dụng chức năng hoàn tiền.',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng này đã được hủy trước đó.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update order status to CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason.trim(),
          canceledAt: new Date(),
          canceledBy: cashierId || 'POS_STAFF',
          version: order.version + 1,
        },
        include: {
          table: true,
          orderItems: { include: { product: true } },
        },
      });

      // 2. Mark all order items as CANCELLED
      await tx.orderItem.updateMany({
        where: { orderId },
        data: { kitchenStatus: KitchenStatus.CANCELLED },
      });

      // 2.1 Dispatch CANCEL_ITEM tickets strictly to stations/printers that received the items
      await this.printRoutingService.dispatchCancelOrderItems(tx, {
        orderId,
        branchId: order.branchId,
        items: order.orderItems.map((i) => ({
          id: i.id,
          name: i.product?.name || 'Món ăn',
          quantity: i.quantity,
          note: i.note || undefined,
        })),
        reason: reason.trim(),
        canceledById: cashierId,
      });

      // 3. Release table session if no other active order exists on this table
      let tableReleased = false;
      if (order.tableId) {
        const otherActiveOrders = await tx.order.count({
          where: {
            tableId: order.tableId,
            id: { not: orderId },
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.HELD,
                OrderStatus.DRAFT,
              ],
            },
          },
        });

        if (otherActiveOrders === 0) {
          tableReleased = true;
          if (order.tableSessionId) {
            await tx.tableSession.update({
              where: { id: order.tableSessionId },
              data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
            });
          }
        }
      }

      // 4. Audit Log
      if (cashierId) {
        await tx.auditLog
          .create({
            data: {
              userId: cashierId,
              action: 'CANCEL_ORDER',
              target: `Order:${orderId}`,
              oldValue: JSON.stringify({ status: order.status, totalAmount: order.totalAmount }),
              newValue: JSON.stringify({
                status: OrderStatus.CANCELLED,
                reason: reason.trim(),
                tableReleased,
              }),
            },
          })
          .catch(() => {});
      }

      return { updatedOrder, tableReleased };
    });

    // Realtime Broadcasts
    this.posGateway.emitOrderUpdated(result.updatedOrder, cashierId);
    if (result.tableReleased && order.tableId) {
      this.posGateway.emitTableStatusChanged(
        order.branchId,
        order.tableId,
        'VACANT',
        null,
        null,
        cashierId,
      );
    }

    return result.updatedOrder;
  }

  /**
   * Cập nhật trạng thái đơn hàng trực tiếp từ POS (Xác nhận đơn, Chuẩn bị, Giao hàng, Hoàn thành)
   */
  async updateOrderStatusFromPos(orderId: string, newStatus: OrderStatus, cashierId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        orderItems: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // Chống gian lận & thất thoát: Đơn SePay đã thanh toán tự động không được phép hủy hoặc hạ trạng thái thủ công
    if (
      order.paymentMethod === 'SEPAY' &&
      order.paymentStatus === 'PAID' &&
      (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.PENDING)
    ) {
      throw new ForbiddenException(
        'Đơn hàng này đã được hệ thống SePay tự động đối soát tiền về tài khoản ngân hàng. Nghiêm cấm nhân viên can thiệp thủ công hủy hoặc hạ trạng thái!',
      );
    }

    const updateData: any = {
      status: newStatus,
      version: order.version + 1,
    };

    const now = new Date();
    if (newStatus === OrderStatus.CONFIRMED && !order.confirmedAt) {
      updateData.confirmedAt = now;
    } else if (newStatus === OrderStatus.DELIVERING && !order.deliveringAt) {
      updateData.deliveringAt = now;
    } else if (newStatus === OrderStatus.COMPLETED) {
      if (!order.deliveredAt) updateData.deliveredAt = now;
      if (order.paymentStatus !== 'PAID') {
        updateData.paymentStatus = 'PAID';
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        table: true,
        user: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    // Realtime broadcast to all POS terminals
    this.posGateway.emitOrderUpdated(updated, cashierId);

    return updated;
  }

  /**
   * Cập nhật phí vận chuyển & thông tin thuế VAT từ POS
   */
  async updateOrderFeesFromPos(
    orderId: string,
    dto: {
      shippingFee?: number;
      taxCode?: string;
      companyName?: string;
      taxAddress?: string;
      invoiceEmail?: string;
      isInvoiceRequested?: boolean;
    },
    cashierId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // TUYỆT ĐỐI KHÔNG cho phép sửa phí vận chuyển của đơn hàng ONLINE
    if ((order.orderSource === OrderSource.ONLINE || (order.orderSource as string) === 'ONLINE') && dto.shippingFee !== undefined && dto.shippingFee !== order.shippingFee) {
      throw new ForbiddenException(
        'TUYỆT ĐỐI KHÔNG cho phép chỉnh sửa phí giao hàng đối với đơn hàng ONLINE sau khi khách đã đặt đơn.',
      );
    }

    // Không cho phép sửa tiền của đơn SePay đã thanh toán tự động
    if (
      order.paymentMethod === 'SEPAY' &&
      order.paymentStatus === 'PAID' &&
      dto.shippingFee !== undefined &&
      dto.shippingFee !== order.shippingFee
    ) {
      throw new ForbiddenException(
        'Đơn hàng đã được SePay tự động đối soát tiền về tài khoản. Không được phép chỉnh sửa phí vận chuyển làm sai lệch doanh thu.',
      );
    }

    // Đơn Online giữ nguyên shippingFee; đơn POS không có shippingFee (luôn = 0)
    const newShippingFee = (order.orderSource === OrderSource.ONLINE || (order.orderSource as string) === 'ONLINE')
      ? order.shippingFee
      : 0;
    const newTotal = Math.max(0, order.subTotal - order.discountAmount + newShippingFee - order.shippingDiscount + (order.serviceChargeTotal || 0) + (order.vatPriceModeSnapshot === 'VAT_EXCLUDED' ? (order.taxAmount || 0) : 0));

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shippingFee: newShippingFee,
        totalAmount: newTotal,
        invoiceTaxCode: dto.taxCode !== undefined ? dto.taxCode : order.invoiceTaxCode,
        invoiceCompanyName: dto.companyName !== undefined ? dto.companyName : order.invoiceCompanyName,
        invoiceAddress: dto.taxAddress !== undefined ? dto.taxAddress : order.invoiceAddress,
        invoiceEmail: dto.invoiceEmail !== undefined ? dto.invoiceEmail : order.invoiceEmail,
        isInvoiceRequested: dto.isInvoiceRequested !== undefined ? Boolean(dto.isInvoiceRequested) : order.isInvoiceRequested,
        version: order.version + 1,
      },
      include: {
        table: true,
        user: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
      },
    });

    this.posGateway.emitOrderUpdated(updated, cashierId);

    return updated;
  }

  /**
   * Cập nhật thông tin xuất hóa đơn VAT công ty cho đơn hàng
   * Hỗ trợ cả POS và Waiter (thông tin được lưu bền vững vào DB và đồng bộ thời gian thực)
   */
  async updateOrderInvoiceInfo(
    orderId: string,
    dto: {
      isInvoiceRequested?: boolean;
      invoiceTaxCode?: string;
      invoiceCompanyName?: string;
      invoiceAddress?: string;
      invoiceEmail?: string;
      isInvoiceExported?: boolean;
    },
    cashierId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const updateData: any = {
      version: order.version + 1,
    };

    if (dto.isInvoiceRequested !== undefined) {
      updateData.isInvoiceRequested = Boolean(dto.isInvoiceRequested);
      updateData.invoiceTaxCode = dto.isInvoiceRequested ? (dto.invoiceTaxCode || '').trim() || null : null;
      updateData.invoiceCompanyName = dto.isInvoiceRequested ? (dto.invoiceCompanyName || '').trim() || null : null;
      updateData.invoiceAddress = dto.isInvoiceRequested ? (dto.invoiceAddress || '').trim() || null : null;
      updateData.invoiceEmail = dto.isInvoiceRequested ? (dto.invoiceEmail || '').trim() || null : null;
    } else {
      if (dto.invoiceTaxCode !== undefined) updateData.invoiceTaxCode = (dto.invoiceTaxCode || '').trim() || null;
      if (dto.invoiceCompanyName !== undefined) updateData.invoiceCompanyName = (dto.invoiceCompanyName || '').trim() || null;
      if (dto.invoiceAddress !== undefined) updateData.invoiceAddress = (dto.invoiceAddress || '').trim() || null;
      if (dto.invoiceEmail !== undefined) updateData.invoiceEmail = (dto.invoiceEmail || '').trim() || null;
    }

    if (dto.isInvoiceExported !== undefined) {
      updateData.isInvoiceExported = Boolean(dto.isInvoiceExported);
      updateData.invoiceExportedAt = dto.isInvoiceExported ? new Date() : null;
      updateData.invoiceExportedBy = dto.isInvoiceExported ? cashierId || null : null;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        table: true,
        user: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
        serviceCharges: true,
      },
    });

    this.posGateway.emitOrderUpdated(updated, cashierId);

    return updated;
  }

  // ==========================================
  // 15. MEMBER LOYALTY SEARCH
  // ==========================================
  async searchMembers(query: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    const q = query.trim();
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { phone: { contains: q } },
          { memberCode: { contains: q } },
          { fullName: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        memberCode: true,
        points: true,
        currentPoints: true,
        totalSpending: true,
        companyName: true,
        taxCode: true,
        taxAddress: true,
        invoiceEmail: true,
        membershipTier: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
            pointMultiplier: true,
          },
        },
        addresses: {
          select: {
            id: true,
            recipientName: true,
            phone: true,
            streetDetail: true,
            ward: true,
            province: true,
            isDefault: true,
          },
          orderBy: { isDefault: 'desc' },
        },
      },
      take: 10,
    });
    return users;
  }

  /**
   * Quick Create New Customer from POS
   */
  async createMember(dto: CreateMemberDto) {
    const phone = dto.phone.trim();
    if (!phone) {
      throw new BadRequestException('Số điện thoại không được để trống');
    }

    const existing = await this.prisma.user.findFirst({
      where: { phone },
      include: {
        membershipTier: true,
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    });

    if (existing) {
      // Update invoice / customer info if provided
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: dto.fullName?.trim() || existing.fullName,
          email: dto.email?.trim() || existing.email,
          companyName: dto.companyName || existing.companyName,
          taxCode: dto.taxCode || existing.taxCode,
          taxAddress: dto.taxAddress || existing.taxAddress,
          invoiceEmail: dto.invoiceEmail || existing.invoiceEmail,
        },
        include: {
          membershipTier: true,
          addresses: { orderBy: { isDefault: 'desc' } },
        },
      });
      return updated;
    }

    // Generate unique memberCode
    const memberCode = `AVR${Math.floor(100000 + Math.random() * 900000)}`;
    const cleanPhone = phone.replace(/\D/g, '');
    const userEmail = dto.email?.trim() || `${cleanPhone || Date.now()}@pos.avora.vn`;

    const newUser = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        phone,
        email: userEmail,
        memberCode,
        role: RoleType.USER,
        companyName: dto.companyName || null,
        taxCode: dto.taxCode || null,
        taxAddress: dto.taxAddress || null,
        invoiceEmail: dto.invoiceEmail || null,
        addresses: dto.address
          ? {
              create: {
                recipientName: dto.fullName.trim(),
                phone,
                streetDetail: dto.address.trim(),
                ward: '',
                province: 'Việt Nam',
                isDefault: true,
              },
            }
          : undefined,
      },
      include: {
        membershipTier: true,
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    });

    return newUser;
  }

  /**
   * Lookup Company Tax Info with Automatic Address Normalization
   */
  async lookupTax(mst: string) {
    if (!mst || mst.trim().length < 4) {
      throw new BadRequestException('Mã số thuế không hợp lệ');
    }
    const cleanMst = mst.trim();
    try {
      const res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(cleanMst)}`);
      const json = await res.json();
      if (json.code === '00' && json.data?.name) {
        let address = (json.data.address || '').trim();
        // Automatic address normalization: TP -> Thành phố, Q. -> Quận, H. -> Huyện, etc.
        address = address.replace(/\b(T\.?P\.?|TP)\.?\s*(?=[A-ZÀ-Ỹ])/g, 'Thành phố ');
        address = address.replace(/\bQ\.\s*/g, 'Quận ');
        address = address.replace(/\bQ\s+(?=\d+\b)/g, 'Quận ');
        address = address.replace(/\bP\.\s*/g, 'Phường ');
        address = address.replace(/\bP\s+(?=\d+\b)/g, 'Phường ');
        address = address.replace(/\bH\.\s*/g, 'Huyện ');
        address = address.replace(/\b(T\.?X\.?|TX)\.?\s*(?=[A-ZÀ-Ỹ])/g, 'Thị xã ');
        address = address.replace(/\b(T\.?T\.?|TT)\.?\s*(?=[A-ZÀ-Ỹ])/g, 'Thị trấn ');
        address = address.replace(/\bThành phố\s*HCM\b/gi, 'Thành phố Hồ Chí Minh');
        address = address.replace(/\bThành phố\s*HN\b/gi, 'Thành phố Hà Nội');
        address = address.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').trim();
        if (!/,\s*Việt\s*Nam$/i.test(address) && !/\bViệt\s*Nam$/i.test(address)) {
          address = address.replace(/[,.]+$/, '').trim() + ', Việt Nam';
        }

        return {
          success: true,
          data: {
            taxCode: cleanMst,
            companyName: json.data.name,
            address,
          },
        };
      }
      return {
        success: false,
        message: json.desc || 'Không tìm thấy thông tin công ty từ mã số thuế này',
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Lỗi khi tra cứu mã số thuế: ' + (err.message || 'Không thể kết nối'),
      };
    }
  }

  // ==========================================
  // 16. POS VOUCHERS & VALIDATION
  // ==========================================
  async getPosVouchers(branchId?: string, subTotal?: number) {
    const now = new Date();
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        applicableScope: { in: ['ALL', 'POS'] },
        ...(branchId
          ? {
              OR: [
                { branches: { none: {} } },
                { branches: { some: { id: branchId } } },
              ],
            }
          : {}),
      },
      orderBy: { discountValue: 'desc' },
      take: 30,
    });

    return vouchers.map((v) => {
      let isApplicable = true;
      let reasonNotApplicable = '';
      if (subTotal !== undefined && subTotal < v.minOrderValue) {
        isApplicable = false;
        reasonNotApplicable = `Đơn tối thiểu ${v.minOrderValue.toLocaleString('vi-VN')}đ`;
      }
      if (v.usageLimit && v.usedCount >= v.usageLimit) {
        isApplicable = false;
        reasonNotApplicable = 'Voucher đã hết lượt sử dụng';
      }

      return {
        ...v,
        isApplicable,
        reasonNotApplicable,
      };
    });
  }

  async validateVoucher(code: string, subTotal: number, userId?: string, branchId?: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Mã voucher không được để trống');
    }

    const now = new Date();
    const v = await this.prisma.voucher.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { branches: true },
    });

    if (!v || !v.isActive) {
      throw new BadRequestException('Mã giảm giá không tồn tại hoặc đã ngừng hoạt động');
    }

    if (v.startDate > now) {
      throw new BadRequestException('Mã giảm giá chưa đến đợt áp dụng');
    }

    if (v.endDate < now) {
      throw new BadRequestException('Mã giảm giá đã hết hạn sử dụng');
    }

    if (v.applicableScope !== 'ALL' && v.applicableScope !== 'POS') {
      throw new BadRequestException('Mã giảm giá này chỉ áp dụng cho đơn hàng Online');
    }

    if (branchId && v.branches && v.branches.length > 0) {
      const matchBranch = v.branches.some((b) => b.id === branchId);
      if (!matchBranch) {
        throw new BadRequestException('Mã giảm giá không áp dụng cho chi nhánh này');
      }
    }

    if (subTotal < v.minOrderValue) {
      throw new BadRequestException(
        `Đơn hàng chưa đạt giá trị tối thiểu ${v.minOrderValue.toLocaleString('vi-VN')}đ để sử dụng mã này`,
      );
    }

    if (v.usageLimit && v.usedCount >= v.usageLimit) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng toàn hệ thống');
    }

    let calculatedDiscount = 0;
    if (v.discountType === 'PERCENTAGE') {
      calculatedDiscount = (subTotal * v.discountValue) / 100;
      if (v.maxDiscount) {
        calculatedDiscount = Math.min(calculatedDiscount, v.maxDiscount);
      }
    } else {
      calculatedDiscount = Math.min(subTotal, v.discountValue);
    }

    return {
      voucher: {
        id: v.id,
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscount: v.maxDiscount,
        minOrderValue: v.minOrderValue,
      },
      calculatedDiscount: Math.round(calculatedDiscount),
      subTotalAfterDiscount: Math.max(0, Math.round(subTotal - calculatedDiscount)),
    };
  }

  // ==========================================
  // 17. REAL RESERVATIONS & CALENDAR VIEW
  // ==========================================
  async getReservations(branchId?: string, date?: string, status?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        0,
        0,
        0,
      );
      const endOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23,
        59,
        59,
      );
      where.reservationDate = { gte: startOfDay, lte: endOfDay };
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const reservations = await this.prisma.reservation.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        tables: {
          include: {
            table: true,
          },
        },
      },
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
      take: 100,
    });

    return reservations.map((r) => ({
      id: r.id,
      reservationCode: r.reservationCode || `RSV-${r.id.substring(0, 6).toUpperCase()}`,
      customerName: r.customerName || r.user?.fullName || 'Khách đặt trước',
      customerPhone: r.customerPhone || r.user?.phone || '',
      customerEmail: r.customerEmail || r.user?.email || '',
      partySize: r.partySize,
      reservationDate: r.reservationDate,
      reservationTime: r.reservationTime,
      status: r.status,
      tablePreference: r.tablePreference,
      specialRequests: r.specialRequests,
      internalNote: r.internalNote,
      source: r.source,
      checkedInAt: r.checkedInAt,
      seatedAt: r.seatedAt,
      branchName: r.branch.name,
      assignedTables: r.tables.map((t) => ({
        id: t.table.id,
        name: t.table.name,
        code: t.table.tableCode,
      })),
    }));
  }

  async checkInReservation(reservationId: string, tableId?: string, cashierId?: string) {
    const resv = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { tables: { include: { table: true } } },
    });
    if (!resv) throw new NotFoundException('Không tìm thấy thông tin đặt bàn');

    const assignedTableId = tableId || resv.tables[0]?.tableId;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update reservation status
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CHECKED_IN,
          checkedInAt: new Date(),
          seatedAt: new Date(),
        },
      });

      // 2. If table assigned, create table session
      let session: any = null;
      if (assignedTableId) {
        session = await tx.tableSession.create({
          data: {
            tableId: assignedTableId,
            branchId: resv.branchId,
            guestCount: resv.partySize,
            cashierId,
            status: TableSessionStatus.ACTIVE,
          },
        });
      }

      return { updated, session, assignedTableId };
    });

    if (result.assignedTableId) {
      this.posGateway.emitTableStatusChanged(
        resv.branchId,
        result.assignedTableId,
        'OCCUPIED',
        result.session,
        null,
        cashierId,
      );
    }

    return result;
  }

  // ==========================================
  // 18. POS PAYMENT METHODS FROM DB
  // ==========================================
  async getPosPaymentMethods() {
    return this.prisma.paymentMethod.findMany({
      where: { isActiveForPos: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // ==========================================
  // 19. BRANCH PRINT SETTINGS (PERSISTENCE & RETRIEVAL)
  // ==========================================
  async getBranchPrintSettings(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        branchCode: true,
        autoPrintReceipt: true,
        autoPrintTempBill: true,
        splitKitchenTickets: true,
        printCancelTicket: true,
        receiptCopies: true,
        kitchenCopies: true,
        defaultPaperSize: true,
        defaultReceiptPrinterId: true,
        excludeBuffetItemsFromTempBill: true,
        removeBuffetItemsOnCheckout: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }

    const settings = await this.prisma.branchPrinterSetting.findMany({
      where: { branchId },
      include: { printer: true },
      orderBy: { purpose: 'asc' },
    });

    return {
      branch,
      settings,
    };
  }

  async updateBranchPrintSettings(branchId: string, data: any) {
    // 1. Update Branch fields
    const updatedBranch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        splitKitchenTickets: data.splitKitchenTickets !== undefined ? Boolean(data.splitKitchenTickets) : undefined,
        printCancelTicket: data.printCancelTicket !== undefined ? Boolean(data.printCancelTicket) : undefined,
        autoPrintReceipt: data.autoPrintReceipt !== undefined ? Boolean(data.autoPrintReceipt) : undefined,
        autoPrintTempBill: data.autoPrintTempBill !== undefined ? Boolean(data.autoPrintTempBill) : undefined,
        excludeBuffetItemsFromTempBill: data.excludeBuffetItemsFromTempBill !== undefined ? Boolean(data.excludeBuffetItemsFromTempBill) : undefined,
        removeBuffetItemsOnCheckout: data.removeBuffetItemsOnCheckout !== undefined ? Boolean(data.removeBuffetItemsOnCheckout) : undefined,
        receiptCopies: data.receiptCopies ? Math.max(1, Math.min(5, parseInt(data.receiptCopies, 10))) : undefined,
        kitchenCopies: data.kitchenCopies ? Math.max(1, Math.min(5, parseInt(data.kitchenCopies, 10))) : undefined,
        defaultPaperSize: data.defaultPaperSize || undefined,
        defaultReceiptPrinterId: data.defaultReceiptPrinterId !== undefined ? (data.defaultReceiptPrinterId ? String(data.defaultReceiptPrinterId) : null) : undefined,
      },
    });

    // 2. Upsert BranchPrinterSetting records if provided
    const items = Array.isArray(data.settings)
      ? data.settings
      : Array.isArray(data.printers)
      ? data.printers
      : [];

    const upsertedSettings: any[] = [];
    for (const item of items) {
      if (!item.purpose) continue;
      const validCopies = Math.max(1, Math.min(5, parseInt(item.copies, 10) || 1));
      const res = await this.prisma.branchPrinterSetting.upsert({
        where: {
          branchId_purpose: { branchId, purpose: item.purpose },
        },
        update: {
          printerName: item.printerName || '',
          paperSize: item.paperSize || '80mm',
          copies: validCopies,
          isEnabled: item.isEnabled !== undefined ? Boolean(item.isEnabled) : true,
          autoPrint: item.autoPrint !== undefined ? Boolean(item.autoPrint) : false,
          driverName: item.driverName || null,
          portName: item.portName || null,
          agentPrinterId: item.agentPrinterId || null,
          printerId: item.printerId || null,
          lastSeenAt: new Date(),
        },
        create: {
          branchId,
          purpose: item.purpose,
          printerName: item.printerName || '',
          paperSize: item.paperSize || '80mm',
          copies: validCopies,
          isEnabled: item.isEnabled !== undefined ? Boolean(item.isEnabled) : true,
          autoPrint: item.autoPrint !== undefined ? Boolean(item.autoPrint) : false,
          driverName: item.driverName || null,
          portName: item.portName || null,
          agentPrinterId: item.agentPrinterId || null,
          printerId: item.printerId || null,
          lastSeenAt: new Date(),
        },
      });
      upsertedSettings.push(res);
    }

    return {
      branch: updatedBranch,
      settings: upsertedSettings,
    };
  }

  private buildKitchenTicketHtml(data: any): string {
    const isCancel = data.eventType === 'CANCEL_ITEM';
    const isReprint = data.eventType === 'REPRINT';
    const rawTableName = data.tableName || (data.orderTypeStr === 'TAKEAWAY' ? 'Mang đi / Mang về' : 'Đơn hàng');
    // Bỏ ngoặc vuông nếu rawTableName đã có sẵn ngoặc
    const cleanTableName = String(rawTableName).replace(/^\[+|\]+$/g, '').trim();
    const staffName = data.staffName || data.sender || 'Nhân viên';
    const sentDate = data.sentAt ? new Date(data.sentAt) : new Date();
    const formattedHours = String(sentDate.getHours()).padStart(2, '0');
    const formattedMinutes = String(sentDate.getMinutes()).padStart(2, '0');
    const formattedDay = String(sentDate.getDate()).padStart(2, '0');
    const formattedMonth = String(sentDate.getMonth() + 1).padStart(2, '0');
    const formattedYear = sentDate.getFullYear();
    const formattedTime = `${formattedHours}:${formattedMinutes} ${formattedDay}/${formattedMonth}/${formattedYear}`;

    const itemsRows = (data.items || [])
      .map(
        (i: any) => `
        <tr style="vertical-align: middle; border-bottom: 1px dashed #000;">
          <td style="padding: 4px 6px 4px 0; text-align: left; vertical-align: top;">
            <div style="font-size: 15px; font-weight: 800; line-height: 1.25; color: #000; word-break: break-word;">
              ${i.name}
            </div>
            ${i.isAdditional ? `<div style="font-size: 12px; font-weight: 900; color: #000; margin-top: 1px;">*** [Khách gọi thêm] ***</div>` : ''}
            ${i.options ? `<div style="font-size: 11px; font-weight: 600; font-style: italic; color: #111; margin-top: 1px;">[Tuỳ chọn]: ${i.options}</div>` : ''}
            ${i.note ? `<div style="font-size: 11px; font-style: italic; font-weight: 800; color: #000; margin-top: 1px;">* Ghi chú: ${i.note}</div>` : ''}
          </td>
          <td style="padding: 4px 0; text-align: center; vertical-align: top; width: 50px;">
            <span style="display: inline-block; font-size: 18px; font-weight: 900; line-height: 1; border: 1.5px solid #000; border-radius: 4px; padding: 2px 5px; min-width: 22px; text-align: center; color: #000;">
              ${i.quantity}
            </span>
          </td>
        </tr>
      `,
      )
      .join('');

    return `
      <style>
        @page { size: portrait; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        }
        * { box-sizing: border-box; }
      </style>
      <div style="font-family: 'Segoe UI', Arial, sans-serif; width: 100%; max-width: 72mm; margin: 0 auto; padding: 2px 2px; color: #000; background: #fff;">
        <!-- Tên Bàn Căn Giữa Hiện Đại, Rõ Nét, Gọn Gàng -->
        <div style="text-align: center; margin-bottom: 3px;">
          <div style="display: inline-block; font-size: 17px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000; padding: 1px 4px;">
            [ ${cleanTableName} ]
          </div>
        </div>

        <!-- Thông tin Nhân viên & Thời gian (1 Dòng Gọn Gàng) -->
        <div style="font-size: 11px; font-weight: 600; line-height: 1.3; margin-bottom: 3px; color: #000;">
          <div style="display: flex; justify-content: space-between;">
            <span>NV: <strong>${staffName}</strong></span>
            <span><strong>${formattedTime}</strong></span>
          </div>
          ${isCancel ? `<div style="text-align: center; color: #fff; background: #000; font-weight: 900; font-size: 13px; text-transform: uppercase; margin-top: 2px; padding: 1px 0; border-radius: 2px;">*** PHIẾU HỦY MÓN ***</div>` : ''}
          ${isReprint ? `<div style="text-align: center; color: #000; font-weight: 900; font-size: 12px; text-transform: uppercase; margin-top: 2px; border: 1px solid #000; padding: 1px 0;">*** IN LẠI PHIẾU BẾP ***</div>` : ''}
          ${data.orderNote ? `<div style="font-style: italic; font-weight: 700; font-size: 11px; margin-top: 1px;">* Ghi chú bàn: ${data.orderNote}</div>` : ''}
        </div>

        <!-- Đường kẻ nét đứt phân cách -->
        <div style="border-top: 1.5px dashed #000; margin: 2px 0 3px 0;"></div>

        <!-- Bảng 2 cột Mặt hàng & SL (SL có khung nổi bật, nằm an toàn trong khổ in 72mm) -->
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="font-size: 12px; font-weight: 900; border-bottom: 1.5px dashed #000;">
              <th style="text-align: left; padding-bottom: 3px; color: #000;">Mặt hàng</th>
              <th style="text-align: center; padding-bottom: 3px; width: 50px; color: #000;">SL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Đường kẻ nét đứt phía dưới -->
        <div style="border-top: 1.5px dashed #000; margin: 3px 0 1px 0;"></div>
      </div>
    `;
  }

  /**
   * Khách hàng quét mã QR tại bàn gọi nhân viên phục vụ / trợ giúp
   */
  async requestCustomerHelp(tableId: string, message?: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: { branch: true },
    });
    if (!table) throw new NotFoundException('Bàn không tồn tại');

    const tableName = table.name || table.tableCode || 'Bàn';
    await this.notificationEngine.publishEvent({
      eventType: 'CUSTOMER_HELP_REQUESTED',
      category: 'SERVICE',
      priority: 2, // HIGH
      branchId: table.branchId,
      entityId: table.id,
      subId: Date.now().toString(),
      title: 'Yêu cầu hỗ trợ',
      message: `Khách tại ${tableName} đang cần nhân viên hỗ trợ${message ? `: "${message}"` : '.'}`,
      actor: {
        name: `Khách ${tableName}`,
      },
      reference: {
        type: 'TABLE',
        id: table.id,
        url: `/admin/pos?tableId=${table.id}`,
      },
      metadata: {
        tableId: table.id,
        tableName,
        branchId: table.branchId,
        message,
      },
      requiredPermissions: ['waiter.access', 'pos.access'],
      appScopes: ['WAITER', 'POS'],
      legacyType: 'SYSTEM',
    });

    return { success: true, message: 'Đã gửi yêu cầu hỗ trợ tới nhân viên phục vụ' };
  }

  /**
   * Khách hàng quét mã QR tại bàn yêu cầu thanh toán hóa đơn
   */
  async requestTablePayment(tableId: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: { branch: true },
    });
    if (!table) throw new NotFoundException('Bàn không tồn tại');

    const tableName = table.name || table.tableCode || 'Bàn';
    await this.notificationEngine.publishEvent({
      eventType: 'PAYMENT_REQUESTED',
      category: 'PAYMENT',
      priority: 2, // HIGH
      branchId: table.branchId,
      entityId: table.id,
      subId: Date.now().toString(),
      title: 'Yêu cầu thanh toán',
      message: `Khách tại ${tableName} yêu cầu thanh toán hóa đơn.`,
      actor: {
        name: `Khách ${tableName}`,
      },
      reference: {
        type: 'TABLE',
        id: table.id,
        url: `/admin/pos?tableId=${table.id}`,
      },
      metadata: {
        tableId: table.id,
        tableName,
        branchId: table.branchId,
      },
      requiredPermissions: ['pos.payment.collect', 'pos.access'],
      appScopes: ['POS', 'WAITER'],
      legacyType: 'ORDER',
    });

    return { success: true, message: 'Đã gửi yêu cầu thanh toán tới thu ngân' };
  }

  /**
   * Lấy danh sách món có thể đổi điểm thưởng theo chi nhánh
   */
  async getRedeemableRewards(branchId?: string) {
    return this.prisma.product.findMany({
      where: {
        available: true,
        isRedeemable: true,
        redemptionPoints: { gt: 0 },
        ...(branchId
          ? {
              OR: [
                { redeemAllBranches: true },
                { redeemableBranches: { some: { id: branchId } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        price: true,
        unit: true,
        redemptionPoints: true,
      },
      orderBy: { redemptionPoints: 'asc' },
    });
  }

  /**
   * Đổi điểm thưởng thành món ăn vào đơn hàng (POS / Waiter)
   */
  async redeemRewardToOrder(
    orderId: string,
    dto: { productId: string; userId: string; quantity?: number },
    actorId?: string,
    source: OrderItemSource = OrderItemSource.POS,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Hội viên không tồn tại');

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product || !product.isRedeemable || !product.redemptionPoints) {
      throw new BadRequestException('Món này không hỗ trợ đổi điểm');
    }

    const quantity = dto.quantity || 1;
    const requiredPoints = product.redemptionPoints * quantity;
    const currentPoints = user.points ?? user.currentPoints;

    if (currentPoints < requiredPoints) {
      throw new BadRequestException(
        `Hội viên hiện có ${currentPoints.toLocaleString('vi-VN')} điểm, không đủ ${requiredPoints.toLocaleString('vi-VN')} điểm để đổi món này.`,
      );
    }

    // Determine station
    const station = await this.prisma.kitchenStation.findFirst({
      where: {
        branchId: order.branchId,
        isActive: true,
      },
    });

    // Resolve staff member name for audit and notes
    let staffName = 'Nhân viên';
    if (actorId) {
      const staff = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { fullName: true, role: true },
      });
      if (staff?.fullName) staffName = staff.fullName;
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Trừ điểm hội viên
      await tx.user.update({
        where: { id: user.id },
        data: {
          points: { decrement: requiredPoints },
          currentPoints: { decrement: requiredPoints },
        },
      });

      // 2. Ghi lịch sử giao dịch điểm chi tiết
      await tx.pointTransaction.create({
        data: {
          userId: user.id,
          orderId: order.id,
          balanceBefore: currentPoints,
          amount: -requiredPoints,
          balanceAfter: currentPoints - requiredPoints,
          source: PointTransactionSource.REWARD,
          description: `Đổi ${requiredPoints.toLocaleString('vi-VN')} điểm lấy ${quantity}x ${product.name} (Đơn #${order.orderCode || order.id.slice(-6)}) - NV: ${staffName}`,
        },
      });

      // 3. Thêm OrderItem đổi điểm (Lưu giá 0đ luôn, không để giảm giá, ghi nhận KH và NV)
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity,
          priceAtSale: 0,
          originalPriceAtSale: 0,
          discountAmount: 0,
          discountReason: `Đổi ${requiredPoints.toLocaleString('vi-VN')} điểm thưởng`,
          note: `[ĐỔI ĐIỂM THƯỞNG] KH đổi: ${user.fullName}${user.phone ? ` (${user.phone})` : ''} | NV thực hiện: ${staffName}`,
          stationId: station?.id || null,
          kitchenStatus: KitchenStatus.PENDING,
          pricingMode: OrderItemPricingMode.REGULAR,
          source,
          orderedById: user.id,
          orderedByName: `${user.fullName} (${user.phone || 'Hội viên'})`,
        },
      });

      // 4. Ghi AuditLog chi tiết giao dịch đổi điểm
      if (actorId) {
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'REDEEM_POINTS_REWARD',
            target: `Order:${order.id}`,
            oldValue: JSON.stringify({
              customerId: user.id,
              customerName: user.fullName,
              customerPhone: user.phone,
              pointsBefore: currentPoints,
            }),
            newValue: JSON.stringify({
              productId: product.id,
              productName: product.name,
              quantity,
              pointsDeducted: requiredPoints,
              pointsAfter: currentPoints - requiredPoints,
              staffName,
            }),
          },
        });
      }

      // 5. Cập nhật Order
      await tx.order.update({
        where: { id: order.id },
        data: {
          userId: user.id,
          customerName: order.customerName || user.fullName,
          customerPhone: (order.customerPhone || user.phone) ?? undefined,
          pointsUsed: { increment: requiredPoints },
          version: { increment: 1 },
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          table: true,
          orderItems: { include: { product: true, selectedOptions: true } },
        },
      });
    });

    // Realtime notification
    this.posGateway.emitOrderUpdated(updatedOrder, actorId, order.table?.name);

    return {
      success: true,
      message: `Đã đổi thành công ${quantity}x ${product.name}!`,
      data: {
        order: updatedOrder,
        remainingPoints: currentPoints - requiredPoints,
      },
    };
  }
}

