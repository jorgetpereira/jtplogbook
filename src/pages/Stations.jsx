import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Fuel, RefreshCw, AlertCircle, Navigation, ChevronDown, ChevronUp, Zap } from "lucide-react";

const FUEL_TYPE_TO_SLUGS = {
  "Gasóleo":  ["diesel", "diesel_plus"],
  "Gasolina": ["gasoline_95", "gasoline_98_plus"],
  "GPL":      ["gpl_auto"],
  "Elétrico": [],
  "Híbrido":  ["gasoline_95", "gasoline_98_plus"],
};
const ALL_FUEL_SLUGS = ["diesel", "diesel_plus", "gasoline_95", "gasoline_98_plus", "gpl_auto"];

const SLUG_LABEL = {
  diesel:           "Gasóleo",
  diesel_plus:      "Gasóleo Esp.",
  gasoline_95:      "Gasolina 95",
  gasoline_98_plus: "Gasolina 98",
  gpl_auto:         "GPL Auto",
};

const SLUG_COLOR = {
  diesel:           "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  diesel_plus:      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  gasoline_95:      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  gasoline_98_plus: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  gpl_auto:         "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
};

const EV_TYPE_COLOR = {
  "AC (casa)":              "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300",
  "AC público":             "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  "DC rápido":              "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  "DC rápido (subscrição)": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  "DC ultra-rápido":        "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  "DC ultra-rápido (Tesla)":"bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  "AC/DC (roaming)":        "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300",
  "AC/DC (comparador)":     "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

export default function Stations() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const [activeTab, setActiveTab] = useState("fuel"); // "fuel" | "ev"
  const [stations, setStations] = useState([]);
  const [evTariffs, setEvTariffs] = useState([]);
  const [evStations, setEvStations] = useState([]);
  const [loadingEvStations, setLoadingEvStations] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingEv, setLoadingEv] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [location, setLocation] = useState(null);
  const [sortBy, setSortBy] = useState("distance");
  const [expandedStation, setExpandedStation] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    base44.entities.Vehicle.list().then(v => {
      if (!mountedRef.current) return;
      setVehicles(v);
      if (v.length > 0) setSelectedVehicleId(v[0].id);
    }).catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  // Load EV tariffs
  useEffect(() => {
    if (activeTab !== "ev") return;
    if (evTariffs.length > 0) return;
    setLoadingEv(true);
    base44.functions.invoke("getDGEGPrices", {}).then(res => {
      if (!mountedRef.current) return;
      setEvTariffs(res.data?.ev_tariffs || []);
    }).catch(() => {}).finally(() => {
      if (mountedRef.current) setLoadingEv(false);
    });
  }, [activeTab]);

  // Load nearby EV stations via Overpass (browser-side, no CORS issues)
  const fetchEvStations = useCallback(async (coords) => {
    setLoadingEvStations(true);
    setEvStations([]);
    try {
      const res = await base44.functions.invoke("getNearbyEVStations", {
        lat: coords.latitude,
        lon: coords.longitude,
      });
      if (mountedRef.current) setEvStations(res.data?.stations || []);
    } catch {
      // silently fail
    } finally {
      if (mountedRef.current) setLoadingEvStations(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "ev" && location && evStations.length === 0 && !loadingEvStations) {
      fetchEvStations(location);
    }
  }, [activeTab, location]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const fuelSlugs = selectedVehicle
    ? (FUEL_TYPE_TO_SLUGS[selectedVehicle.fuel_type] || ALL_FUEL_SLUGS)
    : ALL_FUEL_SLUGS;

  const fetchStations = useCallback(async (coords) => {
    setLoadingStations(true);
    setStations([]);
    try {
      const res = await base44.functions.invoke("getNearbyStations", {
        lat: coords.latitude,
        lon: coords.longitude,
        radius: 20,
        fuel_slugs: ALL_FUEL_SLUGS, // always fetch all slugs, filter by vehicle on display
      });
      if (!mountedRef.current) return;
      setStations(res.data?.stations || []);
    } catch {
    } finally {
      if (mountedRef.current) setLoadingStations(false);
    }
  }, []);

  const requestLocation = () => {
    setGeoError(null);
    setLoadingStations(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        if (!mountedRef.current) return;
        setLocation(coords);
        fetchStations(coords);
      },
      () => {
        if (!mountedRef.current) return;
        setGeoError("Não foi possível obter a localização. Verifique as permissões do browser.");
        setLoadingStations(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Filter stations to only those that have at least one of the vehicle's fuel slugs
  const visibleStations = stations.filter(s =>
    fuelSlugs.some(slug => s.fuels[slug]?.price != null)
  );

  const sortedStations = [...visibleStations].sort((a, b) => {
    if (sortBy === "distance") return a.distance_km - b.distance_km;
    const pa = a.fuels[sortBy]?.price ?? Infinity;
    const pb = b.fuels[sortBy]?.price ?? Infinity;
    return pa - pb;
  });

  const cheapestBySlug = {};
  fuelSlugs.forEach(slug => {
    const withPrice = visibleStations.filter(s => s.fuels[slug]?.price != null);
    if (withPrice.length > 0) {
      cheapestBySlug[slug] = withPrice.reduce((best, s) =>
        s.fuels[slug].price < best.fuels[slug].price ? s : best
      );
    }
  });

  // Group EV tariffs by type category
  const evGroups = evTariffs.reduce((acc, t) => {
    const key = t.type.startsWith("AC (casa)") ? "🏠 Doméstico"
      : t.type.startsWith("AC") ? "⚡ AC Público (lento)"
      : t.type.startsWith("DC rápido") ? "🔋 DC Rápido"
      : t.type.startsWith("DC ultra") ? "🚀 DC Ultra-Rápido (HPC)"
      : "🌐 Roaming / Agregadores";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div
        className="bg-gradient-to-br from-sky-500 to-blue-600 text-white px-4 pb-3 sticky top-0 z-20 shadow-lg shadow-sky-500/20"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Postos</h1>
            <p className="text-xs text-white/60 mt-0.5">Preços em tempo real · DGEG</p>
          </div>
          {activeTab === "fuel" && (
            <button onClick={requestLocation} disabled={loadingStations} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors">
              <RefreshCw className={`w-5 h-5 ${loadingStations ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-white/15 rounded-xl p-1 mb-3">
          <button
            onClick={() => setActiveTab("fuel")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "fuel" ? "bg-white text-sky-600 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            <Fuel className="w-3.5 h-3.5" /> Combustível
          </button>
          <button
            onClick={() => setActiveTab("ev")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "ev" ? "bg-white text-sky-600 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Elétrico
          </button>
        </div>

        {/* Vehicle selector (fuel tab only) */}
        {activeTab === "fuel" && vehicles.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {vehicles.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVehicleId(v.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedVehicleId === v.id
                    ? "bg-white text-orange-600 shadow-sm"
                    : "bg-white/15 text-white/85 hover:bg-white/25 border border-white/10"
                }`}
              >
                {v.brand} {v.model}
              </button>
            ))}
            {vehicles.length > 1 && (
              <button
                onClick={() => setSelectedVehicleId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedVehicleId === "all"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "bg-white/15 text-white/85 hover:bg-white/25 border border-white/10"
                }`}
              >
                Todos
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pt-4 pb-24 space-y-4">

        {/* ── FUEL TAB ── */}
        {activeTab === "fuel" && (
          <>
            {geoError && (
              <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-2xl p-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Localização indisponível</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{geoError}</p>
                  <button onClick={requestLocation} className="text-xs text-primary font-semibold mt-2 underline">Tentar novamente</button>
                </div>
              </div>
            )}

            {loadingStations && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm">A procurar postos próximos...</p>
              </div>
            )}

            {!loadingStations && !location && !geoError && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Navigation className="w-8 h-8 text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Partilhe a sua localização</p>
                  <p className="text-sm text-muted-foreground mt-1">Para encontrar postos perto de si</p>
                </div>
                <button
                  onClick={requestLocation}
                  className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-orange-500/30 active:scale-95 transition-transform"
                >
                  Usar Localização
                </button>
              </div>
            )}

            {!loadingStations && visibleStations.length > 0 && (
              <>
                {/* Cheapest per slug */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-2">Mais Baratos</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {fuelSlugs.filter(s => cheapestBySlug[s]).map(slug => {
                      const s = cheapestBySlug[slug];
                      return (
                        <div key={slug} className="shrink-0 bg-card border border-border rounded-2xl p-3 min-w-[145px]">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${SLUG_COLOR[slug]}`}>{SLUG_LABEL[slug]}</span>
                          <p className="text-xl font-bold text-green-600 mt-2">€{s.fuels[slug].price.toFixed(3)}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{s.name}</p>
                          <p className="text-[10px] text-primary font-medium">{s.distance_km.toFixed(1)} km</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sort */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setSortBy("distance")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                      sortBy === "distance" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                    }`}
                  >
                    📍 Distância
                  </button>
                  {fuelSlugs.map(slug => (
                    <button
                      key={slug}
                      onClick={() => setSortBy(slug)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                        sortBy === slug ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                      }`}
                    >
                      {SLUG_LABEL[slug]}
                    </button>
                  ))}
                </div>

                {/* Stations list */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-2">{sortedStations.length} Postos Encontrados</p>
                  <div className="space-y-2">
                    {sortedStations.map((station, i) => {
                      const isExpanded = expandedStation === station.station_id;
                      const isCheapest = fuelSlugs.some(s => cheapestBySlug[s]?.station_id === station.station_id);
                      return (
                        <div
                          key={station.station_id}
                          className={`bg-card border rounded-2xl overflow-hidden transition-all ${isCheapest ? "border-green-300 dark:border-green-700" : "border-border"}`}
                        >
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-left"
                            onClick={() => setExpandedStation(isExpanded ? null : station.station_id)}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              i === 0 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                              i === 1 ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                              i === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-sm truncate">{station.name}</p>
                                {isCheapest && (
                                  <span className="shrink-0 text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-md">MELHOR PREÇO</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {station.locality} · <span className="text-primary font-medium">{station.distance_km.toFixed(1)} km</span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {fuelSlugs.map(slug => {
                                  const fuel = station.fuels[slug];
                                  if (!fuel) return null;
                                  return (
                                    <span key={slug} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${SLUG_COLOR[slug]}`}>
                                      {SLUG_LABEL[slug]}: €{fuel.price.toFixed(3)}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                              <p className="text-xs text-muted-foreground">{station.address}, {station.locality}, {station.municipality}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {fuelSlugs.map(slug => {
                                  const fuel = station.fuels[slug];
                                  const isBest = cheapestBySlug[slug]?.station_id === station.station_id;
                                  return (
                                    <div key={slug} className={`rounded-xl p-3 border ${isBest ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700" : "border-border bg-muted/40"}`}>
                                      <p className="text-[10px] font-bold text-muted-foreground">{SLUG_LABEL[slug]}{isBest ? " ✓" : ""}</p>
                                      <p className="text-lg font-bold mt-1">
                                        {fuel ? `€${fuel.price.toFixed(3)}` : <span className="text-sm text-muted-foreground">N/D</span>}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-center text-[10px] text-muted-foreground pb-2">Fonte: DGEG · apiaberta.pt · Raio de 20 km</p>
              </>
            )}

            {!loadingStations && location && visibleStations.length === 0 && !geoError && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Fuel className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="font-semibold">Nenhum posto encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Num raio de 20 km da sua localização.</p>
              </div>
            )}
          </>
        )}

        {/* ── EV TAB ── */}
        {activeTab === "ev" && (
          <>
            {loadingEv && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm">A carregar tarifas...</p>
              </div>
            )}

            {!loadingEv && evTariffs.length > 0 && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 text-xs text-blue-700 dark:text-blue-300">
                  ⚡ Tarifas de referência para Portugal (c/ IVA). Preços podem variar conforme plano, localização e operador.
                </div>

                {Object.entries(evGroups).map(([group, tariffs]) => (
                  <div key={group} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
                      <p className="text-xs font-bold">{group}</p>
                    </div>
                    <div className="divide-y divide-border">
                      {tariffs.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{t.provider}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.notes}</p>
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1 ${EV_TYPE_COLOR[t.type] || "bg-muted text-muted-foreground border-border"}`}>
                              {t.type}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            {t.price_kwh != null ? (
                              <>
                                <p className="text-lg font-bold text-primary">€{t.price_kwh.toFixed(2)}</p>
                                <p className="text-[10px] text-muted-foreground">/kWh</p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">Variável</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-center text-[10px] text-muted-foreground pb-2">Fontes: MOBI.E, operadores, Plan2Charge · Ref. 2025/2026</p>
              </div>
            )}

            {/* Nearby EV Stations */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Postos de Carregamento Próximos</p>
                    <p className="text-[10px] text-muted-foreground">25 mais próximos · 20 km · OpenChargeMap</p>
                  </div>
                </div>
                {location && (
                  <button
                    onClick={() => fetchEvStations(location)}
                    disabled={loadingEvStations}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingEvStations ? "animate-spin" : ""}`} />
                  </button>
                )}
              </div>
              <div className="p-4">
                {!location && (
                  <p className="text-sm text-muted-foreground text-center py-4">Partilhe a sua localização (tab Combustível) para ver postos próximos.</p>
                )}
                {loadingEvStations && (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" /> A procurar postos...
                  </div>
                )}
                {!loadingEvStations && evStations.length > 0 && (
                  <div className="divide-y divide-border -mx-4">
                    {evStations.map((s, i) => (
                      <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                          i === 0 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                          i === 1 ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                          i === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{s.name}</p>
                          {s.operator && (
                            <p className="text-xs text-primary font-medium">{s.operator}{s.network ? ` · ${s.network}` : ""}</p>
                          )}
                          {s.address && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.address}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] font-medium text-primary">{s.distance_km.toFixed(2)} km</span>
                            {s.power_kw && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                ⚡ {s.power_kw} kW
                              </span>
                            )}
                            {s.socket_type2 > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">Type 2 ×{s.socket_type2}</span>
                            )}
                            {s.socket_ccs > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">CCS</span>
                            )}
                            {s.socket_chademo > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">CHAdeMO</span>
                            )}
                            {s.opening_hours === "24/7" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700">24/7</span>
                            )}
                          </div>
                          {/* Address / navigation */}
                          {s.address ? (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            >
                              📍 {s.address}
                            </a>
                          ) : (
                            <a
                              href={`https://maps.google.com/?q=${s.lat},${s.lon}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 mt-1.5 text-[10px] text-primary font-medium hover:underline"
                            >
                              📍 Ver no Google Maps
                            </a>
                          )}
                        </div>
                        </div>
                    ))}
                  </div>
                )}
                {!loadingEvStations && location && evStations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum posto encontrado num raio de 20 km.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}