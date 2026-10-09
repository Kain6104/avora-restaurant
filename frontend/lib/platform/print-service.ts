/**
 * AVORA Print Service Abstraction (Directive 15)
 * Dual-mode printing pipeline:
 * 1. DesktopNativePrintService: Used automatically inside AVORA POS Desktop (.EXE).
 *    Calls C# Native Core (Win32 winspool.drv RAW, ESC/POS, TSPL, persistent SQLite queue).
 * 2. LegacyWebPrintService: Used when accessing /admin/pos via standard Web Browser.
 */

import { platformBridge } from './platform-bridge';

export interface WindowsPrinter {
  id: string;
  name: string;
  driverName: string;
  portName: string;
  status: string;
  isDefault: boolean;
  isVirtual: boolean;
}

export interface PrintReceiptOptions {
  orderId: string;
  orderCode: string;
  tableName?: string;
  orderType?: string;
  cashierName?: string;
  waiterName?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  memberPointsBalance?: number;
  pointsEarned?: number;
  pointsUsed?: number;
  restaurantName?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  orderTime?: string | Date;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    originalPrice?: number;
    totalPrice: number;
    discountAmount?: number;
    note?: string;
    options?: string[];
    isBuffetIncluded?: boolean;
  }>;
  subTotal: number;
  itemDiscountTotal?: number;
  orderDiscountAmount?: number;
  voucherCode?: string;
  pointsDiscountAmount?: number;
  serviceChargeTotal?: number;
  taxAmount?: number;
  shippingFee?: number;
  totalAmount: number;
  paymentMethod?: string;
  amountReceived?: number;
  changeAmount?: number;
  isInvoiceRequested?: boolean;
  invoiceTaxCode?: string;
  invoiceCompanyName?: string;
  invoiceAddress?: string;
  invoiceEmail?: string;
  qrData?: string;
  barcodeData?: string;
  footerNote?: string;
  isProForma?: boolean;
  cutPaper?: boolean;
  openDrawer?: boolean;
  targetPrinterId?: string;
}

export interface PrintKitchenTicketOptions {
  orderId: string;
  orderCode: string;
  tableName: string;
  orderType?: string;
  cashierOrWaiterName?: string;
  sentTime?: string | Date;
  stationId: string;
  stationName: string;
  isCancelTicket?: boolean;
  generalCancelReason?: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    note?: string;
    options?: string[];
    stationName: string;
    isNew?: boolean;
    isCancelled?: boolean;
    cancelReason?: string;
  }>;
  targetPrinterId?: string;
}

export interface PrintLabelOptions {
  labels: Array<{
    itemName: string;
    optionsText?: string;
    price: number;
    orderCode: string;
    tableName: string;
    customerName?: string;
    barcode?: string;
    qrCode?: string;
    copyNumber?: number;
    totalCopies?: number;
  }>;
  targetPrinterId?: string;
}

export interface PrintHtmlPayload {
  html: string;
  printerName?: string;
  paperSize?: string;
  copies?: number;
  receiptPayload?: any;
}

export interface IPrintService {
  getPrinters(): Promise<WindowsPrinter[]>;
  printHtml(options: PrintHtmlPayload): Promise<{ success: boolean; error?: string }>;
  printReceipt(options: PrintReceiptOptions): Promise<{ success: boolean; error?: string }>;
  printKitchenTicket(options: PrintKitchenTicketOptions): Promise<{ success: boolean; error?: string }>;
  printLabel(options: PrintLabelOptions): Promise<{ success: boolean; error?: string }>;
  openCashDrawer(printerName?: string): Promise<{ success: boolean; error?: string }>;
  testPrint(printerName: string, type: 'RECEIPT' | 'LABEL'): Promise<{ success: boolean; error?: string }>;
}

// ----------------------------------------------------
// 1. DESKTOP NATIVE PRINT SERVICE (.NET 8 WinSpool RAW)
// ----------------------------------------------------
type NativeHostCallable = (arg?: string) => Promise<string | Record<string, unknown>>;
type NativeHostBridge = Record<string, NativeHostCallable>;

// ----------------------------------------------------
// 1. DESKTOP NATIVE PRINT SERVICE (.NET 8 WinSpool RAW)
// ----------------------------------------------------
class DesktopNativePrintService implements IPrintService {
  private get nativeBridge(): NativeHostBridge | null {
    if (typeof window !== 'undefined' && window.chrome?.webview?.hostObjects?.nativePrintService) {
      return window.chrome.webview.hostObjects.nativePrintService as unknown as NativeHostBridge;
    }
    return null;
  }

  private async callBridgeOrHttp<T>(
    methodName: string,
    httpEndpoint: string,
    payload?: unknown
  ): Promise<T> {
    // 1. Try direct COM object bridge with safety timeout (zero-latency)
    const bridge = this.nativeBridge;
    if (bridge) {
      try {
        const isKnownBridgeMethod = [
          'PrintHtml',
          'GetPrintersJson',
          'GetPrinterProfilesJson',
          'SavePrinterProfile',
          'PrintReceipt',
          'PrintKitchenTicket',
          'PrintLabel',
          'OpenCashDrawer',
          'TestPrint',
          'OpenExternalBrowser',
          'CheckUpdateJson',
          'DownloadUpdateJson',
          'ApplyUpdate',
        ].includes(methodName);

        if (isKnownBridgeMethod && typeof (bridge as any)[methodName] === 'function') {
          const fn = (bridge as any)[methodName];
          const arg = payload !== undefined ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : undefined;
          
          const bridgePromise = new Promise<any>((resolve) => {
            try {
              const res = arg !== undefined ? fn.call(bridge, arg) : fn.call(bridge);
              Promise.resolve(res)
                .then(resolve)
                .catch((err) => {
                  console.warn(`Bridge call reject for ${methodName}:`, err);
                  resolve(null);
                });
            } catch (syncErr) {
              console.warn(`Bridge call sync throw for ${methodName}:`, syncErr);
              resolve(null);
            }
          });

          const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve(null), 3500)
          );
          const resJson = await Promise.race([bridgePromise, timeoutPromise]);
          if (resJson) {
            const parsed = typeof resJson === 'string' ? JSON.parse(resJson) : (resJson as T);
            if ((parsed as any)?.success !== false) {
              return parsed;
            }
          }
        }
      } catch (err) {
        console.warn(`Bridge call failed for ${methodName}:`, err);
      }
    }

    // 2. Fallback to local HTTP server hosted by C# core (http://127.0.0.1:9123)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`http://127.0.0.1:9123${httpEndpoint}`, {
        method: payload !== undefined ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: payload !== undefined ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as T;
      }
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` } as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể kết nối AVORA Native Print Core';
      return { success: false, error: message } as T;
    }
  }

  async getPrinters(): Promise<WindowsPrinter[]> {
    const res = await this.callBridgeOrHttp<{ success: boolean; data: any[] }>(
      'GetPrintersJson',
      '/printers'
    );
    const rawList = Array.isArray(res?.data) ? res.data : [];
    return rawList
      .map((p) => {
        const name = String(p.name || p.Name || '').trim();
        const id = String(p.id || p.Id || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
        const isVirtual = Boolean(
          p.isVirtual ?? p.IsVirtual ?? /(pdf|onenote|xps|fax|portprompt|nul:|anydesk|print to)/i.test(name)
        );
        return {
          id,
          name,
          driverName: String(p.driverName || p.DriverName || ''),
          portName: String(p.portName || p.PortName || ''),
          status: String(p.status || p.Status || 'ONLINE'),
          isDefault: Boolean(p.isDefault ?? p.IsDefault),
          isVirtual,
        };
      })
      .filter((p) => Boolean(p.name));
  }

  async printHtml(options: PrintHtmlPayload): Promise<{ success: boolean; error?: string }> {
    const targetPrinter = options.printerName || 'Xprinter XP-350B';

    // 1. Ưu tiên cao nhất: AVORA Print Agent HTTP cổng 9102 (SumatraPDF Silent, 100% chuẩn định dạng HTML, không lỗi SSL, in cực nét cho cả Xprinter XP-350B & XP-80C)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('http://127.0.0.1:9102/print-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: targetPrinter,
          htmlContent: options.html,
          paperSize: options.paperSize || '80mm',
          copies: options.copies || 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json.ok || json.success) return { success: true };
      }
    } catch {
      // Bỏ qua nếu agent 9102 không phản hồi
    }

    // 2. Thử qua Native Bridge WebView2 Silent Core (PrintHtml)
    const bridgeRes = await this.callBridgeOrHttp<{ success: boolean; error?: string }>(
      'PrintHtml',
      '/print-html',
      {
        ...options,
        printerName: targetPrinter,
      }
    );
    if (bridgeRes && bridgeRes.success) {
      return bridgeRes;
    }

    // 3. Thử qua Print Agent HTTPS cổng 9101
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://localhost:9101/print-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer avora-pos-agent-secure-token-2026',
        },
        body: JSON.stringify({
          printerName: targetPrinter,
          htmlContent: options.html,
          paperSize: options.paperSize || '80mm',
          copies: options.copies || 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json.ok || json.success) return { success: true };
      }
    } catch {
      // Bỏ qua nếu agent 9101 không nhận
    }

    // 4. Fallback cuối cùng sang WinSpool RAW (PrintReceipt) nếu là máy in hóa đơn tiêu chuẩn (XP-80C)
    // TUYỆT ĐỐI KHÔNG gửi ESC/POS raw bytes tới máy in nhãn như Xprinter XP-350B vì sẽ làm rớt lệnh / nuốt giấy
    const isLabelPrinter = /350b|xp-?350|tsc|label/i.test(targetPrinter);
    if (!isLabelPrinter && options.receiptPayload) {
      const receiptRes = await this.printReceipt({
        ...options.receiptPayload,
        targetPrinterId: targetPrinter,
      });
      if (receiptRes && receiptRes.success) {
        return receiptRes;
      }
    }

    return bridgeRes || { success: false, error: `Không thể in ra máy in [${targetPrinter}]` };
  }

  async printReceipt(options: PrintReceiptOptions): Promise<{ success: boolean; error?: string }> {
    return await this.callBridgeOrHttp<{ success: boolean; error?: string }>(
      'PrintReceipt',
      '/print-receipt',
      options
    );
  }

  async printKitchenTicket(options: PrintKitchenTicketOptions): Promise<{ success: boolean; error?: string }> {
    return await this.callBridgeOrHttp<{ success: boolean; error?: string }>(
      'PrintKitchenTicket',
      '/print-kitchen',
      options
    );
  }

  async printLabel(options: PrintLabelOptions): Promise<{ success: boolean; error?: string }> {
    return await this.callBridgeOrHttp<{ success: boolean; error?: string }>(
      'PrintLabel',
      '/print-label',
      options
    );
  }

  async openCashDrawer(printerName: string = 'XP-80C'): Promise<{ success: boolean; error?: string }> {
    return await this.callBridgeOrHttp<{ success: boolean; error?: string }>(
      'OpenCashDrawer',
      '/open-drawer',
      { printerName }
    );
  }

  async testPrint(printerName: string, type: 'RECEIPT' | 'LABEL'): Promise<{ success: boolean; error?: string }> {
    return await this.callBridgeOrHttp<{ success: boolean; error?: string }>(
      'TestPrint',
      '/test-print',
      { printerName, type }
    );
  }
}

interface LegacyAgentResponse {
  ok?: boolean;
  success?: boolean;
  error?: string;
  data?: unknown;
}

// ----------------------------------------------------
// 2. LEGACY WEB PRINT SERVICE (agent.js / HTTP 9101)
// ----------------------------------------------------
class LegacyWebPrintService implements IPrintService {
  private async legacyRequest<T = LegacyAgentResponse>(endpoint: string, body?: unknown): Promise<T> {
    // 1. Ưu tiên HTTP port 9102 trước (không bị lỗi SSL cert)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`http://127.0.0.1:9102${endpoint}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {}

    // 2. Fallback sang HTTPS port 9101
    try {
      const res = await fetch(`https://localhost:9101${endpoint}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer avora-pos-agent-secure-token-2026',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return (await res.json()) as T;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: message } as T;
    }
  }

  async getPrinters(): Promise<WindowsPrinter[]> {
    const res = await this.legacyRequest<Array<string | Record<string, unknown>>>('/printers');
    if (Array.isArray(res)) {
      return res.map((p) => {
        if (typeof p === 'string') {
          return {
            id: p,
            name: p,
            driverName: '',
            portName: '',
            status: 'READY',
            isDefault: false,
            isVirtual: false,
          };
        }
        const obj = p as Record<string, unknown>;
        return {
          id: String(obj.id || obj.name || ''),
          name: String(obj.name || ''),
          driverName: String(obj.driverName || ''),
          portName: String(obj.portName || ''),
          status: 'READY',
          isDefault: Boolean(obj.isDefault),
          isVirtual: Boolean(obj.isVirtual),
        };
      });
    }
    return [];
  }

  async printReceipt(options: PrintReceiptOptions): Promise<{ success: boolean; error?: string }> {
    const itemsHtml = options.items
      .map((it) => `<div>${it.name} x${it.quantity} - ${it.totalPrice}d</div>`)
      .join('');
    const html = `
      <div style="font-family:sans-serif; width:80mm; padding:10px;">
        <h2>${options.restaurantName || 'AVORA RESTAURANT'}</h2>
        <h3>${options.isProForma ? 'PHIẾU TẠM TÍNH' : 'HÓA ĐƠN THANH TOÁN'}</h3>
        <p>Bàn: ${options.tableName || ''} | Mã: ${options.orderCode}</p>
        <hr/>
        ${itemsHtml}
        <hr/>
        <h4>TỔNG TIỀN: ${options.totalAmount}d</h4>
      </div>
    `;

    const res = await this.legacyRequest('/print-html', {
      printerName: options.targetPrinterId || 'XP-80C',
      htmlContent: html,
      paperSize: '80mm',
    });

    return { success: res?.ok || res?.success || false, error: res?.error };
  }

  async printKitchenTicket(options: PrintKitchenTicketOptions): Promise<{ success: boolean; error?: string }> {
    const itemsHtml = options.items
      .map((it) => `<div><b>${it.name}</b> x${it.quantity} ${it.note ? `(${it.note})` : ''}</div>`)
      .join('');
    const html = `
      <div style="font-family:sans-serif; width:80mm; padding:10px;">
        <h2>${options.isCancelTicket ? 'HỦY MÓN BẾP' : `BẾP - ${options.stationName}`}</h2>
        <p>Bàn: ${options.tableName} | Đơn: ${options.orderCode}</p>
        <hr/>
        ${itemsHtml}
      </div>
    `;

    const res = await this.legacyRequest('/print-html', {
      printerName: options.targetPrinterId || 'XP-80C',
      htmlContent: html,
      paperSize: '80mm',
    });

    return { success: res?.ok || res?.success || false, error: res?.error };
  }

  async printLabel(options: PrintLabelOptions): Promise<{ success: boolean; error?: string }> {
    const res = await this.legacyRequest('/print-labels', {
      printerName: options.targetPrinterId || 'Xprinter XP-350B',
      labels: options.labels.map((l) => ({
        productName: l.itemName,
        options: l.optionsText || '',
        price: l.price,
        orderCode: l.orderCode,
        tableName: l.tableName,
        barcode: l.barcode,
      })),
      labelSize: { width: '50mm', height: '30mm' },
    });

    return { success: res?.ok || res?.success || false, error: res?.error };
  }

  async printHtml(options: PrintHtmlPayload): Promise<{ success: boolean; error?: string }> {
    const res = await this.legacyRequest('/print-html', options);
    return { success: res?.ok || res?.success || false, error: res?.error };
  }

  async openCashDrawer(printerName: string = 'XP-80C'): Promise<{ success: boolean; error?: string }> {
    const res = await this.legacyRequest('/cash-drawer/open', { printerName });
    return { success: res?.ok || res?.success || false, error: res?.error };
  }

  async testPrint(printerName: string, type: 'RECEIPT' | 'LABEL'): Promise<{ success: boolean; error?: string }> {
    const res = await this.legacyRequest('/test-print', { printerName, purpose: type });
    return { success: res?.ok || res?.success || false, error: res?.error };
  }
}

let printServiceInstance: IPrintService | null = null;

export function getPrintService(): IPrintService {
  if (printServiceInstance) return printServiceInstance;

  // Auto-detect environment (Directive 15)
  if (platformBridge.isDesktop) {
    printServiceInstance = new DesktopNativePrintService();
  } else {
    printServiceInstance = new LegacyWebPrintService();
  }

  return printServiceInstance;
}

export const posPrintService = getPrintService();
