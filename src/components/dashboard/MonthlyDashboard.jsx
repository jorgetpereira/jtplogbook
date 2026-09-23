import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { Fuel, Wrench, Gauge, TrendingDown } from "lucide-react";

export default function MonthlyDashboard({ expenses, vehicles }) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // This month's expenses
  const monthExpenses = expenses.filter(e => (e.date || "").slice(0, 7) === ym);
  const fuelTotal = monthExpenses.filter(e => e.category === "Combustível").reduce((s, e) => s + (e.amount || 0), 0);
  const maintTotal = monthExpenses.filter(e => e.category === "Manutenção").reduce((s, e) => s + (e.amount || 0), 0);
  const monthTotal = fuelTotal + maintTotal;

  // Average consumption (latest fill-to-fill per vehicle)
  const liquidCons = [];
  const elecCons = [];

  vehicles.forEach(v => {
    const entries = expenses
      .filter(e => e.vehicle_id === v.id && e.category === "Combustível" && e.liters && e.mileage_at_expense)
      .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

    const liquid = entries.filter(e => e.sub_category !== "Eletricidade");
    let prev = null;
    let lastLiquid = null;
    liquid.forEach(e => {
      if (prev !== null && e.mileage_at_expense > prev) {
        lastLiquid = +((e.liters / (e.mileage_at_expense - prev)) * 100).toFixed(1);
      }
      prev = e.mileage_at_expense;
    });
    if (lastLiquid !== null) liquidCons.push(lastLiquid);

    const elec = entries.filter(e => e.sub_category === "Eletricidade");
    prev = null;
    let lastElec = null;
    elec.forEach(e => {
      if (prev !== null && e.mileage_at_expense > prev) {
        lastElec = +((e.liters / (e.mileage_at_expense - prev)) * 100).toFixed(1);
      }
      prev = e.mileage_at_expense;
    });
    if (lastElec !== null) elecCons.push(lastElec);
  });

  const avgLiquid = liquidCons.length > 0
    ? (liquidCons.reduce((s, c) => s + c, 0) / liquidCons.length).toFixed(1)
    : null;
  const avgElec = elecCons.length > 0
    ? (elecCons.reduce((s, c) => s + c, 0) / elecCons.length).toFixed(1)
    : null;

  // 6-month trend
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const mExpenses = expenses.filter(e => {
      const d = new Date(e.date + "T12:00:00");
      return d >= start && d <= end;
    });
    months.push({
      name: format(date, "MMM", { locale: pt }),
      Combustível: +mExpenses.filter(e => e.category === "Combustível").reduce((s, e) => s + (e.amount || 0), 0).toFixed(0),
      Manutenção: +mExpenses.filter(e => e.category === "Manutenção").reduce((s, e) => s + (e.amount || 0), 0).toFixed(0),
    });
  }

  const monthName = format(now, "MMMM yyyy", { locale: pt });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const fuelPct = monthTotal > 0 ? (fuelTotal / monthTotal) * 100 : 0;
  const maintPct = monthTotal > 0 ? (maintTotal / monthTotal) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-4 border-b border-border">
        <h3 className="font-bold text-base flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-primary" />
          Dashboard Mensal
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{monthLabel}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Total + category breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-900">
            <div className="flex items-center gap-1.5 mb-1">
              <Fuel className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-medium text-muted-foreground">Combustível</span>
            </div>
            <p className="font-bold text-lg text-blue-600 dark:text-blue-400">€{fuelTotal.toFixed(0)}</p>
            {monthTotal > 0 && (
              <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">{fuelPct.toFixed(0)}% do total</p>
            )}
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 border border-orange-100 dark:border-orange-900">
            <div className="flex items-center gap-1.5 mb-1">
              <Wrench className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[11px] font-medium text-muted-foreground">Manutenção</span>
            </div>
            <p className="font-bold text-lg text-orange-600 dark:text-orange-400">€{maintTotal.toFixed(0)}</p>
            {monthTotal > 0 && (
              <p className="text-[11px] text-orange-500 dark:text-orange-400 mt-0.5">{maintPct.toFixed(0)}% do total</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {monthTotal > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Total mensal: €{monthTotal.toFixed(0)}</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              <div className="bg-blue-500 transition-all" style={{ width: `${fuelPct}%` }} />
              <div className="bg-orange-500 transition-all" style={{ width: `${maintPct}%` }} />
            </div>
          </div>
        )}

        {/* Average consumption */}
        {(avgLiquid || avgElec) && (
          <div className="flex items-center gap-3 bg-teal-50 dark:bg-teal-950/30 rounded-xl p-3 border border-teal-100 dark:border-teal-900">
            <Gauge className="w-4 h-4 text-teal-600 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">Consumo médio</p>
              <p className="font-bold text-sm text-teal-700 dark:text-teal-400">
                {avgLiquid && avgElec
                  ? `${avgLiquid} L/100km · ${avgElec} kWh/100km`
                  : avgLiquid
                  ? `${avgLiquid} L/100km`
                  : `${avgElec} kWh/100km`}
              </p>
            </div>
          </div>
        )}

        {/* 6-month chart */}
        <div className="pt-1">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={months} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value) => [`€${value}`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Combustível" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Manutenção" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}