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
  getLatestUpdate(): PosUpdateManifest {
    return {
      version: '1.0.1',
      build: 101,
      releaseDate: '2026-09-10T10:20:00+07:00',
      updateType: 'RECOMMENDED',
      minimumSupportedVersion: '1.0.0',
      downloadUrl: 'http://localhost:3001/api/pos-desktop/update/download',
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
  downloadInstaller(@Res() res: Response) {
    const installerPath = path.resolve(process.cwd(), '../dist/installer/AVORA-POS-Setup.exe');
    if (fs.existsSync(installerPath)) {
      return res.download(installerPath, 'AVORA-POS-Setup.exe');
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
