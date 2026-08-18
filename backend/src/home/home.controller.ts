import { Controller, Get } from '@nestjs/common';
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
}
