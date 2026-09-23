import { useMemo } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Fuel, Zap } from "lucide-react";

const GREEN = "text-emerald-600 bg-emerald-50";
const AMBER = "text-amber-600 bg-amber-50";
const RED = "text-red-600 bg-red-50";

function diffColor(calc, carAvg) {
  if (!calc || !carAvg) return "text-muted-foreground bg-muted";
  const d = calc - carAvg;
  if (d <= 0) return GREEN;
  if (d <= carAvg * 0.1) return AMBER;
  return RED;
}

export default function ReportFuelHistoryTable({ expenses, vehicles }) {
  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  // Replicate Dashboard consumption logic: fill-to-fill for cheios, accumulated for parciais
  const rows = useMemo(() => {
    const fuelExpenses = expenses
      .filter(e => e.category === "Combustível" && e.liters && e.mileage_at_expense)
      .sort((a, b) => new Date(b.date) - new Date(a.date) || b.mileage_at_expense - a.mileage_at_expense);

    // Group by vehicle
    const byVehicle = {};
    fuelExpenses.forEach(e => {
      if (!byVehicle[e.vehicle_id]) byVehicle[e.vehicle_id] = [];
      byVehicle[e.vehicle_id].push(e);
    });

    const consumptionMap = {};
    const kmSinceLastMap = {};

    Object.entries(byVehicle).forEach(([vid, entries]) => {
      const vehicle = vehicleMap[vid];
      const isElectric = vehicle?.fuel_type === "Elétrico";
      const isHybrid = vehicle?.fuel_type === "Híbrido" || vehicle?.fuel_type === "Híbrido EREV";

      // Sort ascending by odometer for calculation
      const sorted = [...entries].sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

      if (isElectric || isHybrid) {
        // Electric / hybrid: simple fill-to-fill per fuel type
        const byFuelType = {};
        sorted.forEach(e => {
          const key = e.sub_category;
          if (!byFuelType[key]) byFuelType[key] = [];
          byFuelType[key].push(e);
        });
        Object.entries(byFuelType).forEach(([fuelType, fuelEntries]) => {
          let prevKm = null;
          fuelEntries.forEach(e => {
            if (prevKm !== null && e.mileage_at_expense > prevKm) {
              const km = e.mileage_at_expense - prevKm;
              consumptionMap[e.id] = parseFloat(((e.liters / km) * 100).toFixed(1));
              kmSinceLastMap[e.id] = km;
            }
            prevKm = e.mileage_at_expense;
          });
        });
      } else {
        // Fossil: cheios = fill-to-fill; parciais = accumulated between cheios
        let prevKm = null;
        // First pass: cheios
        sorted.forEach(entry => {
          const km = entry.mileage_at_expense;
          const isCheio = entry.full_tank === true || entry.tank_percentage === 100;
          if (isCheio && prevKm !== null && km > prevKm) {
            const totalKm = km - prevKm;
            consumptionMap[entry.id] = parseFloat(((entry.liters / totalKm) * 100).toFixed(1));
            kmSinceLastMap[entry.id] = totalKm;
          }
          prevKm = km;
        });

        // Second pass: parciais accumulated between cheios
        let lastCheioKm = null;
        let lastCheioIdx = -1;
        for (let i = 0; i < sorted.length; i++) {
          const entry = sorted[i];
          const isCheio = entry.full_tank === true || entry.tank_percentage === 100;
          if (isCheio) {
            if (lastCheioIdx >= 0 && lastCheioKm !== null) {
              const parciais = sorted.slice(lastCheioIdx + 1, i).filter(e => e.mileage_at_expense && e.liters);
              if (parciais.length > 0) {
                const kmTotal = entry.mileage_at_expense - lastCheioKm;
                const litrosTotal = parciais.reduce((s, p) => s + Number(p.liters), 0) + Number(entry.liters);
                if (kmTotal > 0 && litrosTotal > 0) {
                  const value = parseFloat(((litrosTotal / kmTotal) * 100).toFixed(1));
                  parciais.forEach(p => {
                    consumptionMap[p.id] = value;
                    kmSinceLastMap[p.id] = kmTotal;
                  });
                }
              }
            }
            lastCheioKm = entry.mileage_at_expense;
            lastCheioIdx = i;
          }
        }
      }
    });

    return fuelExpenses.map(e => {
      const vehicle = vehicleMap[e.vehicle_id];
      const isElectric = e.sub_category === "Eletricidade";
      const calc = consumptionMap[e.id];
      const carAvg = e.car_avg_consumption;
      const delta = calc && carAvg ? parseFloat((calc - carAvg).toFixed(1)) : null;
      return {
        id: e.id,
        date: e.date,
        vehicle,
        sub_category: e.sub_category,
        liters: e.liters,
        odometer: e.mileage_at_expense,
        kmSinceLast: kmSinceLastMap[e.id],
        isElectric,
        calc,
        carAvg,
        delta,
        isPartial: e.full_tank === false && e.tank_percentage !== 100,
      };
    });
  }, [expenses, vehicleMap]);

  if (rows.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Fuel className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Sem dados de abastecimentos</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Fuel className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Histórico de Abastecimentos</h3>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} registos</span>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Data</th>
              <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Veículo</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Litros</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Km</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Km Perc.</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Média Calc.</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Média Carro</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => {
              const unit = r.isElectric ? "kWh" : "L";
              const consUnit = r.isElectric ? "kWh/100km" : "L/100km";
              return (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(r.date + "T12:00:00"), "dd MMM yy", { locale: pt })}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {r.isElectric
                        ? <Zap className="w-3 h-3 text-blue-500 shrink-0" />
                        : <Fuel className="w-3 h-3 text-orange-500 shrink-0" />}
                      <span className="font-mono text-[11px] font-bold tracking-wider">
                        {r.vehicle?.license_plate || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {Number(r.liters).toFixed(1)} <span className="text-[10px] text-muted-foreground">{unit}</span>
                    {r.isPartial && (
                      <span className="ml-1 text-[9px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded-full font-medium">P</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-xs">
                    {r.odometer.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                    {r.kmSinceLast ? `+${r.kmSinceLast.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {r.calc != null ? (
                      <span className="font-semibold">
                        {r.calc} <span className="text-[10px] text-muted-foreground font-normal">{consUnit}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {r.carAvg != null ? (
                      <span>
                        {r.carAvg} <span className="text-[10px] text-muted-foreground">{consUnit}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {r.delta != null ? (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${diffColor(r.calc, r.carAvg)}`}>
                        {r.delta > 0 ? "+" : ""}{r.delta}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ≤ média carro</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> até +10%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> &gt; +10%</span>
        <span className="ml-auto">P = abastecimento parcial</span>
      </div>
    </div>
  );
}