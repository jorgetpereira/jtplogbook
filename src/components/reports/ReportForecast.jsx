import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import ChartWrapper from "./ChartWrapper";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { TrendingUp } from "lucide-react";

export default function ReportForecast({ expenses }) {
  const { chartData, avgMonthly, forecastNext } = useMemo(() => {
    const now = new Date();
    // Last 12 months
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i);
      return {
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM yy", { locale: pt }),
        start: startOfMonth(d),
        end: endOfMonth(d),
        isFuture: false,
      };
    });

    const monthTotals = months.map(m => {
      const total = expenses
        .filter(e => e.date >= format(m.start, "yyyy-MM-dd") && e.date <= format(m.end, "yyyy-MM-dd"))
        .reduce((s, e) => s + (e.amount || 0), 0);
      const fuel = expenses
        .filter(e => e.category === "Combustível" && e.date >= format(m.start, "yyyy-MM-dd") && e.date <= format(m.end, "yyyy-MM-dd"))
        .reduce((s, e) => s + (e.amount || 0), 0);
      const maint = expenses
        .filter(e => e.category === "Manutenção" && e.date >= format(m.start, "yyyy-MM-dd") && e.date <= format(m.end, "yyyy-MM-dd"))
        .reduce((s, e) => s + (e.amount || 0), 0);
      return { ...m, total: parseFloat(total.toFixed(2)), fuel: parseFloat(fuel.toFixed(2)), maint: parseFloat(maint.toFixed(2)) };
    });

    // Average of last 6 months with data
    const withData = monthTotals.filter(m => m.total > 0).slice(-6);
    const avg = withData.length > 0 ? withData.reduce((s, m) => s + m.total, 0) / withData.length : 0;

    // Next 3 months forecast
    const forecast = Array.from({ length: 3 }, (_, i) => {
      const d = subMonths(now, -1 - i);
      return {
        label: format(d, "MMM yy", { locale: pt }),
        total: parseFloat(avg.toFixed(2)),
        fuel: 0,
        maint: 0,
        isForecast: true,
      };
    });

    return {
      chartData: [...monthTotals.map(m => ({ ...m, isForecast: false })), ...forecast],
      avgMonthly: avg,
      forecastNext: avg * 3,
    };
  }, [expenses]);

  const CustomBar = (props) => {
    const { x, y, width, height, isForecast } = props;
    return (
      <rect
        x={x} y={y} width={width} height={height}
        fill={isForecast ? "hsl(var(--chart-3))" : "hsl(var(--primary))"}
        opacity={isForecast ? 0.5 : 1}
        rx={4}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">€{avgMonthly.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Média mensal (últ. 6 meses)</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">€{forecastNext.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Previsão próximos 3 meses</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-semibold mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Histórico + Previsão
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Barras a laranja = previsão estimada com base nos últimos 6 meses
        </p>
        <ChartWrapper height={260}>
          {(w, h) => (
            <BarChart data={chartData} width={w} height={h}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${v}`} />
              <Tooltip
                formatter={(v, name, props) => [`€${v}`, props.payload.isForecast ? "Previsão" : "Real"]}
                contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <ReferenceLine y={avgMonthly} stroke="hsl(var(--chart-3))" strokeDasharray="6 3" label={{ value: "Média", position: "right", fontSize: 10 }} />
              <Bar dataKey="total" shape={<CustomBar />} />
            </BarChart>
          )}
        </ChartWrapper>
      </div>
    </div>
  );
}