import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EscPosEncoder, KitchenTicketData } from './esc-pos.encoder';
import { PrintTemplateRendererService } from '../print-template/print-template-renderer.service';
import {
  PrintJobStatus,
  PrintJobEventType,
  PrintRouteRole,
  PrintTemplateType,
  Prisma,
} from '@prisma/client';

export interface DispatchKitchenItemParam {
  id: string; // orderItemId
  productId: string;
  name: string;
  quantity: number;
  sentQuantity?: number;
  printedQuantity?: number;
  printVersion?: number;
  note?: string;
  options?: any;
}

export interface DispatchKitchenParams {
  orderId: string;
  branchId: string;
  items: DispatchKitchenItemParam[];
  eventType?: PrintJobEventType;
  createdById?: string;
}

@Injectable()
export class PrintRoutingService {
  private readonly logger = new Logger(PrintRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRenderer: PrintTemplateRendererService,
  ) {}

  /**
   * Dispatch Kitchen Order Items via Transactional Outbox
   * Can be called inside an existing Prisma transaction or standalone
   */
  async dispatchKitchenOrderItems(
    txOrPrisma: Prisma.TransactionClient | PrismaService,
    params: DispatchKitchenParams,
  ) {
    const { orderId, branchId, items, eventType = PrintJobEventType.NEW_ITEM, createdById } = params;

    const order = await txOrPrisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        branch: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const branch = order.branch;
    const splitKitchenTickets = branch?.splitKitchenTickets ?? false;

    // Fetch all active stations and printers for this branch
    const stations = await txOrPrisma.kitchenStation.findMany({
      where: { branchId, isActive: true },
      include: {
        stationPrinters: {
          where: { isActive: true },
          include: { printer: true },
          orderBy: [{ isPrimary: 'desc' }, { priority: 'asc' }],
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Default station fallback if none specified
    const defaultStation = stations[0] || null;

    // Filter items and calculate deltas
    const itemsToProcess: Array<{
      item: DispatchKitchenItemParam;
      delta: number;
      nextVersion: number;
    }> = [];

    for (const item of items) {
      const currentSent = item.sentQuantity ?? 0;
      let delta = item.quantity;

      if (eventType === PrintJobEventType.ADD_QUANTITY) {
        delta = item.quantity - currentSent;
        if (delta <= 0) {
          continue; // No extra quantity added
        }
      }

      const nextVersion = (item.printVersion ?? 0) + 1;
      itemsToProcess.push({ item, delta, nextVersion });

      // Update OrderItem sentQuantity and printVersion
      await txOrPrisma.orderItem.update({
        where: { id: item.id },
        data: {
          sentQuantity: { increment: delta },
          printVersion: nextVersion,
        },
      });
    }

    if (itemsToProcess.length === 0) {
      return { printJobsCreated: 0, message: 'Không có món mới hoặc lượng gọi thêm cần in bếp' };
    }

    // Collect product routes for all items
    const productIds = itemsToProcess.map((p) => p.item.productId);
    const existingRoutes = await txOrPrisma.productPrintRoute.findMany({
      where: {
        productId: { in: productIds },
        branchId,
        isActive: true,
      },
      include: {
        station: {
          include: {
            stationPrinters: {
              where: { isActive: true },
              include: { printer: true },
              orderBy: [{ isPrimary: 'desc' }, { priority: 'asc' }],
            },
          },
        },
      },
      orderBy: { priority: 'asc' },
    });

    // Map each item to its assigned stations & printers
    // Grouping structure: StationId -> PrinterId -> RouteRole -> Items[]
    interface RouteGroup {
      station: any;
      printer: any;
      routeRole: PrintRouteRole;
      routeId?: string;
      items: Array<{
        orderItemId: string;
        name: string;
        quantity: number;
        delta: number;
        note?: string;
        options?: string;
        nextVersion: number;
      }>;
    }

    const groups: Map<string, RouteGroup> = new Map();

    for (const { item, delta, nextVersion } of itemsToProcess) {
      const itemRoutes = existingRoutes.filter((r) => r.productId === item.productId);

      const targets: Array<{ station: any; printer: any; routeRole: PrintRouteRole; routeId?: string }> = [];

      if (itemRoutes.length > 0) {
        for (const route of itemRoutes) {
          const primaryPrinter = route.station.stationPrinters[0]?.printer;
          if (primaryPrinter) {
            targets.push({
              station: route.station,
              printer: primaryPrinter,
              routeRole: route.routeRole,
              routeId: route.id,
            });
          }
        }
      }
      // Khong fallback sang defaultStation: Neu san pham khong co ProductPrintRoute thi 0 gui bat ky tram nao

      for (const target of targets) {
        // If splitKitchenTickets is true, each item generates a distinct group key
        const groupKey = splitKitchenTickets
          ? `${target.station.id}_${target.printer.id}_${target.routeRole}_${item.id}`
          : `${target.station.id}_${target.printer.id}_${target.routeRole}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            station: target.station,
            printer: target.printer,
            routeRole: target.routeRole,
            routeId: target.routeId,
            items: [],
          });
        }

        const optionsText = item.options ? (typeof item.options === 'string' ? item.options : JSON.stringify(item.options)) : undefined;

        groups.get(groupKey)!.items.push({
          orderItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          delta,
          note: item.note,
          options: optionsText,
          nextVersion,
        });
      }
    }

    let jobsCount = 0;

    // Create PrintJob for each group
    for (const group of groups.values()) {
      const { station, printer, routeRole, routeId, items: groupItems } = group;

      // Construct KitchenTicket ESC/POS buffer
      const ticketData: KitchenTicketData = {
        branchName: branch.name,
        stationName: station.name,
        orderCode: order.orderCode || order.temporaryOrderCode || 'TMP',
        tableName: order.table?.name || 'Mang về / Online',
        orderTypeStr: order.orderType,
        orderNote: order.note || undefined,
        eventType,
        sentAt: new Date(),
        paperWidth: (printer.paperSize === '58mm' ? '58mm' : '80mm'),
        items: groupItems.map((gi) => ({
          name: gi.name,
          quantity: gi.quantity,
          delta: gi.delta,
          note: gi.note,
          options: gi.options,
        })),
      };

      const escposBuffer = EscPosEncoder.generateKitchenTicket(ticketData);

      // Generate HTML representation for preview / browser reprint
      const html = this.buildKitchenTicketHtml(ticketData);

      const totalDelta = groupItems.reduce((sum, i) => sum + i.delta, 0);
      const totalQty = groupItems.reduce((sum, i) => sum + i.quantity, 0);
      const primaryItemId = groupItems[0]?.orderItemId || null;
      const primaryVersion = groupItems[0]?.nextVersion || 1;

      const idempotencyKey = `${orderId}_${station.id}_${printer.id}_${eventType}_${primaryVersion}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await txOrPrisma.printJob.create({
        data: {
          orderId,
          orderItemId: groupItems.length === 1 ? primaryItemId : null,
          branchId,
          stationId: station.id,
          printerId: printer.id,
          routeId: routeId || null,
          routeRole,
          payloadType: printer.payloadType,
          printType: PrintTemplateType.KITCHEN_TICKET,
          eventType,
          quantity: totalQty,
          quantityDelta: totalDelta,
          printedQtyBefore: 0,
          copies: 1,
          contentHtml: html,
          payloadData: escposBuffer.toString('base64'),
          snapshotData: { items: groupItems, orderCode: order.orderCode || order.temporaryOrderCode || 'TMP', tableName: order.table?.name },
          status: PrintJobStatus.PENDING,
          idempotencyKey,
        },
      });

      jobsCount++;
    }

    // Record Kitchen Event
    await txOrPrisma.kitchenEvent.create({
      data: {
        orderId,
        branchId,
        eventType,
        itemSummary: itemsToProcess.map((p) => ({
          orderItemId: p.item.id,
          name: p.item.name,
          delta: p.delta,
          totalQty: p.item.quantity,
        })),
        createdById: createdById || null,
      },
    });

    return { printJobsCreated: jobsCount, message: `Đã tạo ${jobsCount} lệnh in bếp thành công` };
  }

  /**
   * Dispatch CANCEL_ITEM tickets strictly to stations/printers that previously received the item
   */
  async dispatchCancelOrderItems(
    txOrPrisma: Prisma.TransactionClient | PrismaService,
    params: {
      orderId: string;
      branchId: string;
      items: Array<{ id: string; name: string; quantity: number; note?: string }>;
      reason?: string;
      canceledById?: string;
    },
  ) {
    const { orderId, branchId, items, reason, canceledById } = params;

    const order = await txOrPrisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, branch: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Check branch setting printCancelTicket
    if (!order.branch.printCancelTicket) {
      this.logger.log(`Branch ${branchId} has printCancelTicket disabled. Skipping cancel tickets.`);
      return { printJobsCreated: 0 };
    }

    const itemIds = items.map((i) => i.id);

    // Find previous jobs for these items to know exactly which stations/printers received them
    const previousJobs = await txOrPrisma.printJob.findMany({
      where: {
        orderId,
        orderItemId: { in: itemIds },
        status: { in: [PrintJobStatus.PRINTED, PrintJobStatus.DISPATCHED, PrintJobStatus.PENDING] },
      },
      include: {
        station: true,
        printer: true,
      },
    });

    // Group previous target stations/printers
    const targets = new Map<string, { station: any; printer: any; items: typeof items }>();

    for (const item of items) {
      const itemJobs = previousJobs.filter((j) => j.orderItemId === item.id);
      for (const pj of itemJobs) {
        const key = `${pj.stationId}_${pj.printerId}`;
        if (!targets.has(key)) {
          targets.set(key, { station: pj.station, printer: pj.printer, items: [] });
        }
        if (!targets.get(key)!.items.find((i) => i.id === item.id)) {
          targets.get(key)!.items.push(item);
        }
      }
    }

    let jobsCount = 0;

    for (const target of targets.values()) {
      const { station, printer, items: cancelItems } = target;

      const ticketData: KitchenTicketData = {
        branchName: order.branch.name,
        stationName: station.name,
        orderCode: order.orderCode || order.temporaryOrderCode || 'TMP',
        tableName: order.table?.name || 'Mang về / Online',
        orderTypeStr: order.orderType,
        eventType: 'CANCEL_ITEM',
        sentAt: new Date(),
        reprintReason: reason || 'Hủy món theo yêu cầu của khách',
        paperWidth: printer.paperSize === '58mm' ? '58mm' : '80mm',
        items: cancelItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          note: i.note,
        })),
      };

      const escposBuffer = EscPosEncoder.generateKitchenTicket(ticketData);
      const html = this.buildKitchenTicketHtml(ticketData);

      const idempotencyKey = `${orderId}_cancel_${station.id}_${printer.id}_${Date.now()}`;

      await txOrPrisma.printJob.create({
        data: {
          orderId,
          branchId,
          stationId: station.id,
          printerId: printer.id,
          payloadType: printer.payloadType,
          printType: PrintTemplateType.KITCHEN_TICKET,
          eventType: PrintJobEventType.CANCEL_ITEM,
          quantity: cancelItems.reduce((sum, i) => sum + i.quantity, 0),
          quantityDelta: cancelItems.reduce((sum, i) => sum + i.quantity, 0),
          copies: 1,
          contentHtml: html,
          payloadData: escposBuffer.toString('base64'),
          reprintReason: reason,
          snapshotData: { items: cancelItems, reason },
          status: PrintJobStatus.PENDING,
          idempotencyKey,
        },
      });

      jobsCount++;
    }

    // Record Kitchen Event
    await txOrPrisma.kitchenEvent.create({
      data: {
        orderId,
        branchId,
        eventType: PrintJobEventType.CANCEL_ITEM,
        itemSummary: { items, reason },
        createdById: canceledById || null,
      },
    });

    return { printJobsCreated: jobsCount };
  }

  /**
   * Reprint an existing job (always creates a NEW PrintJob with audit metadata)
   */
  async reprintJob(jobId: string, params: { reason: string; reprintedBy?: string }) {
    const original = await this.prisma.printJob.findUnique({
      where: { id: jobId },
      include: { station: true, printer: true, branch: true },
    });

    if (!original) {
      throw new NotFoundException(`PrintJob ${jobId} not found`);
    }

    const newIdempotencyKey = `${original.id}_reprint_${Date.now()}`;

    // Re-encode with REPRINT badge
    let payloadBase64 = original.payloadData;
    if (original.snapshotData && typeof original.snapshotData === 'object') {
      const snap: any = original.snapshotData;
      const ticketData: KitchenTicketData = {
        branchName: original.branch.name,
        stationName: original.station.name,
        orderCode: snap.orderCode || 'REPRINT',
        tableName: snap.tableName,
        eventType: 'REPRINT',
        reprintReason: params.reason,
        sentAt: new Date(),
        paperWidth: original.printer.paperSize === '58mm' ? '58mm' : '80mm',
        items: (snap.items || []).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          delta: i.delta,
          note: i.note,
        })),
      };
      payloadBase64 = EscPosEncoder.generateKitchenTicket(ticketData).toString('base64');
    }

    const newJob = await this.prisma.printJob.create({
      data: {
        orderId: original.orderId,
        orderItemId: original.orderItemId,
        branchId: original.branchId,
        stationId: original.stationId,
        printerId: original.printerId,
        routeId: original.routeId,
        routeRole: original.routeRole,
        payloadType: original.payloadType,
        printType: original.printType,
        eventType: PrintJobEventType.REPRINT,
        quantity: original.quantity,
        quantityDelta: original.quantityDelta,
        printedQtyBefore: original.printedQtyBefore,
        copies: original.copies,
        contentHtml: original.contentHtml,
        payloadData: payloadBase64,
        snapshotData: original.snapshotData as any,
        status: PrintJobStatus.PENDING,
        attemptCount: 0,
        idempotencyKey: newIdempotencyKey,
        reprintOfId: original.id,
        reprintReason: params.reason,
        reprintedBy: params.reprintedBy || null,
      },
    });

    // Audit log
    await this.prisma.kitchenEvent.create({
      data: {
        orderId: original.orderId,
        branchId: original.branchId,
        stationId: original.stationId,
        eventType: PrintJobEventType.REPRINT,
        itemSummary: { reprintOfId: original.id, reason: params.reason },
        createdById: params.reprintedBy || null,
      },
    });

    return newJob;
  }

  /**
   * Retry an existing failed job without creating a new duplicate
   */
  async retryJob(jobId: string) {
    const job = await this.prisma.printJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`PrintJob ${jobId} not found`);
    }

    return this.prisma.printJob.update({
      where: { id: jobId },
      data: {
        status: PrintJobStatus.PENDING,
        attemptCount: 0,
        errorMessage: null,
      },
    });
  }

  /**
   * Build HTML preview for kitchen ticket
   */
  private buildKitchenTicketHtml(data: KitchenTicketData): string {
    const isCancel = data.eventType === 'CANCEL_ITEM';
    const isReprint = data.eventType === 'REPRINT';
    const rawTableName = data.tableName || (data.orderTypeStr === 'TAKEAWAY' ? 'Mang đi / Mang về' : 'Đơn hàng');
    const cleanTableName = String(rawTableName).replace(/^\[+|\]+$/g, '').trim();
    const staffName = (data as any).staffName || (data as any).sender || 'Nhân viên';
    const sentDate = data.sentAt ? new Date(data.sentAt) : new Date();
    const formattedHours = String(sentDate.getHours()).padStart(2, '0');
    const formattedMinutes = String(sentDate.getMinutes()).padStart(2, '0');
    const formattedDay = String(sentDate.getDate()).padStart(2, '0');
    const formattedMonth = String(sentDate.getMonth() + 1).padStart(2, '0');
    const formattedYear = sentDate.getFullYear();
    const formattedTime = `${formattedHours}:${formattedMinutes} ${formattedDay}/${formattedMonth}/${formattedYear}`;

    const itemsRows = data.items
      .map(
        (i: any) => {
          const qty = i.delta !== undefined && data.eventType === 'ADD_QUANTITY' ? i.delta : i.quantity;
          const isAdditional = i.isAdditional || (i.delta !== undefined && data.eventType === 'ADD_QUANTITY');
          return `
          <tr style="vertical-align: middle; border-bottom: 1px dashed #000;">
            <td style="padding: 4px 6px 4px 0; text-align: left; vertical-align: top;">
              <div style="font-size: 15px; font-weight: 800; line-height: 1.25; color: #000; word-break: break-word;">
                ${i.name}
              </div>
              ${isAdditional ? `<div style="font-size: 12px; font-weight: 900; color: #000; margin-top: 1px;">*** [Khách gọi thêm] ***</div>` : ''}
              ${i.options ? `<div style="font-size: 11px; font-weight: 600; font-style: italic; color: #111; margin-top: 1px;">[Tuỳ chọn]: ${i.options}</div>` : ''}
              ${i.note ? `<div style="font-size: 11px; font-style: italic; font-weight: 800; color: #000; margin-top: 1px;">* Ghi chú: ${i.note}</div>` : ''}
            </td>
            <td style="padding: 4px 0; text-align: center; vertical-align: top; width: 50px;">
              <span style="display: inline-block; font-size: 18px; font-weight: 900; line-height: 1; border: 1.5px solid #000; border-radius: 4px; padding: 2px 5px; min-width: 22px; text-align: center; color: #000;">
                ${qty}
              </span>
            </td>
          </tr>
        `;
        },
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
          ${data.reprintReason ? `<div style="font-style: italic; font-size: 11px; margin-top: 1px;">Lý do in lại: ${data.reprintReason}</div>` : ''}
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
}
