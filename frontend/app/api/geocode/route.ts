import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  try {
    if (lat && lon) {
      // Reverse Geocoding
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&addressdetails=1&accept-language=vi`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AvoraRestaurantApp/1.0 (contact@avorarestaurant.vn)',
        },
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to reverse geocode' }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json(data);
    } else if (q) {
      // Forward Geocoding / Search
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(
        q
      )}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AvoraRestaurantApp/1.0 (contact@avorarestaurant.vn)',
        },
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        return NextResponse.json([], { status: 200 });
      }

      const data = await res.json();
      return NextResponse.json(data || []);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
