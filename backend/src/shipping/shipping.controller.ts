import { Controller, Post, Body, Req } from '@nestjs/common';
import { ShippingFeeService } from './shipping-fee.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingFeeService: ShippingFeeService) {}

  @Post('quote')
  async getQuote(
    @Body()
    body: {
      branchId?: string;
      addressId?: string;
      destinationLat?: number;
      destinationLng?: number;
      lat?: number;
      lng?: number;
      subTotal?: number;
      subtotal?: number;
      shippingVoucherCode?: string;
    },
    @Req() req: any,
  ) {
    const user = req.user || null;
    const destLat = body.destinationLat ?? body.lat;
    const destLng = body.destinationLng ?? body.lng;
    const sub = body.subTotal ?? body.subtotal ?? 0;

    const data = await this.shippingFeeService.getShippingQuote({
      branchId: body.branchId ? String(body.branchId) : undefined,
      addressId: body.addressId,
      destinationLat: destLat !== undefined && destLat !== null ? Number(destLat) : undefined,
      destinationLng: destLng !== undefined && destLng !== null ? Number(destLng) : undefined,
      subTotal: Number(sub) || 0,
      shippingVoucherCode: body.shippingVoucherCode,
      user,
    });

    return {
      success: true,
      data,
    };
  }
}
