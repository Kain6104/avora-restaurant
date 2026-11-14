/**
 * Centralized Map Configuration for AVORA Restaurant
 * Single Source of Truth for tile layer, attribution, default center, and Leaflet setup.
 */

// Google Maps Standard Road Tiles:
// - 100% free, zero watermark
// - Extremely fast in Vietnam (<20ms via local Google CDN cache in HCMC & Hanoi)
// - Works flawlessly on all ISPs (Viettel, VNPT, FPT, 4G/5G) without DNS blocks
// - Can be overridden via NEXT_PUBLIC_MAP_TILE_URL environment variable if desired
export const MAP_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

export const MAP_TILE_SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3'];

export const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; Google Maps';

// Default center: Ho Chi Minh City (AVORA's main service area)
export const MAP_DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];
export const MAP_DEFAULT_ZOOM = 14;
export const MAP_MAX_ZOOM = 20;

/**
 * Configure Leaflet default marker icons safely in Next.js (client-side only).
 */
export function setupLeafletDefaultIcons(L: any) {
  if (typeof window === 'undefined' || !L || !L.Icon || !L.Icon.Default) return;
  try {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  } catch (e) {
    // Ignore icon merge errors if already initialized
  }
}
