import { useMemo } from "react";
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { PiggyBank, Zap, Fuel } from "lucide-react";
import ChartWrapper from "./ChartWrapper";

export default function ReportEREVSavings({ monthly, vehicles }) {
  const chartData = useMemo(() => {
    if (!monthly.length) return [];

    // Preço médio da gasolina (€/L) a partir das despesas reais do EREV
    const totalFuelCost = monthly.reduce((s, m) => s + m.fuelCost, 0);
    const totalFuelLiters = monthly.reduce((s, m) => s + m.fuelLiters, 0);
    const avgFuelPricePerLiter = totalFuelLiters > 0 ? totalFuelCost / totalFuelLiters : 1.6;

    // Consumo médio elétrico (kWh/100km) dos veículos EREV
    const erevVehicles = vehicles.filter(v => v.fuel_type === "Híbrido EREV");
    const avgElecConsumption = erevVehicles.length > 0
      ? erevVehicles.reduce((s, v) => s + (v.advertised_consumption_electric || v.advertised_consumption || 15), 0) / erevVehicles.length
      : 15;
    const avgFuelConsumption = 6; // L/100km conservador para EREV em modo gasolina

    return monthly.map(m => {
      // km elétricos estimados no mês
      const elecKm = m.elecKwh > 0 ? (m.elecKwh / avgElecConsumption) * 100 : 0;
      // Custo se esses km fossem feitos a gasolina
      const gasolineCostForElecKm = +(elecKm / 100 * avgFuelConsumption * avgFuelPricePerLiter).toFixed(2);
      // Custo real elétrico
      const realElecCost = +m.elecCost.toFixed(2);
      // Poupança = custo equivalente a gasolina - custo real elétrico
      const savings = +(gasolineCostForElecKm - realElecCost).toFixed(2);

      return {
        monthLabel: m.monthLabel,
        "Custo a gasolina": gasolineCostForElecKm,
        "Custo elétrico real": realElecCost,
        "Poupança": Math.max(0, savings),
      };
    });
  }, [monthly, vehicles]);

  const totalSavings = chartData.reduce((s, m) => s + m["Poupança"], 0);
  const totalGasolineEquiv = chartData.reduce((s, m) => s + m["Custo a gasolina"], 0);
  const savingsPct = totalGasolineEquiv > 0 ? Math.round((totalSavings / totalGasolineEquiv) * 100) : 0;

  if (chartData.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank className="w-4 h-4 text-green-500" />
        <h3 className="font-semibold text-sm">Poupança Mensal: Carregar vs Abastecer</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Para os km feitos em modo elétrico, compara o custo real da eletricidade com o que custaria a gasolina. A área verde é a poupança.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-2.5 text-center border border-orange-200 dark:border-orange-800">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Fuel className="w-3 h-3 text-orange-500" /> A gasolina</p>
          <p className="text-sm font-bold text-orange-600">{totalGasolineEquiv.toFixed(0)} €</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2.5 text-center border border-blue-200 dark:border-blue-800">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Zap className="w-3 h-3 text-blue-500" /> Elétrico real</p>
          <p className="text-sm font-bold text-blue-600">{(totalGasolineEquiv - totalSavings).toFixed(0)} €</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-2.5 text-center border border-green-200 dark:border-green-800">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><PiggyBank className="w-3 h-3 text-green-500" /> Poupança</p>
          <p className="text-sm font-bold text-green-600">{totalSavings.toFixed(0)} €</p>
        </div>
      </div>

      <ChartWrapper height={260}>
        {(w, h) => (
          <ComposedChart data={chartData} width={w} height={h} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" €" />
            <Tooltip
              formatter={(v, name) => [`${v.toFixed(2)} €`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Custo a gasolina" fill="#f97316" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar dataKey="Custo elétrico real" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
            <Area type="monotone" dataKey="Poupança" stroke="#22c55e" fill="#22c55e" fillOpacity={0.25} strokeWidth={2} />
          </ComposedChart>
        )}
      </ChartWrapper>

      <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm flex items-center gap-2">
        <PiggyBank className="w-5 h-5 text-green-500 shrink-0" />
        <span className="font-medium text-green-700 dark:text-green-300">
          {totalSavings > 0
            ? `Poupaste ${totalSavings.toFixed(2)} € (${savingsPct}% mais barato) ao carregar em vez de abastecer.`
            : "Sem poupança significativa neste período."}
        </span>
      </div>
    </div>
  );
}