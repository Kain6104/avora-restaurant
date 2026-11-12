export interface RouteCalculationResult {
  distanceMeters: number;
  durationSeconds: number;
  provider: 'OPENMAP_MOTOR' | 'OSRM_ROUTING' | 'HAVERSINE_CURVATURE_ESTIMATE' | string;
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
 * Fallback Provider: Haversine nhân với hệ số uốn lượn đường phố đô thị Việt Nam (1.35)
 * Tốc độ xe máy ước tính trung bình ~25 km/h (~7 m/giây)
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
    const distanceMeters = Math.round(rawHaversine * 1.35);
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
 * OpenMap.vn Directions API Provider
 * Official Documentation: https://docs.openmap.vn/docs/rest-apis/routing/
 * Endpoint: GET https://mapapis.openmap.vn/v1/direction
 * Vehicle: motor (motorcycle routing according to Vietnam road rules)
 */
export class OpenMapRoutingProvider implements ShippingRoutingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly vehicle: string = 'motor',
  ) {}

  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteCalculationResult> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error('OPENMAP_API_KEY is empty or missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

    // Request params: origin=lat,lng & destination=lat,lng & vehicle=motor
    const url = `https://mapapis.openmap.vn/v1/direction?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&vehicle=${encodeURIComponent(
      this.vehicle,
    )}&apikey=${encodeURIComponent(this.apiKey.trim())}`;

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AvoraRestaurant/2.0 (contact@avorafnb.com)',
        },
      });

      if (!res.ok) {
        throw new Error(`OpenMap.vn Directions API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (
        data &&
        Array.isArray(data.routes) &&
        data.routes.length > 0 &&
        Array.isArray(data.routes[0].legs) &&
        data.routes[0].legs.length > 0
      ) {
        const leg = data.routes[0].legs[0];
        const distanceMeters = Math.round(Number(leg.distance?.value || 0));
        const durationSeconds = Math.round(Number(leg.duration?.value || 0));

        if (distanceMeters > 0) {
          return {
            distanceMeters,
            durationSeconds: Math.max(60, durationSeconds),
            provider: 'OPENMAP_MOTOR',
            isFallback: false,
            calculatedAt: new Date(),
          };
        }
      }

      throw new Error('OpenMap.vn returned empty or invalid route legs');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * OSRM (Open Source Routing Machine) Provider
 * Real road network routing used as reliable fallback when OpenMap API key is absent or quota is exceeded
 */
export class OsrmRoutingProvider implements ShippingRoutingProvider {
  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteCalculationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    // Note: OSRM expects coordinates in order: lng,lat;lng,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AvoraRestaurant/2.0 (contact@avorafnb.com)',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceMeters = Math.round(Number(route.distance || 0));
          const durationSeconds = Math.round(Number(route.duration || 0));

          if (distanceMeters > 0) {
            return {
              distanceMeters,
              durationSeconds: Math.max(60, durationSeconds),
              provider: 'OSRM_ROUTING',
              isFallback: false,
              calculatedAt: new Date(),
            };
          }
        }
      }
      throw new Error(`OSRM router returned HTTP ${res.status}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
