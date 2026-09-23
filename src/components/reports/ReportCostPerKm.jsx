import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { TrendingDown } from "lucide-react";
import ChartWrapper from "./ChartWrapper";

export default function ReportCostPerKm({ expenses, vehicles, selectedCategories }) {
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));
  const cats = selectedCategories || { fuel: true, electric: true, maintenance: true, insurance: true, loan: true };

  const filterByCategories = (vExpenses) => {
    return vExpenses.filter(e => {
      const sub = e.sub_category || "";
      if (cats.fuel && (sub.startsWith("Gasóleo") || sub.startsWith("Gasolina") || sub === "GPL")) return true;
      if (cats.electric && sub === "Eletricidade") return true;
      if (cats.maintenance && e.category === "Manutenção") return true;
      if (cats.insurance && e.category === "Seguros") return true;
      if (cats.loan && e.category === "Empréstimos") return true;
      return false;
    });
  };

  const data = useMemo(() => {
    return vehicles.map(v => {
      const vExpenses = expenses.filter(e => e.vehicle_id === v.id);
      const filteredExpenses = filterByCategories(vExpenses);
      const totalCost = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      // Sort by odometer to correctly find min/max km regardless of date
      const fuelEntries = vExpenses
        .filter(e => e.category === "Combustível" && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

      if (fuelEntries.length < 2) return null;
      const kmTravelled = fuelEntries[fuelEntries.length - 1].mileage_at_expense - fuelEntries[0].mileage_at_expense;
      if (kmTravelled <= 0) return null;

      const costPerKm = totalCost / kmTravelled;
      const fuelCost = filteredExpenses.filter(e => { const sub = e.sub_category || ""; return sub.startsWith("Gasóleo") || sub.startsWith("Gasolina") || sub === "GPL"; }).reduce((s, e) => s + (e.amount || 0), 0);
      const maintCost = filteredExpenses.filter(e => e.category === "Manutenção").reduce((s, e) => s + (e.amount || 0), 0);
      const insurCost = filteredExpenses.filter(e => e.category === "Seguros").reduce((s, e) => s + (e.amount || 0), 0);
      const loanCost = filteredExpenses.filter(e => e.category === "Empréstimos").reduce((s, e) => s + (e.amount || 0), 0);

      return {
        name: `${v.brand} ${v.model}`,
        plate: v.license_plate,
        custoPorKm: parseFloat(costPerKm.toFixed(3)),
        totalKm: kmTravelled,
        totalCost,
        fuelCost,
        maintCost,
        insurCost,
        loanCost,
      };
    }).filter(Boolean);
  }, [expenses, vehicles, cats.fuel, cats.electric, cats.maintenance, cats.insurance, cats.loan]);

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">Dados insuficientes para calcular custo por km.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold mb-1 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-primary" />
          Custo por Quilómetro
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Custo por km rodado · {[
            cats.fuel && "combustível",
            cats.electric && "eletricidade",
            cats.maintenance && "manutenção",
            cats.insurance && "seguros",
            cats.loan && "empréstimos",
          ].filter(Boolean).join(" + ") || "nenhuma categoria"}
        </p>
        <ChartWrapper height={200}>
          {(w, h) => (
            <BarChart data={data} layout="vertical" width={w} height={h}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={v => [`€${v}/km`, "Custo por km"]} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              <Bar dataKey="custoPorKm" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          )}
        </ChartWrapper>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {data.map(d => (
          <div key={d.plate} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.plate}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">€{d.custoPorKm}</p>
                <p className="text-xs text-muted-foreground">por km</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-xl p-2">
                <p className="text-sm font-semibold">{d.totalKm.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">km registados</p>
              </div>
              <div className="bg-muted rounded-xl p-2">
                <p className="text-sm font-semibold text-amber-600">€{d.fuelCost.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">combustível</p>
              </div>
              <div className="bg-muted rounded-xl p-2">
                <p className="text-sm font-semibold text-blue-600">€{d.maintCost.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">manutenção</p>
              </div>
              {cats.insurance && (
                <div className="bg-muted rounded-xl p-2">
                  <p className="text-sm font-semibold text-indigo-600">€{d.insurCost.toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">seguros</p>
                </div>
              )}
              {cats.loan && (
                <div className="bg-muted rounded-xl p-2">
                  <p className="text-sm font-semibold text-pink-600">€{d.loanCost.toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">empréstimos</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}