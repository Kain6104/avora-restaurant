export interface RouteCalculationResult {
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
  isFallback: boolean;
  calculatedAt: Date;
}

export interface ShippingRoutingProvider {
  calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteCalculationResult>;
}

/**
 * Tính khoảng cách đường chim bay (Haversine Formula) theo mét
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Fallback Provider: Haversine nhân với hệ số đường bộ đô thị Việt Nam (1.35)
 * Tốc độ xe máy ước tính trung bình 28 km/h (466 m/phút)
 */
export class HaversineFallbackRoutingProvider implements ShippingRoutingProvider {
  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteCalculationResult> {
    const rawHaversine = calculateHaversineDistanceMeters(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
    );
    // Hệ số uốn lượn đường phố thực tế tại Hà Nội / TP.HCM ~ 1.35
    const distanceMeters = Math.round(rawHaversine * 1.35);
    // Thời gian: ~25 km/h ~ 7 m/giây
    const durationSeconds = Math.max(300, Math.round(distanceMeters / 7));

    return {
      distanceMeters,
      durationSeconds,
      provider: 'HAVERSINE_CURVATURE_ESTIMATE',
      isFallback: true,
      calculatedAt: new Date(),
    };
  }
}

/**
 * OSRM (Open Source Routing Machine) Provider - Tính đường bộ xe máy/ô tô chính xác
 */
export class OsrmRoutingProvider implements ShippingRoutingProvider {
  private fallback = new HaversineFallbackRoutingProvider();

  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteCalculationResult> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          return {
            distanceMeters: Math.round(route.distance),
            durationSeconds: Math.round(route.duration),
            provider: 'STANDARD_DELIVERY',
            isFallback: false,
            calculatedAt: new Date(),
          };
        }
      }
    } catch (err) {
      console.warn('OSRM routing request failed or timed out, falling back to Haversine Curvature:', err);
    }

    // Fallback if OSRM unavailable
    return this.fallback.calculateRoute(origin, destination);
  }
}
