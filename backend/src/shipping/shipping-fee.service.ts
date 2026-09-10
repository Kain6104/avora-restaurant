import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
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
      'delivery_price_per_km',
      'delivery_min_fee',
      'delivery_max_fee',
      'delivery_free_threshold',
      'free_shipping_threshold',
      'delivery_min_free',
      'free_shipping_enabled',
      'delivery_routing_provider',
    ];

    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    const thresholdVal = Number(map['free_shipping_threshold'] || map['delivery_min_free'] || map['delivery_free_threshold'] || 500000);
    const freeshipEnabled = map['free_shipping_enabled'] !== 'false';

    return {
      deliveryEnabled: map['delivery_enabled'] !== 'false',
      maxDeliveryDistanceKm: Number(map['delivery_max_distance_km']) || 15,
      baseDistanceKm: Number(map['delivery_base_distance_km']) || 3,
      baseShippingFee: Number(map['delivery_base_fee']) || 15000,
      pricePerAdditionalKm: Number(map['delivery_price_per_km']) || 5000,
      minimumShippingFee: Number(map['delivery_min_fee']) || 10000,
      maximumShippingFee: Number(map['delivery_max_fee']) || 100000,
      freeShippingThreshold: Math.max(0, thresholdVal),
      freeShippingEnabled: freeshipEnabled,
      routingProvider: map['delivery_routing_provider'] || 'OSRM',
    };
  }

  /**
   * Tính quãng đường và thời gian di chuyển giữa 2 tọa độ (có cache 10 phút)
   */
  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteCalculationResult> {
    // Validate coordinates
    if (
      typeof origin.lat !== 'number' ||
      typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' ||
      typeof destination.lng !== 'number' ||
      Math.abs(origin.lat) > 90 ||
      Math.abs(origin.lng) > 180 ||
      Math.abs(destination.lat) > 90 ||
      Math.abs(destination.lng) > 180 ||
      (origin.lat === 0 && origin.lng === 0) ||
      (destination.lat === 0 && destination.lng === 0)
    ) {
      throw new BadRequestException('Tọa độ chi nhánh hoặc địa chỉ giao hàng không hợp lệ');
    }

    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    const now = Date.now();
    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const result = await this.osrmProvider.calculateRoute(origin, destination);
    // Cache 10 phút
    this.routeCache.set(cacheKey, { result, expiresAt: now + 10 * 60 * 1000 });
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
    const { branchId, addressId, destinationLat, destinationLng, subTotal = 0, shippingVoucherCode, user } = params;

    // 1. Lấy chi nhánh
    let branch: any = null;
    if (branchId) {
      branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    }
    if (!branch) {
      branch = await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } });
    }
    if (!branch) {
      throw new BadRequestException('Không tìm thấy chi nhánh phục vụ giao hàng');
    }

    // Tọa độ chi nhánh (mặc định nếu null là trung tâm Hà Nội)
    const branchLat = branch.latitude ?? 21.028511;
    const branchLng = branch.longitude ?? 105.854444;

    // 2. Lấy tọa độ điểm nhận
    let destLat: number | null = null;
    let destLng: number | null = null;

    if (addressId) {
      const addr = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (addr && addr.latitude && addr.longitude) {
        destLat = addr.latitude;
        destLng = addr.longitude;
      }
    }

    if ((destLat === null || destLng === null) && destinationLat && destinationLng) {
      destLat = destinationLat;
      destLng = destinationLng;
    }

    // Nếu vẫn chưa có tọa độ (địa chỉ cũ chưa chấm tọa độ), fallback tọa độ cách 3.5km để tính giá tạm
    const isMockCoords = destLat === null || destLng === null;
    if (isMockCoords) {
      destLat = branchLat + 0.025;
      destLng = branchLng + 0.025;
    }

    // 3. Tính quãng đường thực tế
    const route = await this.calculateRoute(
      { lat: branchLat, lng: branchLng },
      { lat: destLat!, lng: destLng! },
    );

    const distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10;
    const durationMinutes = Math.max(15, Math.ceil(route.durationSeconds / 60));

    // 4. Kiểm tra chính sách giao hàng
    const policy = await this.getShippingPolicy(branch.id);

    let deliveryAvailable = true;
    let unavailabilityReason: string | undefined;

    if (!policy.deliveryEnabled) {
      deliveryAvailable = false;
      unavailabilityReason = 'Dịch vụ giao hàng trực tuyến đang tạm đóng.';
    } else if (distanceKm > policy.maxDeliveryDistanceKm) {
      deliveryAvailable = false;
      unavailabilityReason = `Địa chỉ này nằm ngoài phạm vi giao hàng của chi nhánh (${distanceKm} km > tối đa ${policy.maxDeliveryDistanceKm} km).`;
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
    const freeShippingRemainingAmount = Math.max(0, freeShippingThreshold - freeShippingEligibleAmount);

    let shippingDiscount = 0;
    let shippingDiscountSource: 'NONE' | 'ORDER_THRESHOLD' | 'VOUCHER' | 'ORDER_THRESHOLD_AND_VOUCHER' = 'NONE';

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
