import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch fuel prices from apiaberta.pt (sourced from DGEG, updated daily)
    const res = await fetch('https://api.apiaberta.pt/v1/fuel/prices', {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return Response.json({ error: 'Falha ao obter dados da DGEG' }, { status: 502 });
    }

    const json = await res.json();
    const all = json.data || [];

    // Filter only road vehicle fuels and map to a clean structure
    const roadFuels = all
      .filter(f => f.road_vehicle)
      .map(f => ({
        slug: f.fuel_slug,
        name: f.fuel_name,
        avg: f.avg_price_eur,
        min: f.min_price_eur,
        max: f.max_price_eur,
        stations: f.station_count,
        date: f.date,
      }));

    // EV charging tariffs (kWh) — Portugal, c/ IVA, referência 2025/2026
    // Fontes: sites dos operadores, MOBI.E, Plan2Charge, Chargemap
    const evTariffs = [
      // --- Carregamento doméstico ---
      { provider: "EDP RE:DY", type: "AC (casa)", price_kwh: 0.16, notes: "Tarifa simples residencial" },

      // --- Redes públicas AC ---
      { provider: "MOBI.E (rede pública)", type: "AC público", price_kwh: 0.38, notes: "Média rede MOBI.E" },
      { provider: "EDP e-go", type: "AC público", price_kwh: 0.39, notes: "Rede pública EDP" },
      { provider: "Galp Go", type: "AC público", price_kwh: 0.42, notes: "Rede pública Galp AC" },
      { provider: "Endesa Charge", type: "AC público", price_kwh: 0.41, notes: "Rede pública Endesa" },
      { provider: "Miio (EDP Comercial)", type: "AC público", price_kwh: 0.38, notes: "App Miio — tarifas variáveis por plano" },
      { provider: "Go.Charge (Iberdrola)", type: "AC público", price_kwh: 0.40, notes: "Rede Iberdrola Go.Charge" },
      { provider: "Evio", type: "AC público", price_kwh: 0.39, notes: "Rede Evio (ex-Beev)" },

      // --- Redes públicas DC rápido ---
      { provider: "Galp Go", type: "DC rápido", price_kwh: 0.55, notes: "Rede pública Galp DC" },
      { provider: "Prio Energy", type: "DC rápido", price_kwh: 0.52, notes: "Postos Prio DC" },
      { provider: "Repsol", type: "DC rápido", price_kwh: 0.45, notes: "Postos Repsol AC/DC" },
      { provider: "Atlante", type: "DC rápido", price_kwh: 0.55, notes: "Rede Atlante (sem subscrição)" },
      { provider: "Atlante", type: "DC rápido (subscrição)", price_kwh: 0.44, notes: "Plano mensal Atlante Pass" },

      // --- Ultra-rápido (HPC) ---
      { provider: "Ionity", type: "DC ultra-rápido", price_kwh: 0.79, notes: "Sem plano (pay-as-you-go)" },
      { provider: "Ionity Passport", type: "DC ultra-rápido", price_kwh: 0.35, notes: "Plano mensal ~€17,99/mês" },
      { provider: "Tesla Supercharger", type: "DC ultra-rápido", price_kwh: 0.44, notes: "Não-Tesla; Tesla grátis/incluído nalguns planos" },
      { provider: "Tesla Supercharger", type: "DC ultra-rápido (Tesla)", price_kwh: 0.36, notes: "Titulares Tesla (preço médio PT)" },

      // --- Agregadores / roaming ---
      { provider: "Electroverse (Octopus)", type: "AC/DC (roaming)", price_kwh: null, notes: "Sem taxa de roaming; aplica tarifa do operador local" },
      { provider: "Chargemap Pass", type: "AC/DC (roaming)", price_kwh: null, notes: "Roaming multi-rede; preços variam por posto" },
      { provider: "Plan2Charge", type: "AC/DC (comparador)", price_kwh: null, notes: "Plataforma de comparação de tarifas por comercializador" },
    ];

    // Fuel prices by brand — Portugal, c/ IVA, referência 2025/2026
    // Fontes: sites das marcas, sites de comparação (e.g. gastão.pt, consumidor.pt)
    const fuelByBrand = [
      // --- Gasóleo Simples ---
      { brand: "Galp",        type: "Gasóleo Simples", price: 1.619, notes: "Preço médio nacional Galp" },
      { brand: "BP",          type: "Gasóleo Simples", price: 1.609, notes: "Preço médio nacional BP" },
      { brand: "Repsol",      type: "Gasóleo Simples", price: 1.599, notes: "Preço médio nacional Repsol" },
      { brand: "CEPSA/Moeve", type: "Gasóleo Simples", price: 1.595, notes: "Preço médio nacional CEPSA" },
      { brand: "Prio Energy", type: "Gasóleo Simples", price: 1.559, notes: "Rede Prio" },
      { brand: "Intermarché", type: "Gasóleo Simples", price: 1.539, notes: "Posto médio Intermarché" },
      { brand: "E.Leclerc",   type: "Gasóleo Simples", price: 1.529, notes: "Posto médio E.Leclerc" },
      { brand: "Jumbo",       type: "Gasóleo Simples", price: 1.535, notes: "Postos Jumbo/Auchan" },
      { brand: "Continente",  type: "Gasóleo Simples", price: 1.545, notes: "Postos Continente" },

      // --- Gasóleo Aditivado ---
      { brand: "Galp",        type: "Gasóleo Aditivado", price: 1.699, notes: "Galp Evoluição Diesel" },
      { brand: "BP",          type: "Gasóleo Aditivado", price: 1.689, notes: "BP Ultimate Diesel" },
      { brand: "Repsol",      type: "Gasóleo Aditivado", price: 1.679, notes: "Repsol Diesel Efitec+" },
      { brand: "CEPSA/Moeve", type: "Gasóleo Aditivado", price: 1.675, notes: "Moeve Diesel Plus" },
      { brand: "Prio Energy", type: "Gasóleo Aditivado", price: 1.639, notes: "Prio Diesel +" },

      // --- Gasolina 95 ---
      { brand: "Galp",        type: "Gasolina 95",    price: 1.719, notes: "Preço médio nacional Galp" },
      { brand: "BP",          type: "Gasolina 95",    price: 1.709, notes: "Preço médio nacional BP" },
      { brand: "Repsol",      type: "Gasolina 95",    price: 1.699, notes: "Preço médio nacional Repsol" },
      { brand: "CEPSA/Moeve", type: "Gasolina 95",    price: 1.695, notes: "Preço médio nacional CEPSA" },
      { brand: "Prio Energy", type: "Gasolina 95",    price: 1.659, notes: "Rede Prio" },
      { brand: "Intermarché", type: "Gasolina 95",    price: 1.639, notes: "Posto médio Intermarché" },
      { brand: "E.Leclerc",   type: "Gasolina 95",    price: 1.629, notes: "Posto médio E.Leclerc" },
      { brand: "Jumbo",       type: "Gasolina 95",    price: 1.635, notes: "Postos Jumbo/Auchan" },
      { brand: "Continente",  type: "Gasolina 95",    price: 1.645, notes: "Postos Continente" },

      // --- Gasolina Aditivada 98 ---
      { brand: "Galp",        type: "Gasolina Aditivada 98", price: 1.849, notes: "Galp Evoluição 98" },
      { brand: "BP",          type: "Gasolina Aditivada 98", price: 1.839, notes: "BP Ultimate 98" },
      { brand: "Repsol",      type: "Gasolina Aditivada 98", price: 1.829, notes: "Repsol Efitec 98+" },
      { brand: "CEPSA/Moeve", type: "Gasolina Aditivada 98", price: 1.825, notes: "Moeve 98 Plus" },
      { brand: "Prio Energy", type: "Gasolina Aditivada 98", price: 1.789, notes: "Prio 98+" },
    ];

    return Response.json({
      fuels: roadFuels,
      ev_tariffs: evTariffs,
      fuel_by_brand: fuelByBrand,
      updated_at: all[0]?.updated_at || new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});