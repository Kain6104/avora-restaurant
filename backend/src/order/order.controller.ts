import { Controller, Post, Body, UseGuards, Request, Get, Param, Patch } from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrder(@Request() req, @Body() payload: any) {
    const userId = req.user.id;
    return this.orderService.createOrder(userId, payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getOrders(@Request() req) {
    return this.orderService.getOrders(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orderCode')
  async getOrderByCode(@Request() req, @Param('orderCode') orderCode: string) {
    return this.orderService.getOrderByCode(req.user.id, orderCode);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':orderCode/cancel')
  async cancelOrder(
    @Request() req, 
    @Param('orderCode') orderCode: string,
    @Body('reason') reason: string
  ) {
    return this.orderService.cancelOrder(req.user.id, orderCode, reason);
  }
}
