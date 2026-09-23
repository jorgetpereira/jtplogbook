import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import ChartWrapper from "./ChartWrapper";

const COLORS = [
  "hsl(217, 91%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(43, 74%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 70%, 50%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 70%, 55%)",
];

export default function ReportByCategory({ expenses }) {
  const subCategories = {};
  expenses.forEach(e => {
    const key = e.sub_category || "Sem categoria";
    subCategories[key] = (subCategories[key] || 0) + (e.amount || 0);
  });

  const data = Object.entries(subCategories)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold mb-4">Por Subcategoria</h3>
        <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-semibold mb-4">Por Subcategoria</h3>
      <ChartWrapper height={300}>
        {(w, h) => (
          <PieChart width={w} height={h}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={45}
              dataKey="value"
              label={({ cx, cy, midAngle, outerRadius, percent }) => {
                const RADIAN = Math.PI / 180;
                const radius = outerRadius + 20;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                return percent > 0.04 ? (
                  <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={500}>
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                ) : null;
              }}
              labelLine={false}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [`€${v.toFixed(2)}`, name]} />
          </PieChart>
        )}
      </ChartWrapper>
      <div className="mt-4 space-y-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span>{item.name}</span>
            </div>
            <span className="font-medium">€{item.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}