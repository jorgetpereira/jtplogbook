import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Fuel } from "lucide-react";
import ChartWrapper from "./ChartWrapper";

export default function ReportFuelCostComparison({ expenses, vehicles }) {
  const data = useMemo(() => {
    return vehicles.map(v => {
      const vExpenses = expenses.filter(e => e.vehicle_id === v.id);
      // Only fuel + electricity for fair comparison
      const fuelExpenses = vExpenses.filter(e => {
        const sub = e.sub_category || "";
        return sub.startsWith("Gasóleo") || sub.startsWith("Gasolina") || sub === "GPL";
      });
      const elecExpenses = vExpenses.filter(e => (e.sub_category || "") === "Eletricidade");

      const fuelCost = fuelExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const elecCost = elecExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalCost = fuelCost + elecCost;

      // km travelled based on fuel entries with odometer
      const fuelEntries = vExpenses
        .filter(e => e.category === "Combustível" && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

      if (fuelEntries.length < 2) return null;
      const kmTravelled = fuelEntries[fuelEntries.length - 1].mileage_at_expense - fuelEntries[0].mileage_at_expense;
      if (kmTravelled <= 0) return null;

      const costPerKm = totalCost / kmTravelled;

      return {
        name: `${v.brand} ${v.model}`,
        plate: v.license_plate,
        fuelType: v.fuel_type,
        custoPorKm: parseFloat(costPerKm.toFixed(3)),
        combustivel: parseFloat(fuelCost.toFixed(0)),
        eletricidade: parseFloat(elecCost.toFixed(0)),
        totalKm: kmTravelled,
      };
    }).filter(Boolean);
  }, [expenses, vehicles]);

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">Dados insuficientes para comparação.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-semibold mb-1 flex items-center gap-2">
        <Fuel className="w-4 h-4 text-primary" />
        Comparação de Custo Combustível/km
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Só combustível + eletricidade · comparação justa entre veículos
      </p>
      <ChartWrapper height={220}>
        {(w, h) => (
          <BarChart data={data} width={w} height={h}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${v}`} />
            <Tooltip
              formatter={(v, name) => [`€${v}`, name === "custoPorKm" ? "€/km" : name]}
              contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="custoPorKm" name="€/km" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ChartWrapper>

      <div className="grid grid-cols-1 gap-3 mt-4">
        {data.map(d => (
          <div key={d.plate} className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.plate} · {d.fuelType}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">€{d.custoPorKm}</p>
                <p className="text-[10px] text-muted-foreground">por km</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-card rounded-lg p-2">
                <p className="text-sm font-semibold text-amber-600">€{d.combustivel}</p>
                <p className="text-[10px] text-muted-foreground">combustível</p>
              </div>
              <div className="bg-card rounded-lg p-2">
                <p className="text-sm font-semibold text-blue-600">€{d.eletricidade}</p>
                <p className="text-[10px] text-muted-foreground">eletricidade</p>
              </div>
              <div className="bg-card rounded-lg p-2">
                <p className="text-sm font-semibold">{d.totalKm.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">km</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}