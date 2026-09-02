import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('tiers')
  async getTiers() {
    return this.membershipService.getTiers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProgress(@Request() req: any) {
    return this.membershipService.getMyProgress(req.user.id);
  }
}
