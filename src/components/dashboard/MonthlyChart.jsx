import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";

export default function MonthlyChart({ expenses }) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    months.push({
      name: format(date, "MMM", { locale: pt }),
      Combustível: monthExpenses.filter(e => e.category === "Combustível").reduce((s, e) => s + (e.amount || 0), 0),
      Manutenção: monthExpenses.filter(e => e.category === "Manutenção").reduce((s, e) => s + (e.amount || 0), 0),
    });
  }

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h3 className="font-semibold mb-4">Despesas Mensais</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={months} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
            formatter={(value) => [`€${value.toFixed(2)}`]}
          />
          <Legend />
          <Bar dataKey="Combustível" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Manutenção" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}