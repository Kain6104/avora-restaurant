import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OpenMapRoutingProvider,
  OsrmRoutingProvider,
  HaversineFallbackRoutingProvider,
  ShippingRoutingProvider,
  RouteCalculationResult,
} from './shipping-routing.provider';

export interface ShippingPolicy {
  deliveryEnabled: boolean;
  maxDeliveryDistanceKm: number;
  baseDistanceKm: number;
  baseShippingFee: number;
  pricePerAdditionalKm: number;
  minimumShippingFee: number;
  maximumShippingFee: number;
  freeShippingThreshold: number;
  freeShippingEnabled: boolean;
  routingProvider: string;
  openmapApiKey?: string;
}

export interface ShippingQuoteResult {
  branchId: string;
  branchName: string;
  distanceKm: number;
  distanceMeters: number;
  durationMinutes: number;
  durationSeconds: number;
  originalShippingFee: number;
  shippingDiscount: number;
  finalShippingFee: number;
  deliveryAvailable: boolean;
  unavailabilityReason?: string;
  provider: string;
  isFallback: boolean;
  freeShippingQualified?: boolean;
  freeShippingThreshold?: number;
  freeShippingRemainingAmount?: number;
  shippingDiscountSource?: 'NONE' | 'ORDER_THRESHOLD' | 'VOUCHER' | 'ORDER_THRESHOLD_AND_VOUCHER';
  expiresAt: string;
}

@Injectable()
export class ShippingFeeService {
  private readonly logger = new Logger(ShippingFeeService.name);
  private osrmProvider = new OsrmRoutingProvider();
  private fallbackProvider = new HaversineFallbackRoutingProvider();
  private routeCache = new Map<string, { result: RouteCalculationResult; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tải cấu hình chính sách giao hàng từ SystemSetting
   */
  async getShippingPolicy(branchId?: string): Promise<ShippingPolicy> {
    const keys = [
      'delivery_enabled',
      'delivery_max_distance_km',
      'delivery_base_distance_km',
      'delivery_base_fee',
      'delivery_fee',
      'delivery_price_per_km',
      'delivery_min_fee',
      'delivery_max_fee',
      'delivery_free_threshold',
      'free_shipping_threshold',
      'delivery_min_free',
      'free_shipping_enabled',
      'delivery_routing_provider',
      'openmap_api_key',
      'delivery_openmap_key',
    ];

    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    const thresholdVal = Number(
      map['free_shipping_threshold'] ||
        map['delivery_min_free'] ||
        map['delivery_free_threshold'] ||
        1500000,
    );
    const freeshipEnabled = map['free_shipping_enabled'] !== 'false';
    const baseFee = Number(map['delivery_base_fee'] || map['delivery_fee']) || 20000;
    const openmapApiKey =
      process.env.OPENMAP_API_KEY ||
      map['openmap_api_key'] ||
      map['delivery_openmap_key'] ||
      undefined;

    return {
      deliveryEnabled: map['delivery_enabled'] !== 'false',
      maxDeliveryDistanceKm: Number(map['delivery_max_distance_km']) || 10,
      baseDistanceKm: Number(map['delivery_base_distance_km']) || 3,
      baseShippingFee: baseFee,
      pricePerAdditionalKm: Number(map['delivery_price_per_km']) || 5000,
      minimumShippingFee: Number(map['delivery_min_fee']) || 10000,
      maximumShippingFee: Number(map['delivery_max_fee']) || 100000,
      freeShippingThreshold: Math.max(0, thresholdVal),
      freeShippingEnabled: freeshipEnabled,
      routingProvider: map['delivery_routing_provider'] || (openmapApiKey ? 'OPENMAP' : 'OSRM'),
      openmapApiKey,
    };
  }

  /**
   * Tính quãng đường và thời gian di chuyển giữa 2 tọa độ (có cache 15 phút)
   * Tuyến xe máy (motorcycle routing) ưu tiên OpenMap.vn, fallback OSRM và Haversine
   */
  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    apiKeyOverride?: string,
  ): Promise<RouteCalculationResult> {
    // Validate coordinates
    if (
      typeof origin.lat !== 'number' ||
      typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' ||
      typeof destination.lng !== 'number' ||
      isNaN(origin.lat) ||
      isNaN(origin.lng) ||
      isNaN(destination.lat) ||
      isNaN(destination.lng) ||
      Math.abs(origin.lat) > 90 ||
      Math.abs(origin.lng) > 180 ||
      Math.abs(destination.lat) > 90 ||
      Math.abs(destination.lng) > 180 ||
      (origin.lat === 0 && origin.lng === 0) ||
      (destination.lat === 0 && destination.lng === 0)
    ) {
      throw new BadRequestException('Tọa độ chi nhánh hoặc địa chỉ giao hàng không hợp lệ');
    }

    // Cache key normalized to 4 decimals (~11 meters)
    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    const now = Date.now();
    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    // Check OpenMap API Key
    const openmapKey =
      apiKeyOverride ||
      process.env.OPENMAP_API_KEY ||
      (await this.prisma.systemSetting
        .findFirst({ where: { key: { in: ['openmap_api_key', 'delivery_openmap_key'] } } })
        .then((s) => s?.value)
        .catch(() => undefined));

    let result: RouteCalculationResult | null = null;

    // 1. Primary: OpenMap.vn Directions API with vehicle=motor
    if (openmapKey && openmapKey.trim()) {
      try {
        const openmapProvider = new OpenMapRoutingProvider(openmapKey.trim(), 'motor');
        result = await openmapProvider.calculateRoute(origin, destination);
      } catch (err: any) {
        this.logger.warn(`OpenMap.vn Directions API failed: ${err.message}. Trying OSRM fallback.`);
      }
    }

    // 2. Secondary: OSRM router
    if (!result) {
      try {
        result = await this.osrmProvider.calculateRoute(origin, destination);
      } catch (err: any) {
        this.logger.warn(`OSRM router failed: ${err.message}. Trying Haversine fallback.`);
      }
    }

    // 3. Last Resort Fallback: Haversine Curvature Estimate
    if (!result) {
      result = await this.fallbackProvider.calculateRoute(origin, destination);
    }

    // Cache for 15 minutes to preserve API quota
    this.routeCache.set(cacheKey, { result, expiresAt: now + 15 * 60 * 1000 });
    return result;
  }

  /**
   * Tính phí giao hàng gốc dựa trên khoảng cách (km) và chính sách
   */
  calculateFeeFromDistance(distanceKm: number, policy: ShippingPolicy, subTotal = 0): number {
    if (policy.freeShippingThreshold > 0 && subTotal >= policy.freeShippingThreshold) {
      return 0;
    }

    let fee = policy.baseShippingFee;
    if (distanceKm > policy.baseDistanceKm) {
      const extraKm = distanceKm - policy.baseDistanceKm;
      fee += Math.ceil(extraKm) * policy.pricePerAdditionalKm;
    }

    fee = Math.max(policy.minimumShippingFee, fee);
    fee = Math.min(policy.maximumShippingFee, fee);
    return Math.round(fee);
  }

  /**
   * Báo giá vận chuyển đầy đủ (Shipping Quote)
   */
  async getShippingQuote(params: {
    branchId?: string;
    addressId?: string;
    destinationLat?: number;
    destinationLng?: number;
    subTotal?: number;
    shippingVoucherCode?: string;
    user?: any;
  }): Promise<ShippingQuoteResult> {
    const {
      branchId,
      addressId,
      destinationLat,
      destinationLng,
      subTotal = 0,
      shippingVoucherCode,
    } = params;

    // 1. Lấy chi nhánh
    let branch: any = null;
    if (branchId) {
      const bId = String(branchId);
      branch = await this.prisma.branch.findFirst({
        where: {
          OR: [{ id: bId }, { branchCode: bId }],
        },
      });
    }
    if (!branch) {
      branch = await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } });
    }
    if (!branch) {
      branch = await this.prisma.branch.findFirst();
    }
    if (!branch) {
      throw new BadRequestException('Không tìm thấy chi nhánh phục vụ giao hàng');
    }

    // Tọa độ chi nhánh
    const branchLat = branch.latitude;
    const branchLng = branch.longitude;

    if (
      typeof branchLat !== 'number' ||
      typeof branchLng !== 'number' ||
      isNaN(branchLat) ||
      isNaN(branchLng) ||
      (branchLat === 0 && branchLng === 0)
    ) {
      throw new BadRequestException(
        `Chi nhánh "${branch.name}" chưa được cấu hình tọa độ định vị chính xác. Vui lòng liên hệ nhà hàng.`,
      );
    }

    // 2. Lấy tọa độ điểm nhận
    let destLat: number | null = null;
    let destLng: number | null = null;

    if (addressId) {
      const addr = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (
        addr &&
        typeof addr.latitude === 'number' &&
        typeof addr.longitude === 'number' &&
        !isNaN(addr.latitude) &&
        !isNaN(addr.longitude) &&
        !(addr.latitude === 0 && addr.longitude === 0)
      ) {
        destLat = addr.latitude;
        destLng = addr.longitude;
      }
    }

    if (
      (destLat === null || destLng === null) &&
      typeof destinationLat === 'number' &&
      typeof destinationLng === 'number' &&
      !isNaN(destinationLat) &&
      !isNaN(destinationLng) &&
      !(destinationLat === 0 && destinationLng === 0)
    ) {
      destLat = destinationLat;
      destLng = destinationLng;
    }

    const policy = await this.getShippingPolicy(branch.id);

    // Nếu địa chỉ chưa có tọa độ ghim trên bản đồ, thông báo rõ ràng cho khách hàng
    if (destLat === null || destLng === null) {
      return {
        branchId: branch.id,
        branchName: branch.name,
        distanceKm: 0,
        distanceMeters: 0,
        durationMinutes: 0,
        durationSeconds: 0,
        originalShippingFee: 0,
        shippingDiscount: 0,
        finalShippingFee: 0,
        deliveryAvailable: false,
        unavailabilityReason:
          'Địa chỉ nhận hàng chưa có tọa độ ghim trên bản đồ. Vui lòng bấm "Thay đổi" và ghim vị trí nhận hàng để tính phí ship chính xác.',
        provider: 'UNAVAILABLE',
        isFallback: false,
        freeShippingQualified: false,
        freeShippingThreshold: policy.freeShippingThreshold,
        freeShippingRemainingAmount: policy.freeShippingThreshold,
        shippingDiscountSource: 'NONE',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    }

    // 3. Tính quãng đường thực tế
    const route = await this.calculateRoute(
      { lat: branchLat, lng: branchLng },
      { lat: destLat, lng: destLng },
      policy.openmapApiKey,
    );

    const distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10;
    const durationMinutes = Math.max(15, Math.ceil(route.durationSeconds / 60));

    // 4. Kiểm tra chính sách giao hàng
    let deliveryAvailable = true;
    let unavailabilityReason: string | undefined;

    if (!policy.deliveryEnabled) {
      deliveryAvailable = false;
      unavailabilityReason = 'Dịch vụ giao hàng trực tuyến đang tạm đóng.';
    } else if (distanceKm > policy.maxDeliveryDistanceKm) {
      deliveryAvailable = false;
      unavailabilityReason = `Địa chỉ này nằm ngoài phạm vi giao hàng của chi nhánh (${distanceKm} km > tối đa ${policy.maxDeliveryDistanceKm} km). Quý khách vui lòng chọn chi nhánh gần hơn hoặc địa chỉ khác.`;
    }

    const originalShippingFee = deliveryAvailable
      ? this.calculateFeeFromDistance(distanceKm, policy, subTotal)
      : 0;

    // 5. Kiểm tra chính sách miễn phí vận chuyển theo giá trị đơn hàng và voucher
    const freeShippingThreshold = policy.freeShippingThreshold;
    const freeShippingEligibleAmount = Math.max(0, subTotal);
    const freeShippingQualified =
      policy.freeShippingEnabled &&
      freeShippingThreshold > 0 &&
      freeShippingEligibleAmount >= freeShippingThreshold;
    const freeShippingRemainingAmount = Math.max(
      0,
      freeShippingThreshold - freeShippingEligibleAmount,
    );

    let shippingDiscount = 0;
    let shippingDiscountSource:
      | 'NONE'
      | 'ORDER_THRESHOLD'
      | 'VOUCHER'
      | 'ORDER_THRESHOLD_AND_VOUCHER' = 'NONE';

    if (freeShippingQualified && originalShippingFee > 0) {
      shippingDiscount = originalShippingFee;
      shippingDiscountSource = 'ORDER_THRESHOLD';
    } else if (shippingVoucherCode && deliveryAvailable && originalShippingFee > 0) {
      const v = await this.prisma.voucher.findUnique({
        where: { code: shippingVoucherCode.trim().toUpperCase() },
        include: { membershipTiers: true, branches: true },
      });
      if (v && v.isActive && v.discountType === 'FREE_SHIP') {
        const now = new Date();
        if (v.startDate <= now && v.endDate >= now && subTotal >= v.minOrderValue) {
          if (v.discountValue > 0) {
            shippingDiscount = Math.min(originalShippingFee, Math.round(v.discountValue));
          } else {
            shippingDiscount = originalShippingFee;
          }
          shippingDiscountSource = 'VOUCHER';
        }
      }
    }

    const finalShippingFee = Math.max(0, originalShippingFee - shippingDiscount);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 phút

    return {
      branchId: branch.id,
      branchName: branch.name,
      distanceKm,
      distanceMeters: route.distanceMeters,
      durationMinutes,
      durationSeconds: route.durationSeconds,
      originalShippingFee,
      shippingDiscount,
      finalShippingFee,
      deliveryAvailable,
      unavailabilityReason,
      provider: route.provider,
      isFallback: route.isFallback,
      freeShippingQualified,
      freeShippingThreshold,
      freeShippingRemainingAmount,
      shippingDiscountSource,
      expiresAt,
    };
  }
}
