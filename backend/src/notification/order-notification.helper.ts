/**
 * Helper chuẩn hóa tiêu đề, nội dung thông báo, icon và độ ưu tiên
 * cho toàn hệ thống Avora Restaurant và AVORA Waiter / AVORA Phục Vụ.
 */

export type OrderNotificationIcon =
  | 'receipt'
  | 'gift'
  | 'edit'
  | 'utensils'
  | 'bell-ring'
  | 'wallet'
  | 'pause-circle'
  | 'arrow-left-right'
  | 'scissors'
  | 'git-merge'
  | 'x-circle'
  | 'refresh-cw'
  | 'check-circle'
  | 'alert-triangle'
  | 'info';

export type OrderNotificationPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export interface OrderNotificationChangeDetails {
  addedItems?: string[];
  removedItems?: string[];
  updatedItems?: string[];
  summary?: string;
}

export interface OrderNotificationPayloadInput {
  eventType: string;
  orderCode?: string | null;
  orderType?: string | null;
  tableName?: string | null;
  totalAmount?: number | null;
  actorName?: string | null;
  actorRole?: string | null;
  customerName?: string | null;
  reason?: string | null;
  paymentMethod?: string | null;
  gateway?: string | null;
  // Đổi điểm & số lượng
  pointsUsed?: number | null;
  quantity?: number | null;
  itemName?: string | null;
  // Cập nhật món / khách gọi thêm
  changeDetails?: OrderNotificationChangeDetails | string | null;
  itemsSummary?: string | null;
  // Đổi bàn / đổi loại / tách / gộp
  oldTableName?: string | null;
  newTableName?: string | null;
  oldOrderType?: string | null;
  newOrderType?: string | null;
  newOrderCode?: string | null;
  newOrderTypeDesc?: string | null;
  movedItemsSummary?: string | null;
  // Trạng thái đơn
  oldStatus?: string | null;
  newStatus?: string | null;
  // Chi tiết thay đổi bổ sung
  note?: string | null;
  optionsText?: string | null;
  guestCount?: number | null;
  serverName?: string | null;
  buffetPackageName?: string | null;
}

export interface BuiltOrderNotificationPayload {
  title: string;
  message: string;
  icon: OrderNotificationIcon;
  priority: OrderNotificationPriority;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  DELIVERING: 'Đang giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  BANK_TRANSFER: 'Chuyển khoản',
  SEPAY: 'SePay (Chuyển khoản QR)',
  PAYOS: 'PayOS',
  SPLIT: 'Nhiều phương thức',
  QR_DYNAMIC: 'QR Ngân hàng',
};

export function formatVndCurrency(amount?: number | null): string {
  const safe = Math.round(Number(amount) || 0);
  return `${new Intl.NumberFormat('vi-VN').format(safe)}₫`;
}

export function cleanTableName(tableName?: string | null): string {
  if (!tableName) return '';
  return String(tableName).trim().replace(/^(?:bàn\s+)+/i, '').trim();
}

export function formatOrderCodeDisplay(orderCode?: string | null): string {
  if (!orderCode) return '#';
  const trimmed = String(orderCode).trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export function getOrderTypeLabel(orderType?: string | null): string {
  switch ((orderType || '').toUpperCase()) {
    case 'DINE_IN':
      return 'Tại bàn';
    case 'TAKEAWAY':
      return 'Mang đi';
    case 'DELIVERY':
      return 'Giao hàng';
    default:
      return 'Đơn hàng';
  }
}

export function getOrderDescription(
  orderType?: string | null,
  tableName?: string | null,
): string {
  const normalizedType = (orderType || '').toUpperCase();
  const cleanTable = cleanTableName(tableName);
  switch (normalizedType) {
    case 'DINE_IN':
      return cleanTable ? `Tại bàn (${cleanTable})` : 'Tại bàn';
    case 'TAKEAWAY':
      return 'Mang đi';
    case 'DELIVERY':
      return 'Giao hàng';
    default:
      return cleanTable ? `Tại bàn (${cleanTable})` : 'Đơn hàng';
  }
}

export function generateChangeDetailsMessage(
  details?: OrderNotificationChangeDetails | string | null,
): string {
  if (!details) return '';
  if (typeof details === 'string') return details.trim();

  const parts: string[] = [];
  if (details.addedItems && details.addedItems.length > 0) {
    parts.push(`Thêm món: ${details.addedItems.join(', ')}.`);
  }
  if (details.removedItems && details.removedItems.length > 0) {
    parts.push(`Xóa món: ${details.removedItems.join(', ')}.`);
  }
  if (details.updatedItems && details.updatedItems.length > 0) {
    parts.push(`Sửa món: ${details.updatedItems.join(', ')}.`);
  }
  if (parts.length === 0 && details.summary) {
    parts.push(details.summary.trim());
  }
  return parts.join(' ').trim();
}

function getActorPhrase(actorName?: string | null): string {
  const trimmed = actorName?.trim();
  return trimmed ? ` bởi ${trimmed}` : '';
}

function getActorPrefix(actorName?: string | null, fallback = 'Nhân viên'): string {
  const trimmed = actorName?.trim();
  return trimmed || fallback;
}

export function mapPriorityToNumeric(priority: OrderNotificationPriority): number {
  switch (priority) {
    case 'URGENT':
      return 3;
    case 'HIGH':
      return 2;
    default:
      return 1;
  }
}

export function buildOrderNotificationPayload(
  input: OrderNotificationPayloadInput,
): BuiltOrderNotificationPayload {
  const code = formatOrderCodeDisplay(input.orderCode);
  const orderDesc = getOrderDescription(input.orderType, input.tableName);
  const actorPhrase = getActorPhrase(input.actorName);
  const actorName = getActorPrefix(input.actorName);
  const cleanTable = cleanTableName(input.tableName);
  const formattedTotal = formatVndCurrency(input.totalAmount);
  const targetLocation = cleanTable ? `bàn ${cleanTable}` : orderDesc;

  switch (input.eventType) {
    case 'ORDER_CREATED': {
      const itemsPart = input.itemsSummary?.trim()
        ? ` Món đã chọn: ${input.itemsSummary.trim()}.`
        : '';
      return {
        title: 'Đơn hàng mới',
        message: `${actorName} đã tạo đơn mới ${code} tại ${targetLocation} trị giá ${formattedTotal}.${itemsPart}`,
        icon: 'receipt',
        priority: 'NORMAL',
      };
    }

    case 'CUSTOMER_REDEEMED_ITEM': {
      const customer = input.customerName?.trim() || 'Khách hàng';
      const qty = Math.max(1, Number(input.quantity) || 1);
      const pts = Math.max(0, Math.round(Number(input.pointsUsed) || 0));
      const item = input.itemName?.trim() || 'quà đổi điểm';
      return {
        title: 'Khách hàng đổi điểm',
        message: `Khách hàng ${customer} vừa dùng ${pts} điểm để đổi ${qty}x ${item} tại ${targetLocation}.`,
        icon: 'gift',
        priority: 'HIGH',
      };
    }

    // ==========================================
    // THAO TÁC MÓN ĂN (PHASE 1.1.A)
    // ==========================================

    case 'ITEM_ADDED': {
      const itemsText =
        input.itemsSummary?.trim() ||
        generateChangeDetailsMessage(input.changeDetails) ||
        input.itemName ||
        'món mới';
      return {
        title: 'Thêm món vào đơn',
        message: `${actorName} đã thêm ${itemsText} vào đơn ${code} tại ${targetLocation}.`,
        icon: 'utensils',
        priority: 'NORMAL',
      };
    }

    case 'ITEM_REMOVED': {
      const itemsText =
        input.itemsSummary?.trim() ||
        generateChangeDetailsMessage(input.changeDetails) ||
        input.itemName ||
        'món';
      return {
        title: 'Xóa món khỏi đơn',
        message: `${actorName} đã xóa ${itemsText} khỏi đơn ${code} tại ${targetLocation}.`,
        icon: 'scissors',
        priority: 'NORMAL',
      };
    }

    case 'ITEM_QUANTITY_CHANGED': {
      const itemsText =
        input.itemsSummary?.trim() ||
        generateChangeDetailsMessage(input.changeDetails) ||
        (input.itemName ? `${input.itemName} thành ${input.quantity}` : 'số lượng món');
      return {
        title: 'Thay đổi số lượng món',
        message: `${actorName} đã cập nhật số lượng ${itemsText} tại ${targetLocation}.`,
        icon: 'edit',
        priority: 'NORMAL',
      };
    }

    case 'ITEM_OPTIONS_CHANGED': {
      const item = input.itemName?.trim() || 'món';
      const opts = input.optionsText?.trim() || 'tùy chọn mới';
      return {
        title: 'Đổi tùy chọn món',
        message: `${actorName} đã đổi tùy chọn của ${item}: (${opts}) tại ${targetLocation}.`,
        icon: 'edit',
        priority: 'NORMAL',
      };
    }

    case 'ITEM_NOTE_CHANGED': {
      const item = input.itemName?.trim() || 'món';
      const note = input.note?.trim() ? `: "${input.note.trim()}"` : '';
      return {
        title: 'Ghi chú món ăn',
        message: `${actorName} đã cập nhật ghi chú cho ${item}${note} tại ${targetLocation}.`,
        icon: 'edit',
        priority: 'NORMAL',
      };
    }

    case 'ITEM_PRICE_CHANGED': {
      const item = input.itemName?.trim() || 'món';
      return {
        title: 'Điều chỉnh đơn giá món',
        message: `${actorName} đã điều chỉnh giá của ${item} tại ${targetLocation}.`,
        icon: 'wallet',
        priority: 'HIGH',
      };
    }

    case 'ITEM_RESTORED': {
      const item = input.itemName?.trim() || 'món';
      return {
        title: 'Khôi phục món ăn',
        message: `${actorName} đã khôi phục ${item} vào đơn ${code} tại ${targetLocation}.`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    // ==========================================
    // THAO TÁC ĐƠN HÀNG & BẾP (PHASE 1.1.B)
    // ==========================================

    case 'ORDER_UPDATED': {
      const changeText = generateChangeDetailsMessage(input.changeDetails);
      return {
        title: 'Cập nhật đơn hàng',
        message: changeText
          ? `${actorName} đã cập nhật đơn ${code} tại ${targetLocation}: ${changeText}`
          : `${actorName} đã cập nhật đơn ${code} tại ${targetLocation}.`,
        icon: 'edit',
        priority: 'NORMAL',
      };
    }

    case 'KITCHEN_SENT': {
      const itemsText = input.itemsSummary?.trim() || 'các món ăn';
      return {
        title: 'Gửi món xuống bếp',
        message: `${actorName} đã gửi ${itemsText} xuống bếp chế biến tại ${targetLocation}.`,
        icon: 'utensils',
        priority: 'NORMAL',
      };
    }

    case 'KITCHEN_ITEM_READY': {
      const item = input.itemName?.trim() || 'Món ăn';
      return {
        title: 'Món ăn chế biến xong',
        message: `Bếp đã chuẩn bị xong ${item} tại ${targetLocation}. Phục vụ vui lòng nhận món trả bàn!`,
        icon: 'check-circle',
        priority: 'HIGH',
      };
    }

    case 'GUEST_COUNT_CHANGED': {
      const count = Math.max(1, Number(input.guestCount ?? input.quantity) || 1);
      return {
        title: 'Thay đổi số lượng khách',
        message: `${actorName} đã cập nhật số lượng khách thành ${count} người tại ${targetLocation}.`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    case 'SERVER_ASSIGNED': {
      const server = input.serverName || actorName;
      return {
        title: 'Phân công nhân viên',
        message: `Đã phân công ${server} phụ trách phục vụ tại ${targetLocation}.`,
        icon: 'info',
        priority: 'NORMAL',
      };
    }

    case 'ORDER_TABLE_CHANGED': {
      const oldTable = cleanTableName(input.oldTableName);
      const newTable = cleanTableName(input.newTableName || input.tableName);
      return {
        title: 'Chuyển bàn',
        message: `${actorName} đã chuyển đơn ${code} từ bàn ${oldTable || 'cũ'} sang bàn ${newTable || 'mới'}.`,
        icon: 'arrow-left-right',
        priority: 'NORMAL',
      };
    }

    case 'ORDER_TYPE_CHANGED': {
      const oldType = getOrderTypeLabel(input.oldOrderType);
      const newType = getOrderTypeLabel(input.newOrderType || input.orderType);
      return {
        title: 'Đổi hình thức phục vụ',
        message: `${actorName} đã đổi hình thức phục vụ của đơn ${code} từ [${oldType}] sang [${newType}].`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    case 'ORDER_SPLIT': {
      const fromTable = cleanTableName(input.tableName);
      const toTable = cleanTableName(input.newTableName);
      const newCode = formatOrderCodeDisplay(input.newOrderCode);
      const movedPart = input.movedItemsSummary?.trim()
        ? ` Món đã tách: ${input.movedItemsSummary.trim()}.`
        : '';
      return {
        title: 'Tách bàn / tách đơn',
        message: `${actorName} đã tách đơn ${code} tại bàn ${fromTable || 'hiện tại'} sang đơn ${newCode} tại bàn ${toTable || 'mới'}.${movedPart}`,
        icon: 'scissors',
        priority: 'HIGH',
      };
    }

    case 'ORDER_MERGED': {
      const sourceDesc = input.oldTableName
        ? `bàn ${cleanTableName(input.oldTableName)}`
        : 'đơn cũ';
      const targetDesc = input.newTableName
        ? `bàn ${cleanTableName(input.newTableName)}`
        : `đơn ${code}`;
      return {
        title: 'Gộp bàn / gộp đơn',
        message: `${actorName} đã gộp đơn từ ${sourceDesc} vào ${targetDesc}.`,
        icon: 'git-merge',
        priority: 'HIGH',
      };
    }

    case 'ORDER_CANCELED':
    case 'ORDER_CANCELLED': {
      const reasonPart = input.reason?.trim() ? ` Lý do: ${input.reason.trim()}.` : '';
      return {
        title: 'Hủy đơn hàng',
        message: `${actorName} đã hủy đơn ${code} tại ${targetLocation}.${reasonPart}`,
        icon: 'x-circle',
        priority: 'HIGH',
      };
    }

    case 'ORDER_STATUS_CHANGED': {
      const newStatusDesc =
        ORDER_STATUS_LABELS[input.newStatus || ''] || input.newStatus || 'Cập nhật';
      return {
        title: 'Đổi trạng thái đơn',
        message: `Đơn ${code} tại ${targetLocation} đã chuyển sang trạng thái "${newStatusDesc}"${actorPhrase}.`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    // ==========================================
    // THAO TÁC THANH TOÁN (PHASE 1.1.C)
    // ==========================================

    case 'PAYMENT_REQUESTED': {
      const customer = input.customerName?.trim() || 'Khách';
      const reasonPart = input.reason?.trim() ? ` (${input.reason.trim()})` : '';
      return {
        title: 'Yêu cầu thanh toán',
        message: `${customer} tại ${targetLocation} vừa yêu cầu thanh toán ${formattedTotal}${reasonPart}. Nhân viên vui lòng tiếp nhận!`,
        icon: 'wallet',
        priority: 'URGENT',
      };
    }

    case 'PAYMENT_REQUEST_ACCEPTED': {
      return {
        title: 'Tiếp nhận thanh toán',
        message: `${actorName} đã tiếp nhận yêu cầu thanh toán tại ${targetLocation}.`,
        icon: 'wallet',
        priority: 'NORMAL',
      };
    }

    case 'PAYMENT_REQUEST_CANCELLED': {
      return {
        title: 'Hủy yêu cầu thanh toán',
        message: `Yêu cầu thanh toán cho đơn ${code} tại ${targetLocation} đã được hủy${actorPhrase}.`,
        icon: 'pause-circle',
        priority: 'NORMAL',
      };
    }

    case 'PAYMENT_REQUEST_REJECTED': {
      const reasonPart = input.reason?.trim() ? `: ${input.reason.trim()}` : '';
      return {
        title: 'Từ chối yêu cầu thanh toán',
        message: `${actorName} đã từ chối yêu cầu thanh toán tại ${targetLocation}${reasonPart}.`,
        icon: 'x-circle',
        priority: 'HIGH',
      };
    }

    case 'PAYMENT_DEFERRED': {
      return {
        title: 'Hoãn thanh toán',
        message: `${actorName} đã tạm hoãn thanh toán đơn ${code} tại ${targetLocation}.`,
        icon: 'pause-circle',
        priority: 'NORMAL',
      };
    }

    case 'PAYMENT_SUCCESS': {
      const methodLabel =
        PAYMENT_METHOD_LABELS[input.paymentMethod || ''] || input.paymentMethod || 'Hệ thống';
      return {
        title: 'Thanh toán thành công',
        message: `Đơn ${code} tại ${targetLocation} trị giá ${formattedTotal} đã thanh toán thành công qua ${methodLabel}${actorPhrase}.`,
        icon: 'check-circle',
        priority: 'NORMAL',
      };
    }

    case 'PAYMENT_FAILED': {
      const reasonText = input.reason?.trim() ? ` Lý do: ${input.reason.trim()}` : '';
      return {
        title: 'Thanh toán thất bại',
        message: `Thanh toán cho đơn ${code} tại ${targetLocation} không thành công.${reasonText}`,
        icon: 'alert-triangle',
        priority: 'HIGH',
      };
    }

    // ==========================================
    // QR ORDER (PHASE 1.1.D)
    // ==========================================

    case 'QR_ROUND_SUBMITTED':
    case 'CUSTOMER_ORDER_ADDED': {
      const itemsText =
        input.itemsSummary?.trim() ||
        generateChangeDetailsMessage(input.changeDetails) ||
        'món mới';
      const normalizedItems = itemsText.replace(/\.+$/, '');
      return {
        title: 'Khách gọi món qua QR',
        message: `Khách tại ${targetLocation} vừa gửi yêu cầu gọi món: ${normalizedItems}. Hãy kiểm tra và xác nhận!`,
        icon: 'utensils',
        priority: 'HIGH',
      };
    }

    case 'QR_BUFFET_ROUND_SUBMITTED': {
      const itemsText = input.itemsSummary?.trim() || 'các món buffet';
      return {
        title: 'Khách gọi Buffet qua QR',
        message: `Khách tại ${targetLocation} vừa gửi lượt gọi Buffet: ${itemsText}. Hãy kiểm tra và xác nhận!`,
        icon: 'utensils',
        priority: 'HIGH',
      };
    }

    case 'QR_ORDER_CONFIRMED':
    case 'QR_ROUND_APPROVED': {
      return {
        title: 'Đã xác nhận món QR',
        message: `${actorName} đã xác nhận lượt gọi món từ QR tại ${targetLocation}. Món đã được gửi vào đơn hàng.`,
        icon: 'check-circle',
        priority: 'NORMAL',
      };
    }

    case 'QR_ORDER_REJECTED':
    case 'QR_ROUND_REJECTED': {
      const reasonPart = input.reason?.trim() ? `: ${input.reason.trim()}` : '';
      return {
        title: 'Từ chối món QR',
        message: `${actorName} đã từ chối lượt gọi món từ QR tại ${targetLocation}${reasonPart}.`,
        icon: 'x-circle',
        priority: 'HIGH',
      };
    }

    case 'HELP_REQUESTED':
    case 'STAFF_CALLED': {
      const customer = input.customerName?.trim() || 'Khách hàng';
      const noteText = input.reason?.trim() ? ` (${input.reason.trim()})` : '';
      return {
        title: 'Yêu cầu hỗ trợ tại bàn',
        message: `${customer} tại ${targetLocation} đang gọi nhân viên!${noteText} Vui lòng đến bàn hỗ trợ.`,
        icon: 'bell-ring',
        priority: 'URGENT',
      };
    }

    // ==========================================
    // BUFFET & BÀN (PHASE 1.1.E)
    // ==========================================

    case 'BUFFET_ACTIVATED': {
      const pkg = input.buffetPackageName || input.itemName || 'Buffet';
      const guests = Math.max(1, Number(input.guestCount ?? input.quantity) || 1);
      return {
        title: 'Kích hoạt Buffet',
        message: `${actorName} đã kích hoạt gói ${pkg} cho ${guests} khách tại ${targetLocation}.`,
        icon: 'gift',
        priority: 'HIGH',
      };
    }

    case 'BUFFET_CANCELLED': {
      return {
        title: 'Hủy gói Buffet',
        message: `${actorName} đã hủy phiên Buffet tại ${targetLocation}.`,
        icon: 'x-circle',
        priority: 'HIGH',
      };
    }

    case 'BUFFET_PACKAGE_CHANGED': {
      const pkg = input.buffetPackageName || input.itemName || 'gói mới';
      return {
        title: 'Đổi gói Buffet',
        message: `${actorName} đã chuyển sang gói Buffet ${pkg} tại ${targetLocation}.`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    case 'BUFFET_GUEST_COUNT_CHANGED': {
      const guests = Math.max(1, Number(input.guestCount ?? input.quantity) || 1);
      return {
        title: 'Đổi số vé Buffet',
        message: `${actorName} đã cập nhật số lượng vé Buffet thành ${guests} tại ${targetLocation}.`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    case 'TABLE_STATUS_CHANGED': {
      const statusText = input.newStatus || 'Cập nhật';
      return {
        title: 'Trạng thái bàn thay đổi',
        message: `Bàn ${cleanTable || targetLocation} đã chuyển sang trạng thái "${statusText}".`,
        icon: 'refresh-cw',
        priority: 'NORMAL',
      };
    }

    case 'TABLE_SESSION_OPENED': {
      return {
        title: 'Mở phiên bàn',
        message: `${actorName} đã mở phiên phục vụ mới tại ${targetLocation}.`,
        icon: 'receipt',
        priority: 'NORMAL',
      };
    }

    case 'TABLE_SESSION_CLOSED': {
      return {
        title: 'Giải phóng bàn',
        message: `Bàn ${cleanTable || targetLocation} đã được thanh toán và giải phóng sạch sẽ.`,
        icon: 'check-circle',
        priority: 'NORMAL',
      };
    }

    default: {
      return {
        title: 'Thông báo đơn hàng',
        message: `Đơn ${code} tại ${targetLocation} có cập nhật mới${actorPhrase}.`,
        icon: 'info',
        priority: 'NORMAL',
      };
    }
  }
}
