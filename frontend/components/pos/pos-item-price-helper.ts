/**
 * POS Item Price & Options Breakdown Helper
 * Uniform, accurate calculation and presentation across POS UI, modals, and print views.
 */

export interface ItemOptionBreakdown {
  name: string;
  price: number;
}

export interface ItemPriceBreakdown {
  productName: string;
  hasOptions: boolean;
  options: ItemOptionBreakdown[];
  totalOptionPrice: number;
  baseProductPrice: number;
  unitFinalPrice: number;
  quantity: number;
  discountAmount: number;
  lineTotal: number;
  addedByName: string;
  addedAt: string | null;
  addedByFormatted: string;
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('vi-VN')}đ`;
}

export function formatPosDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Parses options safely from either selectedOptions array or optionsTextSnapshot
 */
export function parseItemOptions(item: any): ItemOptionBreakdown[] {
  const options: ItemOptionBreakdown[] = [];

  // 1. Prioritize structured selectedOptions snapshot array
  if (Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
    for (const opt of item.selectedOptions) {
      const name = opt.nameAtSale || opt.name || 'Tùy chọn';
      const price = Number(opt.priceAdjustmentAtSale ?? opt.priceAdjustment ?? 0);
      options.push({ name, price });
    }
    return options;
  }

  // 2. Fallback to parsing text snapshot e.g. "Thêm cá hồi (+30.000đ), Sốt đặc biệt (+15.000đ), Không hành (+0đ)"
  const textSnapshot = item.optionsTextSnapshot || item.optionsText || '';
  if (textSnapshot && typeof textSnapshot === 'string') {
    const parts = textSnapshot.split(/,\s*/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Match "Option Name (+30.000đ)" or "Option Name (+30000)" or "Option Name (0đ)"
      const match = trimmed.match(/^(.*?)\s*\(\+?([0-9.,]+)\s*(?:đ|vnd)?\)$/i);
      if (match) {
        const rawName = match[1].trim();
        const rawPriceStr = match[2].replace(/[.,]/g, '');
        const price = Number(rawPriceStr) || 0;
        options.push({ name: rawName, price });
      } else {
        // Option without explicit price tag is a 0đ option (e.g. "Không hành", "Ít cay")
        options.push({ name: trimmed, price: 0 });
      }
    }
  }

  return options;
}

/**
 * Calculates complete pricing breakdown for an item, ensuring NO double-counting of options
 */
export function getItemPriceBreakdown(item: any, fallbackOrderCreatedAt?: string | Date | null): ItemPriceBreakdown {
  const productName = item.product?.name || item.productName || item.name || 'Món AVORA';
  const options = parseItemOptions(item);
  const hasOptions = options.length > 0;
  const totalOptionPrice = options.reduce((sum, o) => sum + o.price, 0);

  // priceAtSale in the system already equals (base price + total options)
  const unitFinalPrice = Number(item.priceAtSale ?? item.unitPrice ?? 0);
  const isBuffetIncluded = item.pricingMode === 'BUFFET_INCLUDED';

  // Base product price is 0đ for buffet included, or (unitFinalPrice - totalOptionPrice)
  const baseProductPrice = isBuffetIncluded ? 0 : Math.max(0, unitFinalPrice - totalOptionPrice);
  const quantity = Number(item.quantity ?? 1);
  const discountAmount = Number(item.discountAmount ?? 0);
  const lineTotal = Math.max(0, unitFinalPrice - discountAmount) * quantity;

  // Exact Staff who added the item & timestamp
  const addedByName = item.orderedByName || item.orderedBy || 'Thu ngân';
  const rawAddedAt = item.createdAt || item.sentToKitchenAt || item.addedAt || fallbackOrderCreatedAt || null;
  const formattedTime = formatPosDateTime(rawAddedAt);
  const addedByFormatted = formattedTime ? `Thêm bởi: ${addedByName} | ${formattedTime}` : `Thêm bởi: ${addedByName}`;

  return {
    productName,
    hasOptions,
    options,
    totalOptionPrice,
    baseProductPrice,
    unitFinalPrice,
    quantity,
    discountAmount,
    lineTotal,
    addedByName,
    addedAt: rawAddedAt ? String(rawAddedAt) : null,
    addedByFormatted,
  };
}
