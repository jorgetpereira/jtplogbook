import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import ChartWrapper from "./ChartWrapper";

export default function ReportYearComparison({ expenses }) {
  const years = {};
  expenses.forEach(e => {
    if (!e.date) return;
    const year = e.date.slice(0, 4);
    const month = parseInt(e.date.slice(5, 7));
    if (!years[year]) years[year] = Array(12).fill(0);
    years[year][month - 1] += e.amount || 0;
  });

  const sortedYears = Object.keys(years).sort();
  if (sortedYears.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold mb-4">Comparativo Anual</h3>
        <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
      </div>
    );
  }

  const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const COLORS = ["hsl(var(--chart-1))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))"];

  const data = monthNames.map((name, i) => {
    const entry = { name };
    sortedYears.forEach(year => {
      entry[year] = Math.round((years[year][i] || 0) * 100) / 100;
    });
    return entry;
  });

  const yearTotals = sortedYears.map(year => ({
    year,
    total: expenses.filter(e => e.date?.startsWith(year)).reduce((s, e) => s + (e.amount || 0), 0)
  }));

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <h3 className="font-semibold">Comparativo Anual</h3>

      <div className="flex gap-4 flex-wrap">
        {yearTotals.map(({ year, total }, i) => (
          <div key={year} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="font-medium">{year}:</span>
            <span className="text-muted-foreground">€{total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <ChartWrapper height={300}>
        {(w, h) => (
          <BarChart data={data} width={w} height={h}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
            <Legend />
            {sortedYears.map((year, i) => (
              <Bar key={year} dataKey={year} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} />
            ))}
          </BarChart>
        )}
      </ChartWrapper>
    </div>
  );
}