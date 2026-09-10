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
      subTotal?: number;
      shippingVoucherCode?: string;
    },
    @Req() req: any,
  ) {
    const user = req.user || null;
    const data = await this.shippingFeeService.getShippingQuote({
      branchId: body.branchId,
      addressId: body.addressId,
      destinationLat: body.destinationLat ? Number(body.destinationLat) : undefined,
      destinationLng: body.destinationLng ? Number(body.destinationLng) : undefined,
      subTotal: body.subTotal ? Number(body.subTotal) : 0,
      shippingVoucherCode: body.shippingVoucherCode,
      user,
    });

    return {
      success: true,
      data,
    };
  }
}
