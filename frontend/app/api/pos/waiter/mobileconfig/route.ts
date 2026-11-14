import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '') || 'https');
  const targetAppUrl = `${proto}://${host}/admin/pos/waiter`;

  // Read logo to base64 for Apple icon
  let iconBase64 = '';
  try {
    const iconPath = path.join(process.cwd(), 'public', 'avora_logo.png');
    if (fs.existsSync(iconPath)) {
      const buffer = fs.readFileSync(iconPath);
      iconBase64 = buffer.toString('base64');
    }
  } catch (err) {
    console.error('Failed to read icon for mobileconfig:', err);
  }

  // XML Apple Configuration Profile
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

  return new Response(xmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
      'Content-Disposition': 'attachment; filename="AvoraWaiter.mobileconfig"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
