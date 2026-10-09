import { Controller, Get, Post, Body, Res, Query, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export interface PosUpdateManifest {
  version: string;
  build: number;
  releaseDate: string;
  updateType: 'OPTIONAL' | 'RECOMMENDED' | 'MANDATORY';
  minimumSupportedVersion: string;
  downloadUrl: string;
  sha256?: string;
  fileSize?: number;
  releaseNotes: string[];
}

@Controller('pos-desktop/update')
export class PosUpdateController {
  @Get('latest')
  getLatestUpdate(@Query('product') product?: string): PosUpdateManifest {
    if (product === 'AVORA_POS_NATIVE') {
      return {
        version: '1.0.0',
        build: 100,
        releaseDate: '2026-09-11T10:00:00+07:00',
        updateType: 'OPTIONAL',
        minimumSupportedVersion: '1.0.0',
        downloadUrl: `http://localhost:${process.env.PORT || 4001}/api/pos-desktop/update/download?product=AVORA_POS_NATIVE`,
        sha256: '',
        fileSize: 45000000,
        releaseNotes: [
          'Phiên bản AVORA POS Desktop Native 100% C# .NET 8 WPF',
          'Không phụ thuộc WebView2 / Chromium',
          'In ấn nhiệt ESC/POS và tem nhãn TSPL/ZPL tốc độ cao',
          'Hàng đợi in độc lập cho từng máy in (Per-Printer Queue)',
          'Sơ đồ bàn và giỏ hàng POS kết nối trực tiếp Backend'
        ]
      };
    }

    return {
      version: '1.0.1',
      build: 101,
      releaseDate: '2026-09-10T10:20:00+07:00',
      updateType: 'RECOMMENDED',
      minimumSupportedVersion: '1.0.0',
      downloadUrl: `http://localhost:${process.env.PORT || 4001}/api/pos-desktop/update/download`,
      sha256: 'E513E8ACF00E3D57FF12CFE112C6B4D699C30DE791692CBE3EFCA02CB67634EE',
      fileSize: 50045624,
      releaseNotes: [
        'Dedicated AvoraExitDialog WPF Window - không bị che bởi WebView2',
        'Tất cả liên kết quản trị /admin/* tự động mở bằng trình duyệt ngoài',
        'Đăng xuất Native Desktop quay về giao diện WPF, xóa sạch cookie & DPAPI session',
        'Redesign Native Login phong cách Enterprise Luxury, 100% Vector Icons, Zero Emojis',
        'Đăng nhập Google qua trình duyệt ngoài an toàn tuyệt đối'
      ]
    };
  }

  @Get('download')
  downloadInstaller(@Query('product') product: string | undefined, @Res() res: Response) {
    let installerPath = path.resolve(process.cwd(), '../dist/installer/AVORA-POS-Setup.exe');
    let fileName = 'AVORA-POS-Setup.exe';

    if (product === 'AVORA_POS_NATIVE') {
      installerPath = path.resolve(process.cwd(), '../dist/native/installer/AVORA-POS-Native-Setup.exe');
      fileName = 'AVORA-POS-Native-Setup.exe';
    }

    if (fs.existsSync(installerPath)) {
      return res.download(installerPath, fileName);
    }
    return res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: 'Không tìm thấy tệp cài đặt trên máy chủ'
    });
  }

  @Post('report')
  reportUpdateStatus(@Body() body: any) {
    // Log telemetry for Admin audit (Directive 98)
    return {
      success: true,
      acknowledgedAt: new Date().toISOString()
    };
  }
}
