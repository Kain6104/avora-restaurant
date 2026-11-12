import { Controller, Get, Param } from '@nestjs/common';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  async getHomePageData() {
    return this.homeService.getHomePageData();
  }

  @Get('branches')
  async getBranches() {
    return this.homeService.getBranches();
  }

  @Get('branches/:slugOrId')
  async getBranchDetail(@Param('slugOrId') slugOrId: string) {
    return this.homeService.getBranchDetail(slugOrId);
  }

  @Get('settings')
  async getSettings() {
    return this.homeService.getSettings();
  }
}
