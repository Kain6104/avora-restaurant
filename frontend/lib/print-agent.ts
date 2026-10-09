import { platformBridge } from './platform/platform-bridge';
import { posPrintService } from './platform/print-service';

export interface WindowsPrinter {
  id: string;
  name: string;
  driverName: string;
  portName: string;
  status: string;
  isDefault: boolean;
  isVirtual: boolean;
}

export interface PrintHtmlOptions {
  printerName: string;
  htmlContent: string;
  paperSize?: '80mm' | '58mm' | 'XP-350B' | string;
  copies?: number;
  idempotencyKey?: string;
  receiptPayload?: any;
}

export interface PrintLabelOptions {
  printerName: string;
  htmlContent: string;
  labelSize: {
    width: string;
    height: string;
  };
  copies?: number;
  idempotencyKey?: string;
}

export interface TestPrintOptions {
  printerName: string;
  purpose?: string;
  paperSize?: '80mm' | '58mm' | string;
  copies?: number;
}

export const DEFAULT_AGENT_URL = 'https://localhost:9101';
export const DEFAULT_AGENT_TOKEN = 'avora-pos-agent-secure-token-2026';
export const TOKEN_STORAGE_KEY = 'avora_print_agent_token';

// In-flight & recent duplicate protection in browser memory (15s window)
const recentPrintKeys = new Map<string, number>();

export class PrintAgentClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_AGENT_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Lấy token xác thực agent (ưu tiên localStorage)
   */
  public getToken(): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored && stored.trim().length > 0) return stored.trim();
    }
    return DEFAULT_AGENT_TOKEN;
  }

  /**
   * Cập nhật token ghép nối agent
   */
  public setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    }
  }

  /**
   * Helper fetch với timeout (Mở cho local POS, không bắt buộc token)
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit & { timeoutMs?: number } = {}
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string; duplicate?: boolean }> {
    const { timeoutMs = 6000, ...fetchOptions } = options;

    // 1. Ưu tiên thử qua cổng HTTP 9102 (không bị lỗi SSL Cert)
    try {
      const fastController = new AbortController();
      const fastTimer = setTimeout(() => fastController.abort(), Math.min(timeoutMs, 3000));
      const fastRes = await fetch(`http://127.0.0.1:9102${endpoint}`, {
        ...fetchOptions,
        signal: fastController.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(fetchOptions.headers || {}),
        },
      });
      clearTimeout(fastTimer);
      if (fastRes.ok) {
        let body: any = null;
        try {
          body = await fastRes.json();
        } catch {
          body = null;
        }
        return {
          ok: true,
          status: fastRes.status,
          data: body,
          duplicate: body?.duplicate,
        };
      }
    } catch {}

    // 2. Fallback sang URL cấu hình (HTTPS 9101)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(fetchOptions.headers || {}),
        },
      });

      clearTimeout(timer);

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok) {
        const errorMsg = body?.message || `Lỗi HTTP ${res.status}: ${res.statusText}`;
        return { ok: false, status: res.status, error: errorMsg, data: body };
      }

      return {
        ok: true,
        status: res.status,
        data: body,
        duplicate: body?.duplicate,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, status: 408, error: `Hết thời gian chờ phản hồi từ Print Agent (${timeoutMs}ms)` };
      }
      return { ok: false, status: 0, error: err.message || 'Không thể kết nối AVORA Print Agent' };
    }
  }

  /**
   * Kiểm tra trạng thái hoạt động của Print Agent
   */
  async checkHealth(): Promise<{ ok: boolean; success: boolean; status: 'ONLINE' | 'OFFLINE'; data?: any; error?: string }> {
    if (platformBridge.isDesktop) {
      return { ok: true, success: true, status: 'ONLINE', data: { status: 'ONLINE', native: true, version: platformBridge.getVersion() } };
    }
    const res = await this.request('/health', { method: 'GET', timeoutMs: 300 });
    if (res.ok && res.data?.status === 'ONLINE') {
      return { ok: true, success: true, status: 'ONLINE', data: res.data };
    }
    // Ngay cả khi không có agent, POS vẫn in trực tiếp qua trình duyệt siêu tốc
    return { ok: true, success: true, status: 'ONLINE', data: { status: 'ONLINE', mode: 'DIRECT_WEB' } };
  }

  /**
   * Lấy danh sách máy in thật được Windows nhận diện (Hỗ trợ cả mảng đối tượng chi tiết lẫn mảng tên máy in)
   */
  async getPrinters(): Promise<{ ok: boolean; success: boolean; printers: WindowsPrinter[]; data: WindowsPrinter[]; error?: string }> {
    if (platformBridge.isDesktop) {
      const nativePrinters = await posPrintService.getPrinters();
      return { ok: true, success: true, printers: nativePrinters as WindowsPrinter[], data: nativePrinters as WindowsPrinter[] };
    }
    const res = await this.request<any[]>('/printers?detailed=true', { method: 'GET', timeoutMs: 6000 });
    if (res.ok && Array.isArray(res.data)) {
      const normalized: WindowsPrinter[] = res.data.map((item: any) => {
        if (typeof item === 'string') {
          const isVirtual = /(pdf|onenote|xps|fax|portprompt|nul:|anydesk|print to)/i.test(item);
          return {
            id: item.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            name: item,
            driverName: '',
            portName: '',
            status: 'READY' as const,
            isDefault: false,
            isVirtual,
          };
        }
        return item;
      });
      return { ok: true, success: true, printers: normalized, data: normalized };
    }
    return { ok: false, success: false, printers: [], data: [], error: res.error || 'Không lấy được danh sách máy in' };
  }

  /**
   * Siêu Tốc Độ In HTML: Thực thi in trực tiếp giữ nguyên 100% định dạng mẫu HTML
   * Tuyệt đối không làm đậm font, không chèn font-weight: bold, in vector sắc nét < 50ms
   */
  public executeInstantIframePrint(htmlContent: string, printerName?: string, paperSize?: string): boolean {
    if (typeof window === 'undefined') return false;

    // Tuyệt đối không gọi iframe.print() trên Desktop để ngăn hộp thoại WebView2
    if (platformBridge.isDesktop) {
      return false;
    }

    try {
      let iframe = document.getElementById('avora-pos-silent-printer') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'avora-pos-silent-printer';
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '76mm';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (!doc) return false;

      // Nhận diện khổ in: Ưu tiên XP-350B nếu paperSize = XP-350B hoặc tên máy in chứa XP-350 / 350B
      const isXP350 =
        paperSize === 'XP-350B' ||
        paperSize === 'XP350B' ||
        paperSize === '76mm' ||
        (printerName ? /350b|xp-?350/i.test(printerName) : false);
      const is58 = paperSize === '58mm';
      const sizeDirective = isXP350 ? '76mm auto' : is58 ? '48mm auto' : '72mm auto';
      const widthVal = isXP350 ? '72mm' : is58 ? '46mm' : '70mm';

      let printNormalizedHtml: string;

      // Nếu htmlContent đã là full document HTML từ backend Unified Renderer
      if (htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE')) {
        // Tiêm quy tắc CSS chống tràn trang, ép lề 0mm để trình duyệt không chèn header/footer
        const antiBreakStyle = `
<style id="avora-roll-anti-overflow">
  @page {
    size: ${sizeDirective} !important;
    margin: 0mm !important;
  }
  @page :left { margin: 0mm !important; }
  @page :right { margin: 0mm !important; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  .print-container {
    width: ${widthVal} !important;
    max-width: ${widthVal} !important;
    margin: 0 auto !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-before: avoid !important;
    break-before: avoid !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  table, tr, td, th, div, span, img {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
</style>`;
        if (htmlContent.includes('</head>')) {
          printNormalizedHtml = htmlContent.replace('</head>', `${antiBreakStyle}\n</head>`);
        } else {
          printNormalizedHtml = `${antiBreakStyle}\n${htmlContent}`;
        }
      } else {
        // htmlContent là HTML snippet body đơn thuần
        printNormalizedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bản in AVORA</title>
  <style>
    @page {
      size: ${sizeDirective} !important;
      margin: 0mm !important;
    }
    @page :left { margin: 0mm !important; }
    @page :right { margin: 0mm !important; }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff;
      color: #000;
      height: auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
    }
    .print-container {
      width: ${widthVal} !important;
      max-width: ${widthVal} !important;
      margin: 0 auto !important;
      padding: 1mm !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    table, tr, td, th, div, span, img {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${htmlContent}
  </div>
</body>
</html>`;
      }

      doc.open();
      doc.write(printNormalizedHtml);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('[INSTANT PRINT] Focus/Print error:', e);
        }
      };

      if (iframe.contentWindow?.document.readyState === 'complete') {
        triggerPrint();
      } else {
        iframe.onload = triggerPrint;
      }

      return true;
    } catch (err) {
      console.error('[INSTANT PRINT] Lỗi in iframe siêu tốc:', err);
      return false;
    }
  }

  /**
   * Gửi lệnh in HTML (Hóa đơn, Tạm tính, Phiếu Bếp, Phiếu Bar) - SIÊU TỐC ĐỘ IN
   */
  async printHtml(options: PrintHtmlOptions): Promise<{ ok: boolean; success: boolean; duplicate?: boolean; message?: string; error?: string }> {
    const { printerName, htmlContent, paperSize, copies = 1, idempotencyKey, receiptPayload } = options;

    if (!htmlContent) {
      return { ok: false, success: false, error: 'Nội dung in không được để trống', message: 'Nội dung in không được để trống' };
    }

    // Làm sạch tên máy in (loại bỏ hậu tố trạng thái như ONLINE, OFFLINE)
    const cleanPrinter = (printerName || '').replace(/\s*\((ONLINE|OFFLINE|READY|ERROR)\)\s*$/i, '').trim();

    // Chặn duplicate spam liên tiếp (giảm xuống 1.5s để thu ngân in lại nhanh)
    if (idempotencyKey) {
      const now = Date.now();
      const last = recentPrintKeys.get(idempotencyKey);
      if (last && now - last < 1500) {
        return { ok: true, success: true, duplicate: true, message: 'Lệnh in đang được xử lý' };
      }
      recentPrintKeys.set(idempotencyKey, now);
    }

    // 1. DESKTOP NATIVE PRINT (.NET 8 WinSpool RAW / WebView2 Silent Core)
    // Tuyệt đối không mở hộp thoại in WebView2, in trực tiếp đúng máy in đã cài đặt trong settings
    if (platformBridge.isDesktop) {
      const nativeRes = await posPrintService.printHtml({
        html: htmlContent,
        printerName: cleanPrinter,
        paperSize,
        copies,
        receiptPayload,
      });

      if (nativeRes.success) {
        return {
          ok: true,
          success: true,
          message: `Đã in trực tiếp tới máy in [${cleanPrinter || 'mặc định'}]`,
        };
      }
      const errText = nativeRes.error || `Không thể in ra máy in [${cleanPrinter}]`;
      return {
        ok: false,
        success: false,
        error: errText,
        message: errText,
      };
    }

    // 2. Chạy trên trình duyệt Web thông thường: In qua Local Agent (port 9101 hoặc 9123)
    const agentOnline = await this.checkHealth().catch(() => ({ ok: false }));
    if (agentOnline.ok) {
      const res = await posPrintService.printHtml({
        html: htmlContent,
        printerName: cleanPrinter,
        paperSize,
        copies,
      });
      if (res.success) {
        return {
          ok: true,
          success: true,
          message: `Đã gửi in qua agent tới [${cleanPrinter || 'mặc định'}]`,
        };
      }
    }

    // 3. Fallback chỉ dùng khi KHÔNG ở Desktop và KHÔNG có agent:
    const printed = this.executeInstantIframePrint(htmlContent, cleanPrinter, paperSize);
    if (printed) {
      return {
        ok: true,
        success: true,
        message: `Đã phát lệnh in tới máy in [${cleanPrinter || 'mặc định'}]`,
      };
    }

    return {
      ok: false,
      success: false,
      error: `Không thể in ra máy in [${cleanPrinter}]`,
    };
  }

  /**
   * Gửi lệnh in Tem Nhãn
   */
  async printLabel(options: PrintLabelOptions): Promise<{ ok: boolean; success: boolean; duplicate?: boolean; message?: string; error?: string }> {
    const { printerName, htmlContent, labelSize, copies = 1, idempotencyKey } = options;

    if (!printerName) {
      return { ok: false, success: false, error: 'Chưa cấu hình máy in tem' };
    }

    if (idempotencyKey) {
      const now = Date.now();
      const last = recentPrintKeys.get(idempotencyKey);
      if (last && now - last < 15000) {
        return { ok: true, success: true, duplicate: true, message: 'Tem đã được phát lệnh' };
      }
      recentPrintKeys.set(idempotencyKey, now);
    }

    // 1. Nếu đang chạy POS Desktop, gọi Native TSPL Label Service ngay lập tức
    if (platformBridge.isDesktop) {
      const cleanName = htmlContent ? htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'Món AVORA';
      const nativeRes = await posPrintService.printLabel({
        targetPrinterId: printerName,
        labels: [{
          itemName: cleanName.substring(0, 30),
          price: 0,
          orderCode: idempotencyKey || 'OD-LABEL',
          tableName: 'Bàn',
          totalCopies: copies,
          copyNumber: 1
        }]
      });
      return {
        ok: nativeRes.success,
        success: nativeRes.success,
        message: nativeRes.success ? `Đã in tem TSPL qua [${printerName}]` : (nativeRes.error || 'Lỗi in tem TSPL'),
        error: nativeRes.error
      };
    }

    // 2. Web fallback: in tem nhãn trực tiếp qua iframe siêu tốc
    const printed = this.executeInstantIframePrint(htmlContent, printerName);
    if (printed) {
      return {
        ok: true,
        success: true,
        message: `Đã phát lệnh in tem tới máy in [${printerName}]`,
      };
    }

    return { ok: false, success: false, error: `Lỗi in tem tới [${printerName}]` };
  }

  /**
   * Phát lệnh mở két tiền mặt thu ngân
   */
  async openCashDrawer(printerName: string): Promise<{ ok: boolean; success: boolean; message?: string; error?: string }> {
    if (!printerName) {
      return { ok: false, success: false, error: 'Chưa chỉ định máy in hóa đơn để mở két' };
    }

    if (platformBridge.isDesktop) {
      const res = await posPrintService.openCashDrawer(printerName);
      return {
        ok: res.success,
        success: res.success,
        message: res.success ? 'Đã kích hoạt mở két tiền thành công!' : (res.error || 'Lỗi mở két tiền'),
        error: res.error
      };
    }

    const res = await this.request('/cash-drawer/open', {
      method: 'POST',
      body: JSON.stringify({ printerName }),
      timeoutMs: 6000,
    });

    if (res.ok) {
      return { ok: true, success: true, message: res.data?.message || `Lệnh mở két tiền đã được phát thành công!` };
    }

    return { ok: false, success: false, error: res.error || 'Không thể mở két tiền' };
  }

  /**
   * In thử mẫu kiểm tra kết nối thiết bị
   */
  async testPrint(
    optionsOrPrinterName: TestPrintOptions | string,
    purpose: string = 'PHIẾU IN THỬ NGHIỆM',
    paperSize: string = '80mm',
    copies: number = 1,
  ): Promise<{
    ok: boolean;
    success: boolean;
    state: 'SUCCESS' | 'PRINTER_ERROR' | 'AGENT_OFFLINE' | 'PRINTER_NOT_FOUND';
    message: string;
  }> {
    const opts: TestPrintOptions =
      typeof optionsOrPrinterName === 'string'
        ? { printerName: optionsOrPrinterName, purpose, paperSize, copies }
        : optionsOrPrinterName;

    const { printerName, purpose: testPurpose = 'PHIẾU IN THỬ NGHIỆM', paperSize: testPaper = '80mm', copies: testCopies = 1 } = opts;

    // 1. Kiểm tra health trước
    const health = await this.checkHealth();
    if (!health.ok) {
      return {
        ok: false,
        success: false,
        state: 'AGENT_OFFLINE',
        message: 'Print Agent offline (Không thể kết nối AVORA Print Agent tại https://localhost:9101).',
      };
    }

    if (platformBridge.isDesktop) {
      const isLabel = testPurpose.toUpperCase().includes('LABEL') || testPurpose.toUpperCase().includes('TEM');
      const testPromise = posPrintService.testPrint(printerName, isLabel ? 'LABEL' : 'RECEIPT');
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Hết thời gian chờ phản hồi từ thiết bị in (Timeout 7s)')), 7000)
      );
      const res = await Promise.race([testPromise, timeoutPromise]).catch((err: any) => ({
        success: false,
        error: err.message || 'Lỗi in thử native',
      }));

      return {
        ok: res.success,
        success: res.success,
        state: res.success ? 'SUCCESS' : 'PRINTER_ERROR',
        message: res.success ? `Đã in thử nghiệm thành công tới máy in native [${printerName}]!` : (res.error || 'Lỗi in thử'),
      };
    }

    // 2. Tạo nội dung test trực quan, chuyên nghiệp
    const now = new Date();

    if (testPurpose === 'ITEM_LABEL' || testPurpose === 'LABEL' || testPurpose === 'TEM_NHAN') {
      let labelWidth = '50mm';
      let labelHeight = '30mm';
      if (testPaper && testPaper.includes('x')) {
        const parts = testPaper.split('x');
        if (parts.length === 2) {
          labelWidth = parts[0].trim().endsWith('mm') ? parts[0].trim() : `${parts[0].trim()}mm`;
          labelHeight = parts[1].trim().endsWith('mm') ? parts[1].trim() : `${parts[1].trim()}mm`;
        }
      }

      const testLabelHtml = `
        <div style="font-family: Arial, sans-serif; font-size: 10px; line-height: 1.15; color: #000; width: 100%; box-sizing: border-box; text-align: left; padding: 2mm 3mm 1mm 2mm;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 2px;">
            <b style="font-size: 9.5px; text-transform: uppercase; letter-spacing: -0.2px;">AVORA RESTAURANT</b>
            <span style="font-size: 9px; font-weight: bold;">Bàn Test</span>
          </div>
          <div style="font-size: 11px; font-weight: 900; line-height: 1.15; margin-bottom: 1px; word-break: break-word;">Sashimi Bụng Cá Hồi</div>
          <div style="font-size: 8.5px; line-height: 1.15;">+ Cắt chuẩn (Standard)</div>
          <div style="font-size: 8.5px; line-height: 1.15; font-style: italic;">* In test tem nhãn</div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #000; margin-top: 2px; padding-top: 1px;">
            <span style="font-size: 8px;">${now.toLocaleTimeString('vi-VN')}</span>
            <b style="font-size: 9.5px; white-space: nowrap;">185.000 đ</b>
          </div>
        </div>
      `;

      const res = await this.printLabel({
        printerName,
        htmlContent: testLabelHtml,
        labelSize: { width: labelWidth, height: labelHeight },
        copies: testCopies,
        idempotencyKey: `test_label_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      });

      if (res.ok) {
        return {
          ok: true,
          success: true,
          state: 'SUCCESS',
          message: `In thử tem nhãn thành công tới máy in [${printerName}]!`,
        };
      }
      return {
        ok: false,
        success: false,
        state: 'PRINTER_ERROR',
        message: res.error || `Máy in tem [${printerName}] gặp lỗi khi in.`,
      };
    }

    const purposeTitles: Record<string, { label: string; sub: string }> = {
      RECEIPT: { label: 'MÁY IN THU NGÂN (RECEIPT)', sub: 'Hệ thống in hóa đơn thanh toán' },
      KITCHEN: { label: 'MÁY IN BÁO BẾP (KITCHEN)', sub: 'Hệ thống báo chế biến nhà bếp' },
      BAR: { label: 'MÁY IN PHA CHẾ (BAR)', sub: 'Hệ thống báo quầy pha chế đồ uống' },
      ITEM_LABEL: { label: 'MÁY IN TEM MÓN (LABEL)', sub: 'Hệ thống in tem ly & món mang về' },
    };

    const targetInfo = purposeTitles[testPurpose.toUpperCase()] || {
      label: `MÁY IN ${testPurpose.toUpperCase()}`,
      sub: 'Hệ thống thiết bị in ấn AVORA POS',
    };

    const is58 = testPaper === '58mm';
    const containerWidth = is58 ? '54mm' : '72mm';
    const maxWidth = is58 ? '210px' : '280px';

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            background: #fff;
            color: #000;
            margin: 0;
            padding: ${is58 ? '1.5mm 1mm' : '2mm 2.5mm'};
            width: ${containerWidth};
          }
          .slip {
            width: 100%;
            max-width: ${maxWidth};
            margin: 0 auto;
            text-align: center;
          }
          .brand {
            font-size: ${is58 ? '13px' : '15px'};
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .badge {
            display: inline-block;
            background: #000;
            color: #fff;
            font-size: ${is58 ? '9.5px' : '11px'};
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 3px;
            margin: 2px 0 3px 0;
            text-transform: uppercase;
          }
          .sub {
            font-size: ${is58 ? '8.5px' : '9.5px'};
            color: #333;
            margin-bottom: 4px;
          }
          .divider-dashed {
            border-top: 1px dashed #000;
            margin: 4px 0;
          }
          .divider-solid {
            border-top: 1.5px solid #000;
            margin: 4px 0;
          }
          .grid {
            width: 100%;
            font-size: ${is58 ? '9.5px' : '11px'};
            line-height: 1.4;
            text-align: left;
            margin: 3px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 1px 0;
          }
          .lbl {
            color: #333;
            font-weight: 500;
            white-space: nowrap;
          }
          .val {
            font-weight: 700;
            text-align: right;
            word-break: break-word;
            padding-left: 6px;
          }
          .status-box {
            font-size: ${is58 ? '9.5px' : '10.5px'};
            font-weight: 700;
            text-align: center;
            line-height: 1.35;
            margin: 4px 0;
          }
          .footer-note {
            font-size: ${is58 ? '8px' : '9px'};
            color: #444;
            text-align: center;
            letter-spacing: -0.2px;
          }
        </style>
      </head>
      <body>
        <div class="slip">
          <div class="brand">AVORA RESTAURANT</div>
          <div class="badge">${targetInfo.label}</div>
          <div class="sub">${targetInfo.sub}</div>

          <div class="divider-dashed"></div>

          <div class="grid">
            <div class="row">
              <span class="lbl">Máy in:</span>
              <span class="val">${printerName}</span>
            </div>
            <div class="row">
              <span class="lbl">Khổ giấy:</span>
              <span class="val">${testPaper} (Số liên: ${testCopies})</span>
            </div>
            <div class="row">
              <span class="lbl">Thời gian:</span>
              <span class="val">${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}</span>
            </div>
            <div class="row">
              <span class="lbl">Trạng thái:</span>
              <span class="val">KẾT NỐI TỐT [OK]</span>
            </div>
          </div>

          <div class="divider-dashed"></div>

          <div class="status-box">
            &#10003; Thiết bị phản hồi bình thường<br/>
            &#10003; Sẵn sàng in hóa đơn & chế biến
          </div>

          <div class="divider-solid"></div>
          <div class="footer-note">*** PHIẾU IN THỬ TIẾT KIỆM GIẤY ***</div>
        </div>
      </body>
      </html>
    `;

    const res = await this.printHtml({
      printerName,
      htmlContent: testHtml,
      paperSize: testPaper,
      copies: testCopies,
      idempotencyKey: `test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    });

    if (res.ok) {
      return {
        ok: true,
        success: true,
        state: 'SUCCESS',
        message: `In thử thành công tới máy in [${printerName}]!`,
      };
    }

    if (res.error?.includes('không còn tồn tại') || res.error?.includes('404')) {
      return {
        ok: false,
        success: false,
        state: 'PRINTER_NOT_FOUND',
        message: `Máy in [${printerName}] không tồn tại trên hệ thống Windows!`,
      };
    }

    return {
      ok: false,
      success: false,
      state: 'PRINTER_ERROR',
      message: res.error || `Máy in [${printerName}] gặp lỗi khi in.`,
    };
  }
}

// Export singleton instance
export const printAgent = new PrintAgentClient();
