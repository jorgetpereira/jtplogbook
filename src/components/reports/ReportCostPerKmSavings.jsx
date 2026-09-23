import { useMemo } from "react";
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { PiggyBank, Zap, Fuel } from "lucide-react";
import ChartWrapper from "./ChartWrapper";

export default function ReportCostPerKmSavings({ expenses, chargings, vehicles }) {
  const chartData = useMemo(() => {
    if (!expenses.length && !chargings.length) return [];

    // Veículos elétricos (puros ou EREV em modo elétrico)
    const electricVehicles = vehicles.filter(v => v.fuel_type === "Elétrico" || v.fuel_type === "Híbrido EREV");
    // Veículos a combustão (para referência de preço/consumo)
    const combustionVehicles = vehicles.filter(v => ["Gasóleo", "Gasolina", "GPL", "Híbrido"].includes(v.fuel_type));

    if (!electricVehicles.length) return [];

    // Preço médio por tipo de combustível (€/L) a partir das despesas reais
    const isGasolinaSub = (sub) => sub && (sub.includes("Gasolina") || sub === "GPL");
    const isGasoleoSub = (sub) => sub && (sub.includes("Gasóleo") || sub.includes("Gasoleo") || sub === "Biodiesel");

    const gasolinaExpenses = expenses.filter(e => {
      const v = vehicles.find(vv => vv.id === e.vehicle_id);
      return v && (v.fuel_type === "Gasolina" || v.fuel_type === "Híbrido" || v.fuel_type === "GPL") && e.liters > 0 && isGasolinaSub(e.sub_category);
    });
    const gasoleoExpenses = expenses.filter(e => {
      const v = vehicles.find(vv => vv.id === e.vehicle_id);
      return v && v.fuel_type === "Gasóleo" && e.liters > 0 && isGasoleoSub(e.sub_category);
    });

    const gCost = gasolinaExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const gLiters = gasolinaExpenses.reduce((s, e) => s + (e.liters || 0), 0);
    const avgGasolinaPrice = gLiters > 0 ? gCost / gLiters : 1.6;

    const dCost = gasoleoExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const dLiters = gasoleoExpenses.reduce((s, e) => s + (e.liters || 0), 0);
    const avgGasoleoPrice = dLiters > 0 ? dCost / dLiters : 1.5;

    // Consumo médio por tipo (L/100km)
    const gasolinaVehicles = combustionVehicles.filter(v => v.fuel_type === "Gasolina" || v.fuel_type === "Híbrido" || v.fuel_type === "GPL");
    const gasoleoVehicles = combustionVehicles.filter(v => v.fuel_type === "Gasóleo");
    const avgGasolinaConsumption = gasolinaVehicles.length > 0
      ? gasolinaVehicles.reduce((s, v) => s + (v.advertised_consumption || 6), 0) / gasolinaVehicles.length
      : 6;
    const avgGasoleoConsumption = gasoleoVehicles.length > 0
      ? gasoleoVehicles.reduce((s, v) => s + (v.advertised_consumption || 5), 0) / gasoleoVehicles.length
      : 5;

    // Consumo médio elétrico (kWh/100km)
    const avgElecConsumption = electricVehicles.length > 0
      ? electricVehicles.reduce((s, v) => s + (v.advertised_consumption_electric || v.advertised_consumption || 15), 0) / electricVehicles.length
      : 15;

    const monthMap = {};

    // Custos elétricos reais por mês (despesas de eletricidade + carregamentos)
    electricVehicles.forEach(v => {
      const evId = v.id;
      // Despesas de eletricidade
      expenses
        .filter(e => e.vehicle_id === evId && e.sub_category === "Eletricidade")
        .forEach(e => {
          const month = e.date?.slice(0, 7);
          if (!month) return;
          if (!monthMap[month]) monthMap[month] = { month, elecCost: 0, elecKwh: 0 };
          monthMap[month].elecCost += e.amount || 0;
          monthMap[month].elecKwh += e.liters || 0; // liters field guarda kWh em despesas elétricas
        });
      // Carregamentos (fonte principal de kWh elétricos)
      chargings
        .filter(c => c.vehicle_id === evId)
        .forEach(c => {
          const month = c.start_datetime?.slice(0, 7);
          if (!month) return;
          if (!monthMap[month]) monthMap[month] = { month, elecCost: 0, elecKwh: 0 };
          const cost = c.total_cost != null ? c.total_cost : (c.kwh_added && c.price_per_kwh ? +(c.kwh_added * c.price_per_kwh).toFixed(2) : 0);
          monthMap[month].elecCost += cost;
          monthMap[month].elecKwh += c.kwh_added || 0;
        });
    });

    // Custos de combustão reais por mês (para referência no gráfico)
    const combustionMonthly = {};
    combustionVehicles.forEach(v => {
      expenses
        .filter(e => e.vehicle_id === v.id && e.category === "Combustível" && e.sub_category !== "Eletricidade")
        .forEach(e => {
          const month = e.date?.slice(0, 7);
          if (!month) return;
          if (!combustionMonthly[month]) combustionMonthly[month] = 0;
          combustionMonthly[month] += e.amount || 0;
        });
    });

    return Object.keys(monthMap)
      .sort()
      .map(month => {
        const m = monthMap[month];
        // km elétricos estimados no mês
        const elecKm = m.elecKwh > 0 ? (m.elecKwh / avgElecConsumption) * 100 : 0;
        // Custo se esses km fossem feitos a gasolina
        const gasolinaEquiv = +(elecKm / 100 * avgGasolinaConsumption * avgGasolinaPrice).toFixed(2);
        // Custo se esses km fossem feitos a gasóleo
        const gasoleoEquiv = +(elecKm / 100 * avgGasoleoConsumption * avgGasoleoPrice).toFixed(2);
        // Média dos dois para referência de poupança
        const combustionEquiv = +((gasolinaEquiv + gasoleoEquiv) / 2).toFixed(2);
        const realElecCost = +m.elecCost.toFixed(2);
        const savings = +(combustionEquiv - realElecCost).toFixed(2);

        return {
          monthLabel: new Date(month + "-01").toLocaleDateString("pt-PT", { month: "short", year: "2-digit" }),
          "A gasolina": gasolinaEquiv,
          "A gasóleo": gasoleoEquiv,
          "Custo elétrico real": realElecCost,
          "Poupança": Math.max(0, savings),
        };
      });
  }, [expenses, chargings, vehicles]);

  const totalSavings = chartData.reduce((s, m) => s + m["Poupança"], 0);
  const totalGasolina = chartData.reduce((s, m) => s + m["A gasolina"], 0);
  const totalGasoleo = chartData.reduce((s, m) => s + m["A gasóleo"], 0);
  const totalCombustionEquiv = (totalGasolina + totalGasoleo) / 2;
  const totalElecReal = chartData.reduce((s, m) => s + m["Custo elétrico real"], 0);
  const savingsPct = totalCombustionEquiv > 0 ? Math.round((totalSavings / totalCombustionEquiv) * 100) : 0;

  if (chartData.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
        Nenhum veículo elétrico encontrado. Adiciona um veículo do tipo "Elétrico" ou "Híbrido EREV" para ver a poupança.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank className="w-4 h-4 text-green-500" />
        <h3 className="font-semibold text-sm">Poupança Mensal: Elétrico vs Combustão</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Para os km feitos em modo elétrico, compara o custo real da eletricidade com o que custaria num veículo a combustão equivalente. A área verde é a poupança.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-2.5 text-center border border-orange-200 dark:border-orange-800">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Fuel className="w-3 h-3 text-orange-500" /> A gasolina</p>
          <p className="text-sm font-bold text-orange-600">{totalGasolina.toFixed(0)} €</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-2.5 text-center border border-green-200 dark:border-green-800">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Fuel className="w-3 h-3 text-green-500" /> A gasóleo</p>
          <p className="text-sm font-bold text-green-600">{totalGasoleo.toFixed(0)} €</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2.5 text-center border border-blue-200 dark:border-blue-800">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Zap className="w-3 h-3 text-blue-500" /> Elétrico real</p>
          <p className="text-sm font-bold text-blue-600">{totalElecReal.toFixed(0)} €</p>
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
            <Bar dataKey="A gasolina" fill="#f97316" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="A gasóleo" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="Custo elétrico real" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} />
            <Area type="monotone" dataKey="Poupança" stroke="#22c55e" fill="#22c55e" fillOpacity={0.25} strokeWidth={2} />
          </ComposedChart>
        )}
      </ChartWrapper>

      <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm flex items-center gap-2">
        <PiggyBank className="w-5 h-5 text-green-500 shrink-0" />
        <span className="font-medium text-green-700 dark:text-green-300">
          {totalSavings > 0
            ? `Poupaste ${totalSavings.toFixed(2)} € (${savingsPct}% mais barato) ao usar modo elétrico em vez de combustão.`
            : "Sem poupança significativa neste período."}
        </span>
      </div>
    </div>
  );
}