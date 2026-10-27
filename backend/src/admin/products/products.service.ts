import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeBroadcastService } from '../../order/realtime-broadcast.service';
import { generateUniqueProductSlug } from '../../common/utils/slug.util';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly realtimeBroadcastService?: RealtimeBroadcastService,
  ) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    categoryId?: string;
    branchIdScope?: string;
    status?: string;
    channel?: string;
  }) {
    const { skip = 0, take = 12, search, categoryId, branchIdScope, status, channel } = params;
    
    const where: any = {};
    
    if (branchIdScope) {
      where.branches = {
        some: { id: branchIdScope }
      };
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (status === 'available') {
      where.available = true;
    } else if (status === 'unavailable') {
      where.available = false;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { itemCode: { contains: search } },
      ];
    }

    if (channel && channel !== 'ALL') {
      where.OR = where.OR || [];
      where.salesChannels = {
        array_contains: channel,
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take,
        where,
        include: {
          category: { select: { id: true, name: true } },
          branches: { select: { id: true, name: true, branchCode: true } },
          redeemableBranches: { select: { id: true, name: true, branchCode: true } },
          optionGroups: {
            include: { optionItems: { orderBy: { displayOrder: 'asc' } } },
            orderBy: { displayOrder: 'asc' },
          },
          printRoutes: {
            include: { station: true, branch: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      }
    };
  }

  async toggleAvailability(id: string, branchIdScope?: string) {
    const where: any = { id };
    if (branchIdScope) {
      where.branches = {
        some: { id: branchIdScope }
      };
    }
    
    const product = await this.prisma.product.findFirst({
      where
    });
    
    if (!product) {
      throw new NotFoundException('Product not found or access denied in this branch');
    }
    
    return this.prisma.product.update({
      where: { id: product.id },
      data: { available: !product.available }
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        branches: { select: { id: true, name: true, branchCode: true } },
        redeemableBranches: { select: { id: true, name: true, branchCode: true } },
        category: true,
        optionGroups: {
          include: { optionItems: { orderBy: { displayOrder: 'asc' } } },
          orderBy: { displayOrder: 'asc' },
        },
        printRoutes: {
          include: { station: true, branch: true },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(data: any) {
    const {
      branchIds,
      redeemableBranchIds,
      optionGroups,
      printerRoutes,
      slug,
      salesChannels,
      secondaryImages,
      redeemAllBranches = true,
      ...restData
    } = data;

    const defaultChannels = [
      'DINE_IN',
      'TAKEAWAY',
      'ONLINE_DELIVERY',
      'GRAB_FOOD',
      'SHOPEE_FOOD',
      'QR_ORDER',
    ];

    const finalSlug = slug?.trim()
      ? await generateUniqueProductSlug(this.prisma, slug)
      : await generateUniqueProductSlug(this.prisma, data.name);

    const product = await this.prisma.product.create({
      data: {
        ...restData,
        slug: finalSlug,
        salesChannels: salesChannels || defaultChannels,
        secondaryImages: secondaryImages || [],
        redeemAllBranches: Boolean(redeemAllBranches),
        branches: branchIds?.length
          ? {
              connect: branchIds.map((id: string) => ({ id })),
            }
          : undefined,
        redeemableBranches: !redeemAllBranches && redeemableBranchIds?.length
          ? {
              connect: redeemableBranchIds.map((id: string) => ({ id })),
            }
          : undefined,
        optionGroups: optionGroups?.length
          ? {
              create: optionGroups.map((group: any, gIdx: number) => ({
                name: group.name,
                isRequired: Boolean(group.isRequired),
                multipleChoice: Boolean(group.multipleChoice),
                minSelect: Number(group.minSelect || 0),
                maxSelect: Number(group.maxSelect || 1),
                displayOrder: group.displayOrder ?? gIdx,
                optionItems: {
                  create: (group.items || group.optionItems || []).map((item: any, iIdx: number) => ({
                    name: item.name,
                    priceAdjustment: Number(item.priceAdjustment || 0),
                    isDefault: Boolean(item.isDefault),
                    available: item.available !== false,
                    maxQuantity: Number(item.maxQuantity || 1),
                    displayOrder: item.displayOrder ?? iIdx,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        branches: true,
        optionGroups: { include: { optionItems: true } },
      },
    });

    // Cấu hình Print Routes nếu có
    if (Array.isArray(printerRoutes) && printerRoutes.length > 0) {
      for (const pr of printerRoutes) {
        if (!pr.stationId || !pr.branchId) continue;
        await this.prisma.productPrintRoute.create({
          data: {
            productId: product.id,
            branchId: pr.branchId,
            stationId: pr.stationId,
            routeRole: pr.routeRole || 'PREPARATION',
            printType: pr.printType || 'KITCHEN_TICKET',
            copies: Number(pr.copies || 1),
            isActive: pr.isActive !== false,
          },
        });
      }
    }

    return product;
  }

  async update(id: string, data: any) {
    const {
      branchIds,
      redeemableBranchIds,
      optionGroups,
      printerRoutes,
      salesChannels,
      secondaryImages,
      redeemAllBranches,
      ...restData
    } = data;

    const updateData: any = { ...restData };

    if (salesChannels !== undefined) {
      updateData.salesChannels = salesChannels;
    }
    if (secondaryImages !== undefined) {
      updateData.secondaryImages = secondaryImages;
    }
    if (redeemAllBranches !== undefined) {
      updateData.redeemAllBranches = Boolean(redeemAllBranches);
    }

    if (branchIds !== undefined) {
      updateData.branches = {
        set: (branchIds || []).map((bId: string) => ({ id: bId })),
      };
    }

    if (redeemAllBranches === true) {
      updateData.redeemableBranches = { set: [] };
    } else if (redeemableBranchIds !== undefined) {
      updateData.redeemableBranches = {
        set: (redeemableBranchIds || []).map((bId: string) => ({ id: bId })),
      };
    }

    const oldProduct = await this.prisma.product.findUnique({ where: { id } });
    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Đồng bộ Option Groups nếu client gửi lên
    if (optionGroups !== undefined && Array.isArray(optionGroups)) {
      await this.prisma.optionGroup.deleteMany({
        where: { productId: id },
      });

      for (let gIdx = 0; gIdx < optionGroups.length; gIdx++) {
        const group = optionGroups[gIdx];
        if (!group.name) continue;

        await this.prisma.optionGroup.create({
          data: {
            productId: id,
            name: group.name,
            isRequired: Boolean(group.isRequired),
            multipleChoice: Boolean(group.multipleChoice),
            minSelect: Number(group.minSelect || 0),
            maxSelect: Number(group.maxSelect || 1),
            displayOrder: group.displayOrder ?? gIdx,
            optionItems: {
              create: (group.items || group.optionItems || []).map((item: any, iIdx: number) => ({
                name: item.name,
                priceAdjustment: Number(item.priceAdjustment || 0),
                isDefault: Boolean(item.isDefault),
                available: item.available !== false,
                maxQuantity: Number(item.maxQuantity || 1),
                displayOrder: item.displayOrder ?? iIdx,
              })),
            },
          },
        });
      }
    }

    // Đồng bộ Print Routes nếu client gửi lên
    if (printerRoutes !== undefined && Array.isArray(printerRoutes)) {
      await this.prisma.productPrintRoute.deleteMany({
        where: { productId: id },
      });

      for (const pr of printerRoutes) {
        if (!pr.stationId || !pr.branchId) continue;
        await this.prisma.productPrintRoute.create({
          data: {
            productId: id,
            branchId: pr.branchId,
            stationId: pr.stationId,
            routeRole: pr.routeRole || 'PREPARATION',
            printType: pr.printType || 'KITCHEN_TICKET',
            copies: Number(pr.copies || 1),
            isActive: pr.isActive !== false,
          },
        });
      }
    }

    if (oldProduct && this.realtimeBroadcastService) {
      if (data.price !== undefined && data.price !== oldProduct.price) {
        this.realtimeBroadcastService.broadcastProductUpdate({
          productId: updated.id,
          productName: updated.name,
          changeType: 'PRICE',
          oldPrice: oldProduct.price,
          newPrice: updated.price,
        });
      }
      if (data.taxPercentage !== undefined && data.taxPercentage !== oldProduct.taxPercentage) {
        this.realtimeBroadcastService.broadcastProductUpdate({
          productId: updated.id,
          productName: updated.name,
          changeType: 'TAX',
          taxPercentage: updated.taxPercentage,
        });
      }
      const avail = data.available !== undefined ? data.available : data.isAvailable;
      if (avail !== undefined && avail !== oldProduct.available) {
        this.realtimeBroadcastService.broadcastProductUpdate({
          productId: updated.id,
          productName: updated.name,
          changeType: 'AVAILABILITY',
          available: updated.available,
        });
      }
    }

    return updated;
  }

  async remove(id: string) {
    return this.prisma.product.delete({
      where: { id }
    });
  }
}
