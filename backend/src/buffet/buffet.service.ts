import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuffetPackageDto } from './dto/create-buffet-package.dto';
import { UpdateBuffetPackageDto } from './dto/update-buffet-package.dto';
import { BuffetSessionStatus } from '@prisma/client';

@Injectable()
export class BuffetService {
  private readonly logger = new Logger(BuffetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách gói Buffet theo chi nhánh
   */
  async findByBranch(branchId?: string, onlyActive = false) {
    return this.prisma.buffetPackage.findMany({
      where: {
        ...(branchId && branchId.trim() && branchId !== 'ALL' ? { branchId: branchId.trim() } : {}),
        ...(onlyActive ? { active: true } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        tickets: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discountedPrice: true,
                imageUrl: true,
                available: true,
                itemCode: true,
              },
            },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discountedPrice: true,
                imageUrl: true,
                available: true,
                itemCode: true,
                categoryId: true,
                category: { select: { id: true, name: true, slug: true } },
                optionGroups: {
                  include: {
                    optionItems: true,
                  },
                },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Lấy chi tiết gói Buffet theo ID
   */
  async findById(id: string) {
    const pkg = await this.prisma.buffetPackage.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        tickets: {
          include: {
            product: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: true,
                optionGroups: { include: { optionItems: true } },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!pkg) {
      throw new NotFoundException('Gói Buffet không tồn tại');
    }
    return pkg;
  }

  /**
   * Tạo gói Buffet mới
   */
  async createPackage(dto: CreateBuffetPackageDto, user?: any) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }

    if (!dto.ticketProductIds || dto.ticketProductIds.length === 0) {
      throw new BadRequestException('Gói Buffet bắt buộc phải có ít nhất 1 món đại diện/vé Buffet');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.buffetPackage.create({
        data: {
          branchId: dto.branchId,
          name: dto.name,
          description: dto.description || null,
          active: dto.active !== undefined ? dto.active : true,
          displayOrder: dto.displayOrder || 0,
        },
      });

      // Tạo các món vé đại diện
      for (const prodId of dto.ticketProductIds) {
        await tx.buffetPackageTicket.create({
          data: {
            buffetPackageId: created.id,
            productId: prodId,
          },
        });
      }

      // Tạo các món con được gọi trong gói
      if (dto.items && dto.items.length > 0) {
        for (let i = 0; i < dto.items.length; i++) {
          const it = dto.items[i];
          await tx.buffetPackageItem.create({
            data: {
              buffetPackageId: created.id,
              productId: it.productId,
              displayOrder: it.displayOrder !== undefined ? it.displayOrder : i,
              maxQuantityPerRound: it.maxQuantityPerRound || null,
              availableForQr: it.availableForQr !== undefined ? it.availableForQr : true,
              allowRetailPurchase: it.allowRetailPurchase !== undefined ? it.allowRetailPurchase : true,
            },
          });
        }
      }

      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE_BUFFET_PACKAGE',
            target: `BuffetPackage:${created.id}`,
            newValue: JSON.stringify({ name: created.name, branchId: created.branchId }),
          },
        });
      }

      return created;
    });
  }

  /**
   * Cập nhật gói Buffet
   */
  async updatePackage(id: string, dto: UpdateBuffetPackageDto, user?: any) {
    const existing = await this.prisma.buffetPackage.findUnique({
      where: { id },
      include: { tickets: true, items: true },
    });
    if (!existing) {
      throw new NotFoundException('Gói Buffet không tồn tại');
    }

    if (dto.ticketProductIds && dto.ticketProductIds.length === 0) {
      throw new BadRequestException('Gói Buffet bắt buộc phải có ít nhất 1 món đại diện/vé Buffet');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.buffetPackage.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name : existing.name,
          description: dto.description !== undefined ? dto.description : existing.description,
          active: dto.active !== undefined ? dto.active : existing.active,
          displayOrder: dto.displayOrder !== undefined ? dto.displayOrder : existing.displayOrder,
        },
      });

      if (dto.ticketProductIds) {
        await tx.buffetPackageTicket.deleteMany({ where: { buffetPackageId: id } });
        for (const prodId of dto.ticketProductIds) {
          await tx.buffetPackageTicket.create({
            data: {
              buffetPackageId: id,
              productId: prodId,
            },
          });
        }
      }

      if (dto.items) {
        await tx.buffetPackageItem.deleteMany({ where: { buffetPackageId: id } });
        for (let i = 0; i < dto.items.length; i++) {
          const it = dto.items[i];
          await tx.buffetPackageItem.create({
            data: {
              buffetPackageId: id,
              productId: it.productId,
              displayOrder: it.displayOrder !== undefined ? it.displayOrder : i,
              maxQuantityPerRound: it.maxQuantityPerRound || null,
              availableForQr: it.availableForQr !== undefined ? it.availableForQr : true,
              allowRetailPurchase: it.allowRetailPurchase !== undefined ? it.allowRetailPurchase : true,
            },
          });
        }
      }

      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'UPDATE_BUFFET_PACKAGE',
            target: `BuffetPackage:${id}`,
            oldValue: JSON.stringify({ name: existing.name }),
            newValue: JSON.stringify({ name: updated.name }),
          },
        });
      }

      return updated;
    });
  }

  /**
   * Xóa gói Buffet
   */
  async deletePackage(id: string, user?: any) {
    const existing = await this.prisma.buffetPackage.findUnique({
      where: { id },
      include: { sessions: { where: { status: BuffetSessionStatus.ACTIVE } } },
    });
    if (!existing) {
      throw new NotFoundException('Gói Buffet không tồn tại');
    }

    if (existing.sessions.length > 0) {
      throw new ConflictException('Không thể xóa gói Buffet đang có phiên hoạt động tại bàn');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.buffetPackageTicket.deleteMany({ where: { buffetPackageId: id } });
      await tx.buffetPackageItem.deleteMany({ where: { buffetPackageId: id } });
      const deleted = await tx.buffetPackage.delete({ where: { id } });

      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'DELETE_BUFFET_PACKAGE',
            target: `BuffetPackage:${id}`,
            oldValue: JSON.stringify({ name: existing.name }),
          },
        });
      }

      return deleted;
    });
  }

  /**
   * Lấy Buffet Session đang ACTIVE của đơn hàng
   */
  async getActiveBuffetSession(orderId: string) {
    return this.prisma.buffetSession.findFirst({
      where: {
        orderId,
        status: BuffetSessionStatus.ACTIVE,
      },
      include: {
        buffetPackage: {
          include: {
            tickets: { include: { product: true } },
            items: { include: { product: true } },
          },
        },
      },
    });
  }

  /**
   * Kích hoạt Buffet Session cho Order
   * 1 ORDER = TỐI ĐA 1 ACTIVE BUFFET SESSION
   */
  async activateBuffetSession(orderId: string, buffetPackageId: string, user?: any) {
    const pkg = await this.prisma.buffetPackage.findUnique({ where: { id: buffetPackageId } });
    if (!pkg) {
      throw new NotFoundException('Gói Buffet không tồn tại');
    }
    if (!pkg.active) {
      throw new BadRequestException('Gói Buffet này hiện đang tạm ngưng');
    }

    const currentActiveSession = await this.prisma.buffetSession.findFirst({
      where: { orderId, status: BuffetSessionStatus.ACTIVE },
    });

    if (currentActiveSession) {
      if (currentActiveSession.buffetPackageId === buffetPackageId) {
        return currentActiveSession; // Đã kích hoạt đúng gói này rồi
      }
      throw new ConflictException(
        `Đơn hàng đang sử dụng gói Buffet [${currentActiveSession.packageNameSnapshot}]. Một đơn hàng chỉ được sử dụng tối đa 1 gói Buffet!`,
      );
    }

    return this.prisma.buffetSession.create({
      data: {
        orderId,
        buffetPackageId,
        packageNameSnapshot: pkg.name,
        status: BuffetSessionStatus.ACTIVE,
        activatedById: user?.id || null,
      },
      include: {
        buffetPackage: true,
      },
    });
  }

  /**
   * Vô hiệu hóa Buffet Session khi giảm vé về 0 hoặc chuyển gói
   */
  async deactivateBuffetSession(orderId: string, reason?: string, user?: any) {
    const activeSession = await this.prisma.buffetSession.findFirst({
      where: { orderId, status: BuffetSessionStatus.ACTIVE },
    });
    if (!activeSession) return null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.buffetSession.update({
        where: { id: activeSession.id },
        data: {
          status: BuffetSessionStatus.INACTIVE,
          deactivatedAt: new Date(),
        },
      });

      if (user?.id) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'DEACTIVATE_BUFFET_SESSION',
            target: `BuffetSession:${activeSession.id}`,
            oldValue: JSON.stringify({
              orderId,
              package: activeSession.packageNameSnapshot,
              reason: reason || 'Giảm vé Buffet về 0',
            }),
          },
        });
      }

      return updated;
    });
  }

  /**
   * Kiểm tra xem một productId có phải là vé đại diện của gói Buffet nào ở chi nhánh không
   */
  async findBuffetPackageByTicket(branchId: string, productId: string) {
    const ticket = await this.prisma.buffetPackageTicket.findFirst({
      where: {
        productId,
        buffetPackage: {
          branchId,
          active: true,
        },
      },
      include: { buffetPackage: true },
    });
    return ticket?.buffetPackage || null;
  }

  /**
   * Kiểm tra xem một productId có nằm trong danh sách món con của gói Buffet đang active không
   */
  async isProductInActiveBuffet(buffetPackageId: string, productId: string) {
    const item = await this.prisma.buffetPackageItem.findUnique({
      where: {
        buffetPackageId_productId: {
          buffetPackageId,
          productId,
        },
      },
    });
    return item;
  }
}
