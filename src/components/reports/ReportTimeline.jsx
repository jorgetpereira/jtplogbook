import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartWrapper from "./ChartWrapper";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";

export default function ReportTimeline({ expenses }) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const total = expenses
      .filter(e => { const d = new Date(e.date); return d >= start && d <= end; })
      .reduce((s, e) => s + (e.amount || 0), 0);
    months.push({
      name: format(date, "MMM yy", { locale: pt }),
      total: Math.round(total * 100) / 100
    });
  }

  const filteredMonths = months.filter(m => m.total > 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-semibold mb-4">Evolução Mensal (12 meses)</h3>
      <ChartWrapper height={300}>
        {(w, h) => (
          <AreaChart data={filteredMonths} width={w} height={h}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" maxTickGap={50} />
            <Tooltip formatter={(v) => [`€${v.toFixed(2)}`, "Total"]} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
            <Area type="monotone" dataKey="total" stroke="hsl(217, 91%, 50%)" fill="url(#colorTotal)" strokeWidth={2} />
          </AreaChart>
        )}
      </ChartWrapper>
    </div>
  );
}