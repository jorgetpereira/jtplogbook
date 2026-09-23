import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { TrendingUp } from "lucide-react";

export default function ReportTopExpenses({ expenses, vehicles }) {
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const sorted = [...expenses]
    .filter(e => e.amount)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Group by sub_category
  const byCat = {};
  expenses.forEach(e => {
    const cat = e.sub_category || e.category;
    if (!byCat[cat]) byCat[cat] = 0;
    byCat[cat] += e.amount || 0;
  });
  const catData = Object.entries(byCat)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* By category summary */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold mb-4">Despesa por Tipo</h3>
        <div className="space-y-3">
          {catData.map(({ name, value }) => {
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{name}</span>
                  <span className="font-medium">€{value.toFixed(2)} <span className="text-muted-foreground font-normal">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top expenses list */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Top 15 Maiores Despesas
        </h3>
        <div className="space-y-2">
          {sorted.map((e, i) => {
            const v = vehicleMap[e.vehicle_id];
            return (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{e.sub_category || e.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {v ? `${v.brand} ${v.model}` : "—"} · {format(new Date(e.date + "T12:00:00"), "d MMM yyyy", { locale: pt })}
                  </p>
                </div>
                <span className="font-bold text-sm shrink-0">€{Number(e.amount).toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}