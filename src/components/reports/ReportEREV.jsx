import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Zap, Fuel, TrendingDown } from "lucide-react";
import ReportEREVSavings from "./ReportEREVSavings";
import ChartWrapper from "./ChartWrapper";

export default function ReportEREV({ expenses, chargings, vehicles }) {
  const erevVehicles = vehicles.filter(v => v.fuel_type === "Híbrido EREV");

  const data = useMemo(() => {
    if (!erevVehicles.length) return { monthly: [], totals: [] };

    // Group by vehicle + month
    const monthMap = {};

    erevVehicles.forEach(vehicle => {
      const vExpenses = expenses.filter(e => e.vehicle_id === vehicle.id && e.category === "Combustível");
      const vChargings = chargings.filter(c => c.vehicle_id === vehicle.id);

      // Gasolina expenses
      vExpenses
        .filter(e => e.sub_category !== "Eletricidade")
        .forEach(e => {
          const month = e.date?.slice(0, 7);
          if (!month) return;
          const key = `${vehicle.id}-${month}`;
          if (!monthMap[key]) monthMap[key] = { month, vehicle: `${vehicle.brand} ${vehicle.model}`, fuelCost: 0, fuelLiters: 0, elecCost: 0, elecKwh: 0, km: 0 };
          monthMap[key].fuelCost += e.amount || 0;
          monthMap[key].fuelLiters += e.liters || 0;
        });

      // Charging (elétrico via sessões de carregamento — fonte única para kWh e custo elétrico)
      vChargings.forEach(c => {
        const month = c.start_datetime?.slice(0, 7);
        if (!month) return;
        const key = `${vehicle.id}-${month}`;
        if (!monthMap[key]) monthMap[key] = { month, vehicle: `${vehicle.brand} ${vehicle.model}`, fuelCost: 0, fuelLiters: 0, elecCost: 0, elecKwh: 0, km: 0 };
        const cost = c.total_cost != null ? c.total_cost : (c.kwh_added && c.price_per_kwh ? +(c.kwh_added * c.price_per_kwh).toFixed(2) : 0);
        monthMap[key].elecCost += cost;
        monthMap[key].elecKwh += c.kwh_added || 0;
      });

      // Nota: despesas de eletricidade e carregamentos são o mesmo registo — não somar ambos.

      // km por mês: usar odómetros de expenses + chargings ordenados (ignorar odo=0)
      const allOdo = [
        ...vExpenses.filter(e => e.mileage_at_expense > 0).map(e => ({ date: e.date, km: e.mileage_at_expense })),
        ...vChargings.filter(c => c.odometer > 0).map(c => ({ date: c.start_datetime?.slice(0, 10), km: c.odometer })),
      ].sort((a, b) => a.km - b.km);

      if (allOdo.length >= 2) {
        // Assign km delta per month
        for (let i = 1; i < allOdo.length; i++) {
          const month = allOdo[i].date?.slice(0, 7);
          const key = `${vehicle.id}-${month}`;
          if (monthMap[key]) {
            monthMap[key].km += allOdo[i].km - allOdo[i - 1].km;
          }
        }
      }
    });

    const monthly = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        monthLabel: new Date(m.month + "-01").toLocaleDateString("pt-PT", { month: "short", year: "2-digit" }),
        totalCost: m.fuelCost + m.elecCost,
        costPerKm: m.km > 0 ? +((m.fuelCost + m.elecCost) / m.km).toFixed(3) : null,
      }));

    // Overall totals per vehicle
    const totals = erevVehicles.map(vehicle => {
      const rows = monthly.filter(m => m.vehicle === `${vehicle.brand} ${vehicle.model}`);
      const totalFuel = rows.reduce((s, r) => s + r.fuelCost, 0);
      const totalElec = rows.reduce((s, r) => s + r.elecCost, 0);
      const totalKwh = rows.reduce((s, r) => s + r.elecKwh, 0);
      const totalLiters = rows.reduce((s, r) => s + r.fuelLiters, 0);

      // Km total: max odômetro - min odômetro, ignorando odómetros a zero
      const vExpAll = expenses.filter(e => e.vehicle_id === vehicle.id && e.mileage_at_expense > 0);
      const vChgAll = chargings.filter(c => c.vehicle_id === vehicle.id && c.odometer > 0);
      const allOdos = [
        ...vExpAll.map(e => e.mileage_at_expense),
        ...vChgAll.map(c => c.odometer),
      ];
      // Odómetro é acumulado desde novo → km totais = valor máximo do odómetro (não max-min)
      const maxOdo = allOdos.length > 0 ? Math.max(...allOdos) : 0;
      const totalKm = Math.max(vehicle.mileage || 0, maxOdo);

      // Cost per km per mode — método baseado em energia real:
      // kWh consumidos → km elétricos estimados (consumo médio anunciado do veículo ou 15 kWh/100km)
      // Litros consumidos → km a gasolina estimados (consumo médio anunciado ou 6L/100km)
      const vehicleData = erevVehicles.find(v => `${v.brand} ${v.model}` === `${vehicle.brand} ${vehicle.model}`);
      const elecConsumption = vehicleData?.advertised_consumption_electric || vehicleData?.advertised_consumption || 15; // kWh/100km
      const fuelConsumption = 6; // L/100km base para EREV em modo gasolina (conservador)
      const elecKm = totalKwh > 0 ? (totalKwh / elecConsumption) * 100 : 0;
      const fuelKm = totalLiters > 0 ? (totalLiters / fuelConsumption) * 100 : 0;
      const costPerKmElec = elecKm > 0 ? +(totalElec / elecKm).toFixed(3) : null;
      const costPerKmFuel = fuelKm > 0 ? +(totalFuel / fuelKm).toFixed(3) : null;
      // % elétrico baseado em km estimados reais
      const totalEstimatedKm = elecKm + fuelKm;

      return {
        vehicle: `${vehicle.brand} ${vehicle.model}`,
        totalFuel, totalElec, totalKm,
        totalKwh, totalLiters,
        costPerKm: totalKm > 0 ? +((totalFuel + totalElec) / totalKm).toFixed(3) : null,
        elecPct: totalEstimatedKm > 0 ? Math.round((elecKm / totalEstimatedKm) * 100) : 0,
        costPerKmElec,
        costPerKmFuel,
      };
    });

    return { monthly, totals };
  }, [expenses, chargings, vehicles]);

  if (!erevVehicles.length) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
        Nenhum veículo do tipo Híbrido EREV encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Totals per vehicle */}
      {data.totals.map(t => (
        <div key={t.vehicle} className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-base">{t.vehicle}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Zap className="w-3 h-3 text-blue-500" /> Custo Elétrico</p>
              <p className="text-lg font-bold text-blue-600">{t.totalElec.toFixed(2)} €</p>
              <p className="text-[11px] text-muted-foreground">{t.totalKwh.toFixed(1)} kWh</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Fuel className="w-3 h-3 text-orange-500" /> Custo Gasolina</p>
              <p className="text-lg font-bold text-orange-600">{t.totalFuel.toFixed(2)} €</p>
              <p className="text-[11px] text-muted-foreground">{t.totalLiters.toFixed(1)} L</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3 text-green-500" /> Custo/km</p>
              <p className="text-lg font-bold text-green-600">{t.costPerKm ? `${t.costPerKm} €` : "—"}</p>
              <p className="text-[11px] text-muted-foreground">{t.totalKm > 0 ? `${t.totalKm.toLocaleString("pt")} km` : "s/ km"}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">% Elétrico</p>
              <p className="text-lg font-bold text-primary">{t.elecPct}%</p>
              <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${t.elecPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Cost per km comparison: Electric vs Gasoline */}
      {data.totals.some(t => t.costPerKmElec && t.costPerKmFuel) && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-1">Custo médio por km: Elétrico vs Gasolina</h3>
          <p className="text-xs text-muted-foreground mb-4">Comparação estimada com base na proporção de custos elétrico/gasolina e km totais</p>
          <ChartWrapper height={220}>
            {(w, h) => (
              <BarChart
                data={data.totals.filter(t => t.costPerKmElec && t.costPerKmFuel).map(t => ({
                  name: t.vehicle,
                  "⚡ Elétrico": t.costPerKmElec,
                  "⛽ Gasolina": t.costPerKmFuel,
                }))}
                width={w} height={h}
                margin={{ top: 0, right: 8, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" €" />
                <Tooltip formatter={(v) => [`${v.toFixed(3)} €/km`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="⚡ Elétrico" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="⛽ Gasolina" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ChartWrapper>
          {data.totals.filter(t => t.costPerKmElec && t.costPerKmFuel).map(t => {
            const savings = t.costPerKmFuel - t.costPerKmElec;
            const savingsPct = t.costPerKmFuel > 0 ? Math.round((savings / t.costPerKmFuel) * 100) : 0;
            return (
              <div key={t.vehicle} className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {savings > 0
                    ? `⚡ Em modo elétrico poupas ${savings.toFixed(3)} €/km (${savingsPct}% mais barato que a gasolina)`
                    : `⛽ Gasolina é mais económica neste período`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Monthly bar chart */}
      {data.monthly.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Custo Mensal: Elétrico vs Gasolina (€)</h3>
          <ChartWrapper height={240}>
            {(w, h) => (
              <BarChart data={data.monthly} width={w} height={h} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => [`${v.toFixed(2)} €`, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="elecCost" name="Elétrico" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="fuelCost" name="Gasolina" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ChartWrapper>
        </div>
      )}

      {/* Savings chart: monthly electric vs gasoline cost + savings line */}
      <ReportEREVSavings monthly={data.monthly} vehicles={vehicles} />

      {/* Monthly cost/km table */}
      {data.monthly.filter(m => m.costPerKm).length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-3">Custo/km por Mês</h3>
          <div className="space-y-2">
            {data.monthly.filter(m => m.costPerKm).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <span className="text-muted-foreground">{m.monthLabel} <span className="text-xs">({m.vehicle})</span></span>
                <div className="text-right">
                  <span className="font-semibold text-green-600">{m.costPerKm} €/km</span>
                  <span className="text-xs text-muted-foreground ml-2">{m.totalCost.toFixed(2)} € · {m.km > 0 ? m.km.toLocaleString("pt") + " km" : "s/ km"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}