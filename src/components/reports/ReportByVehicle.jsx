import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import ChartWrapper from "./ChartWrapper";

const VEHICLE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function ReportByVehicle({ expenses, vehicles }) {
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const vehicleTotals = {};
  expenses.forEach(e => {
    vehicleTotals[e.vehicle_id] = (vehicleTotals[e.vehicle_id] || 0) + (e.amount || 0);
  });

  const data = Object.entries(vehicleTotals)
    .map(([id, total]) => ({
      name: vehicleMap[id] ? `${vehicleMap[id].brand} ${vehicleMap[id].model}` : "Desconhecido",
      total: Math.round(total * 100) / 100
    }))
    .sort((a, b) => b.total - a.total);

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold mb-4">Por Veículo</h3>
        <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-semibold mb-4">Por Veículo</h3>
      <ChartWrapper height={150}>
        {(w, h) => (
          <BarChart data={data} layout="vertical" width={w} height={h}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v) => [`€${v.toFixed(2)}`, "Total"]} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
            <Bar dataKey="total" radius={[0, 6, 6, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={VEHICLE_COLORS[index % VEHICLE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartWrapper>
    </div>
  );
}