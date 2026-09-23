import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Mapeia nomes vindos da DGEG para etiquetas curtas amigáveis
const FUEL_LABEL_MAP = {
  "Gasóleo simples": "Gasóleo",
  "Gasóleo especial": "Gasóleo Esp.",
  "Gasolina simples 95": "Gasolina 95",
  "Gasolina especial 95": "Gasolina 95 Esp.",
  "Gasolina 98": "Gasolina 98",
  "Gasolina especial 98": "Gasolina 98 Esp.",
  "GPL Auto": "GPL",
};

// IDs de combustíveis rodoviários a incluir no gráfico
const FUEL_IDS = [2101, 2105, 3201, 3205, 3400, 1120];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Janela de 1 ano até hoje
    const now = new Date();
    const fim = now.toISOString().slice(0, 10);
    const iniDate = new Date(now);
    iniDate.setFullYear(iniDate.getFullYear() - 1);
    const ini = iniDate.toISOString().slice(0, 10);

    // 1) Preços médios diários DGEG (PMDGrafico)
    const url = `https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PMDGrafico?idsTiposComb=${FUEL_IDS.join(",")}&dataIni=${ini}&dataFim=${fim}`;
    const dgegRes = await fetch(url, { headers: { "Accept": "application/json" } });
    const dgegJson = await dgegRes.json();

    // Acumular por mês (YYYY-MM) e por combustível
    const monthlyByFuel = {}; // label -> { "YYYY-MM": [precos] }
    const monthsSet = new Set();

    if (dgegJson && Array.isArray(dgegJson.resultado)) {
      for (const item of dgegJson.resultado) {
        const label = FUEL_LABEL_MAP[item.TipoCombustivel] || item.TipoCombustivel;
        const parts = String(item.Label).split("-"); // "YYYY-M-D"
        if (parts.length < 2) continue;
        const month = `${parts[0]}-${parts[1].padStart(2, "0")}`;
        const price = Number(item.PrecoMedio);
        if (!isFinite(price)) continue;
        monthsSet.add(month);
        if (!monthlyByFuel[label]) monthlyByFuel[label] = {};
        if (!monthlyByFuel[label][month]) monthlyByFuel[label][month] = [];
        monthlyByFuel[label][month].push(price);
      }
    }

    // 2) Preço médio da eletricidade (€/kWh) a partir dos dados do utilizador
    //    Fontes: Charging.price_per_kwh e Expense (sub_category=Eletricidade).price_per_unit
    const [chargings, expenses] = await Promise.all([
      base44.asServiceRole.entities.Charging.list("-start_datetime", 2000),
      base44.asServiceRole.entities.Expense.list("-date", 2000),
    ]);

    const elecByMonth = {}; // "YYYY-MM" -> [precos ponderadas por kWh]
    const pushElec = (month, price, kwh) => {
      if (!isFinite(price) || price <= 0) return;
      monthsSet.add(month);
      if (!elecByMonth[month]) elecByMonth[month] = { sum: 0, n: 0 };
      const w = kwh > 0 ? kwh : 1;
      elecByMonth[month].sum += price * w;
      elecByMonth[month].n += w;
    };

    for (const c of (chargings || [])) {
      if (!c.start_datetime) continue;
      const month = String(c.start_datetime).slice(0, 7);
      const kwh = Number(c.kwh_added) || 0;
      if (c.price_per_kwh != null) pushElec(month, Number(c.price_per_kwh), kwh);
      else if (c.total_cost && kwh > 0) pushElec(month, Number(c.total_cost) / kwh, kwh);
    }
    for (const e of (expenses || [])) {
      if (e.sub_category !== "Eletricidade" || !e.date) continue;
      const month = String(e.date).slice(0, 7);
      const kwh = Number(e.liters) || 0;
      if (e.price_per_unit != null) pushElec(month, Number(e.price_per_unit), kwh);
      else if (e.amount && kwh > 0) pushElec(month, Number(e.amount) / kwh, kwh);
    }

    const hasElectricity = Object.keys(elecByMonth).length > 0;

    // Ordenar meses e construir pontos
    const months = [...monthsSet].sort();
    const fuels = Object.keys(monthlyByFuel);
    if (hasElectricity) fuels.push("Elétrico");

    const points = months.map(month => {
      const point = { month };
      for (const f of fuels) {
        if (f === "Elétrico") {
          const agg = elecByMonth[month];
          point[f] = agg && agg.n > 0 ? Math.round((agg.sum / agg.n) * 1000) / 1000 : null;
        } else {
          const arr = monthlyByFuel[f]?.[month];
          point[f] = arr && arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 1000) / 1000 : null;
        }
      }
      return point;
    });

    return Response.json({
      points,
      fuels,
      hasElectricity,
      date_from: ini,
      date_to: fim,
      source: "DGEG (PMDGrafico) + dados de carregamento do utilizador",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});