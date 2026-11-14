import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('pos/waiter')
export class PosWaiterPublicController {
  @Get('mobileconfig')
  getMobileConfig(@Req() req: Request, @Res() res: Response) {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'avorafnb.com';
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const targetAppUrl = `${proto}://${host}/admin/pos/waiter`;

    let iconBase64 = '';
    try {
      const possiblePaths = [
        path.resolve(process.cwd(), '../frontend/public/avora_logo.png'),
        path.resolve(process.cwd(), 'uploads/avora_logo.png'),
        path.resolve(process.cwd(), 'public/avora_logo.png'),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          iconBase64 = fs.readFileSync(p).toString('base64');
          break;
        }
      }
    } catch {
      // Ignore icon reading error
    }

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>AVORA Phục vụ</string>
            <key>PayloadDescription</key>
            <string>Ứng dụng Order Phục vụ AVORA POS</string>
            <key>PayloadDisplayName</key>
            <string>AVORA Phục vụ</string>
            <key>PayloadIdentifier</key>
            <string>vn.avora.pos.waiter.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>8a1f81d8-3bb8-4f8e-a987-a2f0eb982751</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>${targetAppUrl}</string>
            ${iconBase64 ? `<key>Icon</key>\n            <data>\n            ${iconBase64}\n            </data>` : ''}
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Cài đặt App Phục vụ AVORA</string>
    <key>PayloadDescription</key>
    <string>Tải và cài đặt phím tắt ứng dụng AVORA Waiter trực tiếp lên màn hình chính iOS (0đ không tốn phí)</string>
    <key>PayloadIdentifier</key>
    <string>vn.avora.pos.waiter.profile</string>
    <key>PayloadOrganization</key>
    <string>AVORA Restaurant</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>33c56d78-b12e-4b6e-8ee5-f2d4e8992c10</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

    res.setHeader('Content-Type', 'application/x-apple-aspen-config; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="AvoraWaiter.mobileconfig"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(xmlContent);
  }
}

