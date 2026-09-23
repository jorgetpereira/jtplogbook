import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Map coordinates to Portuguese district (approximate bounding boxes)
function getDistrict(lat, lon) {
  const districts = [
    { name: "Lisboa", latMin: 38.60, latMax: 39.25, lonMin: -9.55, lonMax: -8.80 },
    { name: "Setúbal", latMin: 37.90, latMax: 38.70, lonMin: -9.20, lonMax: -8.40 },
    { name: "Porto", latMin: 41.00, latMax: 41.45, lonMin: -8.90, lonMax: -7.90 },
    { name: "Braga", latMin: 41.40, latMax: 41.90, lonMin: -8.90, lonMax: -7.90 },
    { name: "Aveiro", latMin: 40.50, latMax: 41.10, lonMin: -8.90, lonMax: -8.00 },
    { name: "Coimbra", latMin: 39.80, latMax: 40.60, lonMin: -8.90, lonMax: -7.80 },
    { name: "Leiria", latMin: 39.20, latMax: 40.00, lonMin: -9.20, lonMax: -8.30 },
    { name: "Santarém", latMin: 38.80, latMax: 39.60, lonMin: -9.10, lonMax: -8.00 },
    { name: "Faro", latMin: 36.90, latMax: 37.60, lonMin: -9.00, lonMax: -7.30 },
    { name: "Évora", latMin: 38.00, latMax: 38.90, lonMin: -8.80, lonMax: -7.30 },
    { name: "Beja", latMin: 37.40, latMax: 38.20, lonMin: -8.80, lonMax: -7.00 },
    { name: "Portalegre", latMin: 38.90, latMax: 39.70, lonMin: -8.10, lonMax: -7.00 },
    { name: "Castelo Branco", latMin: 39.60, latMax: 40.30, lonMin: -8.10, lonMax: -7.00 },
    { name: "Guarda", latMin: 40.20, latMax: 41.00, lonMin: -7.80, lonMax: -6.80 },
    { name: "Viseu", latMin: 40.60, latMax: 41.20, lonMin: -8.20, lonMax: -7.30 },
    { name: "Vila Real", latMin: 41.10, latMax: 41.90, lonMin: -8.00, lonMax: -7.00 },
    { name: "Bragança", latMin: 41.40, latMax: 42.20, lonMin: -7.50, lonMax: -6.20 },
    { name: "Viana do Castelo", latMin: 41.70, latMax: 42.20, lonMin: -8.90, lonMax: -8.20 },
  ];
  for (const d of districts) {
    if (lat >= d.latMin && lat <= d.latMax && lon >= d.lonMin && lon <= d.lonMax) {
      return d.name;
    }
  }
  return null;
}

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lat, lon, radius = 20, fuel_slugs = [] } = await req.json();

    if (!lat || !lon) {
      return Response.json({ error: 'lat e lon são obrigatórios' }, { status: 400 });
    }

    const slugs = fuel_slugs.length > 0 ? fuel_slugs : ['diesel_plus', 'gasoline_98_plus'];
    const district = getDistrict(lat, lon);

    async function fetchNearby(slug) {
      const nearby = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        let url = `https://api.apiaberta.pt/v1/fuel/stations?fuel=${slug}&limit=${perPage}&page=${page}`;
        if (district) url += `&district=${encodeURIComponent(district)}`;

        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) break;
        const json = await res.json();
        const items = json.data || [];
        if (items.length === 0) break;

        for (const s of items) {
          if (!s.location?.lat || !s.location?.lng) continue;
          const dist = haversine(lat, lon, s.location.lat, s.location.lng);
          if (dist <= radius) {
            nearby.push({ ...s, fuel_slug: slug, distance_km: dist });
          }
        }

        const total = json.meta?.total || 0;
        if (page * perPage >= total) break;
        page++;
      }
      return nearby;
    }

    const results = await Promise.all(slugs.map(slug => fetchNearby(slug)));
    const allStations = results.flat();

    // If no district matched or very few results, try without district filter (broader search)
    let finalStations = allStations;
    if (allStations.length === 0 && district) {
      // Fallback: search all without district, but limit to 5 pages per slug
      async function fetchNearbyFallback(slug) {
        const nearby = [];
        let page = 1;
        const perPage = 100;
        const maxPages = 5;

        while (page <= maxPages) {
          const url = `https://api.apiaberta.pt/v1/fuel/stations?fuel=${slug}&limit=${perPage}&page=${page}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) break;
          const json = await res.json();
          const items = json.data || [];
          if (items.length === 0) break;

          for (const s of items) {
            if (!s.location?.lat || !s.location?.lng) continue;
            const dist = haversine(lat, lon, s.location.lat, s.location.lng);
            if (dist <= radius) {
              nearby.push({ ...s, fuel_slug: slug, distance_km: dist });
            }
          }

          const total = json.meta?.total || 0;
          if (page * perPage >= total) break;
          page++;
        }
        return nearby;
      }

      const fallbackResults = await Promise.all(slugs.map(slug => fetchNearbyFallback(slug)));
      finalStations = fallbackResults.flat();
    }

    // Group by station_id
    const stationMap = {};
    finalStations.forEach(s => {
      if (!stationMap[s.station_id]) {
        stationMap[s.station_id] = {
          station_id: s.station_id,
          name: s.name,
          brand: s.brand,
          address: s.address,
          locality: s.locality,
          municipality: s.municipality,
          location: s.location,
          distance_km: s.distance_km,
          fuels: {},
        };
      }
      stationMap[s.station_id].fuels[s.fuel_slug] = {
        name: s.fuel_name,
        price: s.price_eur,
        updated_at: s.updated_at,
      };
      if (s.distance_km < stationMap[s.station_id].distance_km) {
        stationMap[s.station_id].distance_km = s.distance_km;
      }
    });

    const stations = Object.values(stationMap)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 50);

    return Response.json({ stations, total: stations.length, district_used: district });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});