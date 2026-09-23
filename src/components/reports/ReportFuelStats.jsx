import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import ChartWrapper from "./ChartWrapper";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FUEL_COLORS = {
  Gasolina: "#f97316",
  Gasóleo: "#16a34a",
  Eletricidade: "#3b82f6",
  GPL: "#a855f7",
};
const getColor = (type) => {
  if (!type) return "hsl(var(--chart-1))";
  if (type.includes("Gasolina") || type.includes("GPL")) return FUEL_COLORS.Gasolina;
  if (type.includes("Gasóleo") || type.includes("Gasoleo")) return FUEL_COLORS.Gasóleo;
  if (type.includes("Elec") || type.includes("Eletr")) return FUEL_COLORS.Eletricidade;
  return "hsl(var(--chart-1))";
};

export default function ReportFuelStats({ expenses, vehicles }) {
  const [selectedFuel, setSelectedFuel] = useState("all");
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const fuelTypes = [...new Set(expenses
    .filter(e => e.category === "Combustível" && e.sub_category)
    .map(e => e.sub_category))].sort();

  const fuelExpenses = expenses
    .filter(e => e.category === "Combustível" && e.liters && e.mileage_at_expense && (selectedFuel === "all" || e.sub_category === selectedFuel))
    .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense || new Date(a.date) - new Date(b.date));

  // Price data: one column per fuel type, merged by date
  const priceByDate = {};
  fuelExpenses.filter(e => e.price_per_unit).forEach(e => {
    const dateKey = e.date;
    if (!priceByDate[dateKey]) {
      priceByDate[dateKey] = {
        _sort: dateKey,
        date: format(new Date(e.date + "T12:00:00"), "dd MMM yy", { locale: pt }),
      };
    }
    priceByDate[dateKey][e.sub_category] = parseFloat(Number(e.price_per_unit).toFixed(3));
  });
  const priceData = Object.values(priceByDate)
    .sort((a, b) => a._sort.localeCompare(b._sort))
    .map(({ _sort, ...rest }) => rest);

  // Consumption data: one column per fuel type (fill-to-fill per vehicle+fuel)
  const consumptionByDate = {};
  const byVehicleFuel = {};
  fuelExpenses.forEach(e => {
    const key = `${e.vehicle_id}__${e.sub_category}`;
    if (!byVehicleFuel[key]) byVehicleFuel[key] = [];
    byVehicleFuel[key].push(e);
  });

  Object.entries(byVehicleFuel).forEach(([key, entries]) => {
    const fuelType = key.split("__")[1];
    const sorted = [...entries].sort((a, b) => a.mileage_at_expense - b.mileage_at_expense || new Date(a.date) - new Date(b.date));
    let prevKm = null;
    sorted.forEach(e => {
      if (prevKm !== null && e.mileage_at_expense > prevKm) {
        const km = e.mileage_at_expense - prevKm;
        const consumo = parseFloat(((e.liters / km) * 100).toFixed(1));
        const dateKey = e.date;
        if (!consumptionByDate[dateKey]) {
          consumptionByDate[dateKey] = {
            _sort: dateKey,
            date: format(new Date(e.date + "T12:00:00"), "dd MMM yy", { locale: pt }),
          };
        }
        consumptionByDate[dateKey][fuelType] = consumo;
      }
      prevKm = e.mileage_at_expense;
    });
  });
  const consumptionData = Object.values(consumptionByDate)
    .sort((a, b) => a._sort.localeCompare(b._sort))
    .map(({ _sort, ...rest }) => rest);

  // Active fuel types for lines
  const activeFuelTypes = selectedFuel !== "all"
    ? [selectedFuel]
    : fuelTypes.filter(type =>
        priceData.some(d => d[type] != null) || consumptionData.some(d => d[type] != null)
      );

  const totalLiters = fuelExpenses.reduce((s, e) => s + (e.liters || 0), 0);
  const totalFuelCost = fuelExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const avgPrice = fuelExpenses.filter(e => e.price_per_unit).reduce((s, e) => s + e.price_per_unit, 0) / (fuelExpenses.filter(e => e.price_per_unit).length || 1);

  return (
    <div className="space-y-6">
      {/* Fuel type selector */}
      <Select value={selectedFuel} onValueChange={setSelectedFuel}>
        <SelectTrigger className="w-60 rounded-xl">
          <SelectValue placeholder="Todos os combustíveis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os combustíveis</SelectItem>
          {fuelTypes.map(type => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalLiters.toFixed(0)}L</p>
          <p className="text-xs text-muted-foreground mt-1">Total Abastecido</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">€{totalFuelCost.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Combustível</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">€{avgPrice.toFixed(3)}</p>
          <p className="text-xs text-muted-foreground mt-1">Preço Médio/L</p>
        </div>
      </div>

      {/* Price trend — one line per fuel type */}
      {priceData.length > 1 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-semibold mb-4">Evolução do Preço por Litro</h3>
          <ChartWrapper height={240}>
            {(w, h) => (
              <LineChart data={priceData} width={w} height={h}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={['auto', 'auto']} unit=" €" />
                <Tooltip
                  formatter={(v, name) => [`€${v}`, name]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeFuelTypes.map(type => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={getColor(type)}
                    strokeWidth={2}
                    dot={{ r: 3, fill: getColor(type) }}
                    connectNulls
                  />
                ))}
              </LineChart>
            )}
          </ChartWrapper>
        </div>
      )}

      {/* Consumption trend — one line per fuel type */}
      {consumptionData.length > 1 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-semibold mb-4">Evolução do Consumo (L/100km)</h3>
          <ChartWrapper height={240}>
            {(w, h) => (
              <LineChart data={consumptionData} width={w} height={h}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={['auto', 'auto']} unit=" L" />
                <Tooltip
                  formatter={(v, name) => [`${v} L/100km`, name]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeFuelTypes.map(type => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={getColor(type)}
                    strokeWidth={2}
                    dot={{ r: 3, fill: getColor(type) }}
                    connectNulls
                  />
                ))}
              </LineChart>
            )}
          </ChartWrapper>
        </div>
      )}

      {fuelExpenses.length === 0 && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">Sem dados de combustível</p>
        </div>
      )}
    </div>
  );
}