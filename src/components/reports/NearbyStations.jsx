import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Fuel, RefreshCw, AlertCircle } from "lucide-react";

// Maps our sub_category values to DGEG slugs
const SUB_TO_SLUG = {
  "Gasóleo Simples":       "diesel",
  "Gasóleo":               "diesel",
  "Gasóleo Aditivado":     "diesel_plus",
  "Biodiesel":             "diesel",
  "Gasolina 95":           "gasoline_95",
  "Gasolina":              "gasoline_95",
  "Gasolina Aditivada 98": "gasoline_98_plus",
  "Gasolina 98":           "gasoline_98_plus",
  "GPL":                   "gpl_auto",
};

const SLUG_LABEL = {
  diesel:            "Gasóleo Simples",
  diesel_plus:       "Gasóleo Especial",
  gasoline_95:       "Gasolina Simples 95",
  gasoline_98_plus:  "Gasolina Especial 98",
  gpl_auto:          "GPL Auto",
};

const SLUG_COLOR = {
  diesel:            "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800",
  diesel_plus:       "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800",
  gasoline_95:       "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800",
  gasoline_98_plus:  "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-800",
  gpl_auto:          "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800",
};

export default function NearbyStations({ usedSubCategories = [] }) {
  const [location, setLocation] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Always include the 4 main fuel types, plus any other slugs the user actually uses
  const userSlugs = usedSubCategories.map(s => SUB_TO_SLUG[s]).filter(Boolean);
  const fuelSlugs = [...new Set(["diesel", "diesel_plus", "gasoline_95", "gasoline_98_plus", ...userSlugs])];

  const fetchStations = useCallback(async (coords) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getNearbyStations", {
        lat: coords.latitude,
        lon: coords.longitude,
        radius: 20,
        fuel_slugs: fuelSlugs,
      });
      setStations(res.data?.stations || []);
    } finally {
      setLoading(false);
    }
  }, [fuelSlugs.join(",")]);

  const requestLocation = () => {
    setGeoError(null);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(coords);
        fetchStations(coords);
      },
      (err) => {
        setGeoError("Não foi possível obter a localização. Verifique as permissões do browser.");
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  useEffect(() => {
    if (fuelSlugs.length > 0) {
      requestLocation();
    }
  }, []);

  const visibleStations = stations;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Postos Próximos (20 km)</p>
            <p className="text-[10px] text-muted-foreground">
              10 postos mais próximos · Fonte: DGEG
            </p>
          </div>
        </div>
        <button
          onClick={requestLocation}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Atualizar localização"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        {/* Error state */}
        {geoError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{geoError}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground py-4 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" />
            A procurar postos próximos...
          </div>
        )}

        {/* No location yet */}
        {!loading && !location && !geoError && (
          <button
            onClick={requestLocation}
            className="w-full flex items-center justify-center gap-2 py-4 text-sm text-primary font-medium hover:underline"
          >
            <MapPin className="w-4 h-4" />
            Usar a minha localização
          </button>
        )}

        {/* Results */}
        {!loading && stations.length > 0 && (
          <>
            <div className="divide-y divide-border -mx-4">
              {visibleStations.map((s, i) => (
                <div key={s.station_id} className="flex items-start gap-3 px-4 py-3">
                  {/* Rank */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    i === 0 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                    i === 1 ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                    i === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.locality}, {s.municipality}
                      {s.distance_km != null && <span className="ml-1 font-medium text-primary">· {s.distance_km.toFixed(1)} km</span>}
                    </p>

                    {/* Fuel prices — show all requested slugs, N/D if missing */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {fuelSlugs.map(slug => {
                        const fuel = s.fuels[slug];
                        return (
                          <span
                            key={slug}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${fuel ? (SLUG_COLOR[slug] || "") : "text-muted-foreground bg-muted border-border"}`}
                          >
                            <Fuel className="w-2.5 h-2.5" />
                            {SLUG_LABEL[slug]}: <span className="font-bold">{fuel ? `€${fuel.price.toFixed(3)}` : "N/D"}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>


          </>
        )}

        {!loading && location && stations.length === 0 && !geoError && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum posto encontrado num raio de 20 km.</p>
        )}
      </div>
    </div>
  );
}