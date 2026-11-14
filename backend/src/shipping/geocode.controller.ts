import { Controller, Get, Query, BadRequestException, Logger } from '@nestjs/common';

interface GeocodeCacheEntry {
  data: any;
  expiresAt: number;
}

@Controller('geocode')
export class GeocodeController {
  private readonly logger = new Logger(GeocodeController.name);
  private cache = new Map<string, GeocodeCacheEntry>();

  private getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any, ttlMs: number = 30 * 60 * 1000) {
    if (this.cache.size > 500) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  @Get()
  async geocode(
    @Query('q') q?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('biasLat') biasLat?: string,
    @Query('biasLon') biasLon?: string,
  ) {
    // 1. REVERSE GEOCODING (lat, lon -> address text)
    if (lat && lon) {
      const parsedLat = parseFloat(lat);
      const parsedLon = parseFloat(lon);

      if (
        isNaN(parsedLat) ||
        isNaN(parsedLon) ||
        Math.abs(parsedLat) > 90 ||
        Math.abs(parsedLon) > 180
      ) {
        throw new BadRequestException('Tọa độ không hợp lệ');
      }

      const cacheKey = `rev:${parsedLat.toFixed(5)},${parsedLon.toFixed(5)}`;
      const cached = this.getCached(cacheKey);
      if (cached) return cached;

      // Try OpenStreetMap Nominatim reverse
      try {
        const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
          lat,
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
          this.setCache(cacheKey, data);
          return data;
        }
      } catch (nomErr: any) {
        this.logger.warn(`Nominatim reverse error: ${nomErr.message}. Trying BigDataCloud fallback.`);
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
          this.setCache(cacheKey, mapped);
          return mapped;
        }
      } catch (bdcErr: any) {
        this.logger.warn(`BigDataCloud reverse fallback failed: ${bdcErr.message}`);
      }

      return { error: 'Không thể xác định địa chỉ từ tọa độ' };
    }

    // 2. FORWARD GEOCODING / AUTOCOMPLETE SEARCH (query -> suggestions via Photon)
    if (q && q.trim()) {
      const trimmedQuery = q.trim();
      if (trimmedQuery.length < 2) return [];

      const cacheKey = `search:${trimmedQuery.toLowerCase()}`;
      const cached = this.getCached(cacheKey);
      if (cached) return cached;

      const biasLatitude = biasLat || '10.7769';
      const biasLongitude = biasLon || '106.7009';

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
          trimmedQuery,
        )}&limit=8&lat=${encodeURIComponent(biasLatitude)}&lon=${encodeURIComponent(
          biasLongitude,
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

                const displayName = parts.length > 0 ? parts.join(', ') : (p.name || trimmedQuery);

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
      } catch (photonErr: any) {
        this.logger.warn(`Photon geocoding error: ${photonErr.message}. Trying Nominatim fallback.`);
      }

      // 2B. Fallback: OpenStreetMap Nominatim Search
      if (results.length === 0) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(
            trimmedQuery,
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
        } catch (nomErr: any) {
          this.logger.warn(`Nominatim search fallback error: ${nomErr.message}`);
        }
      }

      this.setCache(cacheKey, results);
      return results;
    }

    return [];
  }
}
