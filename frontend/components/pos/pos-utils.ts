// POS Utilities & Helpers

/**
 * Loại bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu
 * VD: "Phở bò tái" -> "pho bo tai"
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Bộ preset ghi chú nhanh thông minh theo phân loại món
 * Tránh trường hợp món ăn lại hiện "Ít đá" hay đồ uống hiện "Không hành"
 */
export const CATEGORY_QUICK_NOTES: Record<string, string[]> = {
  beverage: ['Ít đá', 'Không đá', 'Ít ngọt', 'Không đường', 'Mang về', 'Uống tại chỗ', 'Mang đi ngay'],
  drink: ['Ít đá', 'Không đá', 'Ít ngọt', 'Không đường', 'Mang về', 'Uống tại chỗ', 'Mang đi ngay'],
  coffee: ['Ít đường', 'Không đường', 'Ít sữa', 'Nhiều sữa', 'Ít đá', 'Không đá', 'Mang về'],
  food: ['Ít cay', 'Không cay', 'Cay nhiều', 'Không hành', 'Không tiêu', 'Mang về', 'Ăn tại chỗ'],
  main: ['Ít cay', 'Không cay', 'Cay nhiều', 'Không hành', 'Làm riêng', 'Mang về', 'Ăn tại chỗ'],
  soup: ['Không hành', 'Không ngò', 'Ít cay', 'Không cay', 'Nước dùng trong', 'Mang về'],
  dessert: ['Ít ngọt', 'Không đường', 'Thêm đá', 'Ăn sau', 'Mang về'],
  general: ['Ít cay', 'Không cay', 'Không hành', 'Ít đá', 'Ít ngọt', 'Mang về', 'Ăn tại chỗ', 'Làm nóng'],
};

/**
 * Lấy danh sách ghi chú nhanh phù hợp nhất cho sản phẩm
 */
export function getProductQuickNotes(categorySlug?: string, productName?: string): string[] {
  const slug = (categorySlug || '').toLowerCase();
  const name = (productName || '').toLowerCase();

  // Nhận diện đồ uống
  if (
    slug.includes('drink') ||
    slug.includes('beverage') ||
    slug.includes('nuoc') ||
    slug.includes('tra') ||
    slug.includes('cafe') ||
    name.includes('trà') ||
    name.includes('nước') ||
    name.includes('cà phê') ||
    name.includes('sinh tố') ||
    name.includes('coca') ||
    name.includes('bia')
  ) {
    return CATEGORY_QUICK_NOTES.beverage;
  }

  // Nhận diện cà phê
  if (slug.includes('coffee') || slug.includes('cafe') || name.includes('cà phê')) {
    return CATEGORY_QUICK_NOTES.coffee;
  }

  // Nhận diện tráng miệng / chè
  if (slug.includes('dessert') || slug.includes('trang-mieng') || name.includes('chè') || name.includes('bánh')) {
    return CATEGORY_QUICK_NOTES.dessert;
  }

  // Mặc định món ăn mặn
  if (slug.includes('soup') || slug.includes('canh') || slug.includes('pho') || name.includes('phở') || name.includes('bún')) {
    return CATEGORY_QUICK_NOTES.soup;
  }

  if (slug.includes('food') || slug.includes('mon-chinh') || slug.includes('rice') || slug.includes('com')) {
    return CATEGORY_QUICK_NOTES.food;
  }

  return CATEGORY_QUICK_NOTES.general;
}

/**
/**
 * Tạo chuỗi nhận diện duy nhất cho một cấu hình tùy chọn của sản phẩm
 */
export function getCartItemIdentity(
  productId: string,
  selectedOptions?: Array<{ optionItemId: string }>,
): string {
  if (!selectedOptions || selectedOptions.length === 0) {
    return productId;
  }
  const sortedOptionIds = selectedOptions
    .map((o) => o.optionItemId)
    .sort()
    .join('|');
  return `${productId}:${sortedOptionIds}`;
}

/**
 * Tạo cartLineIdentity chuẩn hóa nghiêm ngặt từ:
 * - productId
 * - normalizedSelectedOptions
 * - normalizedNote
 * - priceAtSale
 * - itemDiscount state
 * - kitchen state
 *
 * Quy tắc Merge vs Split:
 * Chỉ gộp (merge) khi toàn bộ identity giống nhau 100% và item đang ở trạng thái PENDING.
 * Nếu ghi chú khác nhau (ví dụ: một dòng "cắt dày", dòng mới không ghi chú hoặc khác) -> Bắt buộc tách (split).
 * Nếu cùng ghi chú giống nhau -> Được phép merge nếu các thông số khác giống nhau.
 */
export function getCartLineIdentity(item: {
  productId: string;
  selectedOptions?: Array<{ optionItemId: string }>;
  note?: string | null;
  priceAtSale?: number;
  discountAmount?: number;
  discountReason?: string | null;
  kitchenStatus?: string | null;
  pricingMode?: string | null;
  buffetSessionId?: string | null;
}): string {
  const normOptions = (item.selectedOptions || [])
    .map((o) => o.optionItemId)
    .sort()
    .join('|');
  const normNote = (item.note || '').trim().toLowerCase();
  const price = item.priceAtSale !== undefined ? Math.round(item.priceAtSale) : 0;
  const discState = `${item.discountAmount || 0}:${(item.discountReason || '').trim().toLowerCase()}`;
  const kitchen = item.kitchenStatus || 'PENDING';
  const pricingMode = item.pricingMode || 'REGULAR';
  const buffetSessionId = item.buffetSessionId || '';

  return `${item.productId}::opt[${normOptions}]::note[${normNote}]::price[${price}]::disc[${discState}]::k[${kitchen}]::pm[${pricingMode}]::bs[${buffetSessionId}]`;
}

/**
 * Kiểm tra xem đơn hàng có phải đơn trực tuyến (Web, Online, Chatbot, Voice) không
 */
export function isOnlineOrder(
  order?: { orderSource?: string | null; tableId?: string | null; table?: any } | null,
): boolean {
  if (!order) return false;
  return (
    order.orderSource === 'WEB' ||
    order.orderSource === 'ONLINE' ||
    order.orderSource === 'CHATBOT' ||
    order.orderSource === 'VOICE' ||
    (Boolean(order.orderSource) && order.orderSource !== 'POS' && !order.tableId && !order.table)
  );
}

