import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CampaignCollisionParams {
  campaignId?: string;
  startTime: Date;
  endTime: Date;
  branchIds?: string[]; // Empty or undefined means ALL_BRANCHES
}

export interface SlotDefinitionInput {
  id?: string;
  name: string;
  startTime: Date | string;
  endTime: Date | string;
  teaserStartAt?: Date | string | null;
  sortOrder?: number;
}

export interface ProductCollisionParams {
  campaignId?: string;
  slotStartTime: Date;
  slotEndTime: Date;
  branchIds?: string[];
  productIds: string[];
}

export interface ChecklistItem {
  key: string;
  title: string;
  passed: boolean;
  message?: string;
}

export interface PrePublishChecklistResult {
  isValid: boolean;
  checklist: ChecklistItem[];
  errors: string[];
  warnings: string[];
}

@Injectable()
export class FlashSaleValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Kiểm tra tính hợp lệ của thời gian chiến dịch (Time Bounds)
   */
  validateTimeBounds(startTime: Date, endTime: Date, teaserStartAt?: Date | null): void {
    const now = new Date();
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_INVALID_TIME',
          message: 'Thời gian bắt đầu hoặc kết thúc không hợp lệ.',
        },
      });
    }

    if (startTime >= endTime) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_INVALID_TIME_RANGE',
          message: 'Thời gian bắt đầu phải trước thời gian kết thúc.',
        },
      });
    }

    if (teaserStartAt) {
      if (isNaN(teaserStartAt.getTime())) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_INVALID_TEASER_TIME',
            message: 'Thời gian hiển thị trước (Teaser) không hợp lệ.',
          },
        });
      }
      if (teaserStartAt > startTime) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_INVALID_TEASER_RANGE',
            message: 'Thời gian hiển thị trước (Teaser) phải diễn ra trước hoặc cùng lúc với giờ bắt đầu Flash Sale.',
          },
        });
      }
    }
  }

  /**
   * 2. Kiểm tra danh sách khung giờ (Slots) trong chiến dịch:
   * - Phải có ít nhất 1 slot
   * - Mọi slot phải nằm trong khoảng [startTime, endTime] của chiến dịch
   * - Các slot không được overlap lẫn nhau
   */
  validateSlots(
    slots: SlotDefinitionInput[],
    campaignStartTime: Date,
    campaignEndTime: Date,
  ): void {
    if (!slots || slots.length === 0) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_SLOTS_EMPTY',
          message: 'Chiến dịch Flash Sale bắt buộc phải có ít nhất 1 khung giờ.',
        },
      });
    }

    const parsedSlots = slots.map((s, idx) => {
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      if (isNaN(sStart.getTime()) || isNaN(sEnd.getTime()) || sStart >= sEnd) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_SLOT_INVALID_RANGE',
            message: `Khung giờ "${s.name || `Khung ${idx + 1}`}" có thời gian không hợp lệ (Bắt đầu phải trước Kết thúc).`,
          },
        });
      }

      if (sStart < campaignStartTime || sEnd > campaignEndTime) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_SLOT_OUT_OF_CAMPAIGN',
            message: `Khung giờ "${s.name}" phải nằm trọn trong thời gian diễn ra chiến dịch (${campaignStartTime.toLocaleTimeString()} - ${campaignEndTime.toLocaleTimeString()}).`,
          },
        });
      }

      return {
        ...s,
        sStart,
        sEnd,
      };
    });

    // Sắp xếp theo thời gian bắt đầu để kiểm tra overlap giữa các slots
    parsedSlots.sort((a, b) => a.sStart.getTime() - b.sStart.getTime());

    for (let i = 0; i < parsedSlots.length - 1; i++) {
      const current = parsedSlots[i];
      const next = parsedSlots[i + 1];

      // Giao thoa nếu start của slot sau < end của slot trước
      if (next.sStart < current.sEnd) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_SLOT_CONFLICT',
            message: `Xung đột khung giờ: "${current.name}" (${current.sStart.toLocaleTimeString()} - ${current.sEnd.toLocaleTimeString()}) bị trùng lặp thời gian với "${next.name}" (${next.sStart.toLocaleTimeString()} - ${next.sEnd.toLocaleTimeString()}).`,
          },
        });
      }
    }
  }

  /**
   * 3. Kiểm tra xung đột giữa các chiến dịch (Campaign Collision) theo Chi nhánh:
   * - Quét các chiến dịch SCHEDULED, UPCOMING, ACTIVE
   * - Nếu trùng thời gian và cùng áp dụng ALL_BRANCHES hoặc giao nhau về branchIds -> BÁO LỖI
   */
  async detectCampaignCollisions(params: CampaignCollisionParams): Promise<void> {
    const { campaignId, startTime, endTime, branchIds } = params;

    // Lấy tất cả chiến dịch đang hoặc sẽ chạy (trừ DRAFT, CANCELLED, ENDED)
    const candidates = await this.prisma.flashSale.findMany({
      where: {
        id: campaignId ? { not: campaignId } : undefined,
        status: { in: ['SCHEDULED', 'UPCOMING', 'ACTIVE'] },
        isActive: true,
        // Điều kiện giao thoa thời gian: newStart < existingEnd AND newEnd > existingStart
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: {
        branches: { select: { id: true, name: true } },
      },
    });

    if (candidates.length === 0) return;

    const isAllBranches = !branchIds || branchIds.length === 0;

    for (const cand of candidates) {
      const candIsAllBranches = cand.branches.length === 0;

      let hasCollision = false;
      let collisionBranchName = '';

      if (isAllBranches || candIsAllBranches) {
        hasCollision = true;
        collisionBranchName = isAllBranches && candIsAllBranches ? 'Toàn bộ chi nhánh' : cand.branches.map((b) => b.name).join(', ') || 'Toàn hệ thống';
      } else {
        // Kiểm tra tập giao chi nhánh
        const candBranchIds = new Set(cand.branches.map((b) => b.id));
        const overlapBranch = branchIds.find((id) => candBranchIds.has(id));
        if (overlapBranch) {
          hasCollision = true;
          collisionBranchName = cand.branches.find((b) => b.id === overlapBranch)?.name || overlapBranch;
        }
      }

      if (hasCollision) {
        const startStr = cand.startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const endStr = cand.endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_CONFLICT',
            message: `Trùng lịch Flash Sale: Thời gian bị trùng với chiến dịch "${cand.name}" (${startStr} - ${endStr}) đang áp dụng tại ${collisionBranchName}.`,
            details: {
              conflictingCampaignId: cand.id,
              conflictingCampaignName: cand.name,
              branch: collisionBranchName,
            },
          },
        });
      }
    }
  }

  /**
   * 4. Kiểm tra xung đột món ăn (Product Collision):
   * Đảm bảo 1 món không thuộc 2 slot Flash Sale overlap trong cùng chi nhánh
   */
  async detectProductCollisions(params: ProductCollisionParams): Promise<void> {
    const { campaignId, slotStartTime, slotEndTime, branchIds, productIds } = params;
    if (!productIds || productIds.length === 0) return;

    const overlappingItems = await this.prisma.flashSaleItem.findMany({
      where: {
        flashSaleId: campaignId ? { not: campaignId } : undefined,
        productId: { in: productIds },
        isActive: true,
        flashSale: {
          status: { in: ['SCHEDULED', 'UPCOMING', 'ACTIVE'] },
          isActive: true,
          startTime: { lt: slotEndTime },
          endTime: { gt: slotStartTime },
        },
      },
      include: {
        product: { select: { name: true, itemCode: true } },
        flashSale: {
          include: {
            branches: { select: { id: true, name: true } },
          },
        },
        slot: true,
      },
    });

    if (overlappingItems.length === 0) return;

    const isAllBranches = !branchIds || branchIds.length === 0;

    for (const item of overlappingItems) {
      const cand = item.flashSale;
      const candIsAllBranches = cand.branches.length === 0;

      let hasCollision = false;
      let collisionBranchName = '';

      if (isAllBranches || candIsAllBranches) {
        hasCollision = true;
        collisionBranchName = isAllBranches && candIsAllBranches ? 'Toàn hệ thống' : cand.branches.map((b) => b.name).join(', ');
      } else {
        const candBranchIds = new Set(cand.branches.map((b) => b.id));
        const overlapBranch = branchIds.find((id) => candBranchIds.has(id));
        if (overlapBranch) {
          hasCollision = true;
          collisionBranchName = cand.branches.find((b) => b.id === overlapBranch)?.name || overlapBranch;
        }
      }

      if (hasCollision) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_PRODUCT_CONFLICT',
            message: `Sản phẩm "${item.product.name}" (${item.product.itemCode}) đã được xếp vào chiến dịch "${cand.name}" trong cùng khoảng thời gian tại ${collisionBranchName}.`,
            details: {
              productId: item.productId,
              productName: item.product.name,
              conflictingCampaignId: cand.id,
              conflictingCampaignName: cand.name,
            },
          },
        });
      }
    }
  }

  /**
   * 5. Pre-Publish Checklist Engine:
   * Kiểm tra toàn diện 8 tiêu chí trước khi cho phép xuất bản chiến dịch
   */
  async validatePrePublishChecklist(flashSaleId: string): Promise<PrePublishChecklistResult> {
    const campaign = await this.prisma.flashSale.findUnique({
      where: { id: flashSaleId },
      include: {
        slots: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
        items: {
          include: { product: true },
        },
        branches: true,
      },
    });

    if (!campaign) {
      throw new BadRequestException({
        success: false,
        statusCode: 404,
        error: { code: 'FLASH_SALE_NOT_FOUND', message: 'Không tìm thấy chiến dịch Flash Sale.' },
      });
    }

    const checklist: ChecklistItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Tiêu chí 1: Thời gian chiến dịch
    const timeValid = campaign.startTime < campaign.endTime;
    checklist.push({
      key: 'time_bounds',
      title: 'Thời gian chiến dịch hợp lệ',
      passed: timeValid,
      message: timeValid ? undefined : 'Thời gian bắt đầu phải trước thời gian kết thúc',
    });
    if (!timeValid) errors.push('Thời gian bắt đầu phải trước thời gian kết thúc.');

    // Tiêu chí 2: Khung giờ (Slots)
    const hasSlots = campaign.slots.length > 0;
    checklist.push({
      key: 'slots_present',
      title: `Có ${campaign.slots.length} khung giờ được cấu hình`,
      passed: hasSlots,
      message: hasSlots ? undefined : 'Cần ít nhất 1 khung giờ hoạt động',
    });
    if (!hasSlots) errors.push('Chiến dịch chưa có khung giờ hoạt động nào.');

    // Tiêu chí 3: Sản phẩm
    const allItems = campaign.slots.flatMap((s) => s.items).concat(campaign.items.filter((it) => !it.flashSaleSlotId));
    const hasProducts = allItems.length > 0;
    checklist.push({
      key: 'products_present',
      title: `Có ${allItems.length} suất sản phẩm tham gia`,
      passed: hasProducts,
      message: hasProducts ? undefined : 'Chưa có sản phẩm nào trong chiến dịch',
    });
    if (!hasProducts) errors.push('Chiến dịch chưa có sản phẩm nào được chọn.');

    // Tiêu chí 4: Giá bán & Tồn kho
    let pricingValid = true;
    for (const item of allItems) {
      if (item.flashSalePrice <= 0) {
        pricingValid = false;
        errors.push(`Món "${item.product.name}" có giá Flash Sale không hợp lệ (${item.flashSalePrice}).`);
      }
      if (item.stock <= 0) {
        pricingValid = false;
        errors.push(`Món "${item.product.name}" có tồn kho Flash Sale <= 0.`);
      }
      if (item.flashSalePrice >= item.product.price) {
        warnings.push(`Món "${item.product.name}" có giá Flash Sale (${item.flashSalePrice.toLocaleString('vi-VN')}đ) không thấp hơn giá thường (${item.product.price.toLocaleString('vi-VN')}đ).`);
      }
    }
    checklist.push({
      key: 'pricing_stock_valid',
      title: 'Giá bán & Flash stock hợp lệ',
      passed: pricingValid,
      message: pricingValid ? undefined : 'Tồn tại sản phẩm có giá <= 0 hoặc tồn kho <= 0',
    });

    // Tiêu chí 5: Xung đột chiến dịch (Campaign Collision)
    let collisionFree = true;
    try {
      await this.detectCampaignCollisions({
        campaignId: campaign.id,
        startTime: campaign.startTime,
        endTime: campaign.endTime,
        branchIds: campaign.branches.map((b) => b.id),
      });
      checklist.push({
        key: 'campaign_collision_free',
        title: 'Không trùng lịch với chiến dịch khác',
        passed: true,
      });
    } catch (e: any) {
      collisionFree = false;
      const msg = e?.response?.error?.message || e.message;
      checklist.push({
        key: 'campaign_collision_free',
        title: 'Không trùng lịch với chiến dịch khác',
        passed: false,
        message: msg,
      });
      errors.push(msg);
    }

    // Tiêu chí 6: Xung đột sản phẩm (Product Collision)
    let productCollisionFree = true;
    try {
      for (const slot of campaign.slots) {
        const pIds = slot.items.map((it) => it.productId);
        if (pIds.length > 0) {
          await this.detectProductCollisions({
            campaignId: campaign.id,
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
            branchIds: campaign.branches.map((b) => b.id),
            productIds: pIds,
          });
        }
      }
      checklist.push({
        key: 'product_collision_free',
        title: 'Không trùng lặp sản phẩm đang Flash Sale',
        passed: true,
      });
    } catch (e: any) {
      productCollisionFree = false;
      const msg = e?.response?.error?.message || e.message;
      checklist.push({
        key: 'product_collision_free',
        title: 'Không trùng lặp sản phẩm đang Flash Sale',
        passed: false,
        message: msg,
      });
      errors.push(msg);
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      checklist,
      errors,
      warnings,
    };
  }
}
