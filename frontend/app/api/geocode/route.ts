import { NextRequest, NextResponse } from 'next/server';

interface GeocodeCacheItem {
  data: any;
  expiresAt: number;
}

// In-memory server-side cache for geocoding queries (TTL 30 minutes)
const geocodeCache = new Map<string, GeocodeCacheItem>();

function getCached(key: string): any | null {
  const item = geocodeCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    geocodeCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key: string, data: any, ttlMs: number = 30 * 60 * 1000) {
  // Prune cache if oversized
  if (geocodeCache.size > 500) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey) geocodeCache.delete(oldestKey);
  }
  geocodeCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const lat = searchParams.get('lat')?.trim();
  const lon = searchParams.get('lon')?.trim();

  // Location bias (defaults to Ho Chi Minh City: 10.7769, 106.7009)
  const biasLat = searchParams.get('biasLat') || '10.7769';
  const biasLon = searchParams.get('biasLon') || '106.7009';

  try {
    // ── 1. REVERSE GEOCODING (lat, lon -> address text) ─────────────────────
    if (lat && lon) {
      const parsedLat = parseFloat(lat);
      const parsedLon = parseFloat(lon);

      if (
        isNaN(parsedLat) ||
        isNaN(parsedLon) ||
        Math.abs(parsedLat) > 90 ||
        Math.abs(parsedLon) > 180
      ) {
        return NextResponse.json({ error: 'Tọa độ không hợp lệ' }, { status: 400 });
      }

      const cacheKey = `rev:${parsedLat.toFixed(5)},${parsedLon.toFixed(5)}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }

      // Try OpenStreetMap Nominatim reverse with custom timeout
      try {
        const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lon)}&addressdetails=1&accept-language=vi`;

        const res = await fetch(reverseUrl, {
          headers: {
            'User-Agent': 'AvoraRestaurant/2.0 (contact@avorafnb.com)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4500),
        });

        if (res.ok) {
          const data = await res.json();
          setCache(cacheKey, data);
          return NextResponse.json(data);
        }
      } catch (nomErr) {
        console.warn('Nominatim reverse error, trying BigDataCloud fallback:', nomErr);
      }

      // Fallback to BigDataCloud client API
      try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${parsedLat}&longitude=${parsedLon}&localityLanguage=vi`;
        const bdcRes = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          const mapped = {
            display_name: `${bdcData.locality || ''}, ${bdcData.principalSubdivision || ''}, ${bdcData.countryName || 'Việt Nam'}`,
            address: {
              city: bdcData.principalSubdivision,
              suburb: bdcData.locality,
              country: bdcData.countryName,
            },
            lat: String(parsedLat),
            lon: String(parsedLon),
          };
          setCache(cacheKey, mapped);
          return NextResponse.json(mapped);
        }
      } catch (bdcErr) {
        console.warn('BigDataCloud reverse fallback failed:', bdcErr);
      }

      return NextResponse.json({ error: 'Không thể xác định địa chỉ từ tọa độ' }, { status: 502 });
    }

    // ── 2. FORWARD GEOCODING / AUTOCOMPLETE SEARCH (query -> suggestions) ───
    if (q) {
      if (q.length < 2) {
        return NextResponse.json([]);
      }

      const cacheKey = `search:${q.toLowerCase()}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }

      let results: Array<{
        display_name: string;
        lat: string;
        lon: string;
        type?: string;
        provider: string;
      }> = [];

      // 2A. Primary: Photon API by Komoot (OpenStreetMap data with location bias)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q
        )}&limit=8&lat=${encodeURIComponent(biasLat)}&lon=${encodeURIComponent(
          biasLon
        )}&lang=vi`;

        const photonRes = await fetch(photonUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'AvoraRestaurant/2.0 (contact@avorafnb.com)',
          },
          signal: AbortSignal.timeout(3500),
        });

        if (photonRes.ok) {
          const photonData = await photonRes.json();
          if (Array.isArray(photonData.features) && photonData.features.length > 0) {
            results = photonData.features
              .filter((f: any) => f.geometry && Array.isArray(f.geometry.coordinates))
              .map((f: any) => {
                const p = f.properties || {};
                const parts: string[] = [];

                if (p.name) parts.push(p.name);
                if (p.housenumber && p.street) {
                  parts.push(`${p.housenumber} ${p.street}`);
                } else if (p.street && (!p.name || !p.name.includes(p.street))) {
                  parts.push(p.street);
                }
                if (p.district) parts.push(p.district);
                if (p.city && p.city !== p.name && p.city !== p.district) parts.push(p.city);
                else if (p.state && p.state !== p.city) parts.push(p.state);
                if (p.country && !parts.includes(p.country)) parts.push(p.country);

                const displayName = parts.length > 0 ? parts.join(', ') : (p.name || q);

                return {
                  display_name: displayName,
                  lat: String(f.geometry.coordinates[1]),
                  lon: String(f.geometry.coordinates[0]),
                  type: p.osm_value || p.type || 'place',
                  provider: 'PHOTON',
                };
              });
          }
        }
      } catch (photonErr) {
        console.warn('Photon geocoding request failed or timed out:', photonErr);
      }

      // 2B. Fallback: OpenStreetMap Nominatim Search if Photon yielded no results
      if (results.length === 0) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(
            q
          )}`;

          const nomRes = await fetch(nomUrl, {
            headers: {
              'User-Agent': 'AvoraRestaurant/2.0 (contact@avorafnb.com)',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(3500),
          });

          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (Array.isArray(nomData) && nomData.length > 0) {
              results = nomData.map((item: any) => ({
                display_name: item.display_name,
                lat: String(item.lat),
                lon: String(item.lon),
                type: item.type || 'place',
                provider: 'NOMINATIM',
              }));
            }
          }
        } catch (nomErr) {
          console.warn('Nominatim fallback also failed:', nomErr);
        }
      }

      setCache(cacheKey, results);
      return NextResponse.json(results);
    }

    return NextResponse.json([]);
  } catch (error: any) {
    console.error('Geocoding route exception:', error);
    return NextResponse.json([], { status: 200 });
  }
}
