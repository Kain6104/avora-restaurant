import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) { }

  async findAll(branchId?: string) {
    return this.prisma.branch.findMany({
      where: branchId ? { id: branchId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.branch.findUnique({
      where: { id },
      include: {
        printers: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        kitchenStations: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { orders: true, users: true }
        }
      }
    });
  }

  private sanitizeBranchData(data: any) {
    const sanitized = { ...data };
    if (sanitized.splitKitchenTickets !== undefined) sanitized.splitKitchenTickets = Boolean(sanitized.splitKitchenTickets);
    if (sanitized.printCancelTicket !== undefined) sanitized.printCancelTicket = Boolean(sanitized.printCancelTicket);
    if (sanitized.autoPrintReceipt !== undefined) sanitized.autoPrintReceipt = Boolean(sanitized.autoPrintReceipt);
    if (sanitized.autoPrintTempBill !== undefined) sanitized.autoPrintTempBill = Boolean(sanitized.autoPrintTempBill);
    if (sanitized.receiptCopies !== undefined) sanitized.receiptCopies = Math.max(1, Math.min(5, parseInt(sanitized.receiptCopies, 10) || 1));
    if (sanitized.kitchenCopies !== undefined) sanitized.kitchenCopies = Math.max(1, Math.min(5, parseInt(sanitized.kitchenCopies, 10) || 1));
    if (sanitized.defaultPaperSize !== undefined) sanitized.defaultPaperSize = sanitized.defaultPaperSize || '80mm';
    if (sanitized.defaultReceiptPrinterId !== undefined) {
      sanitized.defaultReceiptPrinterId = sanitized.defaultReceiptPrinterId ? String(sanitized.defaultReceiptPrinterId) : null;
    }
    // Loyalty Settings
    if (sanitized.isLoyaltyOnlineEnabled !== undefined) sanitized.isLoyaltyOnlineEnabled = Boolean(sanitized.isLoyaltyOnlineEnabled);
    if (sanitized.loyaltyEarnRateOnline !== undefined) sanitized.loyaltyEarnRateOnline = Math.max(1, parseFloat(sanitized.loyaltyEarnRateOnline) || 40);
    if (sanitized.isLoyaltyPosEnabled !== undefined) sanitized.isLoyaltyPosEnabled = Boolean(sanitized.isLoyaltyPosEnabled);
    if (sanitized.loyaltyEarnRatePos !== undefined) sanitized.loyaltyEarnRatePos = Math.max(1, parseFloat(sanitized.loyaltyEarnRatePos) || 40);
    if (sanitized.allowDirectDiscount !== undefined) sanitized.allowDirectDiscount = Boolean(sanitized.allowDirectDiscount);
    if (sanitized.pointRedeemRate !== undefined) sanitized.pointRedeemRate = Math.max(0.1, parseFloat(sanitized.pointRedeemRate) || 1);
    if (sanitized.maxPointDiscountPercent !== undefined) sanitized.maxPointDiscountPercent = Math.min(100, Math.max(1, parseFloat(sanitized.maxPointDiscountPercent) || 20));
    if (sanitized.allowRedeemVoucherOnline !== undefined) sanitized.allowRedeemVoucherOnline = Boolean(sanitized.allowRedeemVoucherOnline);
    if (sanitized.allowRedeemItemPos !== undefined) sanitized.allowRedeemItemPos = Boolean(sanitized.allowRedeemItemPos);
    return sanitized;
  }

  async create(data: any) {
    const sanitized = this.sanitizeBranchData(data);
    // Generate a default branchCode if not provided
    if (!sanitized.branchCode) {
      sanitized.branchCode = `BR-${Date.now()}`;
    }
    return this.prisma.branch.create({
      data: sanitized,
    });
  }

  async update(id: string, data: any) {
    const sanitized = this.sanitizeBranchData(data);
    return this.prisma.branch.update({
      where: { id },
      data: sanitized,
    });
  }

  async delete(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, users: true }
        }
      }
    });

    if (!branch) {
      throw new Error('Branch not found');
    }

    if (branch._count.orders > 0 || branch._count.users > 0) {
      throw new Error('Cannot delete branch because it has associated orders or users');
    }

    return this.prisma.branch.delete({
      where: { id },
    });
  }
}
