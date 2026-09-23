import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const R = 6371;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lat, lon } = await req.json();
    if (!lat || !lon) return Response.json({ error: 'lat e lon são obrigatórios' }, { status: 400 });

    const apiKey = Deno.env.get('OPENCHARGEMAP_API_KEY');
    const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=PT&latitude=${lat}&longitude=${lon}&distance=20&distanceunit=KM&maxresults=50&compact=true&verbose=false&key=${apiKey}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ error: `OpenChargeMap error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    const stations = (data || [])
      .map(poi => {
        const addr = poi.AddressInfo;
        if (!addr?.Latitude || !addr?.Longitude) return null;
        const dist = haversine(lat, lon, addr.Latitude, addr.Longitude);
        const connections = poi.Connections || [];
        const maxPower = connections.reduce((m, c) => Math.max(m, c.PowerKW || 0), 0);
        const addrParts = [addr.AddressLine1, addr.Town].filter(Boolean);
        const hasType2 = connections.some(c => c.ConnectionTypeID === 25 || c.ConnectionTypeID === 1036);
        const hasCCS = connections.some(c => c.ConnectionTypeID === 33);
        const hasCHAdeMO = connections.some(c => c.ConnectionTypeID === 2);
        return {
          id: poi.ID,
          lat: addr.Latitude,
          lon: addr.Longitude,
          name: addr.Title || 'Posto EV',
          operator: poi.OperatorInfo?.Title || null,
          address: addrParts.join(', ') || null,
          opening_hours: poi.OpeningTimes?.IsOpen24Hours ? '24/7' : null,
          power_kw: maxPower > 0 ? maxPower : null,
          socket_type2: hasType2 ? 1 : 0,
          socket_ccs: hasCCS ? 1 : 0,
          socket_chademo: hasCHAdeMO ? 1 : 0,
          distance_km: dist,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 30);

    return Response.json({ stations });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});