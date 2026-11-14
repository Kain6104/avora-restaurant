import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CartService, CartIdentifier } from './cart.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import * as crypto from 'crypto';
import {
  AddToCartDto,
  UpdateCartItemDto,
  SwitchBranchDto,
  ReplaceCartItemDto,
  MergeGuestCartDto,
  SyncCartDto,
} from './dto/cart.dto';

const GUEST_COOKIE_NAME = 'avora_guest_token';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Trích xuất CartIdentifier từ JWT hoặc Cookie, tự động sinh guest token nếu chưa có
   */
  private resolveIdentifier(
    req: Request,
    res: Response,
    branchIdQuery?: string,
  ): CartIdentifier {
    const user = (req as any).user;
    const isSecure =
      process.env.NODE_ENV === 'production' ||
      process.env.FRONTEND_URL?.startsWith('https');

    if (user?.id) {
      return {
        userId: user.id,
        branchId: branchIdQuery,
      };
    }

    let guestToken = req.cookies?.[GUEST_COOKIE_NAME];
    if (!guestToken) {
      guestToken = crypto.randomBytes(32).toString('hex');
      res.cookie(GUEST_COOKIE_NAME, guestToken, {
        httpOnly: true,
        secure: !!isSecure,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
      });
    }

    return {
      guestToken,
      branchId: branchIdQuery,
    };
  }

  /**
   * Lấy thông tin giỏ hàng hiện tại (hỗ trợ cả Member và Guest)
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('branchId') branchId?: string,
  ) {
    const user = (req as any).user;
    const guestCookie = req.cookies?.[GUEST_COOKIE_NAME];

    // Tự động merge guest cart vào user cart nếu vừa đăng nhập và vẫn còn cookie guest
    if (user?.id && guestCookie) {
      try {
        await this.cartService.mergeGuestCart(user.id, guestCookie);
        const isSecure =
          process.env.NODE_ENV === 'production' ||
          process.env.FRONTEND_URL?.startsWith('https');
        res.clearCookie(GUEST_COOKIE_NAME, {
          path: '/',
          httpOnly: true,
          secure: !!isSecure,
          sameSite: 'lax',
        });
      } catch (err) {
        // Log merge error if any
      }
    }

    const identifier = this.resolveIdentifier(req, res, branchId);
    const cart = await this.cartService.getOrCreateCart(identifier);
    return {
      success: true,
      data: cart,
    };
  }

  /**
   * Thêm món vào giỏ hàng
   */
  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddToCartDto,
  ) {
    const identifier = this.resolveIdentifier(req, res, dto.branchId);
    const cart = await this.cartService.addItem(dto, identifier);
    return {
      success: true,
      message: 'Đã thêm món vào giỏ hàng thành công.',
      data: cart,
    };
  }

  /**
   * Cập nhật món trong giỏ hàng
   */
  @Put('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async updateItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const identifier = this.resolveIdentifier(req, res);
    const cart = await this.cartService.updateItem(itemId, dto, identifier);
    return {
      success: true,
      message: 'Đã cập nhật giỏ hàng thành công.',
      data: cart,
    };
  }

  /**
   * Xóa một món khỏi giỏ hàng
   */
  @Delete('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async removeItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id') itemId: string,
  ) {
    const identifier = this.resolveIdentifier(req, res);
    const cart = await this.cartService.removeItem(itemId, identifier);
    return {
      success: true,
      message: 'Đã xóa món khỏi giỏ hàng.',
      data: cart,
    };
  }

  /**
   * Làm trống toàn bộ giỏ hàng
   */
  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  async clearCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = this.resolveIdentifier(req, res);
    const cart = await this.cartService.clearCart(identifier);
    return {
      success: true,
      message: 'Đã làm trống giỏ hàng.',
      data: cart,
    };
  }

  /**
   * Hợp nhất Guest Cart vào User Cart thủ công
   */
  @Post('merge')
  @UseGuards(OptionalJwtAuthGuard)
  async mergeGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: MergeGuestCartDto,
  ) {
    const user = (req as any).user;
    if (!user?.id) {
      return {
        success: false,
        message: 'Bạn chưa đăng nhập tài khoản.',
      };
    }

    const cart = await this.cartService.mergeGuestCart(user.id, dto.guestToken);
    const isSecure =
      process.env.NODE_ENV === 'production' ||
      process.env.FRONTEND_URL?.startsWith('https');
    res.clearCookie(GUEST_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: !!isSecure,
      sameSite: 'lax',
    });

    return {
      success: true,
      message: 'Đã đồng bộ giỏ hàng với tài khoản.',
      data: cart,
    };
  }

  /**
   * Đồng bộ toàn bộ danh sách món từ Client vào Database (Lưu trữ DB)
   */
  @Post('sync')
  @UseGuards(OptionalJwtAuthGuard)
  async syncCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: SyncCartDto,
  ) {
    const identifier = this.resolveIdentifier(req, res, dto.branchId);
    const cart = await this.cartService.syncCart(dto, identifier);
    return {
      success: true,
      message: 'Đã đồng bộ giỏ hàng với Database.',
      data: cart,
    };
  }

  /**
   * Kiểm tra khả dụng khi đổi chi nhánh (dùng cho modal cảnh báo đổi chi nhánh)
   */
  @Get('validate-switch')
  @UseGuards(OptionalJwtAuthGuard)
  async validateSwitch(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('targetBranchId') targetBranchId: string,
  ) {
    const identifier = this.resolveIdentifier(req, res);
    const result = await this.cartService.validateBranchSwitch(targetBranchId, identifier);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Xác nhận đổi chi nhánh
   */
  @Post('confirm-switch')
  @UseGuards(OptionalJwtAuthGuard)
  async confirmSwitch(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { branchId: string; keepUnavailable?: boolean },
  ) {
    const identifier = this.resolveIdentifier(req, res);
    const cart = await this.cartService.confirmBranchSwitch(
      body.branchId,
      body.keepUnavailable ?? true,
      identifier,
    );
    return {
      success: true,
      message: 'Đã chuyển đổi chi nhánh cho giỏ hàng.',
      data: cart,
    };
  }

  /**
   * Danh sách chi nhánh đang bán một món cụ thể (dùng cho modal "Xem chi nhánh có hàng")
   */
  @Get('product-branches/:productId')
  async getProductBranches(@Param('productId') productId: string) {
    const result = await this.cartService.getBranchesSellingProduct(productId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Danh sách món thay thế khả dụng tại chi nhánh (dùng cho modal "Chọn món thay thế")
   */
  @Get('replacements')
  async getReplacements(
    @Query('productId') productId: string,
    @Query('branchId') branchId?: string,
  ) {
    const result = await this.cartService.getReplacementDishes(productId, branchId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Thay thế món không khả dụng bằng món khác
   */
  @Post('replace-item')
  @UseGuards(OptionalJwtAuthGuard)
  async replaceItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ReplaceCartItemDto,
  ) {
    const identifier = this.resolveIdentifier(req, res);
    const cart = await this.cartService.replaceCartItem(dto, identifier);
    return {
      success: true,
      message: 'Đã thay thế món ăn thành công.',
      data: cart,
    };
  }
}

