export type FlashSaleRuntimeStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'UPCOMING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ENDED'
  | 'CANCELLED';

export type FlashSaleSlotStatus = 'ENDED' | 'ACTIVE' | 'UPCOMING';

export interface FlashSaleBranch {
  id: string;
  name: string;
  branchCode?: string;
}

export interface FlashSaleProductInfo {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string | null;
  price: number;
  category?: {
    id: string;
    name: string;
    slug?: string;
  } | null;
}

export interface FlashSaleItem {
  id: string;
  flashSaleId: string;
  flashSaleSlotId?: string | null;
  productId: string;
  flashSalePrice: number;
  originalPriceSnapshot?: number | null;
  stock: number;
  reservedStock: number;
  sold: number;
  maxQuantityPerUser?: number | null;
  maxQuantityPerOrder?: number | null;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  product?: FlashSaleProductInfo;
  slot?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface FlashSaleSlot {
  id: string;
  flashSaleId: string;
  name: string;
  startTime: string;
  endTime: string;
  teaserStartAt?: string | null;
  sortOrder: number;
  isActive: boolean;
  runtimeStatus?: FlashSaleSlotStatus;
  countdown?: number;
  itemsCount?: number;
  items?: FlashSaleItem[];
}

export interface FlashSaleCampaign {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  runtimeStatus: FlashSaleRuntimeStatus;
  startTime: string;
  endTime: string;
  teaserStartAt?: string | null;
  bannerImageUrl?: string | null;
  mobileBannerImageUrl?: string | null;
  priority: number;
  isFeatured: boolean;
  allowVouchers: boolean;
  allowFreeship: boolean;
  allowPoints: boolean;
  allowMembershipDiscount: boolean;
  maxQuantityPerOrder?: number | null;
  maxQuantityPerUser?: number | null;
  applyOnline: boolean;
  applyPos: boolean;
  branches: FlashSaleBranch[];
  slots: FlashSaleSlot[];
  items: FlashSaleItem[];
  createdById?: string | null;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;

  // Realtime calculated summary fields
  totalStock?: number;
  totalSold?: number;
  soldPercent?: number;
  totalRevenue?: number;
  totalOrders?: number;
  currentSlot?: FlashSaleSlot | null;
  nextSlot?: FlashSaleSlot | null;
}

export interface FlashSaleKPIs {
  activeCount: number;
  upcomingCount: number;
  endedCount: number;
  totalRevenue: number;
  totalUnitsSold: number;
  totalOrders: number;
  totalBuyers: number;
  totalDiscountAmount: number;
  sellThroughRate: number;
  conversionRate: number;
  revenueToday: number;
  revenue7d: number;
  revenue30d: number;
  revenueGrowth: number;
  ordersGrowth: number;
}

export interface FlashSaleCheckItem {
  code: string;
  title: string;
  passed: boolean;
  message: string;
}

export interface FlashSaleValidationResponse {
  isValid: boolean;
  checks: FlashSaleCheckItem[];
  errors: string[];
}

export interface FlashSaleAuditLog {
  id: string;
  flashSaleId: string;
  action: string;
  details?: any;
  ipAddress?: string | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface FlashSaleReportKPI {
  grossSales: number;
  netRevenue: number;
  totalDiscount: number;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  cancellationRate: number;
  totalUnitsSold: number;
  totalFlashStock: number;
  sellThroughRate: number;
  soldOutProductsCount: number;
  uniqueBuyers: number;
  averageOrderValue: number;
  averageItemsPerBuyer: number;
  averageSpendingPerBuyer: number;
}

export interface FlashSaleFunnel {
  impressions: number;
  productViews: number;
  addToCart: number;
  checkouts: number;
  purchased: number;
  conversionRate: number;
}

export interface FlashSaleSlotPerformance {
  slotId: string;
  slotName: string;
  startTime: string;
  endTime: string;
  revenue: number;
  ordersCount: number;
  unitsSold: number;
  flashStock: number;
  sellThroughRate: number;
  uniqueBuyers: number;
}

export interface FlashSaleProductPerformance {
  productId: string;
  productName: string;
  productImage?: string | null;
  regularPrice: number;
  flashSalePrice: number;
  discountPercent: number;
  stock: number;
  sold: number;
  sellThroughRate: number;
  revenue: number;
  ordersCount: number;
  uniqueBuyers: number;
  isSoldOut: boolean;
}

export interface FlashSaleBranchPerformance {
  branchId: string;
  branchName: string;
  revenue: number;
  ordersCount: number;
  unitsSold: number;
  uniqueBuyers: number;
  averageOrderValue: number;
  sellThroughRate: number;
}
