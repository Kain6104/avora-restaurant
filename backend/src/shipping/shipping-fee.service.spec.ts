import {
  calculateHaversineDistanceMeters,
  HaversineFallbackRoutingProvider,
  OpenMapRoutingProvider,
  OsrmRoutingProvider,
} from './shipping-routing.provider';
import { ShippingFeeService, ShippingPolicy } from './shipping-fee.service';
import { BadRequestException } from '@nestjs/common';

describe('Shipping Routing Providers & Fee Calculation', () => {
  describe('Haversine Formula & Fallback Provider', () => {
    it('should calculate accurate distance between two coordinates in meters', () => {
      // Coordinates: Avora Signature Q1 (10.773234, 106.700684) to Landmark 81 (10.794628, 106.721832)
      const dist = calculateHaversineDistanceMeters(
        10.773234,
        106.700684,
        10.794628,
        106.721832,
      );
      // Approximately 3.3 km - 3.5 km straight line
      expect(dist).toBeGreaterThan(3000);
      expect(dist).toBeLessThan(3800);
    });

    it('should apply 1.35 urban curvature factor in fallback provider', async () => {
      const fallback = new HaversineFallbackRoutingProvider();
      const result = await fallback.calculateRoute(
        { lat: 10.773234, lng: 106.700684 },
        { lat: 10.794628, lng: 106.721832 },
      );
      expect(result.isFallback).toBe(true);
      expect(result.provider).toBe('HAVERSINE_CURVATURE_ESTIMATE');
      expect(result.distanceMeters).toBeGreaterThan(4000);
      expect(result.durationSeconds).toBeGreaterThan(300);
    });
  });

  describe('OpenMapRoutingProvider', () => {
    it('should throw if API key is missing', async () => {
      const provider = new OpenMapRoutingProvider('');
      await expect(
        provider.calculateRoute(
          { lat: 10.773234, lng: 106.700684 },
          { lat: 10.794628, lng: 106.721832 },
        ),
      ).rejects.toThrow('OPENMAP_API_KEY is empty or missing');
    });

    it('should correctly parse valid OpenMap Directions API response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              legs: [
                {
                  distance: { text: '4.8 km', value: 4850 },
                  duration: { text: '12 mins', value: 720 },
                },
              ],
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const provider = new OpenMapRoutingProvider('test-openmap-key', 'motor');
      const res = await provider.calculateRoute(
        { lat: 10.773234, lng: 106.700684 },
        { lat: 10.794628, lng: 106.721832 },
      );

      expect(res.distanceMeters).toBe(4850);
      expect(res.durationSeconds).toBe(720);
      expect(res.provider).toBe('OPENMAP_MOTOR');
      expect(res.isFallback).toBe(false);

      // Verify URL sent to OpenMap
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://mapapis.openmap.vn/v1/direction');
      expect(calledUrl).toContain('vehicle=motor');
      expect(calledUrl).toContain('origin=10.773234,106.700684');
      expect(calledUrl).toContain('destination=10.794628,106.721832');
      expect(calledUrl).toContain('apikey=test-openmap-key');
    });
  });

  describe('OsrmRoutingProvider', () => {
    it('should correctly format lng,lat coordinates for OSRM', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ distance: 5120.4, duration: 680 }],
        }),
      });
      global.fetch = mockFetch;

      const osrm = new OsrmRoutingProvider();
      const res = await osrm.calculateRoute(
        { lat: 10.773234, lng: 106.700684 },
        { lat: 10.794628, lng: 106.721832 },
      );

      expect(res.distanceMeters).toBe(5120);
      expect(res.durationSeconds).toBe(680);
      expect(res.provider).toBe('OSRM_ROUTING');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/106.700684,10.773234;106.721832,10.794628');
    });
  });

  describe('ShippingFeeService Delivery Fee Formula', () => {
    const mockPrisma: any = {
      systemSetting: { findMany: jest.fn(), findFirst: jest.fn() },
      branch: { findUnique: jest.fn(), findFirst: jest.fn() },
      address: { findUnique: jest.fn() },
      voucher: { findUnique: jest.fn() },
    };

    const service = new ShippingFeeService(mockPrisma);

    const standardPolicy: ShippingPolicy = {
      deliveryEnabled: true,
      maxDeliveryDistanceKm: 10,
      baseDistanceKm: 3,
      baseShippingFee: 20000,
      pricePerAdditionalKm: 5000,
      minimumShippingFee: 10000,
      maximumShippingFee: 100000,
      freeShippingThreshold: 1500000,
      freeShippingEnabled: true,
      routingProvider: 'OPENMAP',
    };

    it('should charge base fee for distances within base distance (e.g. 2.5 km)', () => {
      const fee = service.calculateFeeFromDistance(2.5, standardPolicy, 200000);
      expect(fee).toBe(20000);
    });

    it('should charge base fee plus additional km rate for distances over base distance', () => {
      // 5.2 km -> 3km base (20000) + ceil(2.2 km) * 5000 = 20000 + 3 * 5000 = 35000
      const fee = service.calculateFeeFromDistance(5.2, standardPolicy, 200000);
      expect(fee).toBe(35000);
    });

    it('should grant 0đ shipping fee when subTotal reaches freeShippingThreshold', () => {
      const fee = service.calculateFeeFromDistance(6.5, standardPolicy, 1500000);
      expect(fee).toBe(0);
    });

    it('should enforce maximum shipping fee boundary', () => {
      const policyWithLowMax = { ...standardPolicy, maximumShippingFee: 40000 };
      const fee = service.calculateFeeFromDistance(9.8, policyWithLowMax, 100000);
      expect(fee).toBe(40000);
    });

    it('should reject invalid 0,0 coordinates', async () => {
      await expect(
        service.calculateRoute({ lat: 0, lng: 0 }, { lat: 10.773234, lng: 106.700684 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
