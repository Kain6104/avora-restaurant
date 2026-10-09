import toast from 'react-hot-toast';

export interface PrintableOrderInfo {
  id: string;
  orderCode: string;
  orderSource?: string;
  orderType?: string;
  table?: any;
  tableId?: string;
}

/**
 * Phân loại loại mẫu in dựa trên nguồn và hình thức đơn hàng:
 * - POS, Tại bàn (Dine-in), Mang đi tại quầy -> 'RECEIPT'
 * - Online, Delivery, Web -> 'ONLINE_ORDER'
 */
export function getOrderPrintTemplateType(order: PrintableOrderInfo): 'RECEIPT' | 'ONLINE_ORDER' {
  if (
    order.orderSource === 'POS' ||
    Boolean(order.table) ||
    Boolean(order.tableId) ||
    order.orderType === 'DINE_IN' ||
    order.orderType === 'TAKEAWAY'
  ) {
    return 'RECEIPT';
  }
  return 'ONLINE_ORDER';
}

/**
 * Tải mẫu in đã render từ backend và kích hoạt in qua hidden iframe
 */
export async function printOrderInvoice(
  order: PrintableOrderInfo,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  const printType = getOrderPrintTemplateType(order);
  const typeLabel = printType === 'RECEIPT' ? 'Hóa đơn POS' : 'Đơn hàng Online';

  onStart?.();

  try {
    const res = await fetch(`/api/print-templates/render/order/${order.id}?type=${printType}`, {
      credentials: 'include',
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.data?.html) {
      throw new Error(data.message || 'Không thể render mẫu in cho đơn hàng này');
    }

    // Tạo hoặc tái sử dụng hidden iframe để in an toàn không ảnh hưởng UI
    let iframe = document.getElementById('avora-order-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'avora-order-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    iframe.srcdoc = data.data.html;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (printErr) {
        console.error('Lỗi khi gọi window.print():', printErr);
        toast.error('Lỗi khi mở hộp thoại in trình duyệt');
      } finally {
        onEnd?.();
      }
    };
  } catch (err: any) {
    console.error('Lỗi in hóa đơn:', err);
    toast.error(err.message || 'Không thể in hóa đơn');
    onEnd?.();
  }
}
