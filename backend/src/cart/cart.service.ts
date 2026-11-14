import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import {
  AddToCartDto,
  UpdateCartItemDto,
  ReplaceCartItemDto,
  SelectedOptionDto,
  SyncCartDto,
} from './dto/cart.dto';

export interface CartIdentifier {
  userId?: string;
  guestToken?: string;
  branchId?: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Băm SHA-256 guest token để lưu trữ an toàn trong DB
   */
  hashGuestToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Lấy hoặc tạo giỏ hàng cho User hoặc Guest
   */
  async getOrCreateCart(identifier: CartIdentifier) {
    const { userId, guestToken, branchId } = identifier;

    if (!userId && !guestToken) {
      throw new BadRequestException('Phải cung cấp userId hoặc guestToken để xác định giỏ hàng.');
    }

    let cart: any = null;

    if (userId) {
      cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  branches: true,
                  optionGroups: {
                    include: {
                      optionItems: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          branch: true,
        },
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: {
            userId,
            branchId: branchId || null,
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    branches: true,
                    optionGroups: {
                      include: {
                        optionItems: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            branch: true,
          },
        });
      } else if (branchId && !cart.branchId) {
        // Cập nhật branchId nếu chưa có
        cart = await this.prisma.cart.update({
          where: { id: cart.id },
          data: { branchId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    branches: true,
                    optionGroups: {
                      include: {
                        optionItems: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            branch: true,
          },
        });
      }
    } else if (guestToken) {
      const guestTokenHash = this.hashGuestToken(guestToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày TTL

      cart = await this.prisma.cart.findUnique({
        where: { guestTokenHash },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  branches: true,
                  optionGroups: {
                    include: {
                      optionItems: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          branch: true,
        },
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: {
            guestTokenHash,
            branchId: branchId || null,
            expiresAt,
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    branches: true,
                    optionGroups: {
                      include: {
                        optionItems: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            branch: true,
          },
        });
      } else if (branchId && !cart.branchId) {
        cart = await this.prisma.cart.update({
          where: { id: cart.id },
          data: { branchId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    branches: true,
                    optionGroups: {
                      include: {
                        optionItems: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            branch: true,
          },
        });
      }
    }

    return this.enrichCartWithAvailability(cart);
  }

  /**
   * Tính toán tính khả dụng của từng món tại chi nhánh hiện tại
   */
  private enrichCartWithAvailability(cart: any) {
    if (!cart) return null;

    const currentBranchId = cart.branchId;

    let totalAvailableQuantity = 0;
    let totalAvailableAmount = 0;
    let hasUnavailableItems = false;

    const enrichedItems = (cart.items || []).map((item: any) => {
      const prod = item.product;
      let isAvailable = true;
      let unavailabilityReason: 'OUT_OF_STOCK' | 'NOT_SOLD_AT_BRANCH' | 'INACTIVE' | null = null;
      let unavailabilityMessage = '';

      if (!prod) {
        isAvailable = false;
        unavailabilityReason = 'INACTIVE';
        unavailabilityMessage = 'Món ăn hiện đã ngưng phục vụ.';
      } else if (!prod.available) {
        isAvailable = false;
        unavailabilityReason = 'OUT_OF_STOCK';
        unavailabilityMessage = 'Món ăn hiện đang tạm hết hàng.';
      } else if (currentBranchId && Array.isArray(prod.branches) && prod.branches.length > 0) {
        const branchMatch = prod.branches.some((b: any) => b.id === currentBranchId);
        if (!branchMatch) {
          isAvailable = false;
          unavailabilityReason = 'NOT_SOLD_AT_BRANCH';
          unavailabilityMessage = `Món ăn này không phục vụ tại chi nhánh ${cart.branch?.name || 'đã chọn'}.`;
        }
      }

      const itemTotal = Number(item.priceAtSale) * item.quantity;

      if (isAvailable) {
        totalAvailableQuantity += item.quantity;
        totalAvailableAmount += itemTotal;
      } else {
        hasUnavailableItems = true;
      }

      return {
        id: item.id,
        productId: item.productId,
        name: prod?.name || 'Món ăn',
        slug: prod?.slug || '',
        categorySlug: prod?.category?.slug || '',
        image: prod?.imageUrl || '',
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        originalPriceAtSale: item.originalPriceAtSale,
        optionsTextSnapshot: item.optionsTextSnapshot,
        selectedOptions: item.selectedOptionsJson || [],
        note: item.note,
        isFlashSaleItem: item.isFlashSaleItem,
        flashSaleId: item.flashSaleId,
        isCombo: item.isCombo,
        comboId: item.comboId,
        isCustomRecipe: item.isCustomRecipe,
        customRecipeData: item.customRecipeData,
        itemTotal,
        isAvailableAtBranch: isAvailable,
        unavailabilityReason,
        unavailabilityMessage,
        createdAt: item.createdAt,
      };
    });

    return {
      id: cart.id,
      userId: cart.userId,
      branchId: cart.branchId,
      branch: cart.branch
        ? {
            id: cart.branch.id,
            name: cart.branch.name,
            phone: cart.branch.phone,
            street: cart.branch.street,
            ward: cart.branch.ward,
            district: cart.branch.district,
            province: cart.branch.province,
          }
        : null,
      items: enrichedItems,
      totalItemsCount: enrichedItems.length,
      totalQuantity: enrichedItems.reduce((acc: number, cur: any) => acc + cur.quantity, 0),
      totalAvailableQuantity,
      totalAvailableAmount,
      hasUnavailableItems,
      cartVersion: cart.cartVersion,
      updatedAt: cart.updatedAt,
    };
  }

  /**
   * Thêm món vào giỏ hàng
   */
  async addItem(dto: AddToCartDto, identifier: CartIdentifier) {
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Không thể khởi tạo giỏ hàng.');
    }

    // Xác thực sản phẩm từ DB - Tuyệt đối không tin tưởng giá từ client
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        category: true,
        branches: true,
        optionGroups: {
          include: {
            optionItems: true,
          },
        },
      },
    });

    if (!product || !product.available) {
      throw new BadRequestException('Món ăn không tồn tại hoặc đã ngừng phục vụ.');
    }

    // Tính giá chuẩn xác: price + tổng priceAdjustment của options
    let computedPrice = Number(product.price);
    let originalPrice = Number(product.oldPrice || product.price);
    const optionDescriptions: string[] = [];

    if (dto.selectedOptions && dto.selectedOptions.length > 0) {
      for (const opt of dto.selectedOptions) {
        for (const og of product.optionGroups) {
          const matchedItem = og.optionItems.find((i: any) => i.id === opt.optionItemId);
          if (matchedItem) {
            const adj = Number(matchedItem.priceAdjustment || 0);
            computedPrice += adj;
            originalPrice += adj;
            optionDescriptions.push(`${og.name}: ${matchedItem.name}`);
            break;
          }
        }
      }
    }

    const optionsTextSnapshot = optionDescriptions.join(', ') || null;
    const selectedOptionsJson = dto.selectedOptions || [];
    const note = dto.note?.trim() || null;

    // Chuẩn hóa JSON options để so sánh chính xác các dòng món
    const normalizedNewOptions = JSON.stringify(
      [...selectedOptionsJson].sort((a, b) => a.optionItemId.localeCompare(b.optionItemId)),
    );

    // Tìm xem món tương tự đã có trong giỏ chưa
    const existingItems = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id, productId: dto.productId },
    });

    const matchingItem = existingItems.find((item) => {
      const itemOptions = Array.isArray(item.selectedOptionsJson)
        ? (item.selectedOptionsJson as any as SelectedOptionDto[])
        : [];
      const normalizedItemOptions = JSON.stringify(
        [...itemOptions].sort((a, b) => a.optionItemId.localeCompare(b.optionItemId)),
      );

      return (
        normalizedItemOptions === normalizedNewOptions &&
        (item.note || null) === note &&
        Boolean(item.isCustomRecipe) === Boolean(dto.isCustomRecipe)
      );
    });

    if (matchingItem) {
      await this.prisma.cartItem.update({
        where: { id: matchingItem.id },
        data: {
          quantity: matchingItem.quantity + dto.quantity,
          priceAtSale: computedPrice,
          originalPriceAtSale: originalPrice,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
          priceAtSale: computedPrice,
          originalPriceAtSale: originalPrice,
          optionsTextSnapshot,
          selectedOptionsJson: selectedOptionsJson as any,
          note,
          isFlashSaleItem: Boolean(dto.isFlashSaleItem),
          flashSaleId: dto.flashSaleId || null,
          isCombo: Boolean(dto.isCombo),
          comboId: dto.comboId || null,
          isCustomRecipe: Boolean(dto.isCustomRecipe),
          customRecipeData: dto.customRecipeData || null,
        },
      });
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        cartVersion: { increment: 1 },
        branchId: dto.branchId || cart.branchId,
      },
    });

    return this.getOrCreateCart(identifier);
  }

  /**
   * Cập nhật số lượng, ghi chú hoặc options của một món
   */
  async updateItem(itemId: string, dto: UpdateCartItemDto, identifier: CartIdentifier) {
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Giỏ hàng không hợp lệ.');
    }

    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: {
        product: {
          include: {
            optionGroups: {
              include: {
                optionItems: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Món ăn không tồn tại trong giỏ hàng.');
    }

    if (dto.quantity <= 0) {
      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });
    } else {
      let computedPrice = Number(item.product.price);
      let originalPrice = Number(item.product.oldPrice || item.product.price);
      const optionDescriptions: string[] = [];

      const optionsToUse = dto.selectedOptions !== undefined
        ? dto.selectedOptions
        : (Array.isArray(item.selectedOptionsJson) ? (item.selectedOptionsJson as any as SelectedOptionDto[]) : []);

      if (optionsToUse && optionsToUse.length > 0) {
        for (const opt of optionsToUse) {
          for (const og of item.product.optionGroups) {
            const matchedItem = og.optionItems.find((i: any) => i.id === opt.optionItemId);
            if (matchedItem) {
              const adj = Number(matchedItem.priceAdjustment || 0);
              computedPrice += adj;
              originalPrice += adj;
              optionDescriptions.push(`${og.name}: ${matchedItem.name}`);
              break;
            }
          }
        }
      }

      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: dto.quantity,
          note: dto.note !== undefined ? dto.note.trim() : item.note,
          selectedOptionsJson: dto.selectedOptions !== undefined ? (dto.selectedOptions as any) : item.selectedOptionsJson,
          optionsTextSnapshot: optionDescriptions.length > 0 ? optionDescriptions.join(', ') : item.optionsTextSnapshot,
          priceAtSale: computedPrice,
          originalPriceAtSale: originalPrice,
        },
      });
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { cartVersion: { increment: 1 } },
    });

    return this.getOrCreateCart(identifier);
  }

  /**
   * Xóa một món khỏi giỏ hàng
   */
  async removeItem(itemId: string, identifier: CartIdentifier) {
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Giỏ hàng không hợp lệ.');
    }

    await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { cartVersion: { increment: 1 } },
    });

    return this.getOrCreateCart(identifier);
  }

  /**
   * Làm trống toàn bộ giỏ hàng
   */
  async clearCart(identifier: CartIdentifier) {
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Giỏ hàng không hợp lệ.');
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { cartVersion: { increment: 1 } },
    });

    return this.getOrCreateCart(identifier);
  }

  /**
   * Hợp nhất Guest Cart vào User Cart khi khách hàng đăng nhập
   */
  async mergeGuestCart(userId: string, guestToken: string) {
    if (!guestToken || !userId) return;

    const guestTokenHash = this.hashGuestToken(guestToken);
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestTokenHash },
      include: { items: true },
    });

    if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
      return this.getOrCreateCart({ userId });
    }

    const userCart = await this.getOrCreateCart({ userId });
    if (!userCart) return null;

    await this.prisma.$transaction(async (tx) => {
      for (const guestItem of guestCart.items) {
        const existingItems = await tx.cartItem.findMany({
          where: { cartId: userCart.id, productId: guestItem.productId },
        });

        const matching = existingItems.find((ui) => {
          return (
            JSON.stringify(ui.selectedOptionsJson || []) === JSON.stringify(guestItem.selectedOptionsJson || []) &&
            (ui.note || null) === (guestItem.note || null)
          );
        });

        if (matching) {
          await tx.cartItem.update({
            where: { id: matching.id },
            data: {
              quantity: matching.quantity + guestItem.quantity,
            },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: guestItem.productId,
              quantity: guestItem.quantity,
              priceAtSale: guestItem.priceAtSale,
              originalPriceAtSale: guestItem.originalPriceAtSale,
              optionsTextSnapshot: guestItem.optionsTextSnapshot,
              selectedOptionsJson: guestItem.selectedOptionsJson as any,
              note: guestItem.note,
              isFlashSaleItem: guestItem.isFlashSaleItem,
              flashSaleId: guestItem.flashSaleId,
              isCombo: guestItem.isCombo,
              comboId: guestItem.comboId,
              isCustomRecipe: guestItem.isCustomRecipe,
              customRecipeData: guestItem.customRecipeData as any,
            },
          });
        }
      }

      if (!userCart.branchId && guestCart.branchId) {
        await tx.cart.update({
          where: { id: userCart.id },
          data: {
            branchId: guestCart.branchId,
            cartVersion: { increment: 1 },
          },
        });
      }

      await tx.cart.delete({
        where: { id: guestCart.id },
      });
    });

    return this.getOrCreateCart({ userId });
  }

  /**
   * Đồng bộ toàn bộ giỏ hàng từ Client vào Database (Lưu trữ DB thật cho Member/Guest)
   */
  async syncCart(dto: SyncCartDto, identifier: CartIdentifier) {
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Không thể khởi tạo giỏ hàng.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Cập nhật chi nhánh nếu có
      if (dto.branchId) {
        await tx.cart.update({
          where: { id: cart.id },
          data: {
            branchId: dto.branchId,
            cartVersion: { increment: 1 },
          },
        });
      } else {
        await tx.cart.update({
          where: { id: cart.id },
          data: { cartVersion: { increment: 1 } },
        });
      }

      // Xóa tất cả món cũ trong giỏ hàng
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      // Tạo các món mới
      if (dto.items && dto.items.length > 0) {
        for (const it of dto.items) {
          const lookupId = it.productId || (it as any).id;
          if (!lookupId) continue;
          const cleanId = String(lookupId)
            .replace(/^(cart|line|combo|prod)[-_]/gi, '')
            .replace(/[-_](base|normal|fs|default)$/gi, '')
            .trim();

          const product = await tx.product.findFirst({
            where: {
              OR: [
                { id: cleanId },
                { slug: cleanId },
                { itemCode: cleanId },
                { id: lookupId },
                { slug: lookupId },
                { itemCode: lookupId },
              ],
            },
            include: { optionGroups: { include: { optionItems: true } } },
          });

          if (!product) continue;

          let optionsText = it.optionsTextSnapshot || '';
          const calcPrice = Number(it.priceAtSale ?? product.price ?? 0);
          const origPrice = Number(it.originalPriceAtSale ?? product.price ?? 0);

          if (!optionsText && it.selectedOptions && it.selectedOptions.length > 0) {
            const allItems = product.optionGroups.flatMap((g) => g.optionItems);
            optionsText = it.selectedOptions
              .map((so) => {
                const found = allItems.find((oi) => oi.id === so.optionItemId);
                return so.nameAtSale || found?.name;
              })
              .filter(Boolean)
              .join(', ');
          }

          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: product.id,
              quantity: Math.max(1, Number(it.quantity) || 1),
              priceAtSale: calcPrice,
              originalPriceAtSale: origPrice,
              optionsTextSnapshot: optionsText || null,
              selectedOptionsJson: it.selectedOptions ? (it.selectedOptions as any) : null,
              isFlashSaleItem: Boolean(it.isFlashSaleItem),
              flashSaleId: it.flashSaleId || null,
              isCombo: Boolean(it.isCombo),
              comboId: it.comboId || null,
              note: it.note || null,
              isCustomRecipe: Boolean(it.isCustomRecipe),
              customRecipeData: it.customRecipeData || null,
            },
          });
        }
      }
    });

    return this.getOrCreateCart(identifier);
  }

  /**
   * Kiểm tra khả năng đổi chi nhánh
   */
  async validateBranchSwitch(targetBranchId: string, identifier: CartIdentifier) {
    const targetBranch = await this.prisma.branch.findUnique({
      where: { id: targetBranchId },
    });
    if (!targetBranch) {
      throw new NotFoundException('Chi nhánh mục tiêu không tồn tại.');
    }

    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      return {
        targetBranch,
        canSwitchDirectly: true,
        totalItems: 0,
        availableCount: 0,
        unavailableCount: 0,
        availableItems: [],
        unavailableItems: [],
      };
    }

    const availableItems: any[] = [];
    const unavailableItems: any[] = [];

    for (const item of cart.items) {
      const prod = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { branches: true },
      });

      let isAvailable = true;
      let reason = '';

      if (!prod || !prod.available) {
        isAvailable = false;
        reason = 'Tạm hết hàng hoặc đã ngừng phục vụ';
      } else if (Array.isArray(prod.branches) && prod.branches.length > 0) {
        const sellsAtBranch = prod.branches.some((b) => b.id === targetBranchId);
        if (!sellsAtBranch) {
          isAvailable = false;
          reason = `Không phục vụ tại ${targetBranch.name}`;
        }
      }

      const itemInfo = {
        ...item,
        isAvailable,
        reason,
      };

      if (isAvailable) {
        availableItems.push(itemInfo);
      } else {
        unavailableItems.push(itemInfo);
      }
    }

    return {
      targetBranch: {
        id: targetBranch.id,
        name: targetBranch.name,
        phone: targetBranch.phone,
        street: targetBranch.street,
        district: targetBranch.district,
        province: targetBranch.province,
      },
      canSwitchDirectly: unavailableItems.length === 0,
      totalItems: cart.items.length,
      availableCount: availableItems.length,
      unavailableCount: unavailableItems.length,
      availableItems,
      unavailableItems,
    };
  }

  /**
   * Xác nhận đổi chi nhánh
   */
  async confirmBranchSwitch(
    targetBranchId: string,
    keepUnavailable: boolean = true,
    identifier: CartIdentifier,
  ) {
    const validation = await this.validateBranchSwitch(targetBranchId, identifier);
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Giỏ hàng không hợp lệ.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          branchId: targetBranchId,
          cartVersion: { increment: 1 },
        },
      });

      if (!keepUnavailable && validation.unavailableItems.length > 0) {
        const unavailableIds = validation.unavailableItems.map((i) => i.id);
        await tx.cartItem.deleteMany({
          where: {
            id: { in: unavailableIds },
            cartId: cart.id,
          },
        });
      }
    });

    return this.getOrCreateCart({ ...identifier, branchId: targetBranchId });
  }

  /**
   * Lấy danh sách chi nhánh đang bán một món cụ thể
   */
  async getBranchesSellingProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        branches: {
          where: { onlineOrderingEnabled: true },
          select: {
            id: true,
            name: true,
            phone: true,
            street: true,
            ward: true,
            district: true,
            province: true,
            openTime: true,
            closeTime: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Món ăn không tồn tại.');
    }

    if (!product.branches || product.branches.length === 0) {
      const allBranches = await this.prisma.branch.findMany({
        where: { onlineOrderingEnabled: true },
        select: {
          id: true,
          name: true,
          phone: true,
          street: true,
          ward: true,
          district: true,
          province: true,
          openTime: true,
          closeTime: true,
          latitude: true,
          longitude: true,
        },
        orderBy: { name: 'asc' },
      });
      return {
        product: { id: product.id, name: product.name, image: product.imageUrl, basePrice: product.price },
        branches: allBranches,
      };
    }

    return {
      product: { id: product.id, name: product.name, image: product.imageUrl, basePrice: product.price },
      branches: product.branches,
    };
  }

  /**
   * Lấy danh sách món thay thế khả dụng tại chi nhánh hiện tại
   */
  async getReplacementDishes(productId: string, branchId?: string) {
    const currentProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true, name: true, price: true },
    });

    if (!currentProduct) {
      throw new NotFoundException('Món ăn không tồn tại.');
    }

    const replacements = await this.prisma.product.findMany({
      where: {
        categoryId: currentProduct.categoryId,
        id: { not: productId },
        available: true,
        ...(branchId
          ? {
              OR: [
                { branches: { none: {} } },
                { branches: { some: { id: branchId } } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        optionGroups: {
          include: { optionItems: true },
        },
      },
      take: 6,
    });

    return {
      originalProduct: currentProduct,
      replacements: replacements.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        categorySlug: p.category?.slug,
        image: p.imageUrl,
        basePrice: p.price,
        priceDifference: p.price - currentProduct.price,
        optionGroups: p.optionGroups,
      })),
    };
  }

  /**
   * Thay thế một món không khả dụng bằng món khác
   */
  async replaceCartItem(dto: ReplaceCartItemDto, identifier: CartIdentifier) {
    const cart = await this.getOrCreateCart(identifier);
    if (!cart) {
      throw new BadRequestException('Giỏ hàng không hợp lệ.');
    }

    const oldItem = await this.prisma.cartItem.findFirst({
      where: { id: dto.oldItemId, cartId: cart.id },
    });

    if (!oldItem) {
      throw new NotFoundException('Món cũ không tồn tại trong giỏ.');
    }

    const quantityToUse = dto.quantity || oldItem.quantity;

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: { id: oldItem.id },
      });

      const newProduct = await tx.product.findUnique({
        where: { id: dto.newProductId },
        include: {
          optionGroups: {
            include: { optionItems: true },
          },
        },
      });

      if (!newProduct || !newProduct.available) {
        throw new BadRequestException('Món thay thế không khả dụng.');
      }

      let computedPrice = Number(newProduct.price);
      let originalPrice = Number(newProduct.oldPrice || newProduct.price);
      const optionDescriptions: string[] = [];

      if (dto.selectedOptions && dto.selectedOptions.length > 0) {
        for (const opt of dto.selectedOptions) {
          for (const og of newProduct.optionGroups) {
            const matchedItem = og.optionItems.find((i: any) => i.id === opt.optionItemId);
            if (matchedItem) {
              const adj = Number(matchedItem.priceAdjustment || 0);
              computedPrice += adj;
              originalPrice += adj;
              optionDescriptions.push(`${og.name}: ${matchedItem.name}`);
              break;
            }
          }
        }
      }

      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.newProductId,
          quantity: quantityToUse,
          priceAtSale: computedPrice,
          originalPriceAtSale: originalPrice,
          optionsTextSnapshot: optionDescriptions.join(', ') || null,
          selectedOptionsJson: (dto.selectedOptions || []) as any,
          note: dto.note !== undefined ? dto.note : oldItem.note,
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { cartVersion: { increment: 1 } },
      });
    });

    return this.getOrCreateCart(identifier);
  }
}
